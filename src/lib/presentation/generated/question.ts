// BUILD §2.5 — a tracked question's wording, admitted only beside the search it came from.
// src/lib/presentation/generated/question.ts — BP-020, WO-279 (supersedes WO-043)
//
// REQ-093 criterion 3. The wording of one of the twelve tracked questions is
// admitted only on the condition that the search it was derived from is
// shown with it — so this returns an ordered pair the surface renders
// whole. There is no function that returns the wording alone. The
// *content* of `provenance` is REQ-006 criterion 9's and is built by that
// requirement's node; this file owns only that the pair cannot be split.
import type { GeneratedText } from "./text.ts";

export function renderQuestion(q: {
  wording: GeneratedText;
  provenance: string; // supplied by REQ-006's node, already rendered
}): readonly [{ role: "question"; text: string }, { role: "provenance"; text: string }] {
  return [
    { role: "question", text: q.wording.text },
    { role: "provenance", text: q.provenance },
  ] as const;
}
