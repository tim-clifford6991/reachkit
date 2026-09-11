// UI-SPEC §2 `Question list | .q` — the report's "The 12 questions" (#487).
// src/ui/idiom/QuestionList.tsx
//
// "`n · "question"` · `not you` badge · mono provenance line." One renderer
// for both halves of S2's list — the first rows shown and the rest behind
// "Show all 12" — which `_modules/ai-answers.tsx` drew by hand twice.
//
// Every slot but the number arrives already rendered. The wording is model
// text and reaches a screen only through `renderQuestion` (REQ-093 c3); the
// badge is the registered `Badge`, or nothing where the answer named the
// customer; the provenance is a mono phrase the caller writes from its own
// copy key. This component owns the layout and the rules between rows, and
// nothing a question says.
import type React from "react";

export type QuestionItem = {
  /** The question's own number — a data identity, set in the numeral face. */
  n: string;
  wording: React.ReactNode;
  badge?: React.ReactNode;
  provenance: React.ReactNode;
};

export function QuestionList(p: { items: readonly QuestionItem[] }): React.JSX.Element {
  return (
    <ul className="rk-q-list">
      {p.items.map((item) => (
        <li key={item.n} className="rk-q">
          <div className="rk-q-h">
            <span className="rk-q-n num">{item.n}</span>
            <span className="rk-q-t">{item.wording}</span>
            {item.badge ?? null}
          </div>
          <p className="rk-q-p">{item.provenance}</p>
        </li>
      ))}
    </ul>
  );
}
