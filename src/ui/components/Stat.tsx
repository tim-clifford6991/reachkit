// src/ui/components/Stat.tsx
//
// `components.md` §1, verbatim: "`stats`/`stat`. Value renders through the
// mono numeral utility. One headline number per module; every value carries
// its delta or its goal, never bare" | "measured · measured-zero (prints
// `0`) · unmeasured (prints `—` plus one written line naming the reason)".
//
// `label` is required (BP-018 decision 2). The value's carrier is a
// discriminated union enforcing "never bare" at the type level: `delta` and
// `goal` are mutually exclusive and one is required whenever `state` is
// `measured`/`measured-zero`; `unmeasured` instead requires `reason`, the
// one written line naming why. The value renders through `.num`
// (`src/ui/type.css`, WO-030) — the only place this file touches a numeral.
// The em dash `unmeasured` prints is a fixed glyph marking "nothing
// measured," not a product sentence (BP-018 decision 2 is about copy, not
// punctuation); `reason` is the one written line the caller must still
// supply, so nothing here substitutes for the sentence itself.
//
// **`stat-desc` wraps, and that is a correction to daisyUI rather than a
// preference** (issue #211). Its own rule is `white-space: nowrap`, which
// suits the delta or goal a measured tile carries — "+3", "goal: 30" — and
// is wrong for the one thing this component's own type makes required:
// `unmeasured`'s `reason` is **a written line**, a whole sentence the
// caller must supply. Unwrappable, that sentence sets the grid column's
// max-content width, `.stats` shrink-to-fits to it, and the tile grows
// past its containing block: 534px and 463px inside a 320px viewport, at
// every one of §2's five widths, on every Overview that has not been
// measured yet.
//
// It is fixed here, once, and never per screen (BUILD §2.2): a tile that
// only fits when its caller happens to pass a short reason is a tile whose
// layout is the caller's problem, and #211 is what that costs. The width
// sweep over the live branch (`tests/ui/layout/live-account.test.ts`) is
// what catches a regression.
//
// `whitespace-normal` and not `wrap-anywhere`: the reason is a sentence
// with spaces to break at, and breaking mid-word is for values that have
// no spaces (a domain, a URL) — which this element never carries.
import type React from "react";

type WithDelta = { delta: React.ReactNode; goal?: never };
type WithGoal = { goal: React.ReactNode; delta?: never };

type StatMeasured = {
  state: "measured" | "measured-zero";
  label: string;
  value: React.ReactNode;
} & (WithDelta | WithGoal);

type StatUnmeasured = {
  state: "unmeasured";
  label: string;
  /** Required — the one written line naming the reason. No fallback. */
  reason: string;
};

export type StatProps = StatMeasured | StatUnmeasured;

export function Stat(p: StatProps): React.JSX.Element {
  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-title">{p.label}</div>
        <div className="stat-value num">{p.state === "unmeasured" ? "—" : p.value}</div>
        <div className="stat-desc whitespace-normal">
          {p.state === "unmeasured" ? p.reason : (p.delta ?? p.goal)}
        </div>
      </div>
    </div>
  );
}
