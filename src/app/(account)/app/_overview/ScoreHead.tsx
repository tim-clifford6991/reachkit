// SPEC §4 (2026-10-07, issue 1319) — the Overview tab's header, when no page
// is in review.
//
// Today's date and the line that says what the screen is about. While a
// page waits, `WaitingPageCard` carries the head instead, so the action is
// the first thing on the screen. The Discoverability Score that stood
// beside this until D22 (2026-10-02) is the free report's alone, and the
// name of this file is all that is left of it.
//
// **It cannot overflow.** The head line is a `min-w-0` block that wraps.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { SHELL_LOCALE } from "../_shell/format";
import { BADGE } from "./badges";
import type { OverviewModel } from "./model";

const TEST_ID = "overview-head";

/** Today, as the eyebrow states it: the weekday and the day of the month in
 *  the site's own zone. A date, so it is a value and carries no sentence. */
function formatToday(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(at);
}

export function ScoreHead(p: {
  head: OverviewModel["head"];
  today: Date;
  timeZone: string;
  className?: string;
}): React.JSX.Element {
  const line = writtenLine(p.head.key);
  const badge = p.head.badgeKey === undefined ? null : writtenLine(p.head.badgeKey);

  return (
    <header className={`flex min-w-0 flex-col gap-1 ${p.className ?? ""}`} data-testid={TEST_ID}>
      <p className="num text-xs font-semibold uppercase tracking-wide text-base-content/70">
        {formatToday(p.today, p.timeZone)}
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h1>{line ?? copy("shell.nav.overview")}</h1>
        {badge === null ? null : <span className={BADGE.ok}>{badge}</span>}
      </div>
    </header>
  );
}
