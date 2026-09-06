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
// And no three-column engine layout, for the same reason and by the same
// mechanism (issue #128). §6.2 rules the paid battery "rendered as three
// answer columns"; every row now **carries** those three columns as data
// (`AiAnswersSection.rows[].engines`), and drawing them changes an
// approved screen — which `CLAUDE.md` gates behind an owner-approved
// artifact and owner-written copy. So the columns arrive here as the
// `engines` slot, exactly as the chart does, and the card renders
// unchanged until that gate is discharged. The four copy keys the layout
// will need are minted and owner-owed (`ai-answers.engine.*`). The
// layout is issue #157.
//
// Question wording is model text and reaches this file only through
// `renderQuestion`, which will not yield the wording without the search it
// came from (REQ-093 c3).
import type React from "react";
import { Badge, Card, Divider, Table } from "@/ui/components";
import { copy } from "@/lib/presentation/copy";
import { renderQuestion } from "@/lib/presentation/generated";
import type { AiAnswersSection, AnswerCell, StoredQuestion } from "@/lib/scan/report";
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

function QuestionRow(p: { row: { question: StoredQuestion; cell: AnswerCell } }): React.JSX.Element {
  const { question, cell } = p.row;
  const namesCustomer = cell.kind === "answered" && cell.namesCustomer;
  const [wording, provenance] = renderQuestion({
    wording: question.wording,
    provenance: copy("ai-answers.question.provenance", {
      search: question.search,
      brands: question.namedBrands.join(", "),
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
  /** §6.2's three answer columns, once the design gate #128 names is
   *  discharged — issue #157. Same standing as `matrix`: absent is an absence, and the
   *  card below is complete without it — the questions list and the
   *  citation table still state, in writing, everything the customer is
   *  told today. The data the layout reads is already on every row
   *  (`section.rows[].engines`), so the follow-up is a rendering change
   *  and not a measurement one. */
  engines?: React.ReactNode;
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
      {p.engines}

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
