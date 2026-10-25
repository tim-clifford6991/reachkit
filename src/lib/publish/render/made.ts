// SPEC §7 — the note on how a published page was made, one line both destinations print. Both numbers are the row's own
// (`drafts.meta.factsUsed` read from the site, `drafts.meta.rulesChecked`), via `./made-counts.ts`; with neither, no note.
// Hosted draws it under the byline; a WordPress post has no template of ours, so it is an escaped paragraph after the byline.
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

/** The note as a paragraph of a post's content, or `""`; it points at the sources list only where the body ends with one. */
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
