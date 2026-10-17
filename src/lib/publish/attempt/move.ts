// SPEC §7 (2026-10-17, issue 1487) — a retargeted page leaves its old
// address.
//
// The new version is already delivered at the address its new search
// names. This writes the rest of the move, on the rows the hosted page is
// served from:
//
//   · the versions at the old address leave the live set (`unpublished_at`),
//     so the sitemap, the index, the verdicts and Overview hold one page,
//     at the new address. The old address answers 301 to the new one, read
//     by `addressOf` from the update itself — it is not a takedown, and no
//     unpublish outcome is recorded;
//   · every live page of the site that linked the old address links the new
//     one, by the name `pageName` gives the moved page (§7, *Links*).
//
// It never throws: the page went live at its new address whether or not
// the rest could be written, and the log says what was not.
import { pageName } from "@/lib/generate/links/text";
import { urlKey } from "@/lib/generate/links/select";
import { publishDb } from "../db";
import { invalidateHosted } from "../destinations/hosted/cache";
import { slugOf } from "../destinations/hosted/moved";
import { livePagesForSite } from "../destinations/hosted/store";
import { withMovedLink } from "../links/moved";

interface Row {
  id: string;
  site_id: string;
  draft_id: string;
  live_url: string | null;
  published_at: string | null;
  unpublished_at: string | null;
}

export async function moveAddress(a: {
  /** The address the page answered at before, as its update names it. */
  from: string;
  to: { publicationId: string; url: string };
  at: Date;
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
    const left = rows.data
      .filter(
        (row) =>
          row.id !== a.to.publicationId &&
          row.live_url !== null &&
          slugOf(row.live_url) === fromSlug &&
          row.published_at !== null &&
          (row.unpublished_at ?? null) === null
      )
      .map((row) => row.id);
    if (left.length > 0) {
      await publishDb().from<Row>("publications").update({ unpublished_at: a.at.toISOString() }).in("id", left);
    }

    // The links: the old address on the host the site answers at now, and as
    // the update stored it, are one page.
    const old = new Set<string | null>([urlKey(a.from), urlKey(`https://${host}/${fromSlug}`)].filter((key) => key !== null));
    const pages = await livePagesForSite(siteId, host);
    const moved = pages.find((page) => page.publicationId === a.to.publicationId);
    const text = moved === undefined ? "" : pageName({ url: a.to.url, title: moved.title, h1: moved.heading ?? "" });
    if (text !== "") {
      const draftOf = new Map(rows.data.map((row) => [row.id, row.draft_id]));
      for (const page of pages) {
        if (page.publicationId === a.to.publicationId) continue;
        const next = withMovedLink(page.bodyMd, { from: (url) => old.has(urlKey(url)), to: a.to.url, text });
        const draftId = draftOf.get(page.publicationId);
        if (next.moved === 0 || draftId === undefined) continue;
        await publishDb().from<{ id: string }>("drafts").update({ body_md: next.markdown }).eq("id", draftId);
      }
    }
    invalidateHosted({ siteId });
  } catch (error) {
    console.error(JSON.stringify({ event: "hosted_move_failed", from: a.from, to: a.to.url, message: String(error) }));
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
