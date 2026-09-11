// UI-SPEC S18 — one settable row, the shape the set's `kv()` gives every
// field on this screen (set L804): the name at the near edge in the quiet
// body, the stored value and its control at the far one, a hairline above.
// The first row of a group drops its hairline, as the set's does.
//
// Shared by `MarketPanel` and `PublishingPanel` (issue #506), which drew it
// two different ways: the market card put an eyebrow above the value. No
// "use client" and no state, so a server card and a client card can both
// render it.
//
// `below` is the one thing a row carries under itself — the field an Edit
// opens — because a field and its refusal line do not fit on one line at
// 320, and the row's own line should not move when it opens.
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
      className="border-base-300 flex min-w-0 flex-col gap-2 border-t py-2 first:border-t-0"
      data-testid={p.testId}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 text-sm text-[color:var(--ink-2)] wrap-anywhere">{p.name}</span>
        {p.children == null ? null : (
          <span className="flex min-w-0 flex-wrap items-center gap-2">{p.children}</span>
        )}
      </div>
      {p.below ?? null}
    </div>
  );
}
