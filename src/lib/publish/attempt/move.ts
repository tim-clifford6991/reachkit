// SPEC §7 (2026-10-17, issue 1487) — a retargeted page leaves its old
// address.
//
// The new version is already delivered at the address its new search
// names. This writes the rest of the move:
//
//   · every version still live at the old address takes `published →
//     unpublished` through `transition()`, its row's `unpublished_at` with
//     it, as `unpublish()` pairs the two (ADR-080: the live set is never
//     changed by a row edit alone). No unpublish outcome is recorded: the
//     page was not taken down, and the old address answers 301 to the new
//     one, read by `addressOf` from the update itself;
//   · every live page of the site that linked the old address is planned a
//     `link` refresh (§7, *Links in both directions*), whose new version
//     links the new address by the name `pageName` gives the moved page. No
//     live page's text is edited in place.
//
// `repairMoves` runs it each hour for a retarget the move was not written
// for — one published before issue 1487 at its old address, or one whose
// move did not complete — and plans the link refresh of a page that was
// younger than §6's floor when the page moved. 0¢: rows only.
//
// It never throws: the page went live at its new address whether or not
// the rest could be written, and the log says what was not.
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
      await publishDb().from<{ id: string }>("publications").update({ unpublished_at: a.at.toISOString() }).eq("id", row.id);
      const moved = await transition(row.draft_id, "unpublished", a.by, { at: a.at, reason: "moved" });
      if (!moved.ok) {
        console.error(JSON.stringify({ event: "hosted_move_transition_refused", draftId: row.draft_id, refused: moved.refused, state: moved.state }));
      }
    }

    // The links: the old address on the host the site answers at now, and as
    // the update stored it, are one page.
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

/**
 * Every live hosted retarget, moved where its move was not written (SPEC §7,
 * issue 1487). Idempotent: a retarget at its new address with nothing left
 * at the old one and no link left to plan changes nothing.
 *
 * A retarget still at its old address — published before the move existed —
 * is recorded at the address the hosted destination gives it now
 * (`liveUrlOnHost`, with the slug its new search names), as delivery would
 * have recorded it; its draft stays `published`, its text is untouched. It
 * is left where it is when a newer version of the page is live at the old
 * address, or another live page holds the new slug (the adapter's refusal).
 */
export async function repairMoves(a: { now: Date; by?: Actor }): Promise<{ moved: number }> {
  const by = a.by ?? PUBLISH_TICK;
  const { isRetarget } = await import("@/lib/opportunities/types");
  const { slugify } = await import("@/lib/opportunities/derive/candidate");
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
    const to = slugify(opportunity.target_query ?? "");
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
