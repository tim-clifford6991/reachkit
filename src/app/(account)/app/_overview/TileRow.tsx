// BUILD §4.5 — three tiles, one headline number each.
//
// §4.5 item 3 named four things, the owner amended it on 2026-09-03
// ("Overview's AI-answers tile shows one reading only: weeks present in the
// trailing window. The composite score has no tile on Overview."), and the
// approved screen set reversed the second half of that amendment on
// 2026-09-08: ruling 6a names "Overview tile" among the surfaces that label
// the Discoverability Score, and S12 draws it first of three.
//
// So the three tiles are the set's three: the **Discoverability Score**
// with its delta and its band, AI answers over the trailing window, and
// pages published with the count already ranking. The searches reading is
// still on this screen and still one headline — it is the growth card's,
// which is where the set puts it, and `overview.tile.searches.label` is
// that card's eyebrow now.
//
// The first half of the 2026-09-03 ruling is untouched: the AI tile shows
// one reading, and no per-question figure appears anywhere here.
//
// **Every headline carries its delta or its goal, never bare.** `Stat`'s own
// type is what enforces it — `delta` and `goal` are mutually exclusive and
// one is required — and `carriedBy` decides which: the delta where a
// previous measurement exists and produced one, the goal otherwise. The goal
// always exists, which is why "never bare" is reachable in every state.
//
// **The AI tile shows one reading and no movement.** No delta is passed to
// it, and none can be: `model.aiAnswers.headline` has no `delta` field set
// by the assembly. What sits under it is the window itself, drawn as the dot
// matrix — the presence of each week, with the shortfall to the goal as
// dashed dots — and no per-question figure appears anywhere on this screen.
import type React from "react";
import { AiDotMatrixChart, type AiDotMatrixCellState, type AiDotMatrixRow } from "@/ui/charts";
import { Badge, Stat } from "@/ui/components";
import { BAND_TONE } from "@/ui/bands";
import { SCORE_BANDS } from "@/lib/presentation/bands";
import { TOO_EARLY_WEEKS } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { formatDate } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { GOALS } from "./goals";
import { carriedBy, formatCount, formatDayOfMonth, renderValue, type Carried } from "./present";
import type { AiPresenceWindow, Module, ScoreModule } from "./model";
import type { Measured } from "@/lib/measure/measured";
import type { Tone } from "@/ui/types";
import { CardHead, IdiomCard } from "@/ui/idiom";
import { CARRY, CHART_BOX, STACK, TILES } from "./style";

/** The one place a delta or a goal becomes a node. `Stat` takes exactly one
 *  of the two, so this returns the pair the caller spreads. */
function statCarrier(carried: Carried): { delta: React.ReactNode } | { goal: React.ReactNode } {
  // A badge, not bare text (UI-SPEC S12): the set draws every tile's
  // carried value as a pill beside the number — the delta in the success
  // tone, the goal in the neutral one — and §2.5 fixes which is which. A
  // delta is the customer's own movement, so it is `ok`; a goal is a
  // target, which is not a state at all.
  if (carried.kind === "delta") {
    return {
      delta: (
        <Badge tone={DELTA_TONE}>
          <span style={CARRY}>
            <span className="num">{copy(carried.markKey)}</span>
            <span className="num">{carried.text}</span>
          </span>
        </Badge>
      ),
    };
  }
  return {
    goal: (
      <span style={CARRY}>
        <Badge tone={GOAL_TONE}>
          <span className="num">{carried.text}</span>
        </Badge>
        {carried.means === null ? null : <span>{carried.means}</span>}
      </span>
    ),
  };
}

function Tile(p: {
  module: Module<number>;
  labelKey: CopyKey;
  testId: string;
  /** What the headline is out of, where it is a count within a fixed set. */
  outOf?: number;
  children?: React.ReactNode;
}): React.JSX.Element {
  const label = copy(p.labelKey);
  const value = renderValue(p.module.headline.value, p.labelKey);

  return (
    // Take A, the take the owner approved on 2026-09-02: "one card per
    // module, the three stat tiles broken out as three boxes — six boxes".
    // Each tile is its own box now, and its label is the box's head rather
    // than the tile's own `stat-title`: the idiom's card head already
    // carries an eyebrow, and a tile with two of them states the same claim
    // twice (`Stat`'s `labelInHead` widening).
    <IdiomCard head={<CardHead eyebrow={label} />} testId={p.testId}>
      <div style={STACK}>
      {value.isDash ? (
        <Stat state="unmeasured" label={label} labelInHead reason={value.line ?? label} />
      ) : (
        <Stat
          state={p.module.headline.value.kind === "zero" ? "measured-zero" : "measured"}
          label={label}
          labelInHead
          value={
            p.outOf === undefined ? (
              value.text
            ) : (
              <span className="num">{`${value.text}/${formatCount(p.outOf)}`}</span>
            )
          }
          {...statCarrier(carriedBy(p.module.headline, p.labelKey))}
        />
      )}
      {p.children}
      </div>
    </IdiomCard>
  );
}

