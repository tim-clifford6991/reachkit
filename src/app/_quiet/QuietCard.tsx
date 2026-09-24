// One shape for every quiet page.
// src/app/_quiet/QuietCard.tsx — issue #936
//
// A quiet page is one a visitor did not mean to land on: a refusal, a
// removed report, a used-up opt-out link, a mistyped address, a scan that
// stopped. The 2026-09-20 board (`R6-6`, six of them side by side) draws
// them all the same way, and #936 asks for that in one place: **an icon
// tile, a heading, one or two lines, and at least one control.**
//
// The last of those is the whole point. Before this, the refusal arm was a
// bare alert with nothing to press, and the removed arm was one sentence
// with nowhere to go — a stranger's first and only meeting with the
// product, ending in a dead end. `actions` is required and not optional
// for that reason: a quiet page with no way onward cannot be written with
// this component, which is the cheapest possible guarantee of SPEC §1's
// 2026-09-20 line ("the removed and refused arms offer a way back to the
// landing").
//
// **Not a wrapper around a daisyUI class** (DESIGN rule 1, "no new
// component where a daisyUI class exists): this is a *screen shape* shared
// by six screens, the same footing `src/app/_fallback/` has stood on since
// S8, and it is written in daisyUI's own `card` / `card-body` /
// `card-actions` classes rather than in place of them. It takes no
// variant, no size and no padding prop — six screens, one drawing.
//
// It lives outside the three route groups because the app's own 404 uses
// it too, and `(account)` reaching into `(public)` for a screen shape
// would put the public shell's tree inside the app.
import type React from "react";
import type { LucideIcon } from "lucide-react";
import { Surface } from "@/ui/layout";
import type { Arm, Band } from "@/ui/layout";

/**
 * What the icon tile is saying, in the theme's own meaning slots.
 *
 * Three and not four: `bad` is not here. A quiet page is not an alarm —
 * a removed report is the site owner's own decision and a rate limit is
 * the product working — and §2.5's rule that a tone travels only where a
 * severity does is kept by there being no way to spend `--bad` here.
 * `plain` is the theme's `base-200`, not a `neutral` slot: the `reachkit`
 * theme has no `neutral`, and asking for one paints nothing.
 */
export type QuietTone = "plain" | "warn" | "ok";

const TILE: Record<QuietTone, string> = {
  plain: "bg-base-200 text-base-content/70",
  warn: "bg-warning/15 text-warning",
  ok: "bg-success/15 text-success",
};

const ARMS = {
  compact: { kind: "columns", count: 1 },
  medium: { kind: "same-as-below" },
  wide: { kind: "same-as-below" },
} as const satisfies Record<Band, Arm>;

export interface QuietCardProps {
  /** lucide at stroke 1.75 (DESIGN rule 3), 20px in the tile. */
  icon: LucideIcon;
  tone?: QuietTone;
  /** The screen's one heading. An `<h1>`: on every screen that draws this
   *  card it is the only heading on the document, whatever the board's
   *  six-up specimens show. */
  heading: React.ReactNode;
  /** One or two written lines. An element rather than a string, because
   *  some of them carry a value in the mono face. */
  lines: readonly React.ReactNode[];
  /** At least one control. Required — see this file's header. */
  actions: React.ReactNode;
  /** Anything that belongs above the heading: the 404's numeral, or the
   *  domain a refusal is about. */
  eyebrow?: React.ReactNode;
  testId?: string;
}

/** The card itself, with no screen around it — for a quiet state that sits
 *  inside a page that already has its own `Surface` and heading. */
export function QuietCardBody(p: QuietCardProps): React.JSX.Element {
  return (
    <section className="card bg-base-100 shadow-(--shadow-card)" data-testid={p.testId}>
      <div className="card-body gap-3">
        <span
          className={`rounded-box grid size-10 shrink-0 place-items-center ${TILE[p.tone ?? "plain"]}`}
          aria-hidden
        >
          <p.icon size={20} strokeWidth={1.75} aria-hidden />
        </span>
        {p.eyebrow === undefined ? null : <div className="min-w-0">{p.eyebrow}</div>}
        <h1>{p.heading}</h1>
        {p.lines.map((line, i) => (
          // The lines are a fixed list this screen wrote, in order, and
          // nothing reorders or filters them — so the index is the identity.
          <div key={i} className="text-base-content/70 min-w-0 text-sm">
            {line}
          </div>
        ))}
        <div className="card-actions mt-2 flex-wrap gap-2">{p.actions}</div>
      </div>
    </section>
  );
}

/**
 * The whole screen: the card, centred, as the document's one `Surface`.
 *
 * ADR-093 decision 6 — the sweep asserts exactly one `[data-surface]` per
 * document, so this is the root wherever it is used and a caller that
 * already has a `Surface` reaches for `QuietCardBody` instead.
 */
export function QuietPage(p: QuietCardProps): React.JSX.Element {
  return (
    <Surface arms={ARMS}>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-12 sm:py-16">
        <QuietCardBody {...p} />
      </main>
    </Surface>
  );
}
