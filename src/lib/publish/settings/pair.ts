// BUILD §9 · §4.7 — the governing pair, as pure functions. Apart from `settings.ts`, which reaches the database, so the
// publishable predicate stays the pure function REQ-057 c2 asks for. Every function is total and reads nothing.
import type { GoverningPair } from "../types";
import type { PublishingSettings } from "./settings";

/** The pair a settings object stands for, which the telling and the publishable rule compare. */
export function pairOf(s: PublishingSettings): GoverningPair {
  return {
    mode: s.mode,
    vetoHours: s.vetoHours,
    publishTime: s.publishTime,
    timezone: s.timezone,
  };
}

/** The settings a pair stands for, for `nextPublishTimeAtOrAfter`, which has a pair and needs settings. */
export function settingsOf(pair: GoverningPair): PublishingSettings {
  return {
    mode: pair.mode,
    vetoHours: pair.vetoHours,
    publishTime: pair.publishTime,
    timezone: pair.timezone,
  };
}

/** The same pair when all four members agree. Written out, not deep-compared, so a new `GoverningPair` member must be
 *  decided here rather than silently left out of the comparison REQ-057 c8 turns on. */
export function samePair(a: GoverningPair, b: GoverningPair): boolean {
  return (
    a.mode === b.mode &&
    a.vetoHours === b.vetoHours &&
    a.publishTime === b.publishTime &&
    a.timezone === b.timezone
  );
}
