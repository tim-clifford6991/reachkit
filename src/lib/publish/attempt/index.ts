// BUILD §9 — `publish()`: the delivery after the claim, and the outcome written exactly as it happened.
//  1. The adapter is called after the claim, never inside it: the `publications` row comes first (ADR-080).
//  2. `made_live_by_us` is `result.madeLive` and nothing else, never `servesPublicly`, `hostedByUs`, `liveUrl != null`
//     or `kind === 'hosted'`: what this call did to this page, declared by the adapter (ADR-084 decision 4).
//  3. `verify_due_at` reads the address, never the kind, or WordPress silently leaves the verified population.
//  4. `seo_written` keeps "no answer" (`null`) apart from "no plugin wrote" (`'{}'`, REQ-060 c4), written on this update only.
// Written as it happened, never inferred from the switch: a page that went out mid-pause is delivered, one that did not is failed.
import { PUBLISH_DELIVER_TIMEOUT_MS, PUBLISH_VERIFY_DELAY_H } from "@/lib/config/constants";
import { publishDb } from "../db";
import { adapterFor as defaultAdapterFor, withConfig } from "../destinations";
import { NoConfigError } from "../destinations/config";
import { hostedAddressesNow, storedAddressesNow } from "../destinations/hosted/store";
import type { GuardDeps } from "../machine";
import { transition } from "../machine";
import type {
  Actor,
  DeliveryResult,
  DestinationAdapter,
  DestinationKind,
  FailureReason,
  RenderedPage,
} from "../types";
import { checkPageLinks, type AskAddress } from "../links/live";
import { slugify } from "@/lib/opportunities/derive/candidate";
import { isRetarget, type Evidence } from "@/lib/opportunities/types";
import { claim, type HeldBy } from "./claim";
import type { AnnounceSend } from "../destinations/hosted/announce";

export type { FailureReason } from "../types";

/** The reasons a repeated attempt could clear, the only ones §9's "retry ×3" covers; the rest need the customer, so the
 *  page goes to `needs_attention` at once. Policy, so here, while the union lives in the leaf. */
export const RETRYABLE: readonly FailureReason[] = Object.freeze([
  "network",
  "timeout",
  "destination_unavailable",
  "rate_limited",
] as const);

export function isRetryable(reason: FailureReason): boolean {
  return RETRYABLE.includes(reason);
}

export type PublishResult =
  | { ok: true; publicationId: string; liveUrl?: string; alreadyPublished: boolean }
  | { ok: false; reason: FailureReason; retryable: boolean; attemptNo: number }
  /** `matchedEntry` rides the `claim_recheck` hold only: the customer's own words (BUILD §8 hard rule 4). */
  | { ok: false; reason: "held"; heldBy: HeldBy; matchedEntry?: string };

export interface PublishArgs {
  draftId: string;
  destination: DestinationKind;
  by: Actor;
  at?: Date;
  deps?: GuardDeps;
  /** The adapter registry, injected so a test drives a stub without a destination. */
  adapterFor?: (kind: DestinationKind) => DestinationAdapter | null;
  /** How the change is announced (`../destinations/hosted/announce.ts`), injected for suites; the engine passes none. */
  announce?: AnnounceSend;
  /** How the live check asks an address (`../links/live.ts`), injected for suites; the engine passes none. */
  askAddress?: AskAddress;
}

