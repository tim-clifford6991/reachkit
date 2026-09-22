// BUILD §8 hard rule 4 — the free half of the do-not-claim check.
//
// "String + semantic match." This is the string half, on its own, because
// two callers need it and only one of them may reach a model:
//
//   `./check.ts`       runs it first, so an obvious match costs nothing and
//                      the nano pass is asked only about what it could not
//                      decide.
//   the draft editor   runs it on every pause, in the browser, so a
//                      never-claim phrase is underlined where it stands
//                      within a second of being typed (issue 932).
//
// **It is a leaf, and that is the point.** `check.ts` imports `@/lib/llm`
// and `zod`; a client component importing the match from there would pull
// the model client into the browser bundle to use forty lines of string
// comparison. So the comparison lives here, `check.ts` imports it, and
// neither side has a second copy of it — a second copy being exactly how
// the mark on screen and the verdict on the row come to disagree about the
// same words.
//
// The semantic half is not here and is not coming here. A paraphrase is a
// judgement, a judgement costs a call, and a call belongs to the save.

/** The same normalisation the list hash uses, applied to the draft's text,
 *  so the literal pass is case- and spacing-insensitive in exactly the way
 *  the list is. */
export function normaliseClaimText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

/** The literal half. Returns the customer's own entry — the one they
 *  recorded, in the case and spacing they recorded it in — never the
 *  normalised form the match was made on. */
export function literalClaimMatch(text: string, list: readonly string[]): string | null {
  const haystack = normaliseClaimText(text);
  for (const entry of list) {
    const needle = normaliseClaimText(entry);
    if (needle.length === 0) continue;
    if (haystack.includes(needle)) return entry;
  }
  return null;
}
