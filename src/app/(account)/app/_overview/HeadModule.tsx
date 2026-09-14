// BUILD §4.5 — the head line, and the badge only a rising series earns.
//
// The line is the key the measured direction selected in `head.ts`, so the
// words are backed by the chart under them. Where none is written the
// heading falls back to the destination's own word, so the screen always
// has an `h1`.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import type { OverviewModel } from "./model";

export function HeadModule(p: { head: OverviewModel["head"] }): React.JSX.Element {
  const line = writtenLine(p.head.key);
  const badge = p.head.badgeKey === undefined ? null : writtenLine(p.head.badgeKey);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3" data-testid="overview-head">
      <h1>{line ?? copy("shell.nav.overview")}</h1>
      {badge === null ? null : <span className="badge badge-success badge-soft">{badge}</span>}
    </div>
  );
}
