// BUILD §4.1 module 2, left card — AI answers (board PubReport)
//
// The answers that mention the customer, out of those that appeared; the
// searches they were asked for; a waffle of who the answers mention — one
// square per answer, each row named and tallied, the customer's own row
// last in a tinted block; one answer quoted as written;
// and closed beneath them the questions. The waffle is CSS grid
// (`AnswerMatrix` below, DESIGN rule 2: a grid that is not a series), and
// takes its tallies **already written** from this card, so the drawing and
// the card's own figures cannot disagree. Every cell is labelled with its
// row and question (§2.4: "identity is never colour-alone").
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
import { Sparkles } from "lucide-react";
import { LinkSummary } from "../_address/link-summary";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { SCORE_ESTIMATE } from "@/lib/config/constants";
import { namesOrLinks } from "@/lib/measure/drivers";
import { renderQuestion } from "@/lib/presentation/generated";
import { writePageDate } from "@/lib/publish/render/byline";
import type {
  AiAnswersSection,
  AnswerCell,
  BatteryEngine,
  StoredQuestion,
  StoredReport,
} from "@/lib/scan/report";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { RetryPart } from "@/lib/scan/retry";
import { dash, Num } from "../_address/measured";
import { RetryPartControl } from "../_address/retry-part";

/** Which part this card's retry re-runs. A bound handle, not an inline
 *  attribute: the string-literal sweep (REQ-093 c1) reads every JSX
 *  attribute string, and a handle that looks like a sentence to a sweep is
 *  a handle that will be flagged by it.*/
const AI_ANSWERS_PART: RetryPart = "ai_answers";

/** Issue 715: the reuse date as `report-view.tsx` writes the measurement
 *  date, "2 Sep 2026". Written here rather than threaded down from
 *  there because it is a *different* date — the report has one measurement
 *  date and any number of reuse dates — and a second parameter on this card
 *  called `on` beside `measuredOn` would be two dates a caller could swap.
 *  A stored value that is not an instant renders as itself rather than as
 *  `Invalid Date`: the member is the ledger's, and a screen does not get to
 *  decide that a report is unreadable. */
function formatReusedOn(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : writePageDate(at, null);
}

