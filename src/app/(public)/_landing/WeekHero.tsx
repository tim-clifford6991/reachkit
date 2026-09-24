// BUILD §3 — the hero's product component: one week, one card (#935).
// src/app/(public)/_landing/WeekHero.tsx
//
// Owner ruling 2026-09-21: the landing hero is Round 11 `R11-H4-Week` —
// *Hero D · one week, one card*. It stands to the right of the approved
// headline and scan field, and it is the whole argument in one card: the
// autopilot pill and the Discoverability Score up top; a Mon–Sat strip
// where Monday measures and Tuesday to Saturday each publish a page; the
// line that rose to the `findable` boundary; the AI answer that names the
// example business; then what the customer does against what ReachKit
// does.
//
// **It replaces `HeroShot`, and the ruling says why.** The R6-1 hero was
// rejected on 2026-09-20 for showing the interface rather than the value:
// "it has to show excitement, the value and how little the customer has to
// do". A browser frame around three tiles shows a product; a week that
// moved a number shows what the product is for. `HeroShot.tsx` stays in
// the tree — `specimen.ts`'s own figures are still its, and nothing else
// on the landing renders it — and #347, the landing's copy pass, owns
// removing it. Drawing two heroes was the alternative and is worse.
//
// **daisyUI classes in the route, Recharts for the line, no image**
// (DESIGN rules 1 and 2, and the ruling's own words): `card`, `badge`,
// `stat`, `alert`, `divider`; the week is CSS grid, which rule 2 names
// ("grids that are not series … week strip"); the line is the Overview's
// own `GrowthLine`, with the band boundary as its target — reached through
// `./HeroLine`, which holds the chart's box open and fetches its code when
// the line is about to be read (#988). The drawing is the same one.
//
// **Nothing here is a control.** The board draws the autopilot state as a
// toggle knob; a daisyUI `toggle` on this page would be a control that
// does nothing, which is the whole defect SPEC §1's 2026-09-20 line names
// ("every control on them does something"). It is a `badge`. The hero's
// one action is the `ScanForm` beside it, which is also the screen's one
// solid button.
//
// **Every figure is `specimen.ts`'s and every sentence is a key.** The
// card names a business, and its last line says in writing that the
// business is an example and measures no site.
import type React from "react";
import { Clock, MessageSquare, Send, Zap } from "lucide-react";
import { HeroLine } from "./HeroLine";
import { copy } from "@/lib/presentation/copy";
import { SCORE_BAND_BOUNDS } from "@/lib/config/constants";
import { FLOAT } from "@/ui/lift";
import { Num } from "../scan/[domain]/_address/measured";
import {
  SPECIMEN_HERO,
  SPECIMEN_HERO_BUSINESS,
  SPECIMEN_HERO_WEEKS,
  specimenAutopilotSince,
  specimenHeroWeek,
} from "./specimen";

/** Bound to a name before it reaches JSX: the copy sweep reads a bare JSX
 *  attribute string as product voice, and it is right to. */
const HERO_TEST_ID = "landing-hero-week";

/** `47 / 100` and `▲ 25`, composed in TypeScript: numeric formats, not
 *  sentences. The mark is the Overview's own (`overview.delta.up`), so the
 *  arrow the product draws beside a rise is drawn once. */
function outOf(max: number): string {
  return `/${max}`;
}

/**
 * The AI answer, with the example business drawn as the reader's own.
 *
 * The sentence is one key and is resolved whole; this splits the resolved
 * string on the name it was just given, so the emphasis is a *rendering*
 * of that one sentence and never a second copy of it. A name that somehow
 * does not appear leaves the sentence intact and unemphasised, which is
 * the honest failure: the line still reads.
 *
 * The emphasis is weight and `text-primary` on the card's own ground —
 * not a tinted chip. Ink over a coloured ground is what the palette pass
 * (#946) took off this product, and a badge in the middle of a sentence
 * reads as a control besides.
 */
