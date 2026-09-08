// BUILD §3, §2.4, UI-SPEC S1 section 01 — the live AI-answers card.
// src/app/(public)/_landing/MatrixCard.tsx
//
// **Section 01's argument, and it is a component rather than a sentence.**
// The approved set draws the why-care section as a heading and a body
// beside the report's own AI-answers card: the dot matrix over the reserved
// fixture, with the rivals' rows filled and the customer's own row empty
// and red-ringed, under one approved line — "Every filled row is a rival
// being recommended. The empty one is you."
//
// It is the same component the paying customer meets on their report
// (§4.1 module 2, left card), over the same reserved fixture the
// `/scan/example.com` preview renders, so it cannot go stale, it re-themes
// with the page, and it is inside the layout suite's conformance sweep —
// which no screenshot of a card would be.
//
// **Four rows, and the multi-row matrix is why the chart changed.**
// `AiDotMatrixChart` reserved a fixed 66-unit name gutter while its only
// caller drew one row of an Overview tile; a rival's domain is wider than
// that and was drawn left of the viewBox — a `<g>` escaping its `<svg>`,
// which the layout suite's check 2 reports and `canary.test.ts` pins as a
// real defect. The gutter is now derived from the widest name the caller
// passes (issue #351), so a domain is neither truncated (§2.3 does not
// truncate a value) nor drawn outside its box, and §4.1's own drawing —
// "rivals' cited rows filled gray, customer's row empty red-ringed" —
// renders for the first time.
//
// **Every figure is the fixture's own measurement**, and the counts are
// the report's: `n/m` over the searches an AI actually answered, which is
// what `AiAnswersSection` states ("counted over m, never over n") and what
// the report's own table renders beside this chart on `/scan/{domain}`.
import type React from "react";
import { Bot } from "lucide-react";
import { AiDotMatrixChart, type AiDotMatrixCellState, type AiDotMatrixRow } from "@/ui/charts";
import type { AnswerCell } from "@/lib/market/questions/matrix";
import { Badge } from "@/ui/components/Badge";
import { CardHead, IdiomCard } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import { FIXTURE_REPORT } from "../scan/[domain]/_fixture/states";
import { Num, ratio } from "../scan/[domain]/_address/measured";

/** The chip's date, in the report's own locale — the set draws the source
 *  chip as the date alone, and a date is a value, not a sentence. */
const CHIP_LOCALE = "en-US";

/** One measured answer, as the matrix draws it. §2.4's own rule, and the
 *  chart's: a question nobody was asked is a **muted** cell and never a
 *  miss, because merging the two would count a silence as a loss. An
 *  answered question names the row's own domain or it does not — that is
 *  the cited / not-cited pair, and there is no third reading of it.
 *
 *  `namesCustomer` is read on the customer's row alone, and that is not a
 *  detail: it is the answer's record of whether it named *the customer*, so
 *  on a rival's row it would count someone else's citation as that
 *  rival's. A rival is cited when the answer cites the rival's own domain,
 *  and by nothing else. */
function cellState(cell: AnswerCell, domain: string, own: boolean): AiDotMatrixCellState {
  if (cell.kind !== "answered") return "muted";
  const named = cell.citedDomains.some((cited) => cited === domain) || (own && cell.namesCustomer);
  return named ? "cited" : "not-cited";
}

/** How many of the answers named this row's domain — the `n` of its own
 *  `n/m`, counted the same way the cells are painted, so the count and the
 *  drawing cannot disagree. */
function citedCount(cells: readonly AnswerCell[], domain: string): number {
  return cells.filter((cell) => cellState(cell, domain, false) === "cited").length;
}

/** The rivals' rows first and the customer's last: that is the set's order
 *  and it is the reading order of the claim — *they* are cited, *you* are
 *  not. */
function specimenRows(): readonly AiDotMatrixRow[] {
  const answers = FIXTURE_REPORT.aiAnswers;
  if (answers === null) return [];
  const rivals = answers.rivals.map(
    (rival): AiDotMatrixRow => ({
      name: rival.domain,
      identity: "rival",
      cells: rival.cells.map((cell) => cellState(cell, rival.domain, false)),
      count: ratio(citedCount(rival.cells, rival.domain), answers.answeredSearches),
    })
  );
  return [
    ...rivals,
    {
      name: answers.ownDomain,
      identity: "you",
      cells: answers.rows.map((row) => cellState(row.cell, answers.ownDomain, true)),
      count: ratio(answers.customerCitations, answers.answeredSearches),
    },
  ];
}

/** Bound to a name before it reaches JSX: the copy sweep reads every
 *  JSX attribute as product voice unless it is allow-listed, and it is
 *  right to. */
const MATRIX_TEST_ID = "landing-matrix";

export function MatrixCard(): React.JSX.Element {
  const answers = FIXTURE_REPORT.aiAnswers;
  const rows = specimenRows();
  if (answers === null || rows.length === 0) return <></>;

  return (
    <IdiomCard
      testId={MATRIX_TEST_ID}
      head={
        <CardHead
          icon={<Bot size={15} strokeWidth={1.8} aria-hidden />}
          eyebrow={copy("ai-answers.title")}
          pill={
            <Badge tone="neutral">
              <Num>
                {answers.measuredAt.toLocaleDateString(CHIP_LOCALE, { day: "numeric", month: "short" })}
              </Num>
            </Badge>
          }
        />
      }
    >
      <AiDotMatrixChart
        rows={rows}
        // Every cell is identified by its column and its row, never by
        // colour alone (§2.4) — and the column label is the question's own
        // NUMBER, not its wording. The wording is `GeneratedText`, and
        // CLAUDE.md allows generated prose nowhere but draft page content,
        // always labelled; the landing is the last surface that could carry
        // it unlabelled. The number is a data identity, it is what the
        // report's own list numbers each question by, and it sets in the
        // mono numeral face like every other numeral in the product.
        questions={answers.rows.map((row) => String(row.question.n))}
        label={copy("ai-answers.title")}
      />
      <p className="rk-explain">{copy("landing.why.matrix.line")}</p>
    </IdiomCard>
  );
}
