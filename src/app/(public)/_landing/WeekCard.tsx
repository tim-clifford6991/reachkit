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
//
// **The strip is a CSS grid, not a chart** (DESIGN rule 2): seven cells, the
// day in mono and a short rule under it in the state's theme colour —
// success for done, primary for today, a quiet cell for a day to come. Each
// cell's date and its written state are its accessible name, so identity is
// never colour alone.
import type React from "react";
import { Calendar, FileText } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { specimenWeek } from "./specimen";

type WeekDay = ReturnType<typeof specimenWeek>[number];

/** Bound to a name before it reaches JSX: the copy sweep reads every
 *  JSX attribute as product voice unless it is allow-listed, and it is
 *  right to. */
const WEEK_TEST_ID = "landing-week";

const CELL: Readonly<Record<WeekDay["state"], string>> = Object.freeze({
  done: "bg-base-200",
  today: "bg-primary/10 text-primary",
  "to-come": "bg-base-200 opacity-60",
  "nothing-measured": "bg-base-200",
});

const RULE: Readonly<Record<WeekDay["state"], string>> = Object.freeze({
  done: "bg-success",
  today: "bg-primary",
  "to-come": "bg-base-300",
  "nothing-measured": "bg-warning",
});

/** The cell's accessible name: its date, then its state in words. */
function dayName(day: WeekDay): string {
  return [day.date, day.mark].join(" · ");
}

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
        <ol className="grid grid-cols-7 gap-2" aria-label={copy("overview.week.title")}>
          {specimenWeek().map((day) => (
            <li
              key={day.date}
              className={`rounded-field min-w-0 px-1 py-2 text-center ${CELL[day.state]}`}
              data-state={day.state}
              title={dayName(day)}
            >
              <span className="num block text-sm font-semibold" role="img" aria-label={dayName(day)}>
                {day.date}
              </span>
              <span className={`mt-2 block h-1 w-full rounded-full ${RULE[day.state]}`} aria-hidden />
            </li>
          ))}
        </ol>
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
