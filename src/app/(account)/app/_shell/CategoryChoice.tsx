// SPEC §6 (owner ruling 2026-09-17, issue 837) — the thin market's choice:
// two or three broader categories and a field for the founder's own words.
// Any one of them measures the market again now.
//
// The server writes every word (the heading, the field's label, the button)
// and the suggestions; this component only sends the press and states the
// answer. A started pass revalidates the app, so the shell's panel takes over
// with the pass's steps; a refused one keeps the choice and says why.
"use client";

import type React from "react";
import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { remeasureAction } from "./remeasure-actions";
import { REMEASURE_CATEGORY_FIELD, REMEASURE_INITIAL } from "./remeasure";

export function CategoryChoice(p: {
  suggestions: readonly string[];
  words: { suggested: string; own: string; submit: string };
}): React.JSX.Element {
  const [state, formAction, pending] = useActionState(remeasureAction, REMEASURE_INITIAL);

  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="category-choice">
      {p.suggestions.length === 0 ? null : (
        <form action={formAction} className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-semibold">{p.words.suggested}</span>
          <div className="flex min-w-0 flex-wrap gap-2">
            {p.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="submit"
                name={REMEASURE_CATEGORY_FIELD}
                value={suggestion}
                className="btn btn-outline btn-sm h-auto min-h-8 max-w-full wrap-anywhere"
                disabled={pending}
                data-testid="category-suggestion"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </form>
      )}
      <form action={formAction} className="flex min-w-0 flex-col gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-sm">{p.words.own}</span>
          <input className="input input-sm w-full" name={REMEASURE_CATEGORY_FIELD} required disabled={pending} />
        </label>
        <button type="submit" className="btn btn-outline btn-sm self-start" disabled={pending}>
          {pending ? (
            <span className="loading loading-spinner loading-xs" aria-hidden />
          ) : (
            <RefreshCw size={16} strokeWidth={1.75} aria-hidden />
          )}
          {p.words.submit}
        </button>
      </form>
      {state.answer === "refused" ? (
        <p role="alert" className="text-xs text-error wrap-anywhere" data-testid="category-choice-refused">
          {state.line}
        </p>
      ) : null}
    </div>
  );
}