/** The answer takes the width left beside the badge, and drops to its own
 *  full-width line once that is under `basis-64` — which at 390 it is, and
 *  at 768 and up it is not. Tailwind's own scale, per DESIGN; `min-w-0` so
 *  a long line shortens rather than pushing the card wider. */
// `grow` and not `flex-1`: `flex-1` is the whole shorthand and carries a
// `flex-basis: 0%` that would beat the basis below.
const ANSWER = "min-w-0 grow basis-64 text-sm";

function AiAnswer(): React.JSX.Element {
  const sentence = copy("landing.hero.ai.answer", { you: SPECIMEN_HERO_BUSINESS });
  const at = sentence.indexOf(SPECIMEN_HERO_BUSINESS);
  if (at < 0) return <span className={ANSWER}>{sentence}</span>;
  return (
    <span className={ANSWER}>
      {sentence.slice(0, at)}
      <strong className="text-primary font-bold">{SPECIMEN_HERO_BUSINESS}</strong>
      {sentence.slice(at + SPECIMEN_HERO_BUSINESS.length)}
    </span>
  );
}

/** One day of the strip. Monday is the day that measures, so it carries
 *  the week's two counts and the card's accent ground; the five that
 *  publish each carry one page title and the hour it went live.
 *
 *  **The title wraps and the cell grows with it** (#935, owner
 *  2026-09-22). It was `line-clamp-2`, which DESIGN's own line permits for
 *  "a label that can grow" — but a clamp is a box that clips, and check 3
 *  reports a clipped element unless a declared scroll container is above it
 *  or its class is on `TRUNCATION_ALLOWLIST`. `layout.test.ts` passes the
 *  strict list (`.rk-cal-label`, `.rk-cal-empty`), so the longest page
 *  title cut off at two lines and the folded gate went red on `/` at 390
 *  and 1280 in both themes.
 *
 *  **`title=` does not answer it**, and that was measured rather than
 *  assumed: `checks.ts` reads the computed box and the class list and no
 *  attribute at all, so the same span with the whole value on `title`
 *  reports the identical offender. The remedy left is the one that makes
 *  the check's premise false — nothing is cut off, so there is nothing to
 *  find. The cell has no fixed height and the strip is a CSS grid, so a
 *  three-line title grows its row; `mt-auto` keeps every badge on the
 *  bottom edge whatever the titles above them do.
 *
 *  No `title` attribute either: with the whole value on screen it would be
 *  a tooltip repeating what is already there, and a second announcement of
 *  it for a screen reader. The weekday and the hour are values in the mono
 *  face; neither is ever clamped. */
function DayCell(p: { weekday: string; title: string | null }): React.JSX.Element {
  return (
    <li
      className={`rounded-box flex min-w-0 flex-col gap-1 p-2 ${
        p.title === null ? "bg-primary/10 text-primary" : "bg-base-200"
      }`}
    >
      <span className="num text-xs font-bold uppercase">{p.weekday}</span>
      {p.title === null ? (
        <span className="text-xs font-semibold leading-tight">
          {copy("landing.hero.week.measured", {
            searches: String(SPECIMEN_HERO.searches),
            questions: String(SPECIMEN_HERO.questions),
          })}
        </span>
      ) : (
        <>
          <span className="min-w-0 text-xs font-semibold leading-tight">{p.title}</span>
          <span className="badge badge-success badge-sm mt-auto gap-1">
            {copy("calendar.stage.live")}
            <Num>{SPECIMEN_HERO.liveAt}</Num>
          </span>
        </>
      )}
    </li>
  );
}

