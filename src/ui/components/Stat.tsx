// BUILD §2.2 — daisyUI `stats` / `stat`.
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

/** The S1 frame's arm (issue #488): the Overview's tile as the landing's
 *  browser frame draws it — a picture of the Overview at a third of its
 *  size, not the Overview. The approved set prints its figure at the
 *  frame's rung (`--h1`, not `--t-num-big`) and draws the score's delta
 *  beside its figure and no carrier at all on the other two tiles, so the
 *  carrier is optional here and nowhere else. The figures are ruling 5c's
 *  specimen, never a measurement, which is why "never bare" does not bind
 *  them: there is no delta or goal to state about a drawing. */
type StatSpecimen = {
  state: "specimen";
  label: string;
  value: React.ReactNode;
  /** Beside the figure, where the set draws one. */
  delta?: React.ReactNode;
  goal?: never;
};

/** The card idiom's widening: where the caller draws the label as its card
 *  head's eyebrow, the tile does not print it a second time.
 *
 *  `carryBeside` is the approved set's `.stat-row` (UI-SPEC §2's Stat row,
 *  set L193; issue #521): the value and what it carries — its delta or its
 *  goal, and any badge the caller puts beside them — on one baseline-aligned
 *  row that wraps rather than shrinks, where daisyUI stacks the description
 *  under the value. It applies to the measured arms only: `unmeasured`'s
 *  `reason` is a written sentence, and a sentence beside an em dash is not
 *  the row the set draws. */
type LabelPlacement = { labelInHead?: boolean; carryBeside?: boolean };

export type StatProps = (StatMeasured | StatUnmeasured | StatSpecimen) & LabelPlacement;

/** S12's figure (issue #509) on daisyUI's own `stat-value`: daisyUI has no
 *  slot for a stat's size or weight, so the theme's big-numeral rung rides as
 *  utilities naming the same two tokens. */
const FIGURE = "stat-value num text-(length:--t-num-big) font-(--num-weight) tracking-[-0.03em]";

/** The landing frame's miniature at the frame's own rung (issue #488) — the
 *  same figure one step down, so it reads as a picture of S12. */
const FIGURE_MINI =
  "stat-value num text-(length:--h1) font-(--num-weight) tracking-[-0.03em] leading-[1.05]";

// The set's own miniature (artifact L578-584): `.stat-l`, then `.stat-row`
// holding `.stat-v` and its badge on one baseline. The rung it is drawn at
// — the figure at `--h1`, no inset — is this arm's own since issue #548:
// the frame's stylesheet no longer reaches into daisyUI's parts.
function SpecimenStat(p: StatSpecimen): React.JSX.Element {
  return (
    <div className="stats grid min-w-0">
      <div className="stat min-w-0 p-0">
        <div className="stat-title whitespace-normal text-(length:--t-xs) font-semibold text-(--ink-2)">{p.label}</div>
        <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-2">
          <div className={FIGURE_MINI}>{p.value}</div>
          {p.delta}
        </div>
      </div>
    </div>
  );
}

/** The row arm's hook, bound to a name so the copy sweep does not read a
 *  structural attribute value as product voice. */
const CARRY_BESIDE = "beside";

export function Stat(p: StatProps): React.JSX.Element {
  // The card idiom's widening (issue 266, `design/tokens.md` §9.1,
  // `components.md` §7): the label is **placeable in the head**. The
  // idiom's card head already carries an eyebrow, and a tile with two of
  // them states the same claim twice. `labelInHead` moves it there — the
  // caller renders it as the head's eyebrow — and the tile keeps its
  // accessible name here, so the figure is never an unlabelled number to a
  // screen reader just because the label moved.
  //
  // `label` stays required either way: it is the caller's, and there is no
  // arm of this component that has no label at all.
  if (p.state === "specimen") return <SpecimenStat {...p} />;
  return (
    <div className="stats" aria-label={p.labelInHead === true ? p.label : undefined}>
      <div className="stat">
        {p.labelInHead === true ? null : <div className="stat-title">{p.label}</div>}
        {p.carryBeside === true && p.state !== "unmeasured" ? (
          // `gap-2` is `--s-2`, the rung nearest the set's 10px gap.
          <div className="flex flex-wrap items-baseline gap-2" data-carry={CARRY_BESIDE}>
            <div className={FIGURE}>{p.value}</div>
            <div className="stat-desc whitespace-normal">{p.delta ?? p.goal}</div>
          </div>
        ) : (
          <>
            <div className={FIGURE}>{p.state === "unmeasured" ? "—" : p.value}</div>
            <div className="stat-desc whitespace-normal">
              {p.state === "unmeasured" ? p.reason : (p.delta ?? p.goal)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
