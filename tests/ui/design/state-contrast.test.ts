// BUILD §2.1 — every state colour pair in theme.css, measured (issue #328).
// tests/ui/design/state-contrast.test.ts
//
// #290/#292 measured one pair: the quiet ink on the accent ground. Nothing
// had measured the others, and `tailwind.config.ts`'s header is where the
// consequence was recorded rather than caught — "The two light-mode figures
// under 4.5:1 are stated rather than buried". A number stated in a comment
// is a number nothing checks.
//
// This file is the rest of the set, as a table: **one `it` per pair per
// theme, whose name carries the measured ratio**, so the whole measurement
// is in the test output whether it passes or fails, and a changed tone
// fails here with the number before anyone opens a screen.
//
// WHAT A "PAIR" IS. A foreground token the product actually draws, the
// ground it is actually drawn on, and which of WCAG 2.1's floors that use
// carries:
//
//   · `text`      — §1.4.3, 4.5:1. Every rung of this product's type ladder
//                   is below the large-text threshold (15px body down to the
//                   11px eyebrow), so text is 4.5 with no exceptions.
//   · `non-text`  — §1.4.11, 3:1. A boundary or indicator that identifies a
//                   component or its state: the outline rank's edge, the
//                   done stage's mark.
//   · `boundary`   — no floor, but not an unexamined one. A hairline that
//                   *accompanies* an identifying signal rather than being
//                   one, which is §1.4.11's own exception ("available in
//                   another visual presentation"). Every such row names the
//                   pair that does the identifying, and that pair is
//                   asserted against the 3:1 floor — so the exemption is a
//                   checked claim and not a label.
//   · `series`    — no floor. A chart series' colour, where §1.4.11's own
//                   exception applies: UI-SPEC §2 ("A band is conveyed in
//                   words, never by colour alone") means no series is
//                   identified by its colour, and every rival row names
//                   itself beside its line. Measured and printed anyway,
//                   because the number is the point of this file: the dark
//                   `--chart-rival` on `--surface` is 2.98:1, the one pair
//                   in the set that would not clear 3:1 if it had to.
//
// The dark theme's `-bg` and `-line` tints are `rgb(r g b/.12|.28)` — not
// colours until they are composited over the surface beneath them, which
// `contrast.ts` does. Measuring the literal value instead is how a dark-mode
// ratio comes out wrong by a factor.
import { describe, expect, it } from "vitest";
import {
  AA_NON_TEXT,
  AA_TEXT,
  contrast,
  declaredMix,
  resolve,
  resolveMix,
  resolveOnto,
  type Rgb,
  type Theme,
} from "./contrast";

const IDIOM_CSS = "src/ui/idiom/idiom.css";
const THEMES: readonly Theme[] = ["light", "dark"];

/** The four inks `idiom.css` derives for text (issue #328). Named here, read
 *  from the stylesheet there — the percentages are never restated. */
const DERIVED = ["--ink-quiet", "--ok-ink", "--warn-ink", "--bad-ink"] as const;
type Derived = (typeof DERIVED)[number];

type Role = "text" | "non-text" | "boundary" | "series";

interface Pair {
  /** The foreground: a token of the set, or one of the four derived inks. */
  readonly fg: string;
  /** The ground. A translucent ground is composited over `under` first. */
  readonly bg: string;
  /** What a translucent `bg` sits on. The set's tints sit on a card. */
  readonly under?: string;
  readonly role: Role;
  /** Where the product draws it — so a failure names a screen, not a token. */
  readonly where: string;
  /** `boundary` only: the pair that actually identifies the component or the
   *  state this hairline merely accompanies. It carries the 3:1 floor in this
   *  row's place. */
  readonly identifiedBy?: { readonly fg: string; readonly bg: string; readonly under?: string };
}

