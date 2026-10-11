// SPEC §4 (2026-10-10, issue 1395) — the process, as eight steps.
//
// From reading the site to measuring again, each step with the customer's
// own figure and a link to the screen that figure comes from. A daisyUI
// `timeline`, vertical at every width: eight labelled steps do not fit one
// row at 390, and a row that fits at 1280 alone would be two layouts.
//
// It is drawn on Overview while the first pass runs, beside the side
// panel's `PassSteps` (which names the step the pass is on), and under
// Settings › Market and rivals. A figure nobody has read yet says so; no
// step states a number of its own.
import type React from "react";
import Link from "next/link";
import { Workflow } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { SHELL_LOCALE, formatDate } from "./format";
import { processSteps, type DoneFacts, type Sentence } from "../_overview/done";

/** The stored publish time (`07:00`) as every other screen states a time. */
function clockTime(stored: string): string {
  const [hour = 0, minute = 0] = stored.split(":").map(Number);
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(
    new Date(Date.UTC(2000, 0, 1, hour, minute))
  );
}

function figure(s: Sentence, timeZone: string): string {
  const vars: Record<string, string | number> = { ...s.vars };
  if (typeof vars.time === "string") vars.time = clockTime(vars.time);
  for (const [slot, at] of Object.entries(s.at ?? {})) vars[slot] = formatDate(at, timeZone);
  return copy(s.key, vars);
}

export function ProcessTimeline(p: { facts: DoneFacts; timeZone: string }): React.JSX.Element {
  const steps = processSteps(p.facts);
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="process-timeline">
      <div className="card-body min-w-0 gap-3 p-5">
        <h2 className="card-title text-base">
          <Workflow aria-hidden size={20} strokeWidth={1.75} />
          {copy("overview.process.title")}
        </h2>
        <ol className="timeline timeline-vertical timeline-compact min-w-0">
          {steps.map((step, at) => (
            <li key={step.id} className="min-w-0" data-testid={`process-step-${step.id}`}>
              {at === 0 ? null : <hr />}
              <div className="timeline-middle">
                <span className="num badge badge-ghost badge-sm" aria-hidden>
                  {at + 1}
                </span>
              </div>
              <div className="timeline-end flex min-w-0 flex-col gap-1 py-2 ps-2 text-sm">
                <span className="min-w-0 font-medium wrap-anywhere">{copy(step.name)}</span>
                {step.figures.map((each) =>
                  each.href === null ? (
                    <span key={each.key} className="min-w-0 text-base-content/70 wrap-anywhere">
                      {figure(each, p.timeZone)}
                    </span>
                  ) : (
                    <Link key={each.key} className="link link-hover min-w-0 wrap-anywhere" href={each.href}>
                      {figure(each, p.timeZone)}
                    </Link>
                  )
                )}
                {step.pending ? (
                  <span className="min-w-0 text-base-content/70" data-testid={`process-pending-${step.id}`}>
                    {copy("overview.process.pending")}
                  </span>
                ) : null}
              </div>
              {at === steps.length - 1 ? null : <hr />}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
