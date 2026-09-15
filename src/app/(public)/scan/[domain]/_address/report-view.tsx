// BUILD §4.1 — the report, whole
//
// The six modules in §4.1's order, at most one notice, exactly one control
// (or none), and the removal address at the foot. A screen composition,
// daisyUI classes in the route (DESIGN rule 1): `alert` for the notice,
// `btn` for the one control; every module below is its own card.
//
// §4.1's own order, with the two 2026-09-03 amendments folded in:
//   1. verdict strip — score, band, one written line. No driver bars.
//   2. two equal cards, side by side — AI answers · Google search. Each
//      one leads with its verdict and draws its own figure: §2.4's AI
//      dot matrix on the left, its presence bars on the right (issue
//      #352). No per-question volume, no market-total footnote.
//   3. three problem cards.
//   4. three DIY collapses.
//   5. free page card.
//   6. pricing card.
//
// **Nothing on this screen branches on payment, session or tier.** There
// is no parameter here that could carry one, which is how REQ-004 c5's "no
// part hidden, blurred, rounded down, locked, or marked as available on
// payment" is discharged — by there being nothing to pass.
//
// A section the scan could not produce renders as a named absent section
// with one written line (REQ-004 c10/c11) — never an empty card, never a
// spinner — and the rest of the report stays usable.
import type React from "react";
import { CircleAlert } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { ScoreFactorName } from "@/lib/measure/score";
import type { StoredReport } from "@/lib/scan/report";
import { AiAnswersAbsent, AiAnswersCard } from "../_modules/ai-answers";
import {
  GooglePresenceAbsent,
  GooglePresenceCard,
} from "../_modules/google-presence";
import { FreePageAbsent, FreePageCard } from "../_modules/free-page";
import { PricingCard } from "../_modules/pricing";
import { CheckCards, ProblemCards } from "../_problems/cards";
import { checkCardsOf, readingsOf } from "../_problems/checks";
import { MethodSections } from "../_problems/method";
import { cardsOf, PROBLEM_ORDER } from "../_problems/model";
import { unblockLines } from "../_problems/unblock";
import { RemovalAddressLine } from "./removal";
import type { AddressControl, AddressNotice } from "./state";
import { refusalLine } from "./refusal";
import { VerdictStrip } from "./verdict";
// #103: the category has one home — the market the profile inferred.
// `categoryOf` is the one derivation of it, and the screen reads it here
// rather than from a second member the blob used to carry.
import { categoryOf } from "@/lib/scan/sections";

/** BUILD §6.3a / DECISIONS 2026-08-28: MVP is US-English only, one
 *  location constant, so the date a report was measured is formatted once,
 *  here, in that one locale. */
const REPORT_LOCALE = "en-US";

/** The factor's own name, for the notice line that lists what was not
 *  measured. The same three keys the verdict strip's own missing-factor
 *  lines resolve — one name per factor, one home. */
const FACTOR_NAME_KEY: Readonly<Record<ScoreFactorName, CopyKey>> =
  Object.freeze({
    foundations: "verdict.factor.foundations",
    answerability: "verdict.factor.answerability",
    presence: "verdict.factor.presence",
  });

