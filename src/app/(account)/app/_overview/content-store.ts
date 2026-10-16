// SPEC §4 (owner, 2026-10-15, issue 1457) — one site's published pages,
// read from `publications`: published and not taken down, the predicate the
// hosted sitemap and Settings' count read. Reached only through
// `content-provider.ts`, which imports it at the call.
import { dbAdmin } from "@/lib/db";
import type { PublishedPage } from "./content";

interface PublicationRow {
  id: string;
  live_url: string | null;
  published_at: string | null;
  unpublished_at: string | null;
  drafts: { title: string | null } | null;
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
export async function readPublishedPages(siteId: string): Promise<readonly PublishedPage[] | null> {
  let read: { data: PublicationRow[] | null; error: { message: string } | null };
  try {
    read = await (dbAdmin() as unknown as MinimalClient)
      .from("publications")
      .select("id, live_url, published_at, unpublished_at, drafts(title)")
      .eq("site_id", siteId)
      .not("published_at", "is", null);
  } catch {
    return null;
  }
  if (read.error !== null || read.data === null) return null;
  const pages: PublishedPage[] = [];
  for (const row of read.data) {
    if (row.unpublished_at !== null || row.published_at === null) continue;
    const publishedAt = new Date(row.published_at);
    // A page with no stored title is named by its address; one with
    // neither cannot be listed, so it is counted nowhere.
    const title = row.drafts?.title?.trim() || row.live_url || "";
    if (Number.isNaN(publishedAt.getTime()) || title === "") continue;
    pages.push({ id: row.id, title, url: row.live_url, publishedAt });
  }
  return pages;
}