export function WeekHero(): React.JSX.Element {
  const week = specimenHeroWeek();
  return (
    <div className="min-w-0">
      <div className={`card bg-base-100 min-w-0 ${FLOAT}`} data-testid={HERO_TEST_ID}>
        <div className="card-body gap-4">
          {/* ── The pill and the number ── */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="badge badge-success gap-1">
              <Zap size={16} strokeWidth={1.75} aria-hidden />
              {/* A sentence, so not `Num`: §2.3 puts numerals, domains and
                  searches in the mono face, and a date inside a sentence is
                  still the sentence's. */}
              {copy("landing.hero.autopilot", { since: specimenAutopilotSince() })}
            </span>
            {/* Right-aligned beside the pill; left-aligned at 390, where the
                row has wrapped and there is nothing to its right to align to. */}
            <div className="stat w-auto p-0 text-left sm:text-right">
              <div className="stat-title">{copy("overview.tile.score.label")}</div>
              {/* **A flex row, so the denominator has a box that holds it.**
                  `Num` is an inline-block in the mono face; inside a plain
                  inline `<span>` in the UI face at the same size, the two
                  faces' metrics differ and the mono child's border box ends
                  1px below its parent's — which the containment check reads,
                  correctly, as an element escaping its box. As flex items
                  each has a block box of its own sized to its own content,
                  and `items-baseline` keeps the two numerals on one line. */}
              <div className="stat-value flex items-baseline gap-1 text-4xl">
                <Num figure>{SPECIMEN_HERO.score}</Num>
                <span className="text-base-content/60 text-base">
                  <Num>{outOf(SPECIMEN_HERO.max)}</Num>
                </span>
              </div>
              <div className="stat-desc">
                <span className="badge badge-success badge-sm">
                  <Num>{copy("overview.delta.up")}</Num>
                  <Num>{SPECIMEN_HERO.delta}</Num>
                </span>
              </div>
            </div>
          </div>

          {/* ── The week: six cells, CSS grid (DESIGN rule 2) ──
              Two columns on a phone, three above it — **two rows of three,
              and not the board's single row of six.** The board draws the
              card at 700px; in the product it is one half of a two-column
              hero, so six cells would be 85px each and every page title
              would clamp to two or three words. DESIGN's own rule: the
              board says what a screen holds, the classes say how it looks,
              and a difference of a few pixels is not a defect. Six cells,
              in the week's order, each readable. */}
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={copy("overview.week.title")}>
            {week.map((day) => (
              <DayCell key={day.weekday} weekday={day.weekday} title={day.page === null ? null : copy(day.page)} />
            ))}
          </ol>

          {/* ── The line the week moved ──
              The target is the `findable` boundary itself, which is why it
              can be drawn at all: `SCORE_BAND_BOUNDS.findable` is the
              product's own threshold and `band.score.findable` is its
              word, so the dashed line names a real place on the scale and
              not a promise. */}
          <p className="text-base-content/70 text-sm">{copy("landing.hero.week.line")}</p>
          <HeroLine
            weeks={SPECIMEN_HERO_WEEKS}
            label={copy("overview.tile.score.label")}
            target={{
              value: SCORE_BAND_BOUNDS.findable,
              label: `${copy("band.score.findable")} · ${SCORE_BAND_BOUNDS.findable}`,
            }}
          />

          {/* ── What the week earned ── */}
          {/* One child, so daisyUI's `alert` grid is one column and the
              wrapping is this row's own: the badge sits beside the answer
              where there is room for both and above it where there is not.
              At 390 a nowrap badge beside a sentence leaves the sentence a
              column four words wide. */}
          <div className="alert items-start">
            <div className="flex w-full min-w-0 flex-wrap items-start gap-2">
              <span className="badge badge-outline badge-sm gap-1 whitespace-nowrap">
                <MessageSquare size={16} strokeWidth={1.75} aria-hidden />
                {copy("ai-answers.engine.ai-overview")}
              </span>
              <AiAnswer />
            </div>
          </div>

          <div className="divider my-0" />

          {/* ── The trade: what they do, what it does ── */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <Clock size={16} strokeWidth={1.75} className="text-primary shrink-0" aria-hidden />
              {copy("landing.hero.work.you")}
            </p>
            <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <Send size={16} strokeWidth={1.75} className="text-primary shrink-0" aria-hidden />
              {copy("landing.hero.work.reachkit")}
            </p>
          </div>
        </div>
      </div>
      <p className="text-base-content/70 mt-2 text-xs">{copy("landing.hero.example")}</p>
    </div>
  );
}