function citedCount(cells: readonly AnswerCell[]): number {
  return cells.filter((c) => c.kind === "answered" && c.citedDomains.length > 0).length;
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
  return namesOrLinks(cell) ? (
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
    <p className="flex grow-0 flex-wrap items-center gap-2 text-xs">
      <span className="badge badge-ghost">{copy(ENGINE_LABEL[p.engine])}</span>
      <span className="opacity-70">{copy("ai-answers.engine.not-measured")}</span>
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
          <thead className="text-base-content/70">
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

// ── The matrix, as CSS grid (issue 730) ─────────────────────────────────

/** Three states, and only three: a muted cell is a question with no AI
 *  answer and is never a miss (§6.2). */
export type MatrixCell = "cited" | "not-cited" | "muted";

/** One row: its name, whether it is the customer's, its cells in question
 *  order, and its tally already written by the card. */
export interface MatrixRow {
  readonly name: string;
  readonly you: boolean;
  readonly cells: readonly MatrixCell[];
  readonly count: string;
}

/** The grid's root, found by the landing specimen's and the report's tests. */
export const MATRIX_TEST_ID = "ai-matrix";

/** Board PubReport v36: a filled square is light primary, the customer's
 *  full primary; an empty one is the same for every row, never red. */
function cellClass(cell: MatrixCell, you: boolean): string {
  if (cell === "muted") return "border border-dashed border-base-300";
  if (cell === "cited") return you ? "bg-primary" : "bg-primary/60";
  return "bg-base-200 ring-1 ring-inset ring-base-300";
}

/**
 * The dot matrix: each row its name on a line, then a square per question
 * with the count at its right; the customer's row last, in a tinted block,
 * "You" above its domain. The squares share the row's width and shrink
 * before anything clips, so nothing here scrolls; a domain wraps anywhere
 * in the mono face (DESIGN, 2026-10-15).
 */
export function AnswerMatrix(p: {
  rows: readonly MatrixRow[];
  /** One label per column; absent, the squares stand for no one question. */
  questions?: readonly string[];
  label: string;
  testId?: string;
}): React.JSX.Element {
  const width = Math.max(p.questions?.length ?? 0, ...p.rows.map((row) => row.cells.length), 1);
  const squares = { gridTemplateColumns: `repeat(${width}, minmax(0, 1rem))` };
  const cellName = (row: MatrixRow, c: number): string => (p.questions === undefined ? row.name : `${row.name} · ${p.questions[c] ?? ""}`);
  return (
    <div role="table" aria-label={p.label} data-testid={p.testId ?? MATRIX_TEST_ID} className="flex min-w-0 flex-col">
      {p.rows.map((row) => (
        <div
          role="row"
          key={row.name}
          className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 ${row.you ? "rounded-box mt-1 bg-(--accent-bg) p-2.5" : "border-base-300 border-t py-2.5"}`}
        >
          <span role="rowheader" className="col-span-2 flex min-w-0 flex-col text-sm">
            {row.you ? <span className="text-primary font-bold">{copy("report.you")}</span> : null}
            <span className="font-mono text-xs break-all">{row.name}</span>
          </span>
          <div className="grid min-w-0 gap-1" style={squares}>
            {row.cells.map((cell, c) => (
              <div role="cell" key={c} data-cell={cell} title={cellName(row, c)} aria-label={cellName(row, c)}>
                <div aria-hidden="true" className={`aspect-square rounded-[3px] ${cellClass(cell, row.you)}`} />
              </div>
            ))}
          </div>
          <span className="text-sm font-bold tabular-nums">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

/** One cell of the customer's own row. Three states and only three
 *  (§2.4's contract): a question with no AI answer at all is **muted** and
 *  never a miss (§6.2), an answer that named them is cited, and an answer
 *  that did not is the not-cited cell the chart draws red-ringed on this
 *  row alone (§4.1, §2.5). */
function ownCellState(cell: AnswerCell): MatrixCell {
  if (cell.kind !== "answered") return "muted";
  return namesOrLinks(cell) ? "cited" : "not-cited";
}

/** One cell of a rival's row, read the same way `citedCount` counts it —
 *  the cells the chart fills and the count written beside them are the
 *  same fact, so the drawing cannot disagree with the figure. A rival's
 *  row is never red: §2.5 keeps red for the customer's own problem being
 *  shown to them, and the chart has no prop a rival cell could reach it
 *  with. */
function rivalCellState(cell: AnswerCell): MatrixCell {
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
function matrixRows(section: AiAnswersSection): readonly MatrixRow[] {
  const rivals: MatrixRow[] = section.rivals.map((rival) => ({
    name: rival.domain,
    you: false,
    cells: rival.cells.map(rivalCellState),
    count: String(citedCount(rival.cells)),
  }));
  return [
    ...rivals,
    {
      name: section.ownDomain,
      you: true,
      cells: section.rows.map((row) => ownCellState(row.cell)),
      count: String(section.customerCitations),
    },
  ];
}

/** The card's head: the glyph, the card's name, and what sits at its right —
 *  the source line on the measured card, the dash on the absent one. */
function Head(p: { right?: React.ReactNode }): React.JSX.Element {
  // The card's name is its heading, under the section's own (board PubReport).
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2.5 text-lg font-semibold">
        <span aria-hidden className="rounded-field text-primary grid size-8 place-items-center bg-(--accent-bg)">
          <Sparkles size={16} strokeWidth={1.75} />
        </span>
        {copy("ai-answers.title")}
      </h3>
      {p.right}
    </div>
  );
}

/** The longest quote the card shows, in characters: one sentence, never a page. */
const QUOTE_MAX = 240;

/** The answer's words without its markdown marks, which a quote would show raw.
 *  A mark that starts a word (".NET", ".io") keeps the space before it. */
function plainOf(text: string | undefined): string | undefined {
  return text?.replace(/\*\*|`/g, "").replace(/\s+([.,!?;:])(?=\s|$)/g, "$1").trim();
}

/** One AI answer's first sentence, quoted as it was written, with the search
 *  it was asked for and the names the answer itself set in bold. The first
 *  answer that named a competitor and kept its text; `null` where no answer
 *  kept any, so nothing is ever made up. */
export function answerQuoteOf(
  section: AiAnswersSection,
  serps: StoredReport["serps"]
): { search: string; text: string; bold: readonly string[] } | null {
  for (const [i, row] of section.rows.entries()) {
    if (row.cell.kind !== "answered" || row.cell.citedDomains.length === 0) continue;
    const serp = serps[i];
    const raw = serp !== undefined && serp.kind !== "unmeasured" ? serp.value.aiOverview.text : undefined;
    const text = plainOf(raw);
    if (raw === undefined || text === undefined || text === "") continue;
    const sentence = /^[\s\S]*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
    if (sentence.length > QUOTE_MAX) continue;
    const bold = [...raw.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]!.trim()).filter((name) => name !== "" && sentence.includes(name));
    return { search: row.question.search, text: sentence, bold: [...new Set(bold)] };
  }
  return null;
}

/** The quote with the names its answer set in bold drawn bold. */
function Emphasised(p: { text: string; bold: readonly string[] }): React.ReactNode {
  if (p.bold.length === 0) return p.text;
  const names = new RegExp(`(${p.bold.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`);
  return p.text.split(names).map((part, i) => (p.bold.includes(part) ? <strong key={i}>{part}</strong> : part));
}

/** One question: its number, the wording through `renderQuestion`, the
 *  `not you` badge where the answer did not name the customer, and the mono
 *  provenance line. */
function QuestionRow(p: { row: { question: StoredQuestion; cell: AnswerCell } }): React.JSX.Element {
  const { question, cell } = p.row;
  const namesCustomer = cell.kind === "answered" && namesOrLinks(cell);
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
        <span className="text-base-content/70">
          <Num>{String(question.n)}</Num>
        </span>
        <span className="min-w-0 flex-1">{wording.text}</span>
        {/* Issue 869: an unmeasured cell is not a miss. It used to fall
            through to the red "not you", so an engine whose calls all
            failed printed "you are not mentioned" twelve times over an
            outage. The same ghost badge the engine columns already use for
            an unmeasured cell — §2.5 keeps red for the customer's own
            problem, and not having read something is not one. */}
        {cell.kind === "unmeasured" ? (
          <span className="badge badge-ghost badge-sm">{copy("ai-answers.engine.not-measured")}</span>
        ) : cell.kind === "no_answer" ? (
          <span className="badge badge-ghost badge-sm">{copy("ai-answers.question.no-answer")}</span>
        ) : namesCustomer ? null : (
          <span className="badge badge-error badge-sm">{copy("ai-answers.question.not-you")}</span>
        )}
      </div>
      <p className="text-base-content/70 text-xs">
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
  /** The SERPs the card was counted over, in question order, for the one
   *  answer it quotes. */
  serps: StoredReport["serps"];
}): React.JSX.Element {
  const { section } = p;
  // Issue 1309: the list holds every question the pass found, and the pass
  // may have measured fewer. Where it did, the heading and its line say
  // both counts apart, and no line counts an unmeasured row as measured.
  const total = String(section.rows.length);
  const measured = String(section.measuredSearches);
  const partial = section.measuredSearches < section.rows.length;
  const quote = answerQuoteOf(section, p.serps);

  return (
    <section className="card bg-base-100 shadow-(--shadow-card) min-w-0">
      <div className="card-body gap-4">
        <Head />
        {/* The card leads with its answer, not with its metric (#1068).
            Issue 1439: "AI doesn't answer" is only said over enough reads,
            the rule AI presence keeps. */}
        {section.answeredSearches === 0 && section.measuredSearches >= SCORE_ESTIMATE.noneMinReads ? (
          <p className="grow-0 text-lg font-semibold">{copy("ai-answers.finding.unanswered")}</p>
        ) : (
          <p className="flex grow-0 flex-col gap-1">
            <span className="text-3xl">
              <Num figure>
                {copy("report.figure.of", {
                  count: String(section.customerCitations),
                  total: String(section.answeredSearches),
                })}
              </Num>
            </span>
            <span>{copy("ai-answers.finding")}</span>
          </p>
        )}
        <p className="grow-0 text-base-content/70 text-sm">{copy("ai-answers.source", { total: measured, answered: String(section.answeredSearches) })}</p>
        {/* SPEC §2: a correction reuses the AI answers already read, and the
            card says so — only then. */}
        {section.coverage === "cached_only" ? (
          <p className="grow-0 text-base-content/70 text-xs">{copy("ai-answers.coverage.cached-only")}</p>
        ) : null}
        {/* Issue 715: answers a recent scan already had carry the date they
            were bought; absent where this pass bought every answer here. */}
        {section.reusedFrom === null ? null : (
          <p className="grow-0 text-base-content/70 text-xs" data-testid="ai-answers-reused-from">
            <Num phrase>{copy("ai-answers.reused-from", { date: formatReusedOn(section.reusedFrom) })}</Num>
          </p>
        )}

        <div className="flex min-w-0 flex-col gap-1">
          <p className="eyebrow grow-0">{copy("report.ai.waffle")}</p>
          <AnswerMatrix rows={matrixRows(section)} questions={section.rows.map((row) => String(row.question.n))} label={copy("ai-answers.title")} />
        </div>

        {quote === null ? null : (
          <figure className="rounded-box flex flex-col gap-1 bg-base-200 px-3.5 py-3" data-testid="ai-answers-quote">
            <figcaption className="text-base-content/70 text-xs">
              <Num phrase>{copy("report.ai.quote", { search: quote.search })}</Num>
            </figcaption>
            <blockquote className="text-sm">
              <Emphasised text={quote.text} bold={quote.bold} />
            </blockquote>
          </figure>
        )}

        {/* SPEC §2 (owner, 2026-10-07, issue 1328): the questions open from
            their own name, in a `details` that opens with no script. */}
        <details className="group border-base-300 border-t pt-2" data-testid="ai-answers-questions">
          <LinkSummary>
            {partial ? copy("ai-answers.questions.title.partial", { total, measured }) : copy("report.ai.asked", { total })}
          </LinkSummary>
          <div className="hidden min-w-0 flex-col gap-4 pt-2 group-open:flex">
            <AnswerColumns rows={section.rows} />
            {/* Issue 873: what was measured, stated rather than counted off
                the rows. */}
            <p className="text-base-content/70 text-xs">
              {copy(partial ? "ai-answers.questions.measured.partial" : "ai-answers.questions.measured", {
                measured,
                total,
              })}
            </p>
            <QuestionRows rows={section.rows} />
          </div>
        </details>
      </div>
    </section>
  );
}

/** REQ-004 c10/c11: a section that could not be produced is named as
 *  absent in one written line, and the rest of the report stays usable —
 *  never an empty card, never a spinner. */
export function AiAnswersAbsent(p: { cutOff?: boolean; domain?: CanonicalDomain } = {}): React.JSX.Element {
  return (
    <section className="card bg-base-100 shadow-(--shadow-card) min-w-0">
      <div className="card-body gap-4">
        <Head right={<Num unmeasured>{dash()}</Num>} />
        <p className="grow-0 text-sm">{copy("ai-answers.absent")}</p>
        {/* The part this card could not measure is offered again on the card:
            "Retry this part" where the pass's ceiling cut it off (SPEC §2),
            and it re-runs that part inside the report's own 12¢ (issue 715).
            The other arm — a card absent for its own reason, on a pass no
            ceiling stopped — offers the report-level re-scan instead, and
            wiring that one is #935's. */}
        {p.cutOff === true && p.domain !== undefined ? (
          <RetryPartControl domain={p.domain} part={AI_ANSWERS_PART} />
        ) : (
          <div className="card-actions">
            <button type="button" className="btn btn-soft btn-primary btn-sm">
              {copy(p.cutOff === true ? "control.retry-part" : "control.rescan-incomplete")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
