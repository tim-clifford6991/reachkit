// SPEC §7 (2026-10-03, D36, issue 1209) — every page the site has published
// or planned, as a brief is told it.
//
// "All generated content should have context of all other content published
// to never publish something too similar" (owner). The pages ReachKit wrote
// or is writing for the site, newest first, then the pages the ranking plans
// next — each with its title, the question it answers and its kind. Titles
// and questions only: a brief is told what the site covers, never what those
// pages say.
import { CONTENT_MIX } from "@/lib/config/constants";
import { contentTypeOf, type ContentType } from "./content-type";
import { rankOpen } from "./rank/open";
import { opportunityStore, readOpportunity } from "./store";

export interface SitePage {
  title: string | null;
  question: string | null;
  /** Its address, once it has one. */
  url?: string | null;
  kind: ContentType | null;
  /** `published` once a reader can open it; `planned` until then. */
  status: "published" | "planned";
}

/** A page that was stopped, skipped or taken down is not one the site has. */
const NOT_A_PAGE: ReadonlySet<string> = new Set(["skipped", "failed", "needs_attention", "unpublished"]);

export async function sitePagesFor(siteId: string, a: { except: string }): Promise<SitePage[]> {
  const store = opportunityStore();
  const [drafted, ranked] = await Promise.all([
    store.draftedPages(siteId, CONTENT_MIX.BRIEF_PAGES_MAX),
    rankOpen(siteId),
  ]);
  const written: SitePage[] = drafted
    .filter((page) => !NOT_A_PAGE.has(page.state) && page.row.id !== a.except)
    .map((page) => {
      const row = readOpportunity(page.row);
      return {
        title: page.title,
        question: row.targetQuery,
        kind: contentTypeOf(row),
        status: page.state === "published" ? "published" : "planned",
      };
    });
  const next = await Promise.all(
    ranked
      .filter((entry) => entry.opportunityId !== a.except)
      .slice(0, CONTENT_MIX.WINDOW_DAYS)
      .map((entry) => store.byId(entry.opportunityId))
  );
  const planned: SitePage[] = next.flatMap((found) => {
    if (found === null) return [];
    const row = readOpportunity(found);
    return [{ title: row.title, question: row.targetQuery, kind: contentTypeOf(row), status: "planned" as const }];
  });
  return [...written, ...planned].slice(0, CONTENT_MIX.BRIEF_PAGES_MAX);
}
