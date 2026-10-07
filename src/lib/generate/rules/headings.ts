// SPEC §7 (owner, D61; issue 1295) — distinct headings.
//
// reachkit.app's Q&A of 7 October asked one question seven times: "Which
// tools help me understand where AI and search send buyers on a small
// budget", "… without hiring an agency", "… as a team of one". A reader
// meets seven headings and one question, and so does a search engine.
//
// Two H2s are too alike where they share `DISTINCT_HEADINGS.overlap` of the
// longer one's words, or open with the same `DISTINCT_HEADINGS.opening`
// words. Words are compared as written, lower-cased; nothing is stemmed and
// no word is left out, so the measure is the one a reader would make.
//
// The check reads a Q&A's question headings and no other page's: a
// comparison's options and an update's live sections are headed alike on
// purpose ("What does A cost?", "What does B cost?").
import { DISTINCT_HEADINGS } from "@/lib/config/constants";
import type { RuleFailure } from "./types";

const wordsOf = (heading: string): string[] => heading.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Whether two headings share most of their words, or their opening. */
export function alikeHeadings(one: string, other: string): boolean {
  const a = wordsOf(one);
  const b = wordsOf(other);
  if (a.length === 0 || b.length === 0) return false;
  const opening = DISTINCT_HEADINGS.opening;
  if (a.length >= opening && b.length >= opening && a.slice(0, opening).join(" ") === b.slice(0, opening).join(" ")) return true;
  const said = new Set(a);
  const also = new Set(b);
  let shared = 0;
  for (const word of said) if (also.has(word)) shared++;
  return shared / Math.max(said.size, also.size) >= DISTINCT_HEADINGS.overlap;
}

const H2_RE = /^##[ \t]+(.+?)[ \t]*#*$/gm;

export function checkDistinctHeadings(a: { markdown: string; apply: boolean }): RuleFailure | null {
  if (!a.apply) return null;
  const headings = [...a.markdown.matchAll(H2_RE)].map((match) => match[1]!.trim());
  for (let later = 1; later < headings.length; later++) {
    for (let earlier = 0; earlier < later; earlier++) {
      if (alikeHeadings(headings[earlier]!, headings[later]!)) {
        return { rule: "distinct_headings", detail: { rule: "distinct_headings", headings: [headings[earlier]!, headings[later]!] } };
      }
    }
  }
  return null;
}
