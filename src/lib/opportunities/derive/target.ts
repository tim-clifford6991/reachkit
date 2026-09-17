// SPEC §6, §7 (issue 867) — what a page is optimising for, copied at creation.
//
// The founder edits a page without being told what it is for. The facts
// that answer that are all measured already: the search's own keyword
// difficulty (issue 858), the difficulty ceiling this site is judged
// against, and where each of §6.2's three answer engines stood on that
// question. This module copies them onto the candidate's evidence, in the
// same way and for the same reason every other member of `Evidence` is
// copied: the day panel and the draft screen explain why this page was
// chosen *then*, not what the market looks like now.
//
// **Nothing is measured, bought or re-derived here.** Every value is read
// off the stored report the derivation is already reading, and the ceiling
// is the pure function of the site's own footprint the selection used.
import { difficultyCeiling } from "../winnability/bars";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import type { AiAnswersSection, AnswerCell } from "@/lib/scan/report";
import type { AnswerEngine, EngineStanding, TargetEngine, TargetFacts } from "../types";

/** One cell's standing. An engine that answered and named the site is
 *  `names_you`; one that answered without it is `names_others`; the two
 *  remaining arms are not misses and are kept apart — an engine that served
 *  no answer said something, an engine nobody asked said nothing. */
function standingOf(cell: AnswerCell): EngineStanding {
  if (cell.kind === "unmeasured") return "unmeasured";
  if (cell.kind === "no_answer") return "no_answer";
  return cell.namesCustomer ? "names_you" : "names_others";
}

type AnswerRow = AiAnswersSection["rows"][number];

/** The engines one answer row carries, in the order it carries them —
 *  `BATTERY_ENGINES`' order, read off the data rather than transcribed. A
 *  row from before the engines triple carries its AI-Overview cell alone,
 *  and that is what it is read as. */
function enginesOf(row: AnswerRow | undefined): TargetEngine[] {
  if (row === undefined) return [];
  const columns = row.engines.length > 0 ? row.engines : [{ engine: "ai_overview" as const, cell: row.cell }];
  return columns.map((column) => ({
    engine: column.engine as AnswerEngine,
    standing: standingOf(column.cell),
  }));
}

/**
 * The target facts for one question of one pass.
 *
 * `difficulty` is `unmeasured` where the vendor gave the search no
 * difficulty — which is a real outcome for the long tail — so the screens
 * render its written line rather than a 0, which would read as "nothing to
 * beat".
 */
export function targetFactsOf(a: {
  difficulty: number | undefined;
  ownRanked: number;
  answerRow: AnswerRow | undefined;
  at: Date;
}): TargetFacts {
  const difficulty: Measured<number> =
    a.difficulty === undefined ? unmeasured<number>("undeterminable", a.at) : measured(a.difficulty, a.at);
  return {
    difficulty,
    ceiling: difficultyCeiling(a.ownRanked),
    engines: enginesOf(a.answerRow),
  };
}
