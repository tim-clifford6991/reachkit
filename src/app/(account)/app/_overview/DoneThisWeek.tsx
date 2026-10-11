// SPEC §4 (2026-10-10, issue 1395) — what ReachKit did this week, under the
// seven days.
//
// One line per step of the work, in the past tense, and one closed note
// under each (`docs/DESIGN.md`, *Closed sentences*): a daisyUI `collapse` on
// a `details`, the line its `summary`. A tick for a step that ran and a dash
// for one that did not — two shapes, each with its word in the sentence, so
// the state is never colour alone.
//
// **It writes no number.** Every figure is a slot `done.ts` filled from a
// stored row; this file formats instants in the site's zone and joins
// names.
import type React from "react";
import { Check, Minus } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { ENGINE_LABEL } from "../_shell/page-target-words";
import { SHELL_LOCALE } from "../_shell/format";
import { CLOSED } from "./present";
import { doneLines, type DoneFacts, type Sentence } from "./done";

/** Between the parts of one line. */
const SEPARATOR = " · ";
/** Between two engines' names. */
const AND = " + ";

/** An instant as a line states it: the weekday and the time, in the site's
 *  zone ("Mon 6:00 AM"). The week is the one on screen, so no date. */
function when(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone, weekday: "short", hour: "numeric", minute: "2-digit" }).format(at);
}

/** One sentence, its slots filled. */
export function sentence(s: Sentence, timeZone: string): string {
  const vars: Record<string, string | number> = { ...s.vars };
  for (const [slot, at] of Object.entries(s.at ?? {})) vars[slot] = when(at, timeZone);
  if (s.engines !== undefined) vars.engines = s.engines.map((engine) => copy(ENGINE_LABEL[engine])).join(AND);
  return copy(s.key, vars);
}

export function DoneThisWeek(p: { facts: DoneFacts; timeZone: string }): React.JSX.Element | null {
  const lines = doneLines(p.facts);
  if (lines.length === 0) return null;
  return (
    <ul className="flex min-w-0 flex-col gap-2" aria-label={copy("overview.done.label")} data-testid="overview-done">
      {lines.map((line) => (
        <li key={line.id} className="min-w-0" data-testid={`overview-done-${line.id}`} data-ran={line.ran}>
          <details className={CLOSED.root}>
            <summary className={`${CLOSED.head} flex min-w-0 items-start gap-2 text-sm`}>
              {line.ran ? (
                <Check size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-success" />
              ) : (
                <Minus size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-base-content/70" />
              )}
              <span className="min-w-0 wrap-anywhere">
                {line.parts.map((part) => sentence(part, p.timeZone)).join(SEPARATOR)}
              </span>
            </summary>
            <div className={`${CLOSED.body} ps-6 text-sm text-base-content/70`}>
              {line.note === null ? null : <p className="min-w-0 wrap-anywhere">{sentence(line.note, p.timeZone)}</p>}
              {line.rows === undefined ? null : (
                <ul className="flex min-w-0 list-none flex-col gap-1 p-0">
                  {line.rows.map((row) => (
                    <li key={row.key} className="min-w-0 wrap-anywhere">
                      {copy(row.key, { n: row.n })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
