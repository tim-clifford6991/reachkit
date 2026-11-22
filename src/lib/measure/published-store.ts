// SPEC §4 (owner, 2026-10-15, issue 1457) — one site's published pages,
// read from `publications`: published and not taken down, the predicate the
// hosted sitemap and Settings' count read. Overview reaches it through
// `content-provider.ts` at the call, and the Monday mail reads it the same way.
import { dbAdmin } from "@/lib/db";
import { fromStored, renderGenerated } from "@/lib/presentation/generated";
import { pageTitle } from "@/lib/presentation/page-title";
import { readLadders } from "@/lib/publish/reads/store";
import { listedName, standingAt, type PublishedPage } from "./published";

interface PublicationRow {
  id: string;
  draft_id?: string | null;
  live_url: string | null;
  published_at: string | null;
  unpublished_at: string | null;
  drafts: { title: string | null; first_edited_at?: unknown } | null;
  sites?: { language: string | null } | null;
}

interface MinimalClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        not(column: string, operator: string, value: null): PromiseLike<{
          data: PublicationRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

/** The pages, or `null` where they could not be read — never an empty
 *  list, which would say nothing was published. */
export async function readPublishedPages(siteId: string, at: Date = new Date()): Promise<readonly PublishedPage[] | null> {
  let read: { data: PublicationRow[] | null; error: { message: string } | null };
  try {
    read = await (dbAdmin() as unknown as MinimalClient)
      .from("publications")
      .select("id, draft_id, live_url, published_at, unpublished_at, drafts(title, first_edited_at:meta->first_edited_at), sites(language)")
      .eq("site_id", siteId)
      .not("published_at", "is", null);
  } catch {
    return null;
  }
  if (read.error !== null || read.data === null) return null;
  // Issue 1553: each page's ladder. Pages whose ladder could not be read
  // are listed without one.
  const ladders = new Map((await readLadders(siteId).catch(() => null))?.map((row) => [row.publicationId, row]) ?? []);
  const pages: PublishedPage[] = [];
  for (const row of read.data) {
    if (row.published_at === null || !standingAt({ publishedAt: row.published_at, unpublishedAt: row.unpublished_at }, at)) continue;
    const publishedAt = new Date(row.published_at);
    // A page with no stored title is named by its address; one with
    // neither cannot be listed, so it is counted nowhere.
    const stored = pageTitle(row.drafts?.title?.trim() ?? "", row.sites?.language);
    const title = listedName(stored, row.live_url);
    if (Number.isNaN(publishedAt.getTime()) || title === "") continue;
    // Model-written, so it is listed only with its label (ADR-012).
    const generated = fromStored("drafts.title", stored);
    const written =
      stored === ""
        ? null
        : renderGenerated(generated, { state: "written", pageId: row.id, title: generated, edited: typeof row.drafts?.first_edited_at === "string" });
    const ladder = ladders.get(row.id);
    pages.push({
      id: row.id,
      title: written?.text ?? title,
      ...(written === null ? {} : { titleLabel: written.label }),
      url: row.live_url,
      publishedAt,
      ...(typeof row.draft_id === "string" ? { draftId: row.draft_id } : {}),
      ...(ladder === undefined ? {} : { ladder: ladder.ladder, reading: ladder.reading, wordpress: ladder.wordpress }),
    });
  }
  return pages;
}