/**
 * Every pair, in the order the set's own §2.1 block declares the tones.
 *
 * The list is written out rather than generated from the token names,
 * because "which ground is this ink drawn on" is not a property of the
 * names: `--ok` is drawn on its own tint and on a card, and never on
 * `--sunk`. A generated cross-product would measure pairs nothing renders
 * and miss the one that matters. Each row's `where` is the rule in
 * `src/ui/**` that draws it.
 */
const PAIRS: readonly Pair[] = [
  // ── the ink ladder, on the three grounds ────────────────────────────────
  { fg: "--ink", bg: "--surface", role: "text", where: "body ink on a card" },
  { fg: "--ink", bg: "--bg", role: "text", where: "body ink on the page ground" },
  { fg: "--ink", bg: "--sunk", role: "text", where: "body ink on a sunk well" },
  { fg: "--ink-2", bg: "--surface", role: "text", where: "the secondary ink on a card" },
  { fg: "--ink-2", bg: "--bg", role: "text", where: "the secondary ink on the page ground" },
  { fg: "--ink-2", bg: "--sunk", role: "text", where: "`.badge-ghost` — the neutral badge" },
  // The quiet rung. `--ink-3` itself is what every one of these was drawn in
  // until this issue; its own measurements are the non-vacuity block below.
  { fg: "--ink-quiet", bg: "--surface", role: "text", where: "`.eyebrow`, the card head's label" },
  { fg: "--ink-quiet", bg: "--bg", role: "text", where: "`.prov` — the public header's line" },
  { fg: "--ink-quiet", bg: "--sunk", role: "text", where: "`.srcchip` — a source and its date" },

  // ── accent ──────────────────────────────────────────────────────────────
  { fg: "--accent", bg: "--accent-bg", under: "--surface", role: "text", where: "`.badge-primary`, `.rk-head-chip`, the selected chip" },
  { fg: "--accent", bg: "--surface", role: "text", where: "`.rk-panel-chip`, the current stage" },
  { fg: "--accent", bg: "--bg", role: "text", where: "the sidebar's current link" },
  { fg: "--on-accent", bg: "--accent", role: "text", where: "`.btn-primary` — the one solid action" },
  {
    fg: "--accent-line",
    bg: "--surface",
    role: "boundary",
    where: "the selected chip's edge",
    // A selected chip is the accent tint, the accent label and
    // `aria-pressed` — one fact in three presentations (ruling of
    // 2026-09-08, #288/#301). The label is what identifies the state at
    // 3:1 or better; the hairline rides along with it.
    identifiedBy: { fg: "--accent", bg: "--accent-bg", under: "--surface" },
  },
  { fg: "--accent", bg: "--on-accent", role: "text", where: "`.rk-btn-inverse` — the inverted pill on the accent ground" },

  // ── ok ──────────────────────────────────────────────────────────────────
  { fg: "--ok-ink", bg: "--ok-bg", under: "--surface", role: "text", where: "`.badge-success` — the ok badge" },
  { fg: "--ok-ink", bg: "--surface", role: "text", where: "an ok tone on a card" },
  { fg: "--ok-ink", bg: "--bg", role: "text", where: "an ok tone on the page ground" },
  { fg: "--ok", bg: "--surface", role: "non-text", where: "the done stage's mark, `.rk-check-dot`, the check glyph" },
  { fg: "--ink", bg: "--ok-bg", under: "--surface", role: "text", where: "`.rk-doc-levelled mark` — the grounded passage" },

  // ── warn ────────────────────────────────────────────────────────────────
  { fg: "--warn-ink", bg: "--warn-bg", under: "--surface", role: "text", where: "`.badge-warning`, `.rk-head-chip[data-tone=warn]`" },
  { fg: "--warn-ink", bg: "--surface", role: "text", where: "the warn outline pill's label — the veto rank" },
  { fg: "--warn-ink", bg: "--bg", role: "text", where: "a warn tone on the page ground" },
  { fg: "--warn", bg: "--surface", role: "non-text", where: "the warn outline pill's edge" },

  // ── bad ─────────────────────────────────────────────────────────────────
  { fg: "--bad-ink", bg: "--bad-bg", under: "--surface", role: "text", where: "`.badge-error`, `.rk-danger .rk-head-chip`" },
  { fg: "--bad-ink", bg: "--surface", role: "text", where: "`.rk-danger .eyebrow`" },
  { fg: "--bad", bg: "--surface", role: "text", where: "`Input`'s invalid line (`text-error`)" },
  {
    fg: "--bad-line",
    bg: "--surface",
    role: "boundary",
    where: "`.rk-danger > .card` — the danger card's edge",
    // The danger card says what it is in its eyebrow, in words and in
    // `--bad-ink`; the edge is the same statement drawn again.
    identifiedBy: { fg: "--bad-ink", bg: "--surface" },
  },

  // ── the chart series ────────────────────────────────────────────────────
  { fg: "--chart-you", bg: "--surface", role: "series", where: "`GrowthLine`'s own line" },
  { fg: "--chart-rival", bg: "--surface", role: "series", where: "`RivalSparkline` — every rival series" },
  { fg: "--chart-goal", bg: "--surface", role: "series", where: "the goal marker" },

  // ── the hairline ────────────────────────────────────────────────────────
  { fg: "--line", bg: "--surface", role: "series", where: "every rule and cell border — decoration, not a boundary a control is identified by" },
];

