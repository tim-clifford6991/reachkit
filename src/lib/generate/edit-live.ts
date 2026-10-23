// SPEC §7 (owner R19, 2026-10-22) — the customer's edit of a live page,
// saved as a new version at the same address.
//
// A live row is never edited (ADR-080). The first save whose words differ
// from the live version writes a new `drafts` row for a `refresh_page` at
// the page's own address and for its own search: what every refresh is. The
// row starts as a copy of the live text, is held in `needs_attention`, takes
// the customer's words through the editor's own writer (`./edit`, the same
// battery and claim check), and a save that passes enters review on a fresh
// window as a stopped page the customer fixed does. Every move goes through
// `transition()`; the live version stays live until the new one publishes
// over it. No model is asked and nothing is bought: 0¢.
//
// One version of an address waits at a time. A version already written and
// not yet out refuses the save with its id; a refresh only planned gives
// way to the customer's words.
import type { Actor, State } from "@/lib/publish/types";
import { DRAFT_EDIT_MAX_CHARS, saveDraftEdit } from "./edit";
import { generateStore } from "./store";

export interface LiveEdit {
  siteId: string;
  userId: string;
  /** The version the address serves now. */
  liveDraftId: string;
  title: string;
  bodyMd: string;
  description: string;
  at?: Date;
}

export type LiveEditOutcome =
  /** The words are the live version's: nothing was written. */
  | { ok: true; changed: false }
  | { ok: true; changed: true; draftId: string; state: "in_review" | "needs_attention"; passed: boolean; told: boolean }
  | { ok: false; refused: "not_editable" | "not_live" | "too_large" }
  /** A version of this address is already written; `draftId` is null when
   *  another save created it a moment ago. */
  | { ok: false; refused: "pending_version"; draftId: string | null };

/** A version in these states is written and not yet out. */
const WAITING: readonly State[] = ["generating", "in_review", "approved", "publishing", "failed", "needs_attention"];

type Meta = Record<string, unknown>;

export async function startLiveEdit(a: LiveEdit): Promise<LiveEditOutcome> {
  const at = a.at ?? new Date();
  const by: Actor = { kind: "customer", userId: a.userId };
  const store = generateStore();
  const live = await store.draftById(a.liveDraftId);
  if (live === null || live.site_id !== a.siteId) return { ok: false, refused: "not_editable" };
  if (live.state !== "published") return { ok: false, refused: "not_live" };
  if (a.bodyMd.length + a.title.length + a.description.length > DRAFT_EDIT_MAX_CHARS) return { ok: false, refused: "too_large" };
  const served = await servedAt(a.siteId, a.liveDraftId);
  if (served === null) return { ok: false, refused: "not_live" };

  const meta: Meta = typeof live.meta === "object" && live.meta !== null ? { ...(live.meta as Meta) } : {};
  const unchanged =
    a.title === (live.title ?? "") &&
    a.bodyMd === (live.body_md ?? "") &&
    a.description === (typeof meta.description === "string" ? meta.description : "");
  if (unchanged) return { ok: true, changed: false };

  const { opportunityStore, readOpportunity } = await import("@/lib/opportunities/store");
  const opportunities = opportunityStore();
  const own = await opportunities.byId(live.opportunity_id);
  if (own === null) return { ok: false, refused: "not_editable" };
  const { storedAddressesNow } = await import("@/lib/publish/destinations/hosted/store");
  const address = (await storedAddressesNow(a.siteId))(served.url);

  const refreshes = await refreshesAt(a.siteId, address);
  const waiting = refreshes.flatMap((refresh) => refresh.drafts).find((draft) => WAITING.includes(draft.state));
  if (waiting !== undefined) return { ok: false, refused: "pending_version", draftId: waiting.id };

  const { transition } = await import("@/lib/publish/machine");
  for (const refresh of refreshes) {
    for (const draft of refresh.drafts) {
      if (draft.state === "planned") await transition(draft.id, "skipped", by, { at, reason: "live_edit" });
    }
    // A refresh whose version is live is finished; any other gives way.
    if (refresh.drafts.some((draft) => draft.state === "published")) await opportunities.markDone(refresh.id);
    else await opportunities.markDismissed(refresh.id);
  }

  const { refreshOfPage } = await import("@/lib/opportunities/refresh");
  const { persist } = await import("@/lib/opportunities/derive/persist");
  const { created } = await persist({
    candidates: [refreshOfPage({ url: address, publishedAt: served.publishedAt, row: readOpportunity(own) }, "edited", at)],
  });
  const opportunity = created[0];
  if (opportunity === undefined) return { ok: false, refused: "pending_version", draftId: null };

  // The live version's dating is its own, and the new words are what move it.
  delete meta.datedAs;
  delete meta.mendOf;
  const draftId = await store.insertDraft({
    site_id: a.siteId,
    opportunity_id: opportunity.id,
    state: "generating",
    title: live.title,
    body_md: live.body_md,
    grounded_fact: live.grounded_fact,
    attribution: live.attribution,
    scheduled_for: null,
    cost_cents: 0,
    meta,
  });
  await transition(draftId, "needs_attention", by, { at, reason: "live_edit" });

  const saved = await saveDraftEdit({ siteId: a.siteId, draftId, title: a.title, bodyMd: a.bodyMd, description: a.description, at });
  const passed = saved.ok && saved.passed;
  if (!passed) return { ok: true, changed: true, draftId, state: "needs_attention", passed, told: false };
  const { enterReview } = await import("@/lib/publish/attempt/window");
  const entry = await enterReview({ draftId, at, by });
  return {
    ok: true,
    changed: true,
    draftId,
    state: entry.kind === "not_entered" ? "needs_attention" : "in_review",
    passed,
    told: entry.kind === "told",
  };
}

