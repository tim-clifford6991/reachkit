// BUILD §4.1 module 2, left card — AI answers
//
// "AI answers appear on {m} of your 12 biggest searches", the per-rival
// rows over those m, and "The 12 questions" beneath a divider. Leads with
// the answer, not the metric; carries its source as one quiet chip; states
// its method in one line.
//
// **Three things this card deliberately does not hold.** No per-question
// `{vol}/mo` — the owner removed it on 2026-09-03 and `StoredQuestion` has
// no volume member to render. No dot matrix of its own: the AI
// dot-matrix is `BUILD.md` §2.4's closed chart inventory, owned by issue
// #11, so it arrives here as a named, absent-safe `matrix` slot. The rows
// are direct-labelled either way — name and value in writing — so the card
// says everything it claims with the slot empty (§2.4: "identity is never
// colour-alone").
//
// **§6.2's three answer columns are drawn here** (issue #157, design sheet
// linked on the issue). §6.2 rules the paid battery "rendered as three
// answer columns", every row carries them as data
// (`AiAnswersSection.rows[].engines`), and `AnswerColumns` below is that
// data laid out: one column per engine, one row per question, every cell
// a written state. It is §2.2's registered `Table` and not a sixth chart —
// §2.4's inventory is closed at five and a new form is an approval of its
// own — which also buys the `overflow-x-auto` wrap that lets four columns
// narrow to 320px by scrolling instead of by shrinking their type.
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
import type React from "react";
import { Badge, Card, Divider, Table } from "@/ui/components";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { renderQuestion } from "@/lib/presentation/generated";
import type {
  AiAnswersSection,
  AnswerCell,
  BatteryEngine,
  StoredQuestion,
} from "@/lib/scan/report";
import { Num, ratio } from "../_address/measured";

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
    return <Badge tone="neutral">{copy("ai-answers.engine.not-measured")}</Badge>;
  }
  if (cell.kind === "no_answer") {
    return <Badge tone="neutral">{copy("ai-answers.question.no-answer")}</Badge>;
  }
  return cell.namesCustomer ? (
    <Badge tone="ok">{copy("ai-answers.engine.cell.cited")}</Badge>
  ) : (
    <Badge tone="bad">{copy("ai-answers.question.not-you")}</Badge>
  );
}

/** §6.2's three answer columns. Renders nothing where no engine was asked
 *  at all — the card's own denominator lines already state that, and an
 *  empty table under four headers would say it a second time and worse. */
function AnswerColumns(p: { rows: AnswerRows }): React.JSX.Element | null {
  const engines = engineOrder(p.rows);
  const drawn = engines.filter((engine) => wasAsked(p.rows, engine));
  const neverAsked = engines.filter((engine) => !wasAsked(p.rows, engine));
  if (drawn.length === 0) return null;

  return (
    <>
      <Table
        columns={[
          { key: "n", header: copy("ai-answers.engine.column.question") },
          ...drawn.map((engine) => ({ key: engine, header: copy(ENGINE_LABEL[engine]) })),
        ]}
        rows={p.rows.map((row) => ({
          n: <Num>{String(row.question.n)}</Num>,
          ...Object.fromEntries(
            drawn.map((engine) => [engine, <AnswerState key={engine} cell={cellFor(row, engine)} />])
          ),
        }))}
        // Unreachable, and required anyway: `drawn` is empty whenever
        // `rows` is, so this component has already returned null. `Table`
        // admits no fallback for it by design, so it takes the sentence
        // that would be true — nothing was asked — rather than a string
        // invented to satisfy the prop.
        emptyMessage={copy("ai-answers.engine.not-measured")}
      />
      {neverAsked.map((engine) => (
        <p key={engine} className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="neutral">{copy(ENGINE_LABEL[engine])}</Badge>
          <span className="opacity-60">{copy("ai-answers.engine.not-measured")}</span>
        </p>
      ))}
    </>
  );
}

