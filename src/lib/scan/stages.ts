// src/lib/scan/stages.ts — BP-023 `## Public interface`, WO-281
// (consolidates WO-060; see `archive/sdlc-factory-2026-09-04/corpus/docs/work-orders/WO-281.md`
// `## Consolidation`)
//
// Six named handles, one per dataset boundary of `SPEC.md` §6.3's
// free-scan list (BP-023 decision 7), and the stream that carries their
// transitions — plus a heartbeat and exactly one `ending` — to whoever
// calls `progress(scanId)`. No word a visitor reads appears in this file:
// every handle is internal (BP-019 turns a handle into a sentence,
// `## Out of scope`).
//
// **The producer side, and a gap flagged once (constitution rule 4.2).**
// BP-023's own `## Public interface` documents only the *reader* side of
// this module — `StageName`, `STAGES`, `StageEvent`, `progress` — and
// names no function a driver calls to report a transition. No table in
// this corpus's schema records one either (`BP-023 ## Data model delta`
// adds three admission columns and nothing about stages; `BP-012 ##
// Data model delta` adds `is_current`/`supersedes_scan_id`/
// `correction_state`/`stopped_reason` and nothing about stages either) —
// so `progress()` cannot be "an async iterable over the scan's recorded
// stage transitions" (WO-281 `## Steps` step 9) by reading a row anywhere.
// `driving the stages` is BP-012's `runScan`, explicitly out of this WO's
// scope and not yet built, so no real caller exists today to confirm a
// shape against. This file therefore adds a minimal, internal producer
// API — `enterStage`, `exitStage`, `emitEnding`, all below — as an
// in-process, per-`scanId` event bus (module-scoped, rule 1.1: an internal
// module boundary, the implementer's to choose). Its own tests drive it
// directly, standing in for the not-yet-built driver. Two consequences
// worth a future reader's attention, neither discharged here: (a) this
// only carries events within one Node process, so if the job that runs
// `runScan` and the process that serves this route are ever different
// deployed instances, a second transport (Postgres LISTEN/NOTIFY, a
// queue) replaces this bus without changing `progress`'s own exported
// shape; (b) a scan whose stream nobody ever reads to completion leaves
// its entry in `streams` for the life of the process — no retention
// policy exists yet, and none is asked for by any row this WO's test plan
// carries.
//
// **Why `dbAdmin()` appears here at all** (this file's own `##
// Interfaces` block names it as consumed): the one thing the in-process
// bus above cannot answer is "does this `scanId` exist at all" for a
// subscriber that arrives with nothing yet published — an unknown or
// malformed id (WO-281 `## Steps` step 19) must not simply hang waiting
// for an event that will never come. `progress()` checks `scans` once, at
// subscribe time; a known scan yields whatever the bus already holds plus
// whatever it publishes live; an unknown one yields nothing at all, which
// `route.ts` (WO-063's half of this WO) reads as "respond 404" without
// itself touching a database.
import { dbAdmin } from "@/lib/db";
import { TIMING } from "@/lib/config/constants";
import type { Ending } from "./ceilings";

// ── StageName, STAGES — BP-023 decision 7 ───────────────────────────────

/** Internal handles. Every word a visitor reads is BP-019's (REQ-093 c1). */
export type StageName =
  | "reading_your_site" // own fetches: home + detected pricing page
  | "reading_access_rules" // robots.txt and the home document's reader rules
  | "reading_your_market" // profile + keyword_suggestions → market set + the 12 questions
  | "checking_your_presence" // ranked_keywords@50
  | "asking_the_twelve" // 12 live organic SERPs, with their AI overviews
  | "scoring"; // drivers, score, band, problems, first page

/** One entry per `StageName` member, in the order BP-023 decision 7 fixes.
 *  `satisfies Record<StageName, true>` is the compile-time half of WO-281
 *  `## Steps` step 8's assertion — TypeScript refuses to build if a
 *  member is added above and not listed here, or listed here and not in
 *  the union above. `STAGES` below is derived from this object's own
 *  keys, so the two cannot diverge at the value level either. */
const STAGE_ORDER = {
  reading_your_site: true,
  reading_access_rules: true,
  reading_your_market: true,
  checking_your_presence: true,
  asking_the_twelve: true,
  scoring: true,
} satisfies Record<StageName, true>;

/** Exactly the six handles above, in order. */
export const STAGES: readonly StageName[] = Object.freeze(Object.keys(STAGE_ORDER) as StageName[]);

// Runtime half of step 8's assertion, at module load.
if (STAGES.length !== 6) {
  throw new Error(`src/lib/scan/stages.ts: expected exactly 6 stages, found ${STAGES.length}.`);
}
if (new Set(STAGES).size !== STAGES.length) {
  throw new Error("src/lib/scan/stages.ts: STAGES contains a duplicate stage name.");
}

// ── StageEvent ───────────────────────────────────────────────────────────

