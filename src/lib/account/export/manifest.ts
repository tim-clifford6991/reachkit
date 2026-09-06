// BUILD §4.7, §9 — the archive's shape, as a value a test can assert
// against without unzipping anything.
//
// One entry per page ReachKit wrote, in `created_at` order, so two runs
// produce an identical manifest and an identical archive. Every field
// REQ-078 criterion 4 names is present on every page: `publishedAt`,
// `liveUrl` and `unpublishedAt` are **explicit nulls** where they do not
// apply and never absent keys, so a reader can tell "this page was never
// published" from "we forgot to write this down".
//
// This module reads and writes nothing else. Building the archive is
// `archive.ts`'s; what a page's file says is `frontmatter.ts`'s.
import { assetNamesOf } from "./assets";
import { isWritten, pageStateOf, type PageState } from "./pages";
import { slugsFor } from "./slug";
import { exportStore, type ExportPublicationRow } from "./store";
import type { State } from "@/lib/publish/types";

export interface ExportManifestPage {
  /** `pages/<slug>.md`, collision-suffixed, never a title. */
  readonly path: string;
  /** The draft this page came from, so `archive.ts` can find its body and
   *  its assets without a second read keyed on anything derived. */
  readonly draftId: string;
  readonly title: string;
  readonly state: PageState;
  readonly publishedAt: Date | null;
  readonly liveUrl: string | null;
  readonly unpublishedAt: Date | null;
  /** `assets/<page-slug>/<file>`. */
  readonly assets: readonly string[];
}

export interface ExportManifest {
  readonly pages: readonly ExportManifestPage[];
}

export class ManifestUnreadable extends Error {
  constructor(siteId: string) {
    super(`src/lib/account/export: the records of site ${siteId} could not be read.`);
    this.name = "ManifestUnreadable";
  }
}

/** The publication a page's dates come from. A page can carry more than one
 *  row over its life (§9's retries write one per attempt); the one that
 *  matters is the one that went live, and where none did, the latest. */
function publicationFor(
  rows: readonly ExportPublicationRow[]
): ExportPublicationRow | null {
  const published = rows.filter((row) => row.published_at !== null);
  if (published.length === 0) return rows[0] ?? null;
  return published.reduce((latest, row) =>
    (row.published_at ?? "") > (latest.published_at ?? "") ? row : latest
  );
}

export async function buildManifest(siteId: string): Promise<ExportManifest> {
  const [read, published] = await Promise.all([
    exportStore().pages(siteId),
    exportStore().publications(siteId),
  ]);
  if (!read.ok || !published.ok) throw new ManifestUnreadable(siteId);

  const written = read.pages.filter((page) => isWritten(page.body_md));
  const slugs = slugsFor(written.map((page) => page.title));

  const byDraft = new Map<string, ExportPublicationRow[]>();
  for (const row of published.publications) {
    const rows = byDraft.get(row.draft_id);
    if (rows === undefined) byDraft.set(row.draft_id, [row]);
    else rows.push(row);
  }

  return {
    pages: written.map((page, index) => {
      const slug = slugs[index] as string;
      const publication = publicationFor(byDraft.get(page.id) ?? []);
      return {
        path: `pages/${slug}.md`,
        draftId: page.id,
        title: page.title,
        state: pageStateOf(page.state as State),
        publishedAt:
          publication?.published_at == null ? null : new Date(publication.published_at),
        liveUrl: publication?.live_url ?? null,
        unpublishedAt:
          publication?.unpublished_at == null ? null : new Date(publication.unpublished_at),
        assets: assetNamesOf(page).map((name) => `assets/${slug}/${name}`),
      };
    }),
  };
}
