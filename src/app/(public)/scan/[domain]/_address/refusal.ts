// BUILD §4.1 — one refusal, one written line, one place it is composed
//
// The same refusal reaches a visitor two ways: on its own screen when
// there is no stored report to show (`view.tsx`'s `refused` arm), and as
// the one notice beside a report when there is (`report-view.tsx`'s
// `NoticeLine`). Both said the same thing in two copies of the same
// three-line helper until this file; a reason added to `AddressRefusal`
// now needs a word in exactly one map, and the two surfaces cannot drift
// into telling one visitor a different sentence than the other.
//
// No sentence is written here: every string is the copy registry's, and
// the unit word around the wait figure is the owner's too.
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { AddressRefusal } from "./state";

/** One key per reason. `satisfies` over the union means a reason added to
 *  `AddressRefusal` fails this file's build until it has a word. */
const REFUSAL_KEY = {
  "network-limit": "notice.refused.network-limit",
  "network-day-limit": "notice.refused.network-day-limit",
  "domain-day-limit": "notice.refused.domain-day-limit",
  "scan-running": "notice.refused.scan-running",
  stopped: "notice.refused.stopped",
} as const satisfies Record<AddressRefusal["reason"], CopyKey>;

/** One heading per reason, the same shape and the same totality guarantee
 *  as `REFUSAL_KEY` above: a reason added to `AddressRefusal` fails this
 *  file's build until it has a heading as well as a line. */
const REFUSAL_HEAD = {
  "network-limit": "quiet.refused.head.network-limit",
  "network-day-limit": "quiet.refused.head.network-day-limit",
  "domain-day-limit": "quiet.refused.head.domain-day-limit",
  "scan-running": "quiet.refused.head.scan-running",
  stopped: "quiet.refused.head.stopped",
} as const satisfies Record<AddressRefusal["reason"], CopyKey>;

const SECONDS_PER_MINUTE = 60;

/** The `{wait}` every refusal but `stopped` carries: the refusal's own
 *  `retryAfterSeconds`, rounded up to whole minutes, with the unit word
 *  around it read from the registry and never composed here. */
function formatWait(retryAfterSeconds: number): string {
  return copy("report.wait.minutes", {
    minutes: String(Math.ceil(retryAfterSeconds / SECONDS_PER_MINUTE)),
  });
}

/** The one written line for a refusal. ReachKit's own stop names no wait —
 *  nobody can say when we start again — so its line takes no slot and
 *  there is no figure to invent for it (ADR-011). */
export function refusalLine(refusal: AddressRefusal): string {
  if (refusal.reason === "stopped") return copy(REFUSAL_KEY[refusal.reason]);
  return copy(REFUSAL_KEY[refusal.reason], { wait: formatWait(refusal.retryAfterSeconds) });
}

/**
 * The refusal's heading on its own screen (#936).
 *
 * **What happened, never when** (owner, 2026-09-21). The first draft put
 * the wait here, over an approved sentence that ends with the same clause,
 * and the card said one thing twice. The time belongs to the line, which
 * already carries it and is unchanged; the heading carries the other half
 * of the message.
 *
 * So this takes no `{wait}` and does no formatting: there is one heading
 * per reason and nothing to compose. `formatWait` stays the line's alone,
 * which is also why the two can no longer disagree about a figure — only
 * one of them states one.
 */
export function refusalHeading(refusal: AddressRefusal): string {
  return copy(REFUSAL_HEAD[refusal.reason]);
}
