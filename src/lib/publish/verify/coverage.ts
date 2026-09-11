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
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-06: Verification (+24h): "returns its whole page content" = multiset
//   containment of the draft's words in the live document with script/style stripped
//   (visibleText reused); the status whitelist is exactly two (404/410 → page_not_found;
//   everything else falls through to could_not_confirm, which asserts nothing and makes no
//   further fetch); a site's condition is recorded only from an answer the site gave — a
//   timed-out or unparseable sitemap records nothing. — #145

import { renderOf } from "@/lib/generate/rules/text";
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
  // **The draft's words, not its source** (issue #158). `renderOf` is the
  // one declared derivation from a body's Markdown to the words a reader
  // meets — a link becomes its label and the address is gone — and it is
  // read here for the reason its own module states: two derivations would
  // let one caller's "the reader's words" disagree with another's.
  //
  // Tokenising the raw Markdown instead charges a page for the characters
  // of its own link addresses, which no rendering of that body has ever put
  // in front of a reader. That was survivable while a body reached one
  // destination as literal Markdown; since the conversion it is not, and it
  // is the same arithmetic at the hosted edge, which has always rendered.
  // A page carrying three links would lose several points of coverage for
  // being correctly published, and `VERIFY.coverageFloor` is 0.95.
  const wanted = tokens(renderOf(draftBodyMd));
  if (wanted.length === 0) return 0;

  const found = counts(tokens(visibleText(fetchedHtml)));

  let contained = 0;
  for (const [token, n] of counts(wanted)) {
    contained += Math.min(n, found.get(token) ?? 0);
  }
  return contained / wanted.length;
}