/** The floor a role carries, or `null` where WCAG states none. */
function floorFor(role: Role): number | null {
  if (role === "text") return AA_TEXT;
  if (role === "non-text") return AA_NON_TEXT;
  return null;
}

/** A foreground, resolved against the ground it is drawn on: one of
 *  `idiom.css`'s mixes, or a token — and the two `-line` tokens are
 *  translucent in the dark theme, so the ground is needed for them too. */
function foreground(theme: Theme, token: string, ground: Rgb): Rgb {
  return (DERIVED as readonly string[]).includes(token)
    ? resolveMix(theme, declaredMix(IDIOM_CSS, token))
    : resolveOnto(theme, token, ground);
}

function measure(theme: Theme, pair: Pair): number {
  const ground = resolve(theme, pair.bg, pair.under);
  return contrast(foreground(theme, pair.fg, ground), ground);
}

describe(`§2.1 — every state colour pair, measured in both themes (${PAIRS.length} pairs)`, () => {
  for (const theme of THEMES) {
    for (const pair of PAIRS) {
      const ratio = measure(theme, pair);
      const floor = floorFor(pair.role);
      const stated = `${theme}: ${pair.fg} on ${pair.bg} = ${ratio.toFixed(2)}:1`;
      it(`${stated} — ${pair.role}${floor === null ? ", no floor" : ` ≥ ${floor}`} (${pair.where})`, () => {
        if (floor === null) {
          // Rule 5.5: a pair with no floor is still measured, and the
          // measurement is still asserted to be a number a reader can trust
          // — the ratio above is in the test name either way.
          expect(ratio).toBeGreaterThan(1);
          // And a `boundary` row's exemption is only as good as the signal
          // it defers to, so that signal is measured here, in this row.
          if (pair.identifiedBy !== undefined) {
            const other = pair.identifiedBy;
            const ground = resolve(theme, other.bg, other.under);
            const identifying = contrast(foreground(theme, other.fg, ground), ground);
            expect(
              identifying,
              `${theme}: ${pair.fg} is exempt only because ${other.fg} on ${other.bg} identifies it, ` +
                `and that measures ${identifying.toFixed(2)}:1`
            ).toBeGreaterThanOrEqual(AA_NON_TEXT);
          }
          return;
        }
        expect(pair.identifiedBy, `${pair.fg} carries a floor of its own`).toBeUndefined();
        expect(ratio, `${stated}, and ${pair.where} needs ${floor}:1`).toBeGreaterThanOrEqual(floor);
      });
    }
  }

  it("states what it measured, explicitly (rule 5.5)", () => {
    const lines = THEMES.flatMap((theme) =>
      PAIRS.map(
        (pair) =>
          `  ${theme.padEnd(5)} ${pair.fg.padEnd(14)} on ${pair.bg.padEnd(12)} ` +
          `${measure(theme, pair).toFixed(2).padStart(6)}:1  ${pair.role}`
      )
    );
    console.log(
      `tests/ui/design/state-contrast.test.ts: ${PAIRS.length} pair(s) × ${THEMES.length} theme(s)\n${lines.join("\n")}`
    );
    expect(lines).toHaveLength(PAIRS.length * THEMES.length);
  });
});

