// BUILD §4.1 — the report, whole
//
// The six modules in §4.1's order, at most one notice, exactly one control
// (or none), and the removal address at the foot. A screen composition,
// not a registry row: every visible element is one of `src/ui/components`'
// registered rows or a layout element around them.
//
// §4.1's own order, with the two 2026-09-03 amendments folded in:
//   1. verdict strip — score, band, one written line. No driver bars.
//   2. two equal cards, side by side — AI answers · Google search.
//      No per-question volume, no market-total footnote.
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
import { Alert, Btn } from "@/ui/components";
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
import { ProblemCards } from "../_problems/cards";
import { MethodSections } from "../_problems/method";
import { cardsOf, PROBLEM_ORDER } from "../_problems/model";
import { unblockLines } from "../_problems/unblock";
import { RemovalAddressLine } from "./removal";
import type { AddressControl, AddressNotice } from "./state";
import { refusalLine } from "./refusal";
import { VerdictStrip } from "./verdict";

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

/** A total switch: at most one line renders, ever, and `null` is an arm
 *  rather than a missing value. */
function NoticeLine(p: {
  notice: AddressNotice | null;
}): React.JSX.Element | null {
  const notice = p.notice;
  if (notice === null) return null;
  switch (notice.kind) {
    case "incomplete":
      return (
        <Alert
          tone="warn"
          message={copy("notice.incomplete", {
            what: notice.unmeasured
              .map((factor) => copy(FACTOR_NAME_KEY[factor]))
              .join(", "),
          })}
        />
      );
    case "measurement_failed":
      return <Alert tone="warn" message={copy("notice.measurement-failed")} />;
    case "correction_failed":
      return <Alert tone="warn" message={copy("notice.correction-failed")} />;
    case "refused":
      return <Alert tone="neutral" message={refusalLine(notice.refusal)} />;
    default: {
      const exhaustive: never = notice;
      return exhaustive;
    }
  }
}

/** A total switch: `none` renders nothing, every other arm renders exactly
 *  one control, and there is never a second one alongside it. */
function ControlButton(p: {
  control: AddressControl;
}): React.JSX.Element | null {
  const control = p.control;
  switch (control.kind) {
    case "none":
      return null;
    case "rescan":
      return (
        <Btn
          label={copy(
            control.because === "incomplete"
              ? "control.rescan-incomplete"
              : "control.rescan-age",
          )}
        />
      );
    case "retry":
      return <Btn label={copy("control.retry")} />;
    case "correction_retry":
      return <Btn label={copy("control.correction-retry")} />;
    default: {
      const exhaustive: never = control;
      return exhaustive;
    }
  }
}

export function ReportView(p: {
  state: {
    report: StoredReport;
    notice: AddressNotice | null;
    control: AddressControl;
  };
  /** The canonical address this report lives at — REQ-001 c7's value. */
  canonicalUrl: string;
  /** Sibling nodes' modules, absent-safe. `BUILD.md` §2.4's chart
   *  inventory is closed and issue #11 owns it; an absent slot is an
   *  absence, not a loading state and not an empty state. */
  charts?: {
    aiMatrix?: React.ReactNode;
    presenceBars?: React.ReactNode;
  };
}): React.JSX.Element {
  const { report, notice, control } = p.state;
  const measuredOn = formatMeasuredOn(report.verdict.measuredAt);
  const cards = cardsOf(report, unblockLines(report.blockedAgents));

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
      <main className="mx-auto flex max-w-[1060px] flex-col gap-6 p-6">
        {/* REQ-001 c14: the notice and the one control that answers it sit
          together, so a visitor reads what happened and what they can do
          about it in one place. */}
        <div className="flex flex-col gap-3">
          <NoticeLine notice={notice} />
          <ControlButton control={control} />
        </div>

        <VerdictStrip
          verdict={report.verdict}
          category={report.category}
          measuredOn={measuredOn}
          canonicalUrl={p.canonicalUrl}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {report.aiAnswers === null ? (
            <AiAnswersAbsent />
          ) : (
            <AiAnswersCard
              section={report.aiAnswers}
              measuredOn={measuredOn}
              matrix={p.charts?.aiMatrix}
            />
          )}
          {report.presence === null ? (
            <GooglePresenceAbsent />
          ) : (
            <GooglePresenceCard
              section={report.presence}
              bars={p.charts?.presenceBars}
            />
          )}
        </div>

        <ProblemCards cards={cards} />
        <MethodSections for={PROBLEM_ORDER} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {report.freePage === null ? (
            <FreePageAbsent />
          ) : (
            <FreePageCard section={report.freePage} />
          )}
          <PricingCard />
        </div>

        <RemovalAddressLine />
      </main>
    </Surface>
  );
}
