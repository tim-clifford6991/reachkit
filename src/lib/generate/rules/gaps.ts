// SPEC §7 (owner 2026-10-18, issue 1521; amends D42 #7) — a refresh closes
// the gap to the pages above it.
//
// A leaf: the pack reads it to find the subtopics the top results head a
// section with and the live page does not (`../pipeline/pack.ts`,
// `headingGaps`), and `required_blocks` reads it to hold what a growing
// refresh added (`new_sections`). The words are a heading's content words
// in every supported language, so one subtopic worded two ways by two
// pages is one.
import { HEADING_GAPS } from "@/lib/config/constants";
import { LANGUAGE_PACKS, languagePack } from "@/lib/locale/language";
import { headingKey, linksOf } from "./text";

// The English words every pack was read by, and each other supported
// language's function words beside them (D66): a pack does not say which
// language a stored title or question is in.
const STOP = new Set([
  ..."a an and are as at be best but by can do does for from how i in is it my of on or our that the to top vs was we what when which who why will with you your".split(" "),
  ...LANGUAGE_PACKS.filter((pack) => pack.language !== "en").flatMap((pack) => [...pack.stopWords]),
]);

const ENGLISH = languagePack("en");

/** The content words of a text: what tells two topics apart. */
export function topicWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 2 && !STOP.has(word))
      // Issue 1477: "engines" is "engine", as "services" is "service" — the
      // language pack's own plural, never a cut "es" ("engin").
      .map(ENGLISH.stem)
  );
}

/** A heading every kind of page carries that is no subtopic: the FAQ, the
 *  summary, the contents, the comments, the author — in each supported
 *  language. */
const BOILERPLATE_HEADING_RE =
  /^(?:faqs?|frequently asked questions|conclusions?|summary|in summary|final thoughts|key takeaways|table of contents|contents|related(?:\s.*)?|sources|references|comments?|leave a (?:reply|comment)|share(?: this(?: \w+)?)?|newsletter|subscribe|about the author|contact(?: us)?|recent posts|categories|tags|fazit|zusammenfassung|inhaltsverzeichnis|inhalt|häufig gestellte fragen|häufige fragen|quellen|kommentare?|ähnliche artikel|verwandte artikel|über den autor|kontakt)$/iu;

const HEADING_LINE_RE = /^[ \t]*#{2,3}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm;

/** The H2 and H3 headings of a Markdown page, in order. */
export function headingLines(markdown: string): string[] {
  return [...markdown.matchAll(HEADING_LINE_RE)].map((match) => match[1] ?? "");
}

/** A heading's subtopic: its content words, its numbering and closing
 *  mark aside. Empty for a heading that is no subtopic. */
export function subtopicOf(heading: string): Set<string> {
  const text = heading
    .replace(/^\s*(?:\d+[.):]|step\s+\d+:?|schritt\s+\d+:?)\s*/iu, "")
    .replace(/[?!.:]+$/u, "")
    .trim();
  if (BOILERPLATE_HEADING_RE.test(text)) return new Set();
  return topicWords(text);
}

/** Two subtopics are one where half the words of the shorter are the
 *  other's. */
export function sameSubtopic(one: ReadonlySet<string>, other: ReadonlySet<string>): boolean {
  if (one.size === 0 || other.size === 0) return false;
  let shared = 0;
  for (const word of one) if (other.has(word)) shared++;
  return shared / Math.min(one.size, other.size) >= 0.5;
}

const addressOf = (url: string): string =>
  url.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[#?].*$/, "").replace(/\/+$/, "");

/**
 * What a growing refresh may add (issue 1521): its sections the live page
 * does not head are at most `HEADING_GAPS.sectionsMax`, and each is on one
 * of the pack's gaps and links one of the claims that gap names. A section
 * under a live heading is the live page's own and is not read here.
 */
export function newSectionsHold(
  sections: readonly { heading: string; text: string }[],
  growth: { live: string; gaps: readonly { heading: string; claims: readonly string[] }[] }
): boolean {
  const live = new Set(headingLines(growth.live).map(headingKey));
  const added = sections.filter((section) => !live.has(headingKey(section.heading)));
  if (added.length > HEADING_GAPS.sectionsMax) return false;
  return added.every((section) => {
    const words = subtopicOf(section.heading);
    const linked = new Set(linksOf(section.text).map(addressOf));
    return growth.gaps.some((gap) => sameSubtopic(words, subtopicOf(gap.heading)) && gap.claims.some((url) => linked.has(addressOf(url))));
  });
}