/** The address a version is live at now, and when it went live there. */
async function servedAt(siteId: string, draftId: string): Promise<{ url: string; publishedAt: Date } | null> {
  const { publishDb } = await import("@/lib/publish/db");
  const { data, error } = await publishDb()
    .from<{ live_url: string | null; published_at: string | null; unpublished_at: string | null }>("publications")
    .select("live_url, published_at, unpublished_at")
    .eq("site_id", siteId)
    .eq("draft_id", draftId);
  if (error !== null) throw new Error(`edit-live: reading publications: ${error.message}`);
  const row = (data ?? []).find((each) => each.live_url !== null && each.published_at !== null && each.unpublished_at === null);
  return row === undefined ? null : { url: row.live_url!, publishedAt: new Date(row.published_at!) };
}

/** The open or queued refreshes of an address, each with its drafts. */
async function refreshesAt(siteId: string, address: string): Promise<{ id: string; drafts: { id: string; state: State }[] }[]> {
  const { publishDb } = await import("@/lib/publish/db");
  const { urlKey } = await import("./links/select");
  const db = publishDb();
  const opened = await db
    .from<{ id: string; target_ref: string | null }>("opportunities")
    .select("id, target_ref")
    .eq("site_id", siteId)
    .eq("type", "refresh_page")
    .in("status", ["open", "queued"]);
  if (opened.error !== null) throw new Error(`edit-live: reading opportunities: ${opened.error.message}`);
  const key = urlKey(address);
  const ids = (opened.data ?? []).filter((row) => row.target_ref !== null && urlKey(row.target_ref) === key).map((row) => row.id);
  if (ids.length === 0) return [];
  const written = await db.from<{ id: string; state: State; opportunity_id: string }>("drafts").select("id, state, opportunity_id").in("opportunity_id", ids);
  if (written.error !== null) throw new Error(`edit-live: reading drafts: ${written.error.message}`);
  return ids.map((id) => ({ id, drafts: (written.data ?? []).filter((draft) => draft.opportunity_id === id) }));
}