function formatMeasuredOn(at: Date): string {
  return at.toLocaleDateString(REPORT_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** The drivers the pass could not measure, named in the notice's own slot.
 *  The separator is `", "` and is not a sentence — the artboard draws
 *  "and", which is the owner's to say. */
function incompleteLine(unmeasured: readonly ScoreFactorName[]): string {
  return copy("notice.incomplete", {
    what: unmeasured.map((factor) => copy(FACTOR_NAME_KEY[factor])).join(", "),
  });
}

/** The label of the control that answers a notice, so the panel and the
 *  standalone button cannot name the same action two different ways. */
function controlLabel(control: AddressControl & { kind: "rescan" }): string {
  return copy(control.because === "incomplete" ? "control.rescan-incomplete" : "control.rescan-age");
}

/** REQ-001 c14: the notice carries the sentence and the one control that
 *  answers it together. `role="alert"` keeps it announced once. */
function IncompleteNotice(p: {
  unmeasured: readonly ScoreFactorName[];
  control: AddressControl & { kind: "rescan" };
}): React.JSX.Element {
  return (
    <div role="alert" className="alert alert-warning flex flex-wrap">
      <CircleAlert size={20} strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1">{incompleteLine(p.unmeasured)}</span>
      <button type="button" className="btn btn-outline btn-sm">
        {controlLabel(p.control)}
      </button>
    </div>
  );
}

/** A total switch: at most one line, ever, and `null` is an arm rather
 *  than a missing value. `warn` is whether the line takes the warning tone. */
function noticeOf(notice: AddressNotice): { line: string; warn: boolean } {
  switch (notice.kind) {
    // The list is a non-empty tuple (`state.ts`), so `{what}` is never
    // filled with the empty string: `resolve.ts` sends `null` instead of
    // an empty `incomplete` (#541).
    case "incomplete":
      return { line: incompleteLine(notice.unmeasured), warn: true };
    case "site_unreadable":
      return { line: copy("notice.site-unreadable"), warn: true };
    case "measurement_failed":
      return { line: copy("notice.measurement-failed"), warn: true };
    case "correction_failed":
      return { line: copy("notice.correction-failed"), warn: true };
    case "refused":
      return { line: refusalLine(notice.refusal), warn: false };
    default: {
      const exhaustive: never = notice;
      return exhaustive;
    }
  }
}

function NoticeLine(p: { notice: AddressNotice | null }): React.JSX.Element | null {
  if (p.notice === null) return null;
  const { line, warn } = noticeOf(p.notice);
  return (
    <div role="alert" className={warn ? "alert alert-warning" : "alert"}>
      <CircleAlert size={20} strokeWidth={1.75} aria-hidden />
      <span>{line}</span>
    </div>
  );
}

/** A total switch: `none` has no label, every other arm has exactly one. */
function controlLabelOf(control: AddressControl): string | null {
  switch (control.kind) {
    case "none":
      return null;
    case "rescan":
      return controlLabel(control);
    case "retry":
      return copy("control.retry");
    case "correction_retry":
      return copy("control.correction-retry");
    default: {
      const exhaustive: never = control;
      return exhaustive;
    }
  }
}

/** Exactly one control, or none, and never a second alongside it. */
function ControlButton(p: { control: AddressControl }): React.JSX.Element | null {
  const label = controlLabelOf(p.control);
  if (label === null) return null;
  return (
    <div>
      <button type="button" className="btn btn-outline">
        {label}
      </button>
    </div>
  );
}

/** SPEC §2: a part is cut off when the pass stopped at one of its two
 *  ceilings — not when it finished, failed, or could not read the site. */
function cutByCeiling(report: StoredReport): boolean {
  return report.stoppedReason === "time_ceiling" || report.stoppedReason === "spend_ceiling";
}

export function ReportView(p: {
  state: {
    report: StoredReport;
    notice: AddressNotice | null;
    control: AddressControl;
  };
}): React.JSX.Element {
  const { report, notice, control } = p.state;
  const measuredOn = formatMeasuredOn(report.verdict.measuredAt);
  const cards = cardsOf(report, unblockLines(report.blockedAgents));
  const cutOff = cutByCeiling(report);

  return (
    // ADR-093 decision 6: the report is a screen, so it is a screen root,
    // and its three band arms are declared rather than defaulted. Compact
    // is one column — §4.1's "two equal cards, side by side" and the
    // three-card grid both stack. Medium is where they sit side by side.
    // Wide adds no further structural change to this screen, so it says
    // so rather than repeating the arm below it.
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "columns", count: 2 },
        wide: { kind: "same-as-below" },
      }}
    >
      {/* 2026-09-07, issue #241: the arm draws the columns. This screen
          declares `medium: columns:2`, and until `surface.css` existed that
          declaration rendered nothing — so the two-up rows carried their own
          `lg:grid-cols-2`, the same 1024px boundary written a second time,
          and the column's own width and air were three raw values
          (`max-w-[1060px]`, `mx-auto`, `p-6`) beside the two ruled measures.
          All of it is the container's now: `--w-wide` 1216px is
          `design/tokens.md` §2b's "multi-column content column — the public
          report's six modules", which is this screen by name.

          `<main>` stays the landmark and spans the arm's tracks, and
          `grid-cols-subgrid` puts the rows below on *those* tracks rather
          than on a second set of its own: the two-up cards take one track
          each, and a row that spans the screen says so once, in
          `col-span-full`. At compact the grid is one column and every span
          is a no-op. `display: contents` would read the same and is wrong
          here — an element with no box has no border box for conformance
          check 2 to contain its children in, so every row reported as
          escaping. */}
      {/* `items-start` (issue #244).
        *
        * The two-up cards are subgrid items in the same row, so without it
        * each grows to the taller of the pair — and daisyUI's own
        * `.card-body p { flex-grow: 1 }` then hands that slack to the
        * card's paragraphs. On the presence card at 1280 that put one line
        * of text in a 399px band and its legend in another 393px one, with
        * the bars stranded in between. A shorter card keeps its own
        * height; `Card` itself stops the distribution for the cases a
        * layout does stretch one. */}
      <main className="col-span-full grid grid-cols-subgrid items-start">
        {/* REQ-001 c14: the notice and the one control that answers it sit
          together, so a visitor reads what happened and what they can do
          about it in one place. */}
        <div className="col-span-full flex flex-col gap-3">
          {notice !== null && notice.kind === "incomplete" && control.kind === "rescan" ? (
            <IncompleteNotice unmeasured={notice.unmeasured} control={control} />
          ) : (
            <>
              <NoticeLine notice={notice} />
              <ControlButton control={control} />
            </>
          )}
        </div>

        {/* **The copy control is in the header's bar** (UI-SPEC S2, issue
            #357). It stood here for one release because the shared chrome
            had no per-route slot; ruling 3a gave it one, and the layout
            hands the bar this address. REQ-001 c7 is unchanged — the
            control is on the screen that owns the address — and it is on it
            once. */}
        <div className="col-span-full">
          <VerdictStrip
            verdict={report.verdict}
            category={categoryOf(report.market)}
            measuredOn={measuredOn}
          />
          {/* SPEC §2: what was measured, in one line that is always shown. */}
          <p className="text-base-content/60 mt-2 font-mono text-xs">{copy("report.measurement")}</p>
        </div>

        {report.aiAnswers === null ? (
          <AiAnswersAbsent cutOff={cutOff} />
        ) : (
          <AiAnswersCard section={report.aiAnswers} measuredOn={measuredOn} />
        )}
        {report.presence === null ? (
          <GooglePresenceAbsent cutOff={cutOff} />
        ) : (
          <GooglePresenceCard section={report.presence} />
        )}

        <div className="col-span-full">
          <ProblemCards cards={cards} />
        </div>
        <div className="col-span-full">
          {/* SPEC §9's other eight checks, as the scan stored them (#570). A
              check that could not run is absent with its why-line. */}
          <CheckCards cards={checkCardsOf(readingsOf(report.siteIssues, report.verdict.measuredAt))} />
        </div>
        <div className="col-span-full">
          <MethodSections for={PROBLEM_ORDER} />
        </div>

        {/* Modules 5 and 6 are full-width rows, not two cards side by
            side: UI-SPEC S2 draws the giveaway across the report and the
            offer centred under it at the reading measure. They are the
            screen's two trades, and a trade beside a trade reads as a
            choice between them. */}
        <div className="col-span-full">
          {report.freePage === null ? (
            <FreePageAbsent cutOff={cutOff} />
          ) : (
            <FreePageCard section={report.freePage} />
          )}
        </div>
        <div className="col-span-full mx-auto w-full max-w-xl">
          <PricingCard />
        </div>

        <div className="text-base-content/60 col-span-full text-sm">
          <RemovalAddressLine />
        </div>
      </main>
    </Surface>
  );
}