export async function publish(a: PublishArgs): Promise<PublishResult> {
  const at = a.at ?? new Date();
  const resolve = a.adapterFor ?? defaultAdapterFor;

  const claimed = await claim({
    draftId: a.draftId,
    destination: a.destination,
    by: a.by,
    at,
    ...(a.deps === undefined ? {} : { deps: a.deps }),
  });
  if (!claimed.ok) return claimed;

  // Already delivered, its outcome unrecorded: reconciled to `published`, never sent again, the adapter not called.
  if (claimed.alreadyPublished) {
    const row = await readOutcome(claimed.publicationId);
    await transition(a.draftId, "published", a.by, {
      at,
      ...(a.deps === undefined ? {} : { deps: a.deps }),
      reason: "already_delivered",
    });
    return {
      ok: true,
      publicationId: claimed.publicationId,
      ...(row?.live_url === null || row?.live_url === undefined
        ? {}
        : { liveUrl: (await hostedAddressesNow(row.site_id))({ destination: row.destination, liveUrl: row.live_url }) }),
      alreadyPublished: true,
    };
  }

  const adapter = resolve(a.destination);
  if (adapter === null) {
    return failWith(a, claimed.publicationId, claimed.attemptNo, "no_destination", at);
  }

  const rendered = await renderedPage(a.draftId);
  if (rendered === null) {
    return failWith(a, claimed.publicationId, claimed.attemptNo, "destination_rejected", at);
  }
  // SPEC §7: every link is asked once, and the page that goes out links none that is gone.
  const page = await withLiveLinks(rendered, a.draftId, at, a.askAddress);

  // Everything above has committed. The egress seam bounds each request (BUILD §6.4); `PUBLISH_DELIVER_TIMEOUT_MS` bounds
  // the whole attempt, since several slow requests would otherwise hold a claim open unbounded.
  let result: DeliveryResult;
  try {
    result = await withinDeliveryBound(delivered(adapter, page, claimed.destinationId, a.draftId));
  } catch {
    // A throw says nothing about the destination: retryable `timeout`, and the idempotency key reconciles a landed delivery.
    result = { ok: false, madeLive: false, reason: "timeout" };
  }

  if (!result.ok) {
    const reason = result.reason ?? "destination_unavailable";
    return failWith(a, claimed.publicationId, claimed.attemptNo, reason, at);
  }

  const publishedAt = at;
  const liveUrl = result.liveUrl ?? null;
  await publishDb()
    .from<{ id: string }>("publications")
    .update({
      delivery_state: "delivered",
      published_at: publishedAt.toISOString(),
      live_url: liveUrl,
      remote_id: result.remoteId ?? null,
      failure_reason: null,
      // ADR-084 decision 4: off the `DeliveryResult`, derived from nothing else.
      made_live_by_us: result.madeLive,
      // REQ-060 c4: what the adapter read back, as is. `=== undefined` keeps "no such answer" apart from "written into no
      // plugin"; a falsy test or `?? []` would merge them and misplace c4's line.
      seo_written: result.seoWritten === undefined ? null : [...result.seoWritten],
      // BP-049: the address decides, never the kind.
      verify_due_at:
        liveUrl === null
          ? null
          : new Date(publishedAt.getTime() + PUBLISH_VERIFY_DELAY_H * 3600_000).toISOString(),
    })
    .eq("id", claimed.publicationId);

  // SPEC §7: a moved page leaves its old address, which answers 301, and its linkers are planned an update; only where
  // it did publish elsewhere, since WordPress keeps the post's address.
  if (page.moveTo !== undefined && page.updateOf !== undefined && liveUrl !== null && liveUrl.endsWith(`/${page.moveTo}`)) {
    const { moveAddress } = await import("./move");
    await moveAddress({ from: page.updateOf, to: { publicationId: claimed.publicationId, url: liveUrl }, at, by: a.by });
  }

  await transition(a.draftId, "published", a.by, {
    at,
    ...(a.deps === undefined ? {} : { deps: a.deps }),
    reason: "delivered",
  });

  // SPEC §7: engines are told once which addresses changed, a move's old one with its new; hosted only, never failing delivery.
  if (a.destination === "hosted" && liveUrl !== null) {
    const { announceForDraft } = await import("../destinations/hosted/announce");
    await announceForDraft({ draftId: a.draftId, urls: page.updateOf === undefined ? [liveUrl] : [page.updateOf, liveUrl], ...(a.announce === undefined ? {} : { send: a.announce }) });
  }

  return {
    ok: true,
    publicationId: claimed.publicationId,
    ...(liveUrl === null ? {} : { liveUrl }),
    alreadyPublished: false,
  };
}