/** The window, as the matrix's one row. A week that was not measured is a
 *  `muted` cell — §6.2's rule applied to weeks: never a miss — and a date
 *  the answers changed is a `break` cell, which is a rule and not a
 *  reading (REQ-071 c12, issue #205). The count is handed in already
 *  written and is taken over `weeks`, so a break can never be counted as
 *  one. */
function presenceRow(window: AiPresenceWindow, count: string): AiDotMatrixRow {
  const cells: AiDotMatrixCellState[] = window.entries.map((entry) =>
    entry.kind === "break"
      ? "break"
      : entry.week.present === null
        ? "muted"
        : entry.week.present
          ? "cited"
          : "not-cited"
  );
  return { name: copy(AI_LABEL), identity: "you", cells, count };
}

// Every key and test id below is bound to a name before it reaches JSX.
// The copy sweep (`tests/presentation/copy/string-literal-sweep.test.ts`)
// presumes any string literal in a JSX attribute is product voice unless
// the attribute is on its allow-list, and it is right to: a `labelKey=` a
// reader could mistake for a caption is exactly the shape it guards. These
// are registry keys and test hooks, and they say so by being named.
const SCORE_LABEL = "overview.tile.score.label" satisfies CopyKey;
const AI_LABEL = "overview.tile.ai-answers.label" satisfies CopyKey;
const PAGES_LABEL = "overview.tile.pages.label" satisfies CopyKey;
const SCORE_TEST_ID = "overview-tile-score";
const AI_TEST_ID = "overview-tile-ai-answers";
const PAGES_TEST_ID = "overview-tile-pages";

/** The score's own tile: the number, its delta, and the band it stands in.
 *
 *  The band is a `Badge` beside the value rather than a second headline —
 *  it is a word for where the score is, not a number — and its tone is
 *  `BAND_TONE`'s, the one map the report's verdict head reads too, so one
 *  band is never drawn two colours on two screens.
 *
 *  Where the score is unmeasured there is no band: a band is a reading of a
 *  score, and naming one beside a dash would be a verdict on a measurement
 *  the product does not have (S13's arm). */
function ScoreTile(p: { score: ScoreModule; firstDue: string | null }): React.JSX.Element {
  const label = copy(SCORE_LABEL);
  const value = renderValue(p.score.headline.value, SCORE_LABEL);
  // S13: the dash carries the date its first reading is due, which is the
  // date the shell's domain block states from the same `firstDueOn`.
  const firstDue =
    p.firstDue === null ? null : writtenLine("overview.tile.score.first-due", { due: p.firstDue });

  return (
    <IdiomCard head={<CardHead eyebrow={label} />} testId={SCORE_TEST_ID}>
      <div style={STACK}>
        {value.isDash ? (
          <Stat state="unmeasured" label={label} labelInHead reason={value.line ?? label} />
        ) : (
          <Stat
            state={p.score.headline.value.kind === "zero" ? "measured-zero" : "measured"}
            label={label}
            labelInHead
            value={value.text}
            {...statCarrier(carriedBy(p.score.headline, SCORE_LABEL))}
          />
        )}
        {p.score.band === null ? null : (
          <span style={CARRY}>
            <Badge tone={BAND_TONE[p.score.band]}>{copy(SCORE_BANDS[p.score.band])}</Badge>
          </span>
        )}
        {firstDue === null ? null : <p className="rk-quiet">{firstDue}</p>}
      </div>
    </IdiomCard>
  );
}

