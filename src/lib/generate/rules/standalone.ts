// SPEC §7 (owner P2b, 2026-11-16) — each H2 section opens on a sentence that answers on its own: an AI answer lifts a
// passage that stands alone. A warning only (`WARNING_RULES`), shown in the Checks list and never a stop.
import { languagePack } from "@/lib/locale/language";
import type { Language } from "@/lib/locale/locales";
import { blocksOf, sourceBlocksOf, splitSentences } from "./text";
import type { RuleFailure } from "./types";

const H2_RE = /^##[ \t]+/;
const TABLE_RE = /^[ \t]*\|/;

const tokens = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** The words of a text that say what it is about, stemmed: no function word. */
function contentWords(text: string, language: Language): Set<string> {
  const pack = languagePack(language);
  return new Set(tokens(text).filter((token) => !pack.stopWords.has(token)).map((token) => pack.stem(token)));
}

/** Whether a section's first sentence leans on what came before: it opens on a back-reference, or shares no content
 *  word with its heading. A heading with no content word is not judged on the second. */
export function leansBack(heading: string, sentence: string, language: Language): boolean {
  const pack = languagePack(language);
  const opening = tokens(sentence).join(" ");
  if (pack.backReferences.some((words) => opening === words || opening.startsWith(`${words} `))) return true;
  const asked = contentWords(heading, language);
  return asked.size > 0 && ![...contentWords(sentence, language)].some((word) => pack.supports(word, asked));
}

/** The H2 headings whose section's first sentence leans back, in page order. */
export function leaningSections(markdown: string, language: Language): string[] {
  const source = sourceBlocksOf(markdown);
  const blocks = blocksOf(markdown);
  return blocks.flatMap((block, index) => {
    const next = blocks[index + 1];
    if (!H2_RE.test(source[index]!.raw) || next === undefined || next.heading || TABLE_RE.test(source[index + 1]!.raw)) return [];
    const first = splitSentences(next.text)[0] ?? "";
    return first !== "" && leansBack(block.text, first, language) ? [block.text] : [];
  });
}

/** `null` where the rule is not asked (a founder's own page) or every section stands alone. */
export function checkStandaloneLead(a: { markdown: string; language: Language | null }): RuleFailure | null {
  if (a.language === null) return null;
  const headings = leaningSections(a.markdown, a.language);
  return headings.length === 0 ? null : { rule: "standalone_lead", detail: { rule: "standalone_lead", headings } };
}
