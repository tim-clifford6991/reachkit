// BUILD §4.1 module 2, left card — AI answers
//
// "AI answers appear on {m} of your 12 biggest searches", the per-rival
// rows over those m, and "The 12 questions" beneath a divider. Leads with
// the answer, not the metric; carries its source as one quiet chip; states
// its method in one line.
//
// **The rival rows are the dot matrix** (issue #352, the approved
// `walk/report` drawing). §4.1 fixes this card's second element as "a dot
// matrix over those m — rivals' cited rows filled grey, the customer's
// row empty red-ringed, `n/{m}` per row", and `AiDotMatrixChart` is
// §2.4's registered drawing of exactly that. It arrived as an absent-safe
// `matrix` slot while issue #11 owned the inventory and nothing ever
// filled the slot, so the card drew the same rows twice over as a
// two-column table of ratios instead — nine rows of writing where the
// drawing belongs, and the reason the left card stood three times the
// right card's height. The chart direct-labels every row with its own
// name and its own count (§2.4: "identity is never colour-alone"), and
// takes its counts **already written** from this card, so the drawing and
// the card's own figures cannot disagree.
//
// **No per-question `{vol}/mo`** — the owner removed it on 2026-09-03 and
// `StoredQuestion` has no volume member to render.
//
// **§6.2's three answer columns are drawn here** (issue #157, design sheet
// linked on the issue). §6.2 rules the paid battery "rendered as three
// answer columns", every row carries them as data
// (`AiAnswersSection.rows[].engines`), and `AnswerColumns` below is that
// data laid out: one column per engine, one row per question, every cell
// a written state. It is a daisyUI `table` inside an `overflow-x-auto` wrap,
// so four columns narrow to 320px by scrolling instead of shrinking type.
//
// **The columns are built from the data, so nothing here branches on
// tier.** `report-view.tsx` has no payment, session or tier parameter and
// gains none (REQ-004 c5): an engine is drawn as a column when at least
// one question actually asked it. The free path makes zero AI Optimization
// calls (§6.2), so its two battery engines are `unmeasured/not_attempted`
// on every row, contribute no column of cells, and are named once beneath
// the table in `ai-answers.engine.not-measured`. Twelve repetitions of
// "not measured" down two columns would read as twenty-four places the
// customer lost; one line per engine reads as what is true — §6.2's
// "never as a miss", at the column level.
//
// **What this deliberately does not move**: `measuredSearches`,
// `answeredSearches`, `customerCitations` and the rival rows are still
// Google's AI answers alone. Counting them across three engines changes
// what the card *claims*, not how it is laid out, and issue #157's last
// box puts that to the owner.
//
// Question wording is model text and reaches this file only through
// `renderQuestion`, which will not yield the wording without the search it
// came from (REQ-093 c3).
// daisyUI in the route (DESIGN rule 1): `card`, `badge`, `table`,
// `collapse`, `divider`, `btn`; lucide for the head glyph at stroke 1.75.
//
import type React from "react";
import { Bot } from "lucide-react";
import { AiDotMatrixChart, type AiDotMatrixCellState, type AiDotMatrixRow } from "@/ui/charts";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { renderQuestion } from "@/lib/presentation/generated";
import type {
  AiAnswersSection,
  AnswerCell,
  BatteryEngine,
  StoredQuestion,
} from "@/lib/scan/report";
import { dash, Num, ratio } from "../_address/measured";

/** How many of the twelve the list shows before "Show all 12"
 *  (`BUILD.md` §4.1: "First 4 shown"). A layout parameter of this one
 *  card, not a pin any other module reads. */
const QUESTIONS_SHOWN = 4;

function citedCount(cells: readonly AnswerCell[]): number {
  return cells.filter((c) => c.kind === "answered" && c.citedDomains.length > 0).length;
}

function answeredCount(cells: readonly AnswerCell[]): number {
  return cells.filter((c) => c.kind === "answered").length;
}

/** One column header per engine. A **total** map over `BatteryEngine`, so
 *  a fourth engine would be a compile error here rather than an unlabelled
 *  column — which is the guard §2.4 asks for ("identity is never
 *  colour-alone") standing where a fourth name could only arrive by
 *  amending §6.2 and §6.4's never-pull list together. */
