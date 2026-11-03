// Issue 1458 — the one field both free tools ask for: a page address, sent
// back to the same address as `?url=`. A plain GET form: it works with no
// script, and the result is a page of its own the visitor can share.
import type React from "react";
import { ArrowRight, Check } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { PageRead } from "./read";

const FIELD_ID = "tool-url";
const FIELD_NAME = "url";
const INPUT_MODE = "url";
const AUTO_COMPLETE = "url";
/** The costs line is one key, its parts set apart by middle dots. */
const COST_GAP = " · ";

/** The field in its card, and under the button what a check costs the visitor, one tick each. */
export function ToolForm(p: { value: string }): React.JSX.Element {
  return (
    <form method="get" className="card bg-base-100 card-body min-w-0 gap-2.5 shadow-(--shadow-card)" data-testid="tool-form">
      <label htmlFor={FIELD_ID} className="text-sm font-semibold">
        {copy("tools.field.label")}
      </label>
      <input
        id={FIELD_ID}
        name={FIELD_NAME}
        type="text"
        inputMode={INPUT_MODE}
        autoComplete={AUTO_COMPLETE}
        defaultValue={p.value}
        placeholder={copy("tools.field.placeholder")}
        className="input w-full min-w-0 font-mono"
        required
      />
      <button type="submit" className="btn btn-soft btn-primary self-start active:scale-[.98]">
        {copy("tools.submit")}
        <ArrowRight size={20} strokeWidth={1.75} aria-hidden />
      </button>
      <p className="text-base-content/70 flex flex-wrap gap-x-3.5 gap-y-1 text-sm">
        {copy("tools.micro")
          .split(COST_GAP)
          .map((cost) => (
            <span key={cost} className="inline-flex items-center gap-1">
              <Check size={16} strokeWidth={2} aria-hidden className="text-success" />
              {cost}
            </span>
          ))}
      </p>
    </form>
  );
}

/** The one line a check that could not run gives instead of a result. */
export function ReadProblem(p: { read: Extract<PageRead, { ok: false }> }): React.JSX.Element {
  const url = p.read.url ?? "";
  const line =
    p.read.problem === "address"
      ? copy("tools.problem.address")
      : p.read.problem === "limit"
        ? copy("tools.problem.limit")
        : p.read.problem === "robots"
          ? copy("tools.problem.robots", { url })
          : copy("tools.problem.read", { url });
  return (
    <p role="alert" className="alert alert-warning break-words" data-testid="tool-problem">
      {line}
    </p>
  );
}
