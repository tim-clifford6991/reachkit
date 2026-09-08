// BUILD §3, §2.4 — the landing hero's specimen (issue #266).
// src/app/(public)/_landing/HeroSpecimen.tsx
//
// The owner's 2026-09-02 ruling asked for "an enticing image/component
// giving them an immediate feel for what the app is and looks like". The
// approved idiom answers it with **a real component from the product, not a
// picture of one**, and its argument is worth keeping where the code is
// (`/idiom/landing`'s own note, condensed):
//
//   · it makes the product's whole argument without a sentence — and on a
//     page where every sentence is still owed, that is not a nice property,
//     it is the only thing that renders at all;
//   · it is the same code a customer meets after paying, so it cannot go
//     stale, it re-themes with the toggle, it inherits every token ruling,
//     and it is inside ADR-093's conformance suite, which no image is;
//   · a screenshot is a second home for a surface that already has one, and
//     a hero image rots the first time a token is ruled;
//   · it is not interactive, so the argument is not behind a tap.
//
// **One module, not a whole screen.** The trade the idiom records: a scaled
// screenshot of the entire app survives a 320px viewport and a live
// component does not, because a live component at 320 renders its own
// compact arm and stops looking like the product. So the choice is one
// module, which is legible at every band.
//
// **WHERE THE FIGURES COME FROM, STATED.** `design/tokens.md` §9.4 raised
// this as an open question for both this surface and the sign-in panel: a
// score shown to a stranger is either a real measurement, a labelled
// specimen, or a number the product invented — and the third is rule 1.2.
// Issue #266 answers it: these are the **reserved fixture account's** own
// measured figures, the same ones `/scan/example.com` renders, and the
// caption names them as a specimen rather than letting them read as the
// visitor's. Nothing here is invented and nothing is a placeholder.
import type React from "react";
import { AiDotMatrixChart, type AiDotMatrixCellState, type AiDotMatrixRow } from "@/ui/charts";
import type { AnswerCell } from "@/lib/market/questions/matrix";
import { Search } from "lucide-react";
import { Badge } from "@/ui/components/Badge";
import { CardHead } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import { FIXTURE_REPORT } from "../scan/[domain]/_fixture/states";
import { ratio } from "../scan/[domain]/_address/measured";

/** One measured answer, as the matrix draws it. §2.4's own rule, and the
 *  chart's: a question nobody was asked is a **muted** cell and never a
 *  miss, because merging the two would count a silence as a loss. An
 *  answered question names the row's own domain or it does not — that is
 *  the cited / not-cited pair, and there is no third reading of it.
 *
 *  `namesCustomer` is read on the customer's row alone, and that is not a
 *  detail: it is the answer's record of whether it named *the customer*,
 *  so on a rival's row it would count someone else's citation as that
 *  rival's. A rival is cited when the answer cites the rival's own
 *  domain, and by nothing else. */
function cellState(cell: AnswerCell, domain: string, own: boolean): AiDotMatrixCellState {
  if (cell.kind !== "answered") return "muted";
  const named = cell.citedDomains.some((cited) => cited === domain) || (own && cell.namesCustomer);
  return named ? "cited" : "not-cited";
}

/** How many of the answers named this row's domain — the `n` of the row's
 *  own `n/m`, counted the same way the cells are painted, so the count and
 *  the drawing cannot disagree. */
function citedCount(cells: readonly AnswerCell[], domain: string, own: boolean): number {
  return cells.filter((cell) => cellState(cell, domain, own) === "cited").length;
}

/** The two rival rows the archive's hero draws. Not a pin any other module
 *  reads and not a cap on the report: it is this specimen's own layout
 *  parameter, the way the report card's "first 4 shown" is its own, and it
 *  is the count `/idiom/landing` draws — two rivals filled against the
 *  customer's empty row, which is the whole argument in one picture. */
const SPECIMEN_RIVALS = 2;