const ENGINE_LABEL: Readonly<Record<BatteryEngine, CopyKey>> = Object.freeze({
  ai_overview: "ai-answers.engine.ai-overview",
  ai_mode: "ai-answers.engine.ai-mode",
  chatgpt: "ai-answers.engine.chatgpt",
});

type AnswerRows = AiAnswersSection["rows"];

/** The engines the rows carry, in the order they carry them —
 *  `BATTERY_ENGINES` order, read off the data rather than transcribed. Not
 *  taste: `matrix.ts` owns that order, and a **runtime** import of the
 *  market leaf from a file this screen reaches pulls `rivals/domains` →
 *  `scan/domain` → `node:net` into the Edge bundle and fails the build. */
function engineOrder(rows: AnswerRows): readonly BatteryEngine[] {
  const order: BatteryEngine[] = [];
  for (const row of rows) {
    for (const column of row.engines) {
      if (!order.includes(column.engine)) order.push(column.engine);
    }
  }
  return order;
}

function cellFor(row: AnswerRows[number], engine: BatteryEngine): AnswerCell {
  return (
    row.engines.find((column) => column.engine === engine)?.cell ?? {
      kind: "unmeasured",
      reason: "not_attempted",
    }
  );
}

/** Whether anything asked this engine at all. One question it reached is
 *  enough: the column then has something to say, and the questions it did
 *  not reach say so cell by cell. */
function wasAsked(rows: AnswerRows, engine: BatteryEngine): boolean {
  return rows.some((row) => cellFor(row, engine).kind !== "unmeasured");
}

/** One cell of one answer column. Four states and only four — `AnswerCell`'s
 *  three arms, plus the one distinction the answered arm carries — and two
 *  of them are not misses: an engine that served no answer and an engine
 *  nobody asked both take the neutral tone, because §2.5 keeps red for the
 *  customer's own problem being shown to them and neither of those is one. */
function AnswerState(p: { cell: AnswerCell }): React.JSX.Element {
  const { cell } = p;
  if (cell.kind === "unmeasured") {
    return <span className="badge badge-ghost">{copy("ai-answers.engine.not-measured")}</span>;
  }
  if (cell.kind === "no_answer") {
    return <span className="badge badge-ghost">{copy("ai-answers.question.no-answer")}</span>;
  }
  return cell.namesCustomer ? (
    <span className="badge badge-success">{copy("ai-answers.engine.cell.cited")}</span>
  ) : (
    <span className="badge badge-error">{copy("ai-answers.question.not-you")}</span>
  );
}

/** The engine whose reading this card already carries everywhere else —
 *  the free report's one measured engine (ADR-094), the row's own `cell`,
 *  and the matrix's cells. Named once so the two places that ask "is there
 *  a second reading here?" cannot drift apart. */
const AI_OVERVIEW: BatteryEngine = "ai_overview";

/** An engine nothing asked, in one line: its name, and the written line
 *  that says so. Neutral, never `bad` — §2.5 keeps red for the customer's
 *  own problem being shown to them, and a question nobody asked is not
 *  one. */
function EngineNotAsked(p: { engine: BatteryEngine }): React.JSX.Element {
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs">
      <span className="badge badge-ghost">{copy(ENGINE_LABEL[p.engine])}</span>
      <span className="opacity-60">{copy("ai-answers.engine.not-measured")}</span>
    </p>
  );
}

/** §6.2's three answer columns — the **second** reading, beside the
 *  AI-Overview one the counts, the matrix and the questions list below all
 *  carry (DECISIONS 2026-09-07, #165).
 *
 *  The table is drawn where a battery engine was actually asked, and the
 *  engines nobody asked are named in one line each beneath it — never a
 *  column of misses. Where the battery never ran, there is no second
 *  reading to put beside the first: the AI-Overview column alone would be
 *  twelve rows restating, badge for badge, the twelve rows of the
 *  questions list under the divider, and on the free report that table was
 *  most of why this card stood three times its neighbour's height (issue
 *  #352). The two engines it never asked keep their written lines, which
 *  is the whole of what the free report has to say here.
 *
 *  It is a fact of the **data**, never of the tier: `report-view.tsx` has
 *  no payment, session or tier parameter and gains none (REQ-004 c5). A
 *  free scan that had reached a battery engine would draw the table. */
