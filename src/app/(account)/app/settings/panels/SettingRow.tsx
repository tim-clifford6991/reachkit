// One settable row, as every Settings board draws it: the name in a 200px column beside the value from `sm` up,
// stacked above it on a phone, a hairline above (none on the first row).
// `below` is the field an edit opens or the line that belongs to this value, under the value so the row does not move.
import type React from "react";
import type { LineValue } from "../business-screen";

export function SettingRow(p: {
  name: string;
  testId: string;
  /** The value and its control. Absent while `below` stands in for them. */
  children?: React.ReactNode;
  below?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className="border-base-300 flex min-w-0 flex-col gap-2 border-t py-4 first:border-t-0 first:pt-0 sm:flex-row sm:gap-6"
      data-testid={p.testId}
    >
      <span className="min-w-0 text-sm font-semibold wrap-anywhere sm:w-50 sm:shrink-0">{p.name}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {p.children == null ? null : (
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">{p.children}</div>
        )}
        {p.below ?? null}
      </div>
    </div>
  );
}

/** One setting line: the label in its 200px column from `md` (144px in a half-width card from `lg`), the value, then
 *  the line's *Change*; below `md` the label stacks over the value and *Change* stays on the value's line. A value is
 *  drawn whole: the model shortens it. */
export function SettingLine(p: {
  label: string;
  value: LineValue;
  testId: string;
  action?: React.ReactNode;
}): React.JSX.Element {
  const v = p.value;
  return (
    <div
      className={`border-base-300 grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t first:border-t-0 md:grid-cols-[12.5rem_minmax(0,1fr)_auto] lg:min-h-10 lg:grid-cols-[9rem_minmax(0,1fr)_auto]`}
      data-testid={p.testId}
    >
      <span className="col-span-2 min-w-0 pt-1 text-sm font-semibold wrap-anywhere md:col-span-1 md:pt-0">{p.label}</span>
      <span
        className={`flex min-w-0 items-center gap-2 text-sm ${v.kind === "address" ? "num break-all" : v.kind === "empty" ? "text-base-content/70" : "wrap-anywhere"}`}
        title={v.kind === "text" || v.kind === "list" ? v.full : undefined}
      >
        <span className="min-w-0">{v.text}</span>
        {v.kind === "list" && v.more !== null ? <span className="badge badge-ghost badge-sm shrink-0">{v.more}</span> : null}
      </span>
      {p.action ?? <span aria-hidden />}
    </div>
  );
}