export type StageEvent =
  | { stage: StageName; done: boolean }
  | { heartbeat: true } // ≥ every 30 s
  | { ending: Ending }; // terminal; the stream then closes

// ── The in-process, per-scanId event bus ─────────────────────────────────

interface ScanStream {
  events: StageEvent[];
  listeners: Set<(event: StageEvent) => void>;
  done: boolean;
}

const streams = new Map<string, ScanStream>();

function streamFor(scanId: string): ScanStream {
  let stream = streams.get(scanId);
  if (!stream) {
    stream = { events: [], listeners: new Set(), done: false };
    streams.set(scanId, stream);
  }
  return stream;
}

/** BP-023 `## NFR budget`: "one line per stage transition." Heartbeats and
 *  the ending carry their own accounting elsewhere (`progress()` and
 *  `ceilings.ts`'s own ending line, respectively) — this is stage entry
 *  and exit only. */
function logStageTransition(scanId: string, stage: StageName, done: boolean): void {
  console.log(JSON.stringify({ event: "stage_transition", scanId, stage, done }));
}

/** After the ending, the stream is done — no further event of any kind
 *  (WO-281 `## Steps` step 11). A publish attempted after that point is
 *  dropped rather than throwing, since a driver racing its own cleanup
 *  against a ceiling that already closed the stream is a timing accident,
 *  not a caller error worth crashing the scan over. */
function publish(scanId: string, event: StageEvent): void {
  const stream = streamFor(scanId);
  if (stream.done) return;
  stream.events.push(event);
  if ("ending" in event) stream.done = true;
  for (const listener of [...stream.listeners]) listener(event);
}

/** Reports a stage's entry — the seam BP-012's `runScan` (out of this
 *  WO's scope) calls as it starts a unit of measurable work. Not part of
 *  BP-023's documented reader-side interface (see this file's header). */
export function enterStage(scanId: string, stage: StageName): void {
  publish(scanId, { stage, done: false });
  logStageTransition(scanId, stage, false);
}

/** Reports a stage's exit — never called for a stage the ceilings cut
 *  off (WO-281 `## Steps` step 12: "a stage the ceilings cut off emits no
 *  `done: true`"). */
export function exitStage(scanId: string, stage: StageName): void {
  publish(scanId, { stage, done: true });
  logStageTransition(scanId, stage, true);
}

/** Reports the one terminal `Ending` (WO-059's type, carried by this WO).
 *  A second call after the first is a no-op by `publish`'s own guard. */
export function emitEnding(scanId: string, ending: Ending): void {
  publish(scanId, { ending });
}

// ── progress(scanId) — the reader side ───────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `true` when a `scans` row exists for `scanId`. A read error fails
 *  closed (`false`, not "assume it exists and stream forever") — the
 *  opposite of admission's fail-open convention, because failing open
 *  here would mean quietly serving a stream for an id nobody can confirm
 *  is real, and the caller (`route.ts`) has no other signal to use for
 *  its own 404 decision. */
async function scanExists(scanId: string): Promise<boolean> {
  const { data, error } = await dbAdmin().from("scans").select("id").eq("id", scanId).limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

/** The narrowing of BP-012's declared `progress(scanId: string):
 *  AsyncIterable<{ stage: StageName; done: boolean }>` — BP-023's union
 *  adds the heartbeat and the ending arms (that refinement is BP-023's
 *  contract, not re-decided here). Replays whatever this scan's stream
 *  has already published — a subscriber that joins after the pipeline
 *  already started (the ordinary case: `/api/scan`'s `POST` claims the
 *  slot and starts the pipeline before the client's first `progress()`
 *  request lands) still receives the stages that ran before it
 *  subscribed — then delivers events live, filling any idle gap with a
 *  heartbeat at least every `TIMING.progressHeartbeatS`. */
export async function* progress(scanId: string): AsyncIterable<StageEvent> {
  if (!(await scanExists(scanId))) return;

  const stream = streamFor(scanId);

  for (const event of stream.events) {
    yield event;
    if ("ending" in event) return;
  }
  if (stream.done) return;

  const queue: StageEvent[] = [];
  let wake: (() => void) | null = null;
  const listener = (event: StageEvent): void => {
    queue.push(event);
    if (wake) {
      const w = wake;
      wake = null;
      w();
    }
  };
  stream.listeners.add(listener);

  try {
    let lastEventAt = Date.now();
    while (true) {
      if (queue.length > 0) {
        const event = queue.shift()!;
        lastEventAt = Date.now();
        yield event;
        if ("ending" in event) return;
        continue;
      }

      const untilHeartbeatMs = TIMING.progressHeartbeatS * 1000 - (Date.now() - lastEventAt);
      if (untilHeartbeatMs <= 0) {
        lastEventAt = Date.now();
        yield { heartbeat: true };
        continue;
      }

      await Promise.race([
        new Promise<void>((resolve) => {
          wake = resolve;
        }),
        delay(untilHeartbeatMs),
      ]);
    }
  } finally {
    stream.listeners.delete(listener);
  }
}
