// BUILD §4.5 — three tiles, one headline number each.
//
// §4.5 item 3 named four things and the owner amended it. DECISIONS
// 2026-09-03, verbatim: "Overview's AI-answers tile shows one reading only:
// weeks present in the trailing window. The composite score has no tile on
// Overview." So the three tiles are the three goals this screen has:
// searches appeared in, AI answers, pages published. There is no score tile
// and `GoalKey` has no member that could make one.
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
import { Stat } from "@/ui/components";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { GOALS } from "./goals";
import { carriedBy, formatCount, formatDayOfMonth, renderValue, type Carried } from "./present";
import type { AiPresenceWindow, Module } from "./model";
import { CARRY, CHART_BOX, STACK, TILES } from "./style";

/** The one place a delta or a goal becomes a node. `Stat` takes exactly one
 *  of the two, so this returns the pair the caller spreads. */
function statCarrier(carried: Carried): { delta: React.ReactNode } | { goal: React.ReactNode } {
  if (carried.kind === "delta") {
    return {
      delta: (
        <span style={CARRY}>
          <span className="num">{copy(carried.markKey)}</span>
          <span className="num">{carried.text}</span>
        </span>
      ),
    };
  }
  return {
    goal: (
      <span style={CARRY}>
        <span className="num">{carried.text}</span>
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
    <div style={STACK} data-testid={p.testId}>
      {value.isDash ? (
        <Stat state="unmeasured" label={label} reason={value.line ?? label} />
      ) : (
        <Stat
          state={p.module.headline.value.kind === "zero" ? "measured-zero" : "measured"}
          label={label}
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
const SEARCHES_LABEL = "overview.tile.searches.label" satisfies CopyKey;
const AI_LABEL = "overview.tile.ai-answers.label" satisfies CopyKey;
const PAGES_LABEL = "overview.tile.pages.label" satisfies CopyKey;
const SEARCHES_TEST_ID = "overview-tile-searches";
const AI_TEST_ID = "overview-tile-ai-answers";
const PAGES_TEST_ID = "overview-tile-pages";

export function TileRow(p: {
  searches: Module<number>;
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

  return (
    <div style={TILES} data-testid="overview-tiles">
      <Tile module={p.searches} labelKey={SEARCHES_LABEL} testId={SEARCHES_TEST_ID} />
      <Tile
        module={p.aiAnswers}
        labelKey={AI_LABEL}
        testId={AI_TEST_ID}
        outOf={p.aiAnswers.window.of}
      >
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
      <Tile module={p.pagesPublished} labelKey={PAGES_LABEL} testId={PAGES_TEST_ID} />
    </div>
  );
}
