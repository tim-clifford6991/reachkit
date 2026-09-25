// SPEC §7 (2026-09-24, #1059), issue 1071 — the calendar's one statement of
// supply, and, for a market never measured, the two ways it is measured
// again carried inline (board `R12-5-Plan`): *Try “…”* sends the first
// broader category, *Describe it yourself* opens the founder's own words.
// This replaces the separate broader-categories card this screen used to
// draw under the notice (issue 837); the Server Function is the same one.
//
// The server writes every word and hands it in as props, so this client
// leaf ships no copy registry (`copy()` on the client carries all of it).
"use client";

import type React from "react";
import { useActionState, useState } from "react";
import { Info } from "lucide-react";
import { remeasureAction } from "../_shell/remeasure-actions";
import { REMEASURE_CATEGORY_FIELD, REMEASURE_INITIAL } from "../_shell/remeasure-shared";

export interface SupplyChoiceWords {
  /** The first broader category, or `null` when the profile offers none. */
  suggestion: string | null;
  /** *Try “{category}”*, already filled — `null` with no suggestion. */
  tryLabel: string | null;
  describe: string;
  own: string;
  submit: string;
}

export function SupplyNotice(p: { line: string; choice: SupplyChoiceWords | null }): React.JSX.Element {
  const [state, formAction, pending] = useActionState(remeasureAction, REMEASURE_INITIAL);
  const [describing, setDescribing] = useState(false);
  const choice = p.choice;

  return (
    <div
      role="status"
      className="alert alert-soft min-w-0 items-start text-sm max-sm:alert-vertical max-sm:items-start sm:alert-horizontal"
      data-testid="calendar-supply-notice"
    >
      <Info size={20} strokeWidth={1.75} className="text-warning shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-col gap-3">
        <p className="min-w-0 wrap-anywhere" data-testid="calendar-supply-statement">
          {p.line}
        </p>
        {choice !== null && describing ? (
          <form action={formAction} className="flex min-w-0 flex-wrap items-end gap-2">
            <label className="flex min-w-0 grow flex-col gap-1">
              <span>{choice.own}</span>
              <input
                className="input input-sm w-full"
                name={REMEASURE_CATEGORY_FIELD}
                required
                disabled={pending}
                autoFocus
                data-testid="category-own"
              />
            </label>
            <button type="submit" className="btn btn-sm btn-primary" disabled={pending}>
              {choice.submit}
            </button>
          </form>
        ) : null}
        {state.answer === "refused" ? (
          <p role="alert" className="text-xs text-error wrap-anywhere" data-testid="category-choice-refused">
            {state.line}
          </p>
        ) : null}
      </div>
      {choice === null ? null : (
        <div className="flex min-w-0 flex-wrap gap-2" data-testid="calendar-market-choice">
          {choice.suggestion === null || choice.tryLabel === null ? null : (
            <form action={formAction} className="min-w-0">
              <button
                type="submit"
                name={REMEASURE_CATEGORY_FIELD}
                value={choice.suggestion}
                className="btn btn-sm btn-soft btn-primary h-auto min-h-8 max-w-full wrap-anywhere"
                disabled={pending}
                data-testid="category-suggestion"
              >
                {choice.tryLabel}
              </button>
            </form>
          )}
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            aria-expanded={describing}
            onClick={() => setDescribing((open) => !open)}
            data-testid="category-describe"
          >
            {choice.describe}
          </button>
        </div>
      )}
    </div>
  );
}
