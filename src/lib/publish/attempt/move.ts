// SPEC §7 — a retargeted page leaves its old address, once the new version is live at the address its new search names:
//   · every version live at the old address takes `published → unpublished` through `transition()` with its row's
//     `unpublished_at` (ADR-080: never a row edit alone), and no unpublish outcome, as the old address answers 301;
//   · every live page linking the old address is planned a `link` refresh (§7); no live page's text is edited in place.
// A merge is the same move into a page at its own address, and the rows it leaves name it (`merged_into`).
// `repairMoves` runs hourly for a retarget whose move was never written or did not complete. 0¢: rows only.
// It never throws: the page is live at its new address either way, and the log says what was not written.
import { pageName } from "@/lib/generate/links/text";
import { publishDb } from "../db";
import { invalidateHosted } from "../destinations/hosted/cache";
import { liveUrlOnHost } from "../destinations/hosted/address";
import { slugOf } from "../destinations/hosted/moved";
import { livePagesForSite, storedAddressesNow } from "../destinations/hosted/store";
import { transition } from "../machine";
import type { Actor } from "../types";

interface Row {
  id: string;
  site_id: string;
  draft_id: string;
  live_url: string | null;
  published_at: string | null;
  unpublished_at: string | null;
}

const isLive = (row: Row): boolean => row.live_url !== null && row.published_at !== null && (row.unpublished_at ?? null) === null;

export async function moveAddress(a: {
  /** The address the page answered at before, as its update names it. */
  from: string;
  to: { publicationId: string; url: string };
  at: Date;
  /** Who moved it: the actor that published the new version. */
  by: Actor;
  /** The old page went into `to`, a page for its own search, so each row left there names `to` (`merged_into`). */
  merge?: boolean;
}): Promise<void> {
  try {
    const fromSlug = slugOf(a.from);
    const host = hostOf(a.to.url);
    if (fromSlug === null || host === null) return;
    const own = await publishDb()
      .from<Row>("publications")
      .select("id, site_id, draft_id, live_url, published_at, unpublished_at")
      .eq("id", a.to.publicationId)
      .single();
    if (own.error !== null || own.data === null) return;
    const siteId = own.data.site_id;

    const rows = await publishDb()
      .from<Row>("publications")
      .select("id, site_id, draft_id, live_url, published_at, unpublished_at")
      .eq("site_id", siteId)
      .eq("destination", "hosted");
    if (rows.error !== null || rows.data === null) throw new Error(rows.error?.message ?? "no rows");
    const left = rows.data.filter((row) => row.id !== a.to.publicationId && isLive(row) && slugOf(row.live_url ?? "") === fromSlug);
    for (const row of left) {
      const written = await publishDb()
        .from<{ id: string }>("publications")
        .update({ unpublished_at: a.at.toISOString(), ...(a.merge === true ? { merged_into: a.to.publicationId } : {}) })
        .eq("id", row.id);
      // A row that could not be written stays live with its draft: they leave together or not at all.
      if (written.error !== null && written.error !== undefined) {
        console.error(JSON.stringify({ event: "hosted_move_row_refused", publicationId: row.id, message: written.error.message }));
        continue;
      }
      const moved = await transition(row.draft_id, "unpublished", a.by, { at: a.at, reason: "moved" });
      if (!moved.ok) {
        console.error(JSON.stringify({ event: "hosted_move_transition_refused", draftId: row.draft_id, refused: moved.refused, state: moved.state }));
      }
    }

    // The old address as stored and on the current host are one page.
    const pages = await livePagesForSite(siteId, host);
    const moved = pages.find((page) => page.publicationId === a.to.publicationId);
    const title = moved === undefined ? "" : pageName({ url: a.to.url, title: moved.title, h1: moved.heading ?? "" });
    if (title !== "") {
      const { planMovedLinks } = await import("@/lib/opportunities");
      await planMovedLinks({ siteId, from: [a.from, `https://${host}/${fromSlug}`], to: a.to.url, title, at: a.at });
    }
    if (left.length > 0) invalidateHosted({ siteId });
  } catch (error) {
    console.error(JSON.stringify({ event: "hosted_move_failed", from: a.from, to: a.to.url, message: String(error) }));
  }
}

interface RetargetRow extends Row {
  drafts: {
    opportunities: { family: string | null; target_ref: string | null; target_query: string | null; evidence: unknown } | null;
  } | null;
}

/** The repair's actor: it runs inside the hourly publish tick. */
const PUBLISH_TICK: Actor = { kind: "system", job: "publish/execute" };

/** Every live hosted retarget, moved where its move was not written (SPEC §7); idempotent. One still at its old address
 *  is recorded at `liveUrlOnHost` with its new slug, draft and text untouched, unless a newer version is live there or
 *  another page holds the slug. */
export async function repairMoves(a: { now: Date; by?: Actor }): Promise<{ moved: number }> {
  const by = a.by ?? PUBLISH_TICK;
  const { isRetarget } = await import("@/lib/opportunities/types");
  const { slugify } = await import("@/lib/opportunities/derive/candidate");
  const { siteLocale } = await import("@/lib/locale/site");
  const { data, error } = await publishDb()
    .from<RetargetRow>("publications")
    .select("id, site_id, draft_id, live_url, published_at, unpublished_at, drafts(opportunities(family, target_ref, target_query, evidence))")
    .eq("destination", "hosted")
    .not("published_at", "is", null)
    .is("unpublished_at", null);
  if (error !== null || data === null) throw new Error(`move repair: reading publications: ${error?.message ?? "no rows"}`);

  let moved = 0;
  for (const row of data) {
    const opportunity = row.drafts?.opportunities ?? null;
    if (!isLive(row) || opportunity === null || opportunity.target_ref === null) continue;
    if (!isRetarget({ evidence: opportunity.evidence as never })) continue;
    // The new address in the site's language; a page already moved elsewhere is left alone below.
    const to = slugify(opportunity.target_query ?? "", (await siteLocale(row.site_id)).language);
    const from = slugOf(opportunity.target_ref);
    const at = slugOf(row.live_url ?? "");
    if (to === "" || from === null || from === to) continue;

    let url = row.live_url ?? "";
    if (at === from) {
      const site = data.filter((other) => other.site_id === row.site_id && isLive(other));
      const newer = site.some((other) => other.id !== row.id && slugOf(other.live_url ?? "") === from && (other.published_at ?? "") > (row.published_at ?? ""));
      const taken = site.some((other) => slugOf(other.live_url ?? "") === to);
      if (newer || taken) {
        console.error(JSON.stringify({ event: "hosted_move_repair_skipped", publicationId: row.id, because: newer ? "newer_version" : "slug_taken" }));
        continue;
      }
      const host = hostOf((await storedAddressesNow(row.site_id))(url));
      if (host === null) continue;
      url = liveUrlOnHost({ host, slug: to });
      const written = await publishDb()
        .from<{ id: string }>("publications")
        .update({ live_url: url })
        .eq("id", row.id)
        .eq("live_url", row.live_url ?? "");
      if (written.error !== null) continue;
      invalidateHosted({ siteId: row.site_id, publicationId: row.id });
      moved += 1;
    } else if (at !== to) {
      continue;
    }
    await moveAddress({ from: opportunity.target_ref, to: { publicationId: row.id, url }, at: a.now, by });
  }
  console.log(JSON.stringify({ event: "hosted_move_repair", moved }));
  return { moved };
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