/** The reserved fixture's AI-answers module, as the matrix draws it: the
 *  two rivals' rows filled, and the customer's own row empty and
 *  red-ringed beneath them.
 *
 *  **This is the argument the hero is for** — the archive's own note on
 *  `/idiom/landing`: the specimen "makes the product's whole argument
 *  without a sentence, and on a page where every sentence is still owed
 *  that is not a nice property, it is the only thing that renders at all".
 *  One row cannot make it: a row of empty cells with nothing beside it
 *  says the measurement found nothing, not that two rivals are cited where
 *  the customer is not.
 *
 *  It was one row until now for a reason that has been fixed rather than
 *  worked around (issue #351): `AiDotMatrixChart` reserved a fixed 66-unit
 *  name gutter, and `rival-two.example.net` drew left of the viewBox —
 *  a `<g>` escaping its `<svg>`, which the layout suite's check 2 reports.
 *  The chart now derives that gutter from the widest name it is given, so
 *  a domain is neither truncated (§2.3 does not truncate a value) nor
 *  drawn outside the box. The rows are the fixture's own measured cells;
 *  nothing here is invented and nothing is a placeholder.
 *
 *  The rivals come first and the customer's row last, which is the
 *  archive's order and is the reading order of the claim: *they* are
 *  cited, *you* are not. */
function specimenRows(): readonly AiDotMatrixRow[] {
  const answers = FIXTURE_REPORT.aiAnswers;
  if (answers === null) return [];
  const rivals = answers.rivals.slice(0, SPECIMEN_RIVALS).map(
    (rival): AiDotMatrixRow => ({
      name: rival.domain,
      identity: "rival",
      cells: rival.cells.map((cell) => cellState(cell, rival.domain, false)),
      count: ratio(citedCount(rival.cells, rival.domain, false), answers.answeredSearches),
    })
  );
  const you: AiDotMatrixRow = {
    name: answers.ownDomain,
    identity: "you",
    cells: answers.rows.map((row) => cellState(row.cell, answers.ownDomain, true)),
    // `customerCitations` is "counted over m, never over n"
    // (`AiAnswersSection`), and the report's own table renders exactly this
    // ratio. The specimen is the same module over the same data, so it
    // renders the same figure — a row reading `0/12` beside a card that
    // says `0/9` would be two answers to one question.
    count: ratio(answers.customerCitations, answers.answeredSearches),
  };
  return [...rivals, you];
}

/** The `bad`-toned head pill: how many of the measured searches this domain
 *  is absent from, as `n/of`, in the mono numeral face. `null` where the
 *  presence module measured nothing — the pill is then omitted rather than
 *  drawn empty or filled with a number nobody measured. */
function absentFromCount(): React.ReactNode | null {
  const presence = FIXTURE_REPORT.presence;
  if (presence === null) return null;
  return (
    <span className="num">{`${presence.absentFrom.length}/${presence.measuredSearches}`}</span>
  );
}

export function HeroSpecimen(): React.JSX.Element {
  const answers = FIXTURE_REPORT.aiAnswers;
  const rows = specimenRows();
  const absentFrom = absentFromCount();
  if (answers === null || rows.length === 0) return <></>;

  return (
    // An island of `--surface` inside the accent ground — the component in
    // its own theme, exactly as a customer meets it after paying.
    <div className="rk-hero-specimen" data-testid="landing-specimen">
      {/* The idiom draws `Search` here, and a `bad`-toned pill beside it
          (issue #298). The pill is the fixture's **absent-from count** —
          the searches where rivals rank and this domain does not — rendered
          from the specimen's own data rather than from a literal: the
          archive's pill reads a bracketed owed string, and minting one
          would be a sentence nobody wrote. A count is not a sentence.
          It is not the matrix's own row count restated either: that is
          citations in AI answers, this is absence from search results, and
          they are two facts. */}
      <CardHead
        icon={<Search size={16} strokeWidth={2} aria-hidden />}
        eyebrow={copy("landing.hero.specimen.label")}
        pill={absentFrom === null ? undefined : <Badge tone="bad">{absentFrom}</Badge>}
      />
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
        label={copy("landing.hero.specimen.label")}
      />
      {/* The denominator line, under the drawing — the archive's own
          `countLine`, and in v3 it is the report card's own sentence over
          the same two figures rather than a second key saying the same
          thing on a second screen. It is what makes the matrix readable
          without the card around it: how many of the twelve searches an AI
          answered at all, which is the `m` every row's `n/m` is counted
          over. */}
      <p className="rk-quiet">
        {copy("ai-answers.denominator", {
          answered: String(answers.answeredSearches),
          measured: String(answers.measuredSearches),
        })}
      </p>
      <p className="rk-quiet">{copy("landing.hero.specimen.caption")}</p>
    </div>
  );
}
