// One setting line, as every Settings tab draws it; a value is drawn whole, because the model shortens it.
import type React from "react";
import type { LineValue } from "../business-screen";

/** A line's value: the model's, or a node (a badge, a date) that a card composes itself. */
type Shown = LineValue | { kind: "node"; text: React.ReactNode };

/** One setting line: the label in its 200px column from `md` (144px in a half-width card from `lg`), the value, then
 *  the line's *Change*; below `md` the label stacks over the value and *Change* stays on the value's line. A value is
 *  drawn whole: the model shortens it. */
export function SettingLine(p: {
  label: string;
  value: Shown;
  testId: string;
  action?: React.ReactNode;
}): React.JSX.Element {
  const v = p.value;
  return (
    <div
      className={`border-base-300 grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t first:border-t-0 md:grid-cols-[minmax(0,12.5rem)_minmax(0,1fr)_auto] lg:min-h-10 lg:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto]`}
      data-testid={p.testId}
    >
      <span className="col-span-2 min-w-0 pt-1 text-sm font-semibold wrap-anywhere md:col-span-1 md:pt-0">{p.label}</span>
      <span
        className={`flex min-w-0 items-center gap-2 text-sm ${v.kind === "address" ? "font-mono break-all" : v.kind === "empty" ? "text-base-content/70" : "wrap-anywhere"}`}
        title={v.kind === "text" || v.kind === "list" ? v.full : undefined}
      >
        <span className="min-w-0">{v.text}</span>
        {v.kind === "list" && v.more !== null ? <span className="badge badge-ghost badge-sm shrink-0">{v.more}</span> : null}
      </span>
      {p.action ?? <span aria-hidden />}
    </div>
  );
}
