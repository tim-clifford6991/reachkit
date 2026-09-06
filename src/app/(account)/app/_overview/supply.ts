// BUILD §4.5 — the one supply statement Overview may make.
//
// DECISIONS 2026-08-28, verbatim: "Supply is the cap: never invent an
// opportunity to fill a day; the calendar is never padded." That ruling is
// what gives this screen something to say at all — a day with no page is a
// fact about the market, not a failure — and what limits it to saying it
// once.
//
// **One key, never two.** Three conditions can hold at the same time: the
// supply is exhausted, it is short, and the first arrival fell short of what
// was promised. A screen that stated all three would say the same thing
// three ways and read as three separate problems. So they are resolved in a
// fixed order — exhausted, then short, then first-arrival — and exactly one
// key comes back. Precedence is by strength of claim: "there is nothing
// left" already implies "there is not much left", and both already account
// for a thin first arrival.
//
// **The stopped-work statement is not this file's.** ADR-061 rules that
// "'Nothing worth publishing' is a proven arm, never the fallback; an
// unattributed empty day is ReachKit's own stop", and the arbiter for that
// fact is the shared empty-account resolver (#10, §4.6). Overview reads it
// and defines no second one — a second derivation is exactly how two
// screens come to state different reasons for the same empty day. Until
// that resolver lands, the caller passes the fact in.
import type { CopyKey } from "@/lib/presentation/copy";

/** The three conditions, and nothing else. No thresholds live here —
 *  REQ-095's own are `supplyDepth`'s (§7), read and passed in. */
export interface SupplyFacts {
  exhausted: boolean;
  short: boolean;
  firstArrivalShortfall: boolean;
}

export interface SupplyStatement {
  key: CopyKey;
  vars: Record<string, string>;
}

/** The resolution order, strongest claim first. Written once, as data, so
 *  the order is a value a test can read rather than the shape of an
 *  if-chain someone could reorder without noticing. */
export const SUPPLY_PRECEDENCE = [
  { when: "exhausted", key: "overview.supply.exhausted" },
  { when: "short", key: "overview.supply.short" },
  { when: "firstArrivalShortfall", key: "overview.supply.first-arrival" },
] as const satisfies readonly { when: keyof SupplyFacts; key: CopyKey }[];

export function readSupplyStatement(facts: SupplyFacts): SupplyStatement | undefined {
  for (const row of SUPPLY_PRECEDENCE) {
    if (facts[row.when]) return { key: row.key, vars: {} };
  }
  return undefined;
}
