// BUILD §9 — the one definition of REQ-062 criterion 1's "returns its whole page content to a crawler that runs no
// scripts": multiset containment of the draft's words in the fetched document, in `0..1`. Pure; `verify.ts` applies
// `VERIFY.coverageFloor`.
// It answers readability only, and a second threshold on it is forbidden: a parked page and a JavaScript-gated page score
// alike here (`tests/publish/verify/coverage.test.ts`), so identity is `isOurPage` (`answer.ts`), from the document itself.
import { renderOf } from "@/lib/generate/rules/text";
import { visibleText } from "@/lib/measure/parse";

/** Lowercase alphanumeric runs, deliberately crude so markup, curly quotes and template chrome cannot fail a page
 *  whose words are all present. */
function tokens(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function counts(of: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const token of of) out.set(token, (out.get(token) ?? 0) + 1);
  return out;
}

/** The scan's own `visibleText` drops scripts, so a body shipped inside a `__NEXT_DATA__` tag scores none of its words,
 *  as a script-less crawler reads it. A draft with no words scores `0`, never a vacuous `1`. */
export function bodyCoverage(fetchedHtml: string, draftBodyMd: string): number {
  // The reader's words via `renderOf`, never the raw Markdown, which would charge a page for its own link addresses.
  const wanted = tokens(renderOf(draftBodyMd));
  if (wanted.length === 0) return 0;

  const found = counts(tokens(visibleText(fetchedHtml)));

  let contained = 0;
  for (const [token, n] of counts(wanted)) {
    contained += Math.min(n, found.get(token) ?? 0);
  }
  return contained / wanted.length;
}
