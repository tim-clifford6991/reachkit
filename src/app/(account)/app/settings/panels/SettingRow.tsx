// One settable row, as every Settings board draws it: the name in a 200px column beside the value from `sm` up,
// stacked above it on a phone, a hairline above (none on the first row).
// `below` is the field an edit opens or the line that belongs to this value, under the value so the row does not move.
import type React from "react";

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
