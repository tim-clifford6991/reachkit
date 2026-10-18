// SPEC §7 (issue 1507, from the SEO review of 2026-10-17) — a stored page
// read against the six consistency rules, and what code can repair of them.
//
// A new page is held to these by stage 4 — `title` (its description's
// figures), `required_blocks` (`h1`, `link_markup`, `steps_order`) — and by
// the link pass (`../links/apply.ts`, `../links/text.ts`). A page that went
// live before them is read here from its own row: 0¢, no fetch, no model.
//
// What code repairs it repairs without writing a word: a list counted again
// from 1, a repeated link dropped or unwrapped, a link around digits glued
// into a word unwrapped, a stray bracket removed, the body's headings moved
// one level down under the title and a heading that repeats the title or the
// answer dropped. A description stating a figure the body does not needs a
// writer. Either way the live row is not edited (ADR-080): the page is
// planned a refresh. One whose every defect code repairs is mended — a new
// version of the repaired text, dated as the version it mends, since a
// renumbered list is not a change of what the page says (`mendPage` in
// `../index.ts`); any other is written from the repaired text.
import { dedupeLinks, hasRepeatedLinks } from "../links/apply";
import { hasGluedNumberLink, unglueNumberLinks } from "../links/text";
import type { Language } from "@/lib/locale/locales";
import {
  bodyH1s,
  brokenLinkLines,
  renumberSteps,
  repeatedHeadings,
  stepsInOrder,
  withoutBodyH1,
  withoutBrokenLinks,
  withoutRepeatedHeadings,
} from "./blocks";
import { withoutReferenceLists } from "./text";
import { descriptionFiguresMissing } from "./title";

/** A rule of issue 1507 a stored page breaks, by handle. */
export type StructureDefect = "description_figures" | "steps_order" | "repeated_links" | "glued_numeral" | "link_markup" | "h1";

/** The defects code repairs; the rest take a writer. */
export const REPAIRED_IN_CODE: readonly StructureDefect[] = Object.freeze(["steps_order", "repeated_links", "glued_numeral", "link_markup", "h1"]);

/** A stored page as the six rules read it. */
export interface StoredStructure {
  markdown: string;
  description: string;
  /** The page's title: its one H1, which no body heading repeats. */
  title?: string;
  /** The page's language (D66); absent is English. */
  language?: Language;
  /** The years the page was published and updated: a year its description
   *  states passes where it is one of these. */
  years?: readonly number[];
}

/** What a stored page breaks of the six rules, in a fixed order. Pure. */
export function structureDefects(page: StoredStructure): StructureDefect[] {
  const body = withoutReferenceLists(page.markdown);
  const found: (StructureDefect | false)[] = [
    descriptionFiguresMissing(page.description, body, {
      ...(page.language === undefined ? {} : { language: page.language }),
      ...(page.years === undefined ? {} : { years: page.years }),
    }).length > 0 && "description_figures",
    !stepsInOrder(body) && "steps_order",
    hasRepeatedLinks(page.markdown) && "repeated_links",
    page.markdown.split("\n").some(hasGluedNumberLink) && "glued_numeral",
    brokenLinkLines(body).length > 0 && "link_markup",
    (bodyH1s(body).length > 0 || repeatedHeadings(body, page.title ?? "").length > 0) && "h1",
  ];
  return found.filter((defect) => defect !== false);
}

/** The page with every defect code can repair repaired, writing no word:
 *  only a repeated link or heading goes. Unchanged where it has none. Pure. */
export function repairStructure(markdown: string, page: { title?: string } = {}): string {
  const unglued = markdown
    .split("\n")
    .map((line) => (hasGluedNumberLink(line) ? unglueNumberLinks(line) : line))
    .join("\n");
  return renumberSteps(withoutBodyH1(withoutRepeatedHeadings(withoutBrokenLinks(dedupeLinks(unglued)), page.title ?? "")));
}

/** Whether code alone repairs every defect: the page is then mended, and
 *  keeps its dates. */
export const mendedInCode = (defects: readonly string[]): boolean =>
  defects.length > 0 && defects.every((defect) => (REPAIRED_IN_CODE as readonly string[]).includes(defect));

const recordOf = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** A stored version as the six rules read it, from its row: its body, title
 *  and description, the language its pack was written in, and the years it
 *  is dated — when it went live, and the version a mend is dated as. */
export function storedStructure(row: { markdown: string; title: string; meta: unknown; publishedAt: Date }): StoredStructure {
  const meta = recordOf(row.meta);
  const language = recordOf(recordOf(meta.pack).locale).language;
  const dated = typeof meta.datedAs === "string" ? new Date(meta.datedAs) : null;
  return {
    markdown: row.markdown,
    title: row.title,
    description: typeof meta.description === "string" ? meta.description : "",
    ...(language === "en" || language === "de" ? { language } : {}),
    years: [...new Set([row.publishedAt, dated].flatMap((at) => (at === null || Number.isNaN(at.getTime()) ? [] : [at.getUTCFullYear()])))],
  };
}
