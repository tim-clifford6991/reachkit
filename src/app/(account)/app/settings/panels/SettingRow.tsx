// One settable row: the name at the near edge, the stored value and its
// control at the far one, a hairline above (none on the first row).
// `below` is the field an edit opens, under the row so the row does not move.
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
      className="border-base-300 flex min-w-0 flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0"
      data-testid={p.testId}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 text-sm text-base-content/70 wrap-anywhere">{p.name}</span>
        {p.children == null ? null : (
          <span className="flex min-w-0 flex-wrap items-center gap-2">{p.children}</span>
        )}
      </div>
      {p.below ?? null}
    </div>
  );
}