/** The page as it goes out: links asked, gone ones removed, and `drafts.meta.linkCheck` written beside the delivered
 *  body, which the hosted page and the draft screen read. Never a reason not to publish. */
async function withLiveLinks(page: RenderedPage, draftId: string, at: Date, ask?: AskAddress): Promise<RenderedPage> {
  if (page.metadataOnly !== undefined || page.bodyMd.trim() === "") return page;
  try {
    const draft = await publishDb().from<{ site_id: string }>("drafts").select("site_id").eq("id", draftId).single();
    const siteId = draft.data?.site_id;
    if (typeof siteId !== "string") return page;
    const site = await publishDb().from<{ domain: string }>("sites").select("domain").eq("id", siteId).single();
    const domain = site.data?.domain;
    if (typeof domain !== "string" || domain === "") return page;

    const checked = await checkPageLinks({ markdown: page.bodyMd, domain, at, ...(ask === undefined ? {} : { ask }) });
    if (checked.record.links.length === 0) return page;
    const meta = { ...page.meta, linkCheck: checked.record };
    const changed = checked.markdown !== page.bodyMd;
    const written = await publishDb()
      .from<{ id: string }>("drafts")
      .update({ meta, ...(changed ? { body_md: checked.markdown } : {}) })
      .eq("id", draftId);
    if (checked.record.removed.length > 0) {
      console.log(
        JSON.stringify({
          event: "publish_links_removed",
          draftId,
          removed: checked.record.removed.map((link) => ({ url: link.url, kind: link.kind })),
        })
      );
    }
    // The body delivered is the body stored: if the row was not written, the page goes as the row has it.
    return written.error === null ? { ...page, bodyMd: checked.markdown, meta } : page;
  } catch {
    return page;
  }
}

/** One outcome write and one edge for every way a delivery did not land; a retry is the policy's question. */
async function failWith(
  a: PublishArgs,
  publicationId: string,
  attemptNo: number,
  reason: FailureReason,
  at: Date
): Promise<PublishResult> {
  await publishDb()
    .from<{ id: string }>("publications")
    .update({
      delivery_state: "failed",
      failure_reason: reason,
    })
    .eq("id", publicationId);

  await transition(a.draftId, "failed", a.by, {
    at,
    ...(a.deps === undefined ? {} : { deps: a.deps }),
    reason,
  });

  return { ok: false, reason, retryable: isRetryable(reason), attemptNo };
}

interface OutcomeRow {
  id: string;
  site_id: string;
  destination: string | null;
  live_url: string | null;
}

async function readOutcome(publicationId: string): Promise<OutcomeRow | null> {
  const { data, error } = await publishDb()
    .from<OutcomeRow>("publications")
    .select("id, site_id, destination, live_url")
    .eq("id", publicationId)
    .single();
  if (error !== null || data === null) return null;
  return data;
}

interface DraftPageRow {
  site_id: string;
  title: string;
  body_md: string | null;
  attribution?: string | null;
  meta: Record<string, unknown> | null;
  sites?: { domain: string | null } | null;
  opportunities?: {
    family?: string | null;
    type?: string | null;
    proposed_slug?: string | null;
    target_ref?: string | null;
    target_query?: string | null;
    evidence?: Evidence | null;
  } | null;
}

/** `drafts.meta.fix`'s new values, read defensively off jsonb. */
function metadataFixOf(meta: Record<string, unknown>): { title: string | null; description: string | null } | null {
  const fix = meta.fix;
  if (typeof fix !== "object" || fix === null) return null;
  const record = fix as Record<string, unknown>;
  const title = typeof record.title === "string" && record.title !== "" ? record.title : null;
  const description =
    typeof record.description === "string" && record.description !== "" ? record.description : null;
  return title === null && description === null ? null : { title, description };
}

/** An existing page's last path segment, how a destination looks it up; `null` for a site root. */
function slugOfUrl(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const segments = pathname.split("/").filter((segment) => segment !== "");
  return segments.length === 0 ? null : (segments[segments.length - 1] ?? null);
}

