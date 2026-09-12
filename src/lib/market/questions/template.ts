// §6.7 step 4's mechanical question forms over a keyword.
// Split out of `phrase.ts` (which buys a model call beside them) so a
// caller that only words a search reaches no model seam at all.

/** The keyword shapes BUILD §6.7 step 4 names, plus the bare fallback that
 *  makes the template form total — every keyword has one, which is why a
 *  phrasing failure can never remove a question. */
const TEMPLATES: ReadonlyArray<readonly [RegExp, (m: RegExpMatchArray) => string]> = Object.freeze([
  [/^best (.+)$/, (m) => `What's the best ${m[1]}?`],
  [/^(.+?) (?:vs|versus) (.+)$/, (m) => `${sentenceCase(m[1] ?? "")} or ${m[2]} — which should I pick?`],
  [/^(.+?) alternatives?$/, (m) => `What are the alternatives to ${m[1]}?`],
  [/^top (?:\d+ )?(.+)$/, (m) => `What are the top ${m[1]}?`],
  [/^how (?:to|do i|can i) (.+)$/, (m) => `How do I ${m[1]}?`],
  [/^what (is|are) (.+)$/, (m) => `What ${m[1]} ${m[2]}?`],
]);

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Total over every keyword: the shapes above where one matches, otherwise
 *  the search itself as a question. */
export function templateQuestion(keyword: string): string {
  const text = keyword.toLowerCase().trim().replace(/\s+/g, " ");
  for (const [pattern, build] of TEMPLATES) {
    const match = text.match(pattern);
    if (match) return build(match);
  }
  return `${sentenceCase(text)}?`;
}