export function TileRow(p: {
  score: ScoreModule;
  /** UI-SPEC S13's arm. Present only before the first weekly pass has run;
   *  each tile then states when its own reading arrives, in place of a
   *  number nobody has measured. */
  weekZero?: { firstDueOn: Date } | null;
  aiAnswers: Module<number> & { window: AiPresenceWindow };
  pagesPublished: Module<number>;
  timeZone: string;
}): React.JSX.Element {
  const aiValue = renderValue(p.aiAnswers.headline.value, AI_LABEL);
  const aiGoal = GOALS.ai_answers;
  const windowLine = writtenLine("overview.tile.ai-answers.window", {
    weeks: aiValue.text,
    of: formatCount(p.aiAnswers.window.of),
  });

  // Each week's own column label: the day of the month, in the site's zone.
  // Two mono characters, so twelve of them fit the chart's own gutter — and
  // every cell is still named by its column and its row (§2.4).
  // One label per column, breaks included — a rule with no name would be a
  // mark the reader cannot identify, which §2.4 forbids as much for a break
  // as for a cell.
  const weekLabels = p.aiAnswers.window.entries.map((entry) =>
    formatDayOfMonth(entry.kind === "break" ? entry.marker.on : entry.week.weekStart, p.timeZone)
  );

  // The set's "6 already ranking" and "rest under 3 weeks — too early to
  // judge". The first is the model's context value; the second is REQ-063
  // c2's own window, from the pin. Neither renders where the count was not
  // taken: a badge saying nothing ranks is a claim, and the dim line is
  // about a remainder there is no count for.
  const rankingValue = p.pagesPublished.context?.[0];
  const rankingRendered =
    rankingValue === undefined
      ? null
      : renderValue(rankingValue.value as Measured<number>, PAGES_LABEL);
  const ranking =
    rankingValue === undefined || rankingRendered === null || rankingRendered.isDash
      ? null
      : writtenLine(rankingValue.label, { count: rankingRendered.text });
  const tooEarly =
    ranking === null
      ? null
      : writtenLine("overview.tile.pages.too-early", { weeks: formatCount(TOO_EARLY_WEEKS) });

  // S13's three lines. All three or none: they are one arm of the screen,
  // and a tile that states its first-reading date beside two tiles that do
  // not would read as that tile alone being unmeasured.
  const weekZero = p.weekZero ?? null;
  const firstDue = weekZero === null ? null : formatDate(weekZero.firstDueOn, p.timeZone);
  const firstPass = weekZero === null ? null : writtenLine("overview.tile.ai-answers.first-pass");
  const firstReview = weekZero === null ? null : writtenLine("overview.tile.pages.first-review");

  return (
    <div style={TILES} data-testid="overview-tiles">
      <ScoreTile score={p.score} firstDue={firstDue} />
      <Tile
        module={p.aiAnswers}
        labelKey={AI_LABEL}
        testId={AI_TEST_ID}
        outOf={p.aiAnswers.window.of}
      >
        {firstPass === null ? null : <p className="rk-quiet">{firstPass}</p>}
        {windowLine === null ? null : <p className="rk-prov">{windowLine}</p>}
        <div style={CHART_BOX}>
          <AiDotMatrixChart
            rows={[presenceRow(p.aiAnswers.window, `${aiValue.text}/${formatCount(p.aiAnswers.window.of)}`)]}
            questions={weekLabels}
            goal={{
              count: aiGoal.value,
              name: copy("overview.goal", { value: formatCount(aiGoal.value) }),
            }}
            label={copy(AI_LABEL)}
          />
        </div>
      </Tile>
      <Tile module={p.pagesPublished} labelKey={PAGES_LABEL} testId={PAGES_TEST_ID}>
        {ranking === null ? null : (
          <span style={CARRY}>
            <Badge tone={RANKING_TONE}>{ranking}</Badge>
          </span>
        )}
        {tooEarly === null ? null : <p className="rk-quiet">{tooEarly}</p>}
        {firstReview === null ? null : <p className="rk-quiet">{firstReview}</p>}
      </Tile>
    </div>
  );
}

/** §2.5: the badge beside the pages count reports the customer's own
 *  progress — pages that are working — so it is a success state. */
const RANKING_TONE: Tone = "ok";
/** The same rule for the carried values: movement the customer made is a
 *  success state; a goal is a target and takes the neutral pill the set
 *  draws it in. */
const DELTA_TONE: Tone = "ok";
const GOAL_TONE: Tone = "neutral";
