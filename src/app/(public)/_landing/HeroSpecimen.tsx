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

/** One measured answer, as the matrix draws it. §2.4's own rule, and the
 *  chart's: a question nobody was asked is a **muted** cell and never a
 *  miss, because merging the two would count a silence as a loss. An
 *  answered question names the domain or it does not — that is the cited /
 *  not-cited pair, and there is no third reading of it. */
function cellState(cell: AnswerCell, domain: string): AiDotMatrixCellState {
  if (cell.kind !== "answered") return "muted";
  return cell.citedDomains.some((cited) => cited === domain) || cell.namesCustomer ? "cited" : "not-cited";
}

/** The reserved fixture's AI-answers module, as the matrix draws it.
 *
 *  **One row — the customer's own — and not the rivals'.** The idiom's hero
 *  draws four rows, the customer's empty and ringed against two filled
 *  rivals', and that is the better argument. It does not fit the component
 *  v3 actually has: `AiDotMatrixChart` reserves 66px for a row's name
 *  (`NAME_X`), which is what Overview's single tile row needs, and a rival
 *  domain like `rival-three.example.org` draws past the viewBox — three
 *  `<g>` groups escaping their `<svg>`, which the layout suite's check 2
 *  reported on the first run and the canary pins as a real defect.
 *
 *  The two ways to make four rows fit are both refused: shortening a domain
 *  truncates a **value**, which §2.3 forbids and check 3 catches whether or
 *  not it is allow-listed; and widening the name gutter is a change to a
 *  registered chart's contract, which is not this issue's to make. The
 *  multi-row matrix is the report's own module (issue #11) and is not built
 *  in v3 yet — when it is, this specimen gets the rivals with it.
 *
 *  What renders is still a real measured module on real data: the fixture
 *  account's own row, its empty cells ringed, and its count beside them. */
function specimenRows(): readonly AiDotMatrixRow[] {
  const answers = FIXTURE_REPORT.aiAnswers;
  if (answers === null) return [];
  const you: AiDotMatrixRow = {
    name: answers.ownDomain,
    identity: "you",
    cells: answers.rows.map((row) => cellState(row.cell, answers.ownDomain)),
    count: `${answers.customerCitations}/${answers.measuredSearches}`,
  };
  return [you];
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
      <p className="rk-quiet">{copy("landing.hero.specimen.caption")}</p>
    </div>
  );
}
