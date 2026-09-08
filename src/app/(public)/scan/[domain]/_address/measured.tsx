// BUILD §4.1 — one measured number on this screen, rendered once
//
// A screen composition, not a registry row (`BUILD.md` §2.2's component
// set is closed and this adds nothing to it): every measured figure the
// report shows goes through here, so the dash rule, the reason-specific
// line and the mono numeral cannot be half-applied by one module and not
// another. The trichotomy itself is `renderMeasured`'s and is not
// re-implemented (REQ-004).
import type React from "react";
import type { Measured } from "@/lib/measure/measured";
import { renderMeasured } from "@/lib/presentation/measured";
import { copy, type CopyKey } from "@/lib/presentation/copy";

/** REQ-004 c6 vs c9: which of the two owner-written lines an unmeasured
 *  value carries. The choice is the reason's, never the caller's. */
export function unmeasuredLineFor(m: Measured<unknown>): CopyKey {
  return m.kind === "unmeasured" && m.reason === "undeterminable"
    ? "unmeasured.undeterminable"
    : "unmeasured.not-attempted";
}

/** `text` is the figure or the dash; `line` is present only when it is the
 *  dash. Callers place the line where their own card wants it — the pair
 *  is produced together so a card cannot render a dash with no reason. */
export function measuredText(
  m: Measured<number>,
  what: string
): { text: string; isDash: boolean; line?: string } {
  return renderMeasured(m, {
    format: (n) => String(n),
    unmeasuredLine: unmeasuredLineFor(m),
    what,
  });
}

/** Every numeral, date, URL and search query on this screen is JetBrains
 *  Mono with tabular numerals (`BUILD.md` §2.3). `.num` in
 *  `src/ui/type.css` is the one rule that binds it; this is the one
 *  element on this screen that carries the class, so a numeral in the UI
 *  font is a defect with one place to look. */
export function Num(p: {
  children: React.ReactNode;
  /** REQ-004's dash, marked as itself. The cold-start sweep
   *  (`tests/presentation/sweeps/`) flags a dash standing where a value
   *  would sit — REQ-091 c2's "no blank, dash or placeholder value" — and
   *  REQ-004's trichotomy is the one dash that is not that: a measurement
   *  that could not be taken, saying so. Without the marker the sweep
   *  cannot tell the two apart, and would either miss a real blank or
   *  fail an honest admission. It is a structural marker read by tests,
   *  never by a person. */
  unmeasured?: boolean;
  /** A mono **phrase** rather than a single value (issue #307): several
   *  words that may fold at their spaces, as a search query does. The
   *  face is unchanged — §2.3 puts a search query in the mono face — and
   *  no word inside it is ever broken. Opted in, never inferred: whether
   *  a string is one value or a line of language is the caller's call. */
  phrase?: boolean;
}): React.JSX.Element {
  // ADR-093: content fits its box or the box changes, and text is never
  // shrunk to fit. **The box changes; the value does not** (issue #256).
  //
  // This carried `break-words` until #256. A domain is one long token with
  // no space in it, so `rival-three.example.org` came out of a 164px track
  // split at no boundary the string has — a different string from the one
  // in the database, in the mono face §2.3 uses to make exactly that
  // visible. The rule now lives once, on `.num` in `src/ui/type.css`, and
  // this element must not carry a utility that contradicts it.
  //
  // `inline-block` is the other half, and it is about *measurement*. An
  // inline box does not have a width of its own: an unbreakable value
  // inside one reports content it cannot show, which the sweep's check 3
  // reads — correctly — as a value being cut off. As an inline-block the
  // span is exactly as wide as the value, so there is nothing to cut off
  // and nothing to report. `align-bottom` keeps it on the text baseline it
  // sat on as an inline, so nothing moves; `max-w-full` and `min-w-0` keep
  // it a well-behaved grid and flex child.
  //
  // Where a value still cannot fit, the *box* changes and not the value —
  // `_modules/free-page.tsx` stacks its label above the value for exactly
  // that reason.
  return (
    <span
      className={p.phrase === true ? "num num-phrase min-w-0" : "num min-w-0"}
      data-unmeasured={p.unmeasured === true ? "" : undefined}
    >
      {p.children}
    </span>
  );
}

/** A measured count, with the dash rule applied and no line — for a card
 *  that places the reason line itself. */
export function MeasuredNum(p: { value: Measured<number>; what: string }): React.JSX.Element {
  const rendered = measuredText(p.value, p.what);
  return <Num unmeasured={rendered.isDash}>{rendered.text}</Num>;
}

/** `n/m`, composed in TypeScript rather than as two JSX children with a
 *  slash between them: a slash written as JSX text is a string literal in
 *  a voice position, and the copy sweep is right to flag it. This is a
 *  numeric format, not a sentence — it renders inside `Num`. */
export function ratio(part: number, whole: number): string {
  return `${part}/${whole}`;
}

/** The dash itself, for a place that shows no figure at all (the
 *  unmeasured verdict). One key, one character, one home. */
export function dash(): string {
  return copy("unmeasured.dash");
}
