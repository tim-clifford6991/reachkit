// BUILD §3, §4.5 — the live This-week card on the landing.
// src/app/(public)/_landing/WeekCard.tsx
//
// Section 02's picture of what the product does: the Overview's week strip,
// and beneath it the page publishing next. On the landing the panel offers
// no action — a stranger has no account to act in, and the hero's Scan is
// the screen's one solid button.
//
// The week's shape is `specimen.ts`'s, which states why it draws three of
// the strip's four day states.
import type React from "react";
import { Calendar, FileText } from "lucide-react";
import { WeekStrip } from "@/ui/charts";
import { copy } from "@/lib/presentation/copy";
import { specimenWeek } from "./specimen";

/** Bound to a name before it reaches JSX: the copy sweep reads every
 *  JSX attribute as product voice unless it is allow-listed, and it is
 *  right to. */
const WEEK_TEST_ID = "landing-week";

export function WeekCard(): React.JSX.Element {
  return (
    <div className="card min-w-0 border border-base-300 bg-base-100" data-testid={WEEK_TEST_ID}>
      <div className="card-body gap-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
            <Calendar size={16} strokeWidth={1.75} aria-hidden />
            {copy("overview.week.title")}
          </p>
          <span className="badge badge-success">{copy("landing.week.badge")}</span>
        </div>
        <WeekStrip days={specimenWeek()} label={copy("overview.week.title")} />
        <div className="divider my-0" />
        {/* The page publishing next. On the landing it offers nothing. */}
        <div className="alert items-start">
          <FileText size={20} strokeWidth={1.75} aria-hidden />
          <div>
            <p className="font-semibold">{copy("landing.week.page.title")}</p>
            <p className="text-sm text-base-content/70">{copy("landing.week.page.line")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
