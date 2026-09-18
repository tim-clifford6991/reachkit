// BUILD §4.6, §7 — the calendar's one statement of supply.
//
// `supplyNotice` returns at most one notice and its precedence is total
// (`exhausted` > `short` > `arrival_shortfall`) — "the customer reads one
// statement of supply, not two". This file is the other half of that
// promise on the screen's side: one notice in, one line out, and no arm
// that renders two.
//
// **It composes nothing.** Each arm is a registry key with its own slots,
// read through the shell's `writtenLine`, so an unwritten line renders as
// nothing rather than as a placeholder (DECISIONS 2026-09-05, #93). The
// three keys are the owner's and are empty today.
//
// A notice with no date renders the same key with an empty `since` slot
// rather than a different sentence: ADR-061's exhausted arm is a proven
// claim about supply whether or not the moment it ran out is knowable, and
// splitting it in two would make the date look like part of the claim.
import { writtenLine } from "../_shell/written";
import { formatDate } from "../_shell/format";
import type { SupplyNotice } from "@/lib/opportunities";

/** §7's notice, with its zero told apart (issue 765, issue 784): `unmeasured` is an
 *  exhausted count over a market that was never measured — there was
 *  nothing to use up, and "nothing worth publishing is left" is false. */
export type CalendarSupplyNotice =
  | SupplyNotice
  | { kind: "unmeasured" }
  | { kind: "measuring" }
  /** Issue 881: the site holds targets and every one of them is outsized
   *  for it today — neither a market used up nor one never measured. */
  | { kind: "outsized" };

export function supplyLine(notice: CalendarSupplyNotice | null, timeZone: string): string | null {
  if (notice === null) return null;
  if (notice.kind === "unmeasured") return writtenLine("calendar.supply.unmeasured");
  if (notice.kind === "measuring") return writtenLine("calendar.supply.measuring");
  if (notice.kind === "outsized") return writtenLine("calendar.supply.outsized");
  if (notice.kind === "exhausted") {
    return writtenLine("calendar.supply.exhausted", {
      since: notice.since === null ? "" : formatDate(notice.since, timeZone),
    });
  }
  if (notice.kind === "short") {
    return writtenLine("calendar.supply.short", { days: String(notice.days) });
  }
  return writtenLine("calendar.supply.first-arrival", { days: String(notice.days) });
}
