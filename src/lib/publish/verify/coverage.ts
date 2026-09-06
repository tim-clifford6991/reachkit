// BUILD §9 — the one operational definition of REQ-062 criterion 1's
// "returns its whole page content to a crawler that runs no scripts".
//
// Multiset containment of the draft's own words in the document that came
// back, as a fraction in `0..1`. Pure: no fetch, no clock, no database, no
// threshold. The floor it is compared against is `VERIFY.coverageFloor`
// (`constants.ts`) and is applied by `verify.ts`, not here.
//
// **It answers readability and nothing else, and a second threshold on it
// is forbidden.** REQ-062 criterion 4's third outcome includes "what came
// back was not the page ReachKit published", and criterion 1's fourth check
// asks whether the page returns its whole content without scripts. Decided
// from this number alone those are the same measurement at two thresholds:
// a parked page, a soft-404 and a login wall return almost none of the
// draft's words — and so does a correctly published page whose body is
// behind client JavaScript, which is exactly the failure the fourth check
// exists to find. One threshold cannot serve both, and whichever way it is
// set one of the two promises breaks silently. Identity is `isOurPage`
// (`answer.ts`), decided from the document's own declaration of itself.
// `tests/publish/verify/coverage.test.ts` asserts that a JavaScript-gated
// page and a parked page are *indistinguishable* here, so a later reader
// proposing the second floor meets the evidence before the temptation.
//
// The archived plan is WO-233.
import { visibleText } from "@/lib/measure/parse";

/** Lowercase alphanumeric runs. Deliberately crude: it is what makes
 *  markdown-to-HTML differences, typographic substitution (curly quotes,
 *  en dashes) and template chrome unable to fail a page whose content is
 *  wholly present, while leaving a page that returned none of its words
 *  nowhere to hide. */
function tokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function counts(of: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const token of of) out.set(token, (out.get(token) ?? 0) + 1);
  return out;
}

/**
 * The one definition of REQ-062 criterion 1's "whole page content".
 *
 * `visibleText` is `src/lib/measure/parse.ts`'s — the same stripper the
 * scan uses, which removes `<script>`, `<style>`, `<template>` and comment
 * nodes before taking the text. Reusing it is what makes "runs no scripts"
 * true of the *measurement* and not only of the fetch: a page whose body
 * reaches the browser inside a `__NEXT_DATA__` script tag returns none of
 * its words to this function, which is the correct reading of a page a
 * script-less crawler cannot read.
 *
 * A draft with no words at all scores `0` rather than a vacuous `1`: a
 * page with nothing to find has not demonstrated that it returns anything.
 * No caller reaches that case — `verify.ts` records `unmeasured` where a
 * draft carries no body rather than asking this function.
 */
export function bodyCoverage(fetchedHtml: string, draftBodyMd: string): number {
  const wanted = tokens(draftBodyMd);
  if (wanted.length === 0) return 0;

  const found = counts(tokens(visibleText(fetchedHtml)));

  let contained = 0;
  for (const [token, n] of counts(wanted)) {
    contained += Math.min(n, found.get(token) ?? 0);
  }
  return contained / wanted.length;
}
