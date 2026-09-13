// Canvas: Settings — one settable row: the name at the near edge, the
// stored value and its control at the far one, as every card draws it.
//
// No "use client" and no state, so a server card and a client card can both
// render it. `below` is the one thing a row carries under itself — the field
// an Edit opens — because a field and its refusal do not fit on one line at
// 320, and the row's own line should not move when it opens.
import type React from "react";
import { ROW, ROW_NAME, ROW_VALUE, STACK } from "../style";

export function SettingRow(p: {
  name: string;
  testId: string;
  /** The value and its control. Absent while `below` stands in for them. */
  children?: React.ReactNode;
  below?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={STACK} data-testid={p.testId}>
      <div className={ROW}>
        <span className={ROW_NAME}>{p.name}</span>
        {p.children == null ? null : <span className={ROW_VALUE}>{p.children}</span>}
      </div>
      {p.below ?? null}
    </div>
  );
}
