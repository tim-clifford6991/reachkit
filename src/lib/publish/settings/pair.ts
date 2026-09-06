// BUILD §9 · §4.7 — the governing pair, as pure functions.
//
// Split out of `settings.ts` for one reason and it is load-bearing:
// `settings.ts` reaches the database, so importing it pulls in `@/lib/db`
// and the environment it parses. The publishable predicate needs the two
// projections below and nothing else, and a predicate that cannot be
// evaluated without a database connection is not the pure function
// REQ-057 c2 asks for.
//
// Every function here is total, allocates one object and reads nothing.
import type { GoverningPair } from "../types";
import type { PublishingSettings } from "./settings";

/** The pair a settings object stands for — what the telling and the
 *  publishable rule compare and read. */
export function pairOf(s: PublishingSettings): GoverningPair {
  return {
    mode: s.mode,
    vetoHours: s.vetoHours,
    publishTime: s.publishTime,
    timezone: s.timezone,
  };
}

/** The settings a pair stands for, for the one caller that has a pair and
 *  needs a settings object (`nextPublishTimeAtOrAfter`). */
export function settingsOf(pair: GoverningPair): PublishingSettings {
  return {
    mode: pair.mode,
    vetoHours: pair.vetoHours,
    publishTime: pair.publishTime,
    timezone: pair.timezone,
  };
}

/**
 * Two pairs are the same pair when all four members agree.
 *
 * Written out rather than deep-compared so that adding a member to
 * `GoverningPair` without deciding what it means here is a compile error
 * rather than a member silently left out of the comparison REQ-057 c8
 * turns on.
 */
export function samePair(a: GoverningPair, b: GoverningPair): boolean {
  return (
    a.mode === b.mode &&
    a.vetoHours === b.vetoHours &&
    a.publishTime === b.publishTime &&
    a.timezone === b.timezone
  );
}
