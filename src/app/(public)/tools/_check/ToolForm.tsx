// Issue 1458 — the one field both free tools ask for: a page address, sent
// back to the same address as `?url=`. A plain GET form: it works with no
// script, and the result is a page of its own the visitor can share.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import type { PageRead } from "./read";

const FIELD_ID = "tool-url";
const FIELD_NAME = "url";
const INPUT_MODE = "url";
const AUTO_COMPLETE = "url";

export function ToolForm(p: { value: string }): React.JSX.Element {
  return (
    <form method="get" className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end" data-testid="tool-form">
      <label htmlFor={FIELD_ID} className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-semibold">{copy("tools.field.label")}</span>
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
      </label>
      <button type="submit" className="btn btn-primary active:scale-[.98]">
        {copy("tools.submit")}
      </button>
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
