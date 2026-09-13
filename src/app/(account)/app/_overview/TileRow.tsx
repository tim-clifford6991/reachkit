// Canvas: Dashboard — the two tiles under the score card.
//
// The artboard draws two here: AI answers over the trailing window, and pages
// published with the count already ranking. The score leads the card above
// them and the searches reading is that card's series, so neither has a tile.
//
// The pages tile is the one tile that carries neither a delta nor a goal:
// what its figure carries is the standing beside it, which is a measured
// value and not a target, so the tile is not bare either.
import type React from "react";
import { AiDotMatrixChart, type AiDotMatrixCellState, type AiDotMatrixRow } from "@/ui/charts";
import { Badge, Card, Stat } from "@/ui/components";
import { TOO_EARLY_WEEKS } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { GOALS } from "./goals";
import { carriedBy, formatCount, formatDayOfMonth, renderValue } from "./present";
import { besideOnly, statCarrier } from "./carry";
import type { AiPresenceWindow, Module } from "./model";
import type { Measured } from "@/lib/measure/measured";
import type { Tone } from "@/ui/types";
import { CARD_HEAD, CARD_LABEL, CARRY, CHART_BOX, PROV, QUIET, STACK, TILES } from "./style";

function Tile(p: {
  module: Module<number>;
  labelKey: CopyKey;
  testId: string;
  /** What the headline is out of, where it is a count within a fixed set. */
  outOf?: number;
  /** A badge the artboard draws on the value's own row. */
  beside?: React.ReactNode;
  /** The pages tile draws `beside` alone, and so no means sentence either:
   *  there is no goal on that tile for a sentence to explain. */
  carries?: "delta-or-goal" | "beside-only";
  children?: React.ReactNode;
}): React.JSX.Element {
  const label = copy(p.labelKey);
  const value = renderValue(p.module.headline.value, p.labelKey);
  const besideAlone = p.carries === BESIDE_ONLY;
  const carried = carriedBy(p.module.headline, p.labelKey);
  const means =
    besideAlone || carried.kind !== "goal" || carried.means === null ? null : carried.means;

  return (
    <section data-testid={p.testId}>
      <Card
        state="default"
        title={
          <div className={CARD_HEAD}>
            <span className={CARD_LABEL}>
              <span className="eyebrow">{label}</span>
            </span>
          </div>
        }
      >
        <div className={STACK}>
          {value.isDash ? (
            <>
              <Stat state="unmeasured" label={label} labelInHead reason={value.line ?? label} />
              {p.beside === undefined || p.beside === null ? null : (
                <span className={CARRY}>{p.beside}</span>
              )}
            </>
          ) : (
            <>
              <Stat
                state={p.module.headline.value.kind === "zero" ? "measured-zero" : "measured"}
                label={label}
                labelInHead
                carryBeside
                value={
                  p.outOf === undefined ? (
                    value.text
                  ) : (
                    <span className="num">{`${value.text}/${formatCount(p.outOf)}`}</span>
                  )
                }
                {...(besideAlone ? besideOnly(p.beside) : statCarrier(carried, p.beside))}
              />
              {means === null ? null : <p className={QUIET}>{means}</p>}
            </>
          )}
          {p.children}
        </div>
      </Card>
    </section>
  );
}

/** The window, as the matrix's one row. A week that was not measured is a
 *  `muted` cell — never a miss — and a date the answers changed is a `break`,
 *  which is a rule and not a reading. The count is handed in already written
 *  and is taken over `weeks`, so a break can never be counted as one. */
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

// Every key and test id below is bound to a name before it reaches JSX: the
// copy sweep presumes a string literal in a JSX attribute is product voice,
// and these are registry keys and test hooks.
const AI_LABEL = "overview.tile.ai-answers.label" satisfies CopyKey;
const PAGES_LABEL = "overview.tile.pages.label" satisfies CopyKey;
const AI_TEST_ID = "overview-tile-ai-answers";
const PAGES_TEST_ID = "overview-tile-pages";
const BESIDE_ONLY = "beside-only" as const;

export function TileRow(p: {
  /** Present only before the first weekly pass has run; each tile then states
   *  when its own reading arrives, in place of a number nobody measured. */
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
  // One label per column, breaks included — a mark with no name is a mark the
  // reader cannot identify.
  const weekLabels = p.aiAnswers.window.entries.map((entry) =>
    formatDayOfMonth(entry.kind === "break" ? entry.marker.on : entry.week.weekStart, p.timeZone)
  );

  // Neither renders where the count was not taken: a badge saying nothing
  // ranks is a claim, and the dim line is about a remainder there is no count
  // for.
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

  // Both lines or neither: they are one arm of the screen, and a tile stating
  // its first-reading date beside one that does not would read as that tile
  // alone being unmeasured.
  const weekZero = p.weekZero ?? null;
  const firstPass = weekZero === null ? null : writtenLine("overview.tile.ai-answers.first-pass");
  const firstReview = weekZero === null ? null : writtenLine("overview.tile.pages.first-review");

  return (
    <div className={TILES} data-testid="overview-tiles">
      <Tile
        module={p.aiAnswers}
        labelKey={AI_LABEL}
        testId={AI_TEST_ID}
        outOf={p.aiAnswers.window.of}
      >
        {firstPass === null ? null : <p className={QUIET}>{firstPass}</p>}
        {windowLine === null ? null : <p className={PROV}>{windowLine}</p>}
        <div className={CHART_BOX}>
          <AiDotMatrixChart
            rows={[
              presenceRow(
                p.aiAnswers.window,
                `${aiValue.text}/${formatCount(p.aiAnswers.window.of)}`
              ),
            ]}
            questions={weekLabels}
            goal={{
              count: aiGoal.value,
              name: copy("overview.goal", { value: formatCount(aiGoal.value) }),
            }}
            label={copy(AI_LABEL)}
          />
        </div>
      </Tile>
      <Tile
        module={p.pagesPublished}
        labelKey={PAGES_LABEL}
        testId={PAGES_TEST_ID}
        beside={ranking === null ? null : <Badge tone={RANKING_TONE}>{ranking}</Badge>}
        carries={BESIDE_ONLY}
      >
        {tooEarly === null ? null : <p className={QUIET}>{tooEarly}</p>}
        {firstReview === null ? null : <p className={QUIET}>{firstReview}</p>}
      </Tile>
    </div>
  );
}

/** §2.5: the badge beside the pages count reports the customer's own
 *  progress — pages that are working — so it is a success state. */
const RANKING_TONE: Tone = "ok";
