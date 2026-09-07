// BUILD §2.2 — daisyUI `card` / `card-body` / `card-title`.
// src/ui/components/Card.tsx
//
// `components.md` §1, verbatim: "`card`/`card-body`/`card-title`. Title slot
// takes a **verdict node**, not a metric label — §2.5: the card leads with
// the answer" | "default · degraded (one written line in place of a missing
// section — never an empty card, never a spinner)".
//
// `title` takes `React.ReactNode` (a verdict node — typically a `Badge` or a
// pair of them), never a plain label string, so a caller cannot pass a
// metric name where a verdict belongs by construction. The two states are a
// discriminated union on `state`, which is required and has no default:
// `degraded` carries `degradedLine` (the one written line) and no
// `children`; `default` carries `children` (the card body) and no
// `degradedLine`. Neither arm has a fallback string.
import type React from "react";

type CardDefault = {
  state: "default";
  title: React.ReactNode;
  children: React.ReactNode;
};

type CardDegraded = {
  state: "degraded";
  title: React.ReactNode;
  /** The one written line replacing a missing section — required, never a
   * fallback (BP-018 decision 2). Never an empty card, never a spinner. */
  degradedLine: string;
};

export type CardProps = CardDefault | CardDegraded;

export function Card(p: CardProps): React.JSX.Element {
  return (
    // 2026-09-05, issue #13: `card` alone is a radius and a layout in
    // daisyUI 5 — it paints no surface, draws no edge and casts no shadow.
    // `BUILD.md` §2.1 states the card idiom's own tokens (`--surface`,
    // `--line`, `--r-box`, `--shadow-card`) and §2.1's mapping puts them on
    // `base-100`/`base-300`, so the classes below are that mapping applied
    // rather than a second set of values: with only `card`, every card in
    // the product renders as white-on-white and the design system's own
    // surfaces are invisible.
    <div className="card bg-base-100 border-base-300 rounded-box border shadow-sm">
      <div className="card-body">
        <div className="card-title">{p.title}</div>
        {p.state === "degraded" ? <p>{p.degradedLine}</p> : p.children}
      </div>
    </div>
  );
}
