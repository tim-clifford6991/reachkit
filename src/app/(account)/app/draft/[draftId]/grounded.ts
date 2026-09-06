// BUILD §4.6 — "an edited draft keeps its grounding highlight if the fact
// survives the edit".
//
// Two functions and one rule between them: the recorded fact is a verbatim
// passage, and the only question ever asked of it is whether that passage
// still occurs in the body as it now stands. It is never reworded, never
// re-matched loosely, and never rewritten to fit an edit — a fact that has
// been changed is a fact the page is no longer grounded in, which is
// exactly what REQ-045 criterion 8 asks the highlight to say.
//
// The match is on the body's own text, not on the rendered output: the
// customer edits Markdown, so a passage that survives the edit survives it
// in the Markdown. Whitespace is normalised on both sides before comparing
// — a hard-wrapped paragraph re-wrapped at a different column is the same
// sentence, and treating it as a removal would drop a highlight the fact
// still earns.

/** Whitespace runs collapse to one space, ends trimmed. Nothing else is
 *  touched: no case folding, no punctuation stripping, no stemming. Two
 *  strings that differ by a word differ here. */
function normalise(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** REQ-045 criterion 8's one question. `false` for an empty fact — a page
 *  grounded in nothing is not a page whose grounding survived. */
export function factPresentIn(bodyMd: string, fact: string): boolean {
  const needle = normalise(fact);
  if (needle === "") return false;
  return normalise(bodyMd).includes(needle);
}