function QuestionRow(p: { row: { question: StoredQuestion; cell: AnswerCell } }): React.JSX.Element {
  const { question, cell } = p.row;
  const namesCustomer = cell.kind === "answered" && cell.namesCustomer;
  // The brands the AI answer named, from the cell that measured them
  // (#103). They rode on the question until then, which put a fact about
  // the *answer* on the object beside it and made a third copy of this
  // very list. A question whose answer named nobody names none — an empty
  // list, never a claim.
  const namedBrands = cell.kind === "answered" ? cell.citedDomains : [];
  const [wording, provenance] = renderQuestion({
    wording: question.wording,
    provenance: copy("ai-answers.question.provenance", {
      search: question.search,
      brands: namedBrands.join(", "),
    }),
  });

  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex items-baseline gap-2">
        <Num>{question.n}</Num>
        <span className="flex-1">{wording.text}</span>
        {cell.kind === "no_answer" ? (
          <Badge tone="neutral">{copy("ai-answers.question.no-answer")}</Badge>
        ) : namesCustomer ? null : (
          <Badge tone="bad">{copy("ai-answers.question.not-you")}</Badge>
        )}
      </div>
      <p className="text-xs opacity-60">
        <Num>{provenance.text}</Num>
      </p>
    </li>
  );
}

export function AiAnswersCard(p: {
  section: AiAnswersSection;
  /** Issue #11's `AiDotMatrixChart`. Absent is an absence, not a loading
   *  state and not an empty state — the rows below still carry every
   *  figure the chart would draw. */
  matrix?: React.ReactNode;
  /** The date the SERPs behind this card were read, already formatted by
   *  the caller that owns the report's one date. */
  measuredOn: string;
}): React.JSX.Element {
  const { section } = p;
  const shown = section.rows.slice(0, QUESTIONS_SHOWN);

  return (
    <Card
      state="default"
      title={
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span>{copy("ai-answers.title")}</span>
          <Badge tone="neutral">{copy("ai-answers.source", { date: p.measuredOn })}</Badge>
        </div>
      }
    >
      <p>
        {copy("ai-answers.denominator", {
          answered: String(section.answeredSearches),
          measured: String(section.measuredSearches),
        })}
      </p>
      <p>
        {copy("ai-answers.customer-citations", {
          cited: String(section.customerCitations),
          answered: String(section.answeredSearches),
        })}
      </p>

      {p.matrix}
      <AnswerColumns rows={section.rows} />

      <Table
        columns={[
          { key: "domain", header: copy("ai-answers.matrix.column.domain") },
          { key: "cited", header: copy("ai-answers.matrix.column.cited") },
        ]}
        rows={[
          {
            domain: <Num>{section.ownDomain}</Num>,
            cited: <Num>{ratio(section.customerCitations, section.answeredSearches)}</Num>,
          },
          ...section.rivals.map((rival) => ({
            domain: <Num>{rival.domain}</Num>,
            cited: <Num>{ratio(citedCount(rival.cells), answeredCount(rival.cells))}</Num>,
          })),
        ]}
        emptyMessage={copy("ai-answers.matrix.empty")}
      />
      <p className="text-xs opacity-60">{copy("ai-answers.legend")}</p>

      <Divider />

      <h3>{copy("ai-answers.questions.title")}</h3>
      <ul className="list-none p-0">
        {shown.map((row) => (
          <QuestionRow key={row.question.n} row={row} />
        ))}
      </ul>
      {section.rows.length > shown.length ? (
        <Badge tone="neutral">
          {copy("ai-answers.questions.show-all", { total: String(section.rows.length) })}
        </Badge>
      ) : null}
      <p className="text-xs opacity-60">{copy("ai-answers.method")}</p>
    </Card>
  );
}

/** REQ-004 c10/c11: a section that could not be produced is named as
 *  absent in one written line, and the rest of the report stays usable —
 *  never an empty card, never a spinner. */
export function AiAnswersAbsent(): React.JSX.Element {
  return <Card state="degraded" title={copy("ai-answers.title")} degradedLine={copy("ai-answers.absent")} />;
}
