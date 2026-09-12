// BUILD §4.4 — the whole of what the shell states, in one shape.
//
// WO-154 `## Goal`, verbatim: "Assemble `ShellModel` in one request-cached
// read — the domain, a week count that counts measured weeks only, the
// waiting count, and either the next publish time or the first-match reason
// there is none."
//
// `assembleShell` is pure: facts in, model out. The reading of those facts
// is `provider.ts`'s, and today it reads a fixture (issue #9 builds the
// shell on fixture data; the queries arrive with §11's weekly measurement
// (#41) and §9's publishing (#45)). Keeping the assembly pure is what lets
// every REQ-040 criterion be decided by a test with no database at all.
import type { WorkStop } from "@/lib/presentation/stopped";
import { resolveNoPublish, type NoPublishCauses, type NoPublishReason } from "./nopublish";
import { weeksMeasured, type MeasuredWeek, type WeekCount } from "./weeks";

/** REQ-040 c3 and c4 as one closed union: either a time, or a reason there
 *  is none. There is no third arm and no `next?: Date` — an optional field
 *  would let a renderer read "no time" as "not loaded yet". `enabled` is
 *  §9's switch: §7 leaves one mode, so the footer's control switches
 *  whether pages publish at all. */
export type PublishingState =
  | { enabled: boolean; next: Date }
  | { enabled: boolean; next: null; because: NoPublishReason };

export interface ShellModel {
  domain: string;
  /** The zone every date and time the shell states is expressed in
   *  (REQ-073 c1: captured once, stored as one preference). */
  timeZone: string;
  weeks: WeekCount;
  /** REQ-040 c2. `0` renders no count at all — the renderer's rule, but the
   *  number is stated here rather than being an absent field. */
  waiting: number;
  publishing: PublishingState;
  /** REQ-092 c3: the fact that ReachKit stopped its own work, or `null`.
   *  Stated on every app screen by `StoppedNotice` and by nothing else.
   *  `null` is the whole of "it stops stating it once the work resumes" —
   *  there is no dismissal flag and no cached banner to clear. */
  stopped: WorkStop | null;
}

/** Everything the shell reads, before it is a model. One shape, so a
 *  fixture and a future query answer the same question. */
export interface ShellFacts {
  domain: string;
  timeZone: string;
  /** §9's switch — `sites.publishing_enabled`, read by `switch/`. */
  publishingEnabled: boolean;
  weeks: readonly MeasuredWeek[];
  /** REQ-065's own clock (#41): when this domain's first weekly measurement
   *  is due. Read, never computed here. */
  firstDueOn: Date;
  /** The count of calendar items waiting on the customer — §9's `in_review`
   *  and `needs_attention` drafts (#45). */
  waiting: number;
  /** §9's `becomesPublishable` (#45): the next scheduled publish, or `null`
   *  with the four causes stated. */
  next: Date | null;
  noPublishCauses: NoPublishCauses;
  /** BUILD §6.5 / §11's stop, read per account and per day by BP-001's
   *  adapter (the cap-hit ledger over `fetches`, the kill switch, the last
   *  run's status) and assembled into the shape REQ-092 c2/c4/c6 fix. It
   *  carries no cause a renderer could leak — see
   *  `src/lib/presentation/stopped/stop.ts`. */
  stopped: WorkStop | null;
}

export function assembleShell(facts: ShellFacts): ShellModel {
  const weeks = weeksMeasured({
    domain: facts.domain,
    weeks: facts.weeks,
    firstDueOn: facts.firstDueOn,
  });

  return {
    domain: facts.domain,
    timeZone: facts.timeZone,
    weeks,
    waiting: facts.waiting,
    publishing: publishingOf(facts),
    stopped: facts.stopped,
  };
}

/** A scheduled time outranks every cause; with no time, the four causes are
 *  resolved by `NO_PUBLISH_PRECEDENCE` and never by whichever the caller
 *  tested first. A `null` next with no cause holding at all is not a state
 *  the product has: it is an unattributed empty, which ADR-061 rules is
 *  ReachKit's own stop. */
function publishingOf(facts: ShellFacts): PublishingState {
  // REQ-092 c7 first: while ReachKit has stopped its own work, no publish
  // is scheduled — a time carried over from before the stop would be a
  // statement that the work is coming, which is the one thing the customer
  // must not be told. A stop is therefore a cause whether or not the
  // adapter also set the boolean, and it outranks a `next` that is still on
  // the row (ADR-011).
  const stopped = facts.stopped !== null || facts.noPublishCauses.reachkit_stopped;
  if (!stopped && facts.next !== null) {
    return { enabled: facts.publishingEnabled, next: facts.next };
  }
  const causes: NoPublishCauses = { ...facts.noPublishCauses, reachkit_stopped: stopped };
  const because = resolveNoPublish(causes) ?? "reachkit_stopped";
  return { enabled: facts.publishingEnabled, next: null, because };
}