function AnswerColumns(p: { rows: AnswerRows }): React.JSX.Element | null {
  const engines = engineOrder(p.rows);
  const drawn = engines.filter((engine) => wasAsked(p.rows, engine));
  const neverAsked = engines.filter((engine) => !wasAsked(p.rows, engine));
  const secondReading = drawn.some((engine) => engine !== AI_OVERVIEW);

  // #165's own shape: the never-asked engines are "one line **beneath the
  // table**". With no table there is nothing for them to sit beneath, and
  // the approved free report draws neither — so the card says what it
  // measured and stops.
  if (!secondReading) return null;

  return (
    <>
      <div className="min-w-0 overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th className="whitespace-normal">{copy("ai-answers.engine.column.question")}</th>
              {drawn.map((engine) => (
                <th key={engine} className="whitespace-normal">
                  {copy(ENGINE_LABEL[engine])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.rows.map((row) => (
              <tr key={row.question.n}>
                <td>
                  <Num>{String(row.question.n)}</Num>
                </td>
                {drawn.map((engine) => (
                  <td key={engine}>
                    <AnswerState cell={cellFor(row, engine)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {neverAsked.map((engine) => (
        <EngineNotAsked key={engine} engine={engine} />
      ))}
    </>
  );
}

/** One cell of the customer's own row. Three states and only three
 *  (§2.4's contract): a question with no AI answer at all is **muted** and
 *  never a miss (§6.2), an answer that named them is cited, and an answer
 *  that did not is the not-cited cell the chart draws red-ringed on this
 *  row alone (§4.1, §2.5). */
function ownCellState(cell: AnswerCell): AiDotMatrixCellState {
  if (cell.kind !== "answered") return "muted";
  return cell.namesCustomer ? "cited" : "not-cited";
}

/** One cell of a rival's row, read the same way `citedCount` counts it —
 *  the cells the chart fills and the count written beside them are the
 *  same fact, so the drawing cannot disagree with the figure. A rival's
 *  row is never red: §2.5 keeps red for the customer's own problem being
 *  shown to them, and the chart has no prop a rival cell could reach it
 *  with. */
function rivalCellState(cell: AnswerCell): AiDotMatrixCellState {
  if (cell.kind !== "answered") return "muted";
  return cell.citedDomains.length > 0 ? "cited" : "not-cited";
}

/** §4.1's matrix rows: the rivals as context, the customer last and in
 *  their own colour — the order the approved drawing puts them in.
 *
 *  A cold start has no derived rival set, and the customer's row is not a
 *  rival row: it stays, because "you were named in none of them" is this
 *  card's answer and a matrix with no rows at all would be that answer
 *  withheld (REQ-091/092). Every `count` is written here and read by the
 *  chart, which performs no arithmetic of its own. */
function matrixRows(section: AiAnswersSection): readonly AiDotMatrixRow[] {
  const rivals: AiDotMatrixRow[] = section.rivals.map((rival) => ({
    name: rival.domain,
    identity: "rival",
    cells: rival.cells.map(rivalCellState),
    count: ratio(citedCount(rival.cells), answeredCount(rival.cells)),
  }));
  return [
    ...rivals,
    {
      name: section.ownDomain,
      identity: "you",
      cells: section.rows.map((row) => ownCellState(row.cell)),
      count: ratio(section.customerCitations, section.answeredSearches),
    },
  ];
}

/** The card's head: the glyph, the card's name, and what sits at its right —
 *  the source line on the measured card, the dash on the absent one. */
function Head(p: { right: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="card-title text-base-content/70 text-xs tracking-wide uppercase">
        <Bot size={16} strokeWidth={1.75} aria-hidden />
        {copy("ai-answers.title")}
      </h2>
      {p.right}
    </div>
  );
}

/** One question: its number, the wording through `renderQuestion`, the
 *  `not you` badge where the answer did not name the customer, and the mono
 *  provenance line. */
function QuestionRow(p: { row: { question: StoredQuestion; cell: AnswerCell } }): React.JSX.Element {
  const { question, cell } = p.row;
  const namesCustomer = cell.kind === "answered" && cell.namesCustomer;
  // The brands the AI answer named, from the cell that measured them
  // (#103). A question whose answer named nobody names none.
  const namedBrands = cell.kind === "answered" ? cell.citedDomains : [];
  const [wording, provenance] = renderQuestion({
    wording: question.wording,
    provenance: copy("ai-answers.question.provenance", {
      search: question.search,
      brands: namedBrands.join(", "),
    }),
  });

  return (
    <li className="border-base-300 flex flex-col gap-1 border-b py-2 last:border-b-0">
      <div className="flex items-start gap-2 text-sm">
        <span className="text-base-content/60">
          <Num>{String(question.n)}</Num>
        </span>
        <span className="min-w-0 flex-1">{wording.text}</span>
        {cell.kind === "no_answer" ? (
          <span className="badge badge-ghost badge-sm">{copy("ai-answers.question.no-answer")}</span>
        ) : namesCustomer ? null : (
          <span className="badge badge-error badge-sm">{copy("ai-answers.question.not-you")}</span>
        )}
      </div>
      <p className="text-base-content/60 text-xs">
        <Num phrase>{provenance.text}</Num>
      </p>
    </li>
  );
}

function QuestionRows(p: { rows: AnswerRows }): React.JSX.Element {
  return (
    <ul className="flex flex-col">
      {p.rows.map((row) => (
        <QuestionRow key={row.question.n} row={row} />
      ))}
    </ul>
  );
}

export function AiAnswersCard(p: {
  section: AiAnswersSection;
  /** The date the SERPs behind this card were read, already formatted by
   *  the caller that owns the report's one date. */
  measuredOn: string;
}): React.JSX.Element {
  const { section } = p;
  const shown = section.rows.slice(0, QUESTIONS_SHOWN);
  const rest = section.rows.slice(QUESTIONS_SHOWN);

  return (
    <section className="card bg-base-100 border-base-300 border">
      <div className="card-body gap-3">
        <Head
          right={
            <span className="badge badge-ghost h-auto py-1 text-xs whitespace-normal">
              {copy("ai-answers.source", { date: p.measuredOn })}
            </span>
          }
        />
        {/* The card leads with its answer, not with its metric. */}
        <p className="grow-0 text-sm font-semibold">
          {copy("ai-answers.denominator", {
            answered: String(section.answeredSearches),
            measured: String(section.measuredSearches),
          })}
        </p>

        {/* The matrix scrolls rather than shrinking its labels. The
            customer's own row is labelled `n/m`; no sentence repeats it. */}
        <div className="min-w-0 overflow-x-auto">
          <AiDotMatrixChart
            rows={matrixRows(section)}
            questions={section.rows.map((row) => String(row.question.n))}
            label={copy("ai-answers.title")}
          />
        </div>

        <AnswerColumns rows={section.rows} />

        <div className="divider my-0" />

        <p className="text-base-content/60 grow-0 text-xs font-semibold tracking-wide uppercase">
          {copy("ai-answers.questions.title")}
        </p>
        <QuestionRows rows={shown} />
        {/* REQ-006 c8: the first four visible and the remainder one action
            away — `details`, so they are in the document with no JavaScript. */}
        {rest.length === 0 ? null : (
          <details className="collapse collapse-arrow border-base-300 border">
            <summary className="collapse-title text-sm">
              {copy("ai-answers.questions.show-all", { total: String(section.rows.length) })}
            </summary>
            <div className="collapse-content">
              <QuestionRows rows={rest} />
            </div>
          </details>
        )}
        <p className="text-base-content/60 grow-0 text-xs">{copy("ai-answers.method")}</p>
      </div>
    </section>
  );
}

/** REQ-004 c10/c11: a section that could not be produced is named as
 *  absent in one written line, and the rest of the report stays usable —
 *  never an empty card, never a spinner. */
export function AiAnswersAbsent(): React.JSX.Element {
  return (
    <section className="card bg-base-100 border-base-300 border">
      <div className="card-body gap-3">
        <Head right={<Num unmeasured>{dash()}</Num>} />
        <p className="grow-0 text-sm">{copy("ai-answers.absent")}</p>
        {/* The part this card could not measure is offered again on the card. */}
        <div className="card-actions">
          <button type="button" className="btn btn-outline btn-primary btn-sm">
            {copy("control.rescan-incomplete")}
          </button>
        </div>
      </div>
    </section>
  );
}
