// SPEC §7 (2026-10-11, issue 1397) — the note that says how a published
// page was made, as one line both destinations print.
//
// "Written with AI from {n} facts on {site}, checked against {N} rules
// before publishing." Both numbers are the page's own row: the business
// facts it states or links that were read from the site itself
// (`drafts.meta.factsUsed`), and the rules it was held to
// (`drafts.meta.rulesChecked`). A page whose row records no fact read from
// its own site, or no count of its rules, prints no note rather than a
// number nobody counted. The numbers are read by `./made-counts.ts`.
//
// The hosted page draws the line under its byline. A WordPress post has no
// template of ours, so the line is a paragraph of the content this product
// sends, after the byline — escaped like every other character of it.
import { copy } from "@/lib/presentation/copy";
import { madeCounts, type MadeCounts } from "./made-counts";
import { escapeHtml, type Say } from "./markdown";

export { madeCounts, type MadeCounts } from "./made-counts";

/** The line, in the page's own language (D66); absent is English. */
export function madeLine(a: { counts: MadeCounts; site: string; say?: Say }): string {
  const say = a.say ?? copy;
  const rules = String(a.counts.rules);
  return a.counts.facts === 1
    ? say("hosted.made.one", { site: a.site, rules })
    : say("hosted.made", { facts: String(a.counts.facts), site: a.site, rules });
}

/** The words of a heading, for finding the sources list among them. */
function headingKey(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Whether a heading is the sources list code ends a page with
 *  (`generate/pipeline/sources.ts`), in English or the page's language. */
export function isSourcesHeading(text: string, say: Say = copy): boolean {
  const key = headingKey(text);
  return key === headingKey(copy("body.sources.heading")) || key === headingKey(say("body.sources.heading"));
}

/** The note as a paragraph of a post's content; `""` for a page with no
 *  note. It points at the sources list only where the body ends with one. */
export function madeHtml(a: {
  meta: Readonly<Record<string, unknown>> | null;
  domain: string;
  bodyMd: string;
  say?: Say;
}): string {
  const counts = madeCounts(a.meta, a.domain);
  if (counts === null) return "";
  const say = a.say ?? copy;
  const sourced = a.bodyMd
    .split("\n")
    .some((line) => /^#{1,6}[ \t]+/.test(line) && isSourcesHeading(line.replace(/^#{1,6}[ \t]+/, "").replace(/[ \t]*#*[ \t]*$/, ""), say));
  const line = madeLine({ counts, site: a.domain, say });
  return `<p>${escapeHtml(sourced ? `${line} ${say("hosted.made.sources")}` : line)}</p>\n`;
}
