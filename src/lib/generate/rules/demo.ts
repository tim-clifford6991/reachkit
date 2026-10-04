// SPEC §7 (D41 stage 4; issue 1249) — no demo or navigation text.
//
// A site's demo widget and its menus are not the business speaking: "Demo
// data · An example business" and "Pricing · Sign in" read off a page are
// chrome, and a page that repeats one has quoted the furniture. The site's
// demo phrases are kept with its knowledge base and its menu lines are what
// the read marked as chrome; a sentence of the page that is one of them,
// whole, stops the page.
//
// Whole sentences only, and only phrases long enough to be told from prose
// (`PHRASE_MIN_WORDS`): a two-word menu label is also two ordinary words.
// So it under-reports and never over-reports.
import { sentencesOf } from "./text";
import type { RuleFailure } from "./types";

const PHRASE_MIN_WORDS = 3;

const fold = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export function checkDemoText(a: { markdown: string; phrases: readonly string[] | undefined }): RuleFailure | null {
  const phrases = new Set(
    (a.phrases ?? []).map(fold).filter((phrase) => phrase.split(" ").length >= PHRASE_MIN_WORDS)
  );
  if (phrases.size === 0) return null;
  for (const sentence of sentencesOf(a.markdown)) {
    if (phrases.has(fold(sentence.text))) {
      return { rule: "no_demo_text", detail: { rule: "no_demo_text", sentence: sentence.text } };
    }
  }
  return null;
}
