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
import { Bot } from "lucide-react";
import { Badge, Card, Collapse, Divider, Table } from "@/ui/components";
import { AiDotMatrixChart, type AiDotMatrixCellState, type AiDotMatrixRow } from "@/ui/charts";
import { CardHead } from "@/ui/idiom";
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
      <Badge tone="neutral">{copy(ENGINE_LABEL[p.engine])}</Badge>
      <span className="text-[color:var(--ink-quiet)]">{copy("ai-answers.engine.not-measured")}</span>
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
      {/* A mono **phrase**, not a single value: it is a line of language
          with a search inside it, and `.num`'s "never break a value" rule
          would otherwise hold the whole line on one unbreakable run
          (§2.3, issue #307's own `phrase` arm). */}
      <p className="t-explain text-[color:var(--ink-quiet)]">
        <Num phrase>{provenance.text}</Num>
      </p>
    </li>
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
    <Card
      state="default"
      title={
        <CardHead
          // The set's own glyph for this card (UI-SPEC §2's chip row, and
          // the icon its `cardHead('bot', 'AI answers', …)` names). It is
          // decorative — the eyebrow beside it is the label.
          icon={<Bot size={15} strokeWidth={1.8} aria-hidden />}
          eyebrow={copy("ai-answers.title")}
          pill={
            <Badge tone="neutral" wrap>
              {copy("ai-answers.source", { date: p.measuredOn })}
            </Badge>
          }
        />
      }
    >
      {/* The card leads with its answer, not with its metric (§2.5). The
          set sets this line at `--t-sm`, semibold — the ladder's 13 (10a)
          — not at a heading step: the card's head is its eyebrow, and a
          second heading under it would be a second head. */}
      <p className="t-sm font-semibold">
        {copy("ai-answers.denominator", {
          answered: String(section.answeredSearches),
          measured: String(section.measuredSearches),
        })}
      </p>

      {/* A chart is drawn at `width: 100%` of the box it is given, and the
          box is a declared scroll container so a matrix wider than the
          card scrolls rather than shrinking its labels (ADR-093: content
          fits its box or the box changes). */}
      <div className="min-w-0 overflow-x-auto">
        <AiDotMatrixChart
          rows={matrixRows(section)}
          // Each column is identified by its question's own **number**,
          // never its wording: the wording is `GeneratedText` and carries
          // its label with it (REQ-093 c3), and a number is a data
          // identity that sets in the mono numeral face like every other
          // numeral in the product (§2.3).
          questions={section.rows.map((row) => String(row.question.n))}
          label={copy("ai-answers.title")}
        />
      </div>
      {/* **No second count line under the matrix.** The customer's own row
          is drawn `n/m` beside their name, which is REQ-006 c1's citation
          count against c1's own denominator and REQ-006 c4's measurement
          of a customer cited on none; a sentence repeating it would be the
          same claim twice, and the approved set draws one line here, not
          three. `ai-answers.customer-citations` and `ai-answers.legend`
          are no longer spoken by this card — §2.4 has no legend-only mode
          because every mark is direct-labelled. */}

      <AnswerColumns rows={section.rows} />

      <Divider />

      {/* A section label inside a card is the eyebrow rung (§2.3's
          "uppercase 10.5–11px eyebrows for section labels"), not a second
          card head: `--h3` here put the list's label at the same weight
          as the card's own verdict.
          **And not a heading element either**: `heading-scale.test.ts`
          holds every rendered heading to its own step of the ruled scale,
          which an 11px `h3` is not — a label is a label, and the landing's
          own section labels are `p.eyebrow` for the same reason. */}
      <p className="eyebrow text-[color:var(--ink-quiet)]">{copy("ai-answers.questions.title")}</p>
      <ul className="list-none p-0">
        {shown.map((row) => (
          <QuestionRow key={row.question.n} row={row} />
        ))}
      </ul>
      {/* REQ-006 c8: "the first four visible and the remainder one action
          away". The action is the registered `Collapse` — `details` and
          `summary`, so the remaining questions are in the document, are
          reachable with no JavaScript, and stay in the accessibility tree.
          The set draws a quiet pill labelled "Show all 12"; a pill with no
          behaviour would be the label without the action, which is the
          half c8 does not accept. */}
      {rest.length === 0 ? null : (
        <Collapse
          summary={copy("ai-answers.questions.show-all", { total: String(section.rows.length) })}
        >
          <ul className="list-none p-0">
            {rest.map((row) => (
              <QuestionRow key={row.question.n} row={row} />
            ))}
          </ul>
        </Collapse>
      )}
      {/* REQ-006 c6's one written line: what was measured, and no second
          engine named anywhere on the card. */}
      <p className="t-explain text-[color:var(--ink-quiet)]">{copy("ai-answers.method")}</p>
    </Card>
  );
}

/** REQ-004 c10/c11: a section that could not be produced is named as
 *  absent in one written line, and the rest of the report stays usable —
 *  never an empty card, never a spinner. */
export function AiAnswersAbsent(): React.JSX.Element {
  return <Card state="degraded" title={<CardHead icon={<Bot size={15} strokeWidth={1.8} aria-hidden />} eyebrow={copy("ai-answers.title")} />} degradedLine={copy("ai-answers.absent")} />;
}