/** The site's domain and language for the made-with note; unreadable, no note. */
async function siteOf(row: DraftPageRow): Promise<Pick<RenderedPage, "site">> {
  const domain = row.sites?.domain ?? null;
  if (domain === null || domain.trim() === "") return {};
  try {
    const { siteLocale } = await import("@/lib/locale/site");
    return { site: { domain, language: (await siteLocale(row.site_id)).language } };
  } catch {
    return {};
  }
}

/** What the adapter is handed: the page's facts, no rendering and no sentence. A Write target publishes at its proposed
 *  slug, an Improve target changes the page it named (§7); a fix's `target_ref` is a barrier, not a page to rewrite. */
async function renderedPage(draftId: string): Promise<RenderedPage | null> {
  const { data, error } = await publishDb()
    .from<DraftPageRow>("drafts")
    .select("site_id, title, body_md, attribution, meta, sites(domain), opportunities(family, type, proposed_slug, target_ref, target_query, evidence)")
    .eq("id", draftId)
    .single();
  if (error !== null || data === null) return null;

  const opportunity = data.opportunities ?? null;
  const page = {
    title: data.title,
    bodyMd: data.body_md ?? "",
    meta: data.meta ?? {},
    byline: data.attribution ?? null,
    ...(await siteOf(data)),
  };

  // SPEC §9: a `fix_page` updates only the named page's metadata; nothing recorded to change, nothing to deliver.
  if (opportunity?.type === "fix_page") {
    const updateOf = opportunity.target_ref;
    const metadataOnly = metadataFixOf(page.meta);
    if (typeof updateOf !== "string" || updateOf.length === 0 || metadataOnly === null) return null;
    return { ...page, bodyMd: "", slug: slugOfUrl(updateOf) ?? "", updateOf, metadataOnly };
  }

  if (opportunity?.family === "improve") {
    const stored = opportunity.target_ref;
    if (typeof stored !== "string" || stored.length === 0) return null;
    // SPEC §7: updated at the host it answers at now, as the stored address may name a moved host the adapter refuses.
    const updateOf = (await storedAddressesNow(data.site_id))(stored);
    const slug = slugOfUrl(updateOf) ?? "";
    // SPEC §7: a retarget's address says its new search, in the site's language; a refresh keeps its address.
    const moveTo = isRetarget(opportunity) ? slugify(opportunity.target_query ?? "", page.site?.language) : "";
    return { ...page, slug, updateOf, ...(moveTo === "" || moveTo === slug ? {} : { moveTo }) };
  }

  const slug = opportunity?.proposed_slug;
  if (typeof slug !== "string" || slug.length === 0) return null;
  return { ...page, slug };
}

/** The delivery, with the credential plaintext only inside `withConfig`, which returns the callback's value, never the
 *  config. No destination row means an empty config, as hosted gets. */
async function delivered(
  adapter: DestinationAdapter,
  page: RenderedPage,
  destinationId: string,
  idempotencyKey: string
): Promise<DeliveryResult> {
  if (destinationId === "") return adapter.deliver(page, {}, idempotencyKey);
  try {
    return await withConfig(destinationId, (cfg: Record<string, unknown>) =>
      adapter.deliver(page, cfg, idempotencyKey)
    );
  } catch (cause) {
    // No credential is ordinary (hosted has none): the adapter gets an empty config and judges for itself.
    if (cause instanceof NoConfigError) return adapter.deliver(page, {}, idempotencyKey);
    throw cause;
  }
}

/** The delivery, bounded; the caller turns a rejection into retryable `timeout`. The timer is cleared either way. */
function withinDeliveryBound(delivery: Promise<DeliveryResult>): Promise<DeliveryResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("publish: the delivery exceeded PUBLISH_DELIVER_TIMEOUT_MS")),
      PUBLISH_DELIVER_TIMEOUT_MS
    );
  });
  return Promise.race([delivery, bound]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