describe("§2.1 — the four derived inks are each the lowest step that clears AA", () => {
  /** The ground that binds each ink: the darkest it is drawn on in light,
   *  which is the theme that fails first for all four. */
  const BINDING: Readonly<Record<Derived, { bg: string; under?: string }>> = {
    "--ink-quiet": { bg: "--sunk" },
    "--ok-ink": { bg: "--ok-bg", under: "--surface" },
    "--warn-ink": { bg: "--warn-bg", under: "--surface" },
    "--bad-ink": { bg: "--bad-bg", under: "--surface" },
  };

  /** The tone each ink is derived from, and the ratio that tone itself
   *  measures on the same ground — the defect this issue found, kept as the
   *  non-vacuity case so the test cannot pass by measuring nothing. */
  const UNDERIVED: Readonly<Record<Derived, string>> = {
    "--ink-quiet": "--ink-3",
    "--ok-ink": "--ok",
    "--warn-ink": "--warn",
    "--bad-ink": "--bad",
  };

  for (const ink of DERIVED) {
    const declared = declaredMix(IDIOM_CSS, ink);
    const ground = BINDING[ink];

    it(`${ink} is ${UNDERIVED[ink]} mixed ${declared.percent}% toward --ink, and nothing else`, () => {
      expect([declared.first, declared.second]).toEqual([UNDERIVED[ink], "--ink"]);
      // A 5% ladder, like #292's: a percentage off the ladder is a number
      // someone tuned rather than measured.
      expect(declared.percent % 5, `${declared.percent}% is off the 5% ladder`).toBe(0);
    });

    it(`${ink} clears ${AA_TEXT}:1 on ${ground.bg} in both themes, and the next step up does not`, () => {
      for (const theme of THEMES) {
        const bg = resolve(theme, ground.bg, ground.under);
        const ratio = contrast(resolveMix(theme, declared), bg);
        expect(
          ratio,
          `${theme}: ${ink} on ${ground.bg} measures ${ratio.toFixed(2)}:1 at ${declared.percent}%`
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
      // The step above it fails in light — which is what makes the declared
      // step the lowest one and not a rounder number. 100% is the tone
      // itself, so for an ink already at 95% this *is* the tone's own
      // measurement.
      const lightBg = resolve("light", ground.bg, ground.under);
      const above = Math.min(100, declared.percent + 5);
      const weaker = contrast(resolveMix("light", { ...declared, percent: above }), lightBg);
      expect(
        weaker,
        `light: ${ink} at ${above}% measures ${weaker.toFixed(2)}:1, which must be under ${AA_TEXT}`
      ).toBeLessThan(AA_TEXT);
    });

    it(`the underived tone ${UNDERIVED[ink]} is what failed on ${ground.bg} — the defect, measured`, () => {
      const bg = resolve("light", ground.bg, ground.under);
      const ratio = contrast(resolve("light", UNDERIVED[ink]), bg);
      expect(
        ratio,
        `light: ${UNDERIVED[ink]} on ${ground.bg} measures ${ratio.toFixed(2)}:1`
      ).toBeLessThan(AA_TEXT);
    });
  }
});
