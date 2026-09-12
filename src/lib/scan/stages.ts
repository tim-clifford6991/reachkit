// src/lib/scan/stages.ts — BP-023 `## Public interface`, WO-281
// (consolidates WO-060; see `archive/sdlc-factory-2026-09-04/corpus/docs/work-orders/WO-281.md`
// `## Consolidation`)
//
// Six named handles, one per dataset boundary of `BUILD.md` §6.3's
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
// `driving the stages` is BP-012's `runScan`. This file therefore adds a
// minimal, internal producer API — `enterStage`, `exitStage`,
// `emitEnding`, all below — and the stage transitions they report are
// **recorded on the scan's own row** (`scans.stage_events`,
// `supabase/migrations/20260911120000_scans_stage_events.sql`), which is
// where `progress()` reads them back from. That is the answer to step 9's
// "an async iterable over the scan's recorded stage transitions", and it
// is a change of transport and nothing else: `StageName`, `STAGES`,
// `StageEvent` and `progress` are exactly the shape BP-023 documents.
//
// **What stood here before, and why it was wrong** (issue #540). The
// producers published onto a module-scoped, in-process event bus, and the
// paragraph this one replaces flagged the failure in advance: "this only
// carries events within one Node process, so if the job that runs
// `runScan` and the process that serves this route are ever different
// deployed instances, a second transport (Postgres LISTEN/NOTIFY, a
// queue) replaces this bus without changing `progress`'s own exported
// shape". On the platform this deploys to they are different instances —
// `POST /api/scan` runs the pass inside its own invocation and
// `GET /api/scan/{scanId}/progress` is served by another — so the
// subscriber listened to an empty bus in its own process, the visitor read
// the first stage handle forever and the report never replaced the
// progress view. The recorded log is that second transport; the section
// that opens it, below, says why it is a log on the row and not
// LISTEN/NOTIFY. The bus's second loose end goes with it: nothing is held
// in memory for the life of the process any more, so no retention policy
// is owed.
//
// **Why `dbAdmin()` appears here at all** (this file's own `##
// Interfaces` block names it as consumed): it is now the transport itself,
// and it also answers "does this `scanId` exist at all" — an unknown or
// malformed id (WO-281 `## Steps` step 19) must not simply hang waiting
// for an event that will never come. One read of `scans` answers both: a
// known scan yields whatever it has recorded plus whatever it records
// while the subscriber is attached, and an unknown one yields nothing at
// all, which `route.ts` (WO-063's half of this WO) reads as "respond 404"
// without itself touching a database.
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

// ── The transport: the scan's own recorded log ───────────────────────────
//
// **The second transport this file's header asked for (issue #540).** What
// stood here was a module-scoped `Map` of per-`scanId` listeners, and the
// header above said what would break it: "if the job that runs `runScan`
// and the process that serves this route are ever different deployed
// instances, a second transport … replaces this bus without changing
// `progress`'s own exported shape". On the platform this deploys to they
// are different instances — `POST /api/scan` runs the pass inside its own
// invocation, `GET …/progress` is served by another — so the subscriber
// listened to an empty bus in its own process and the visitor read the
// first stage handle forever.
//
// The transport is now **`scans.stage_events`**, an ordered jsonb log of
// this module's own `StageEvent` values
// (`supabase/migrations/20260911120000_scans_stage_events.sql`). Producers
// append one element per transition; `progress()` replays the array and
// then re-reads it. Nothing is derived on the way out: an element is the
// event, so what a subscriber in another process receives is byte for byte
// what a subscriber in the producer's own process would have.
//
// Not LISTEN/NOTIFY — the other transport that header named — for two
// reasons, both structural rather than preferential. `db()`/`dbAdmin()`
// are PostgREST over HTTP (`src/lib/db/index.ts`, the only two ways to
// reach Postgres here) and PostgREST carries no `LISTEN`; and a
// notification is not durable, while the ordinary case is a subscriber
// that attaches *after* the pass has already started and must still be
// shown what it missed.
//
// **The in-process wake below is an optimisation and never the
// transport.** It carries no payload: a local producer's append, once the
// database has it, nudges any subscriber in this same process to re-read
// rather than wait out its poll. Delete it and this module is still
// correct, only up to one poll slower — which is exactly what every
// subscriber in another process already is.

/** How long a subscriber waits before re-reading the log, in
 *  milliseconds, when no local producer has nudged it. It bounds the lag
 *  between a stage transition and the frame the visitor reads: one second
 *  against a pass bounded at `TIMING.reportCeilingS`, so a stage is never
 *  stale on screen by a noticeable fraction of the wait, and a stream
 *  costs one primary-key read a second.
 *
 *  Local, not a pin: `structure.md` rule 5's bar — "a number that appears
 *  in two files is wrong" — does not reach a value that lives in exactly
 *  one file, which this stays as long as no second caller repeats it
 *  (`ceilings.ts`'s `FREE_SCAN_POLICY_VERSION` is the same case). */
const POLL_INTERVAL_MS = 1000;

/** The generated `Database` type is the baseline schema's
 *  (`src/lib/db/types.generated.ts` says so in its own header), and
 *  carries neither `scans.stage_events` nor `append_scan_stage_event`,
 *  both of which are on disk in `supabase/migrations/`. One narrow,
 *  explicitly cast boundary, the same worked-around gap `store.ts`,
 *  `admission.ts` and `stuck.ts` already carry. */
interface MinimalClient {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: unknown
      ): {
        limit(count: number): PromiseLike<{ data: ScanProgressRow[] | null; error: { message: string } | null }>;
      };
    };
  };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
}

/** Exactly the columns `progress()` reads: the recorded log, and the two
 *  the row states its own end in. */
interface ScanProgressRow {
  stage_events: unknown;
  status: string | null;
  stopped_reason: string | null;
}

function client(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

// ── The producers ────────────────────────────────────────────────────────

/** Wakers registered by subscribers running in *this* process. Never the
 *  transport (see above): a waker carries nothing and only shortens a
 *  local subscriber's wait for a read it was going to make anyway. */
const localWakers = new Map<string, Set<() => void>>();

function wakeLocal(scanId: string): void {
  const wakers = localWakers.get(scanId);
  if (wakers === undefined) return;
  for (const wake of [...wakers]) wake();
}

/** BP-023 `## NFR budget`: "one line per stage transition." Heartbeats and
 *  the ending carry their own accounting elsewhere (`progress()` and
 *  `ceilings.ts`'s own ending line, respectively) — this is stage entry
 *  and exit only. */
function logStageTransition(scanId: string, stage: StageName, done: boolean): void {
  console.log(JSON.stringify({ event: "stage_transition", scanId, stage, done }));
}

/** Records one event on the scan's own log, then nudges any subscriber in
 *  this process.
 *
 *  **A pass is never taken down by its own progress stream.** A recording
 *  that fails — the row is gone, PostgREST is unreachable, the log is
 *  already closed by the ending — leaves a line in the log output and
 *  returns; the measurement carries on. The visitor's stream is the thing
 *  that degrades, and it degrades to what the row itself says, because
 *  `progress()` reads the scan's own end state as well as this log.
 *
 *  The "no event after the ending" guard that `publish` used to hold in
 *  memory is now the `where` clause of `append_scan_stage_event`, where it
 *  is one statement and cannot be raced. */
async function publish(scanId: string, event: StageEvent): Promise<void> {
  try {
    const { error } = await client().rpc("append_scan_stage_event", {
      p_scan_id: scanId,
      p_event: event,
    });
    if (error !== null) throw new Error(error.message);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "stage_event_not_recorded",
        scanId,
        detail: error instanceof Error ? error.message : String(error),
      })
    );
    return;
  }
  wakeLocal(scanId);
}

/** Reports a stage's entry — the seam BP-012's `runScan` calls as it starts
 *  a unit of measurable work. Not part of BP-023's documented reader-side
 *  interface (see this file's header). */
export async function enterStage(scanId: string, stage: StageName): Promise<void> {
  await publish(scanId, { stage, done: false });
  logStageTransition(scanId, stage, false);
}

/** Reports a stage's exit — never called for a stage the ceilings cut
 *  off (WO-281 `## Steps` step 12: "a stage the ceilings cut off emits no
 *  `done: true`"). */
export async function exitStage(scanId: string, stage: StageName): Promise<void> {
  await publish(scanId, { stage, done: true });
  logStageTransition(scanId, stage, true);
}

/** Reports the one terminal `Ending` (WO-059's type, carried by this WO).
 *  A second call after the first is a no-op by the append's own guard. */
export async function emitEnding(scanId: string, ending: Ending): Promise<void> {
  await publish(scanId, { ending });
}

// ── progress(scanId) — the reader side ───────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One `StageEvent` as it came back out of the log. The column is `jsonb`,
 *  so what is read is `unknown` until it is checked — a stage handle this
 *  engine no longer names, or an element written by an older shape, is not
 *  an event this stream can carry and is dropped rather than serialised
 *  onto the wire as something the client has no arm for. */
function asStageEvent(value: unknown): StageEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if ("ending" in record) {
    const ending = record.ending;
    return typeof ending === "object" && ending !== null ? { ending: ending as Ending } : null;
  }
  if ("stage" in record) {
    const stage = record.stage;
    if (typeof stage !== "string" || !(STAGES as readonly string[]).includes(stage)) return null;
    return { stage: stage as StageName, done: record.done === true };
  }
  if (record.heartbeat === true) return { heartbeat: true };
  return null;
}

/** The `Ending` a row states about itself, for a stream whose log carries
 *  none.
 *
 *  Three passes reach this. One that the platform froze before it could
 *  record its ending, and that the sweep (`src/lib/scan/stuck.ts`) has
 *  since called a ghost. One that ended before this column existed. And
 *  §6.4's free re-scan, which serves the stored report and closes its
 *  adopted row without running a stage at all. In all three the row has
 *  ended and the visitor is owed the swap REQ-003 c3 promises, so the row
 *  itself is read as the last word — which is the defect this discharges:
 *  "the report never replaces the progress view even after the scan has
 *  ended in the database".
 *
 *  A row has ended only when it says so: a `status` that is present and
 *  is not `running`. A missing one is not an ending — failing that way
 *  would close a live visitor's stream on a read that simply did not carry
 *  the column. `stopped_reason`'s five values are
 *  `scans_stopped_reason_check`'s; a row that ended without recording one
 *  ended without saying what it produced, which is `failed` and not a
 *  report. */
function endingOf(row: ScanProgressRow): Ending | null {
  if (typeof row.status !== "string" || row.status === "running") return null;
  switch (row.stopped_reason) {
    case "complete":
      return { kind: "report", complete: true, stoppedReason: "complete" };
    case "time_ceiling":
    case "spend_ceiling":
      return { kind: "report", complete: false, stoppedReason: row.stopped_reason };
    case "site_unreadable":
      return { kind: "report", complete: false, stoppedReason: "site_unreadable", refusal: null };
    default:
      return { kind: "no_report", stoppedReason: "failed" };
  }
}

/** What one read of the scan's row says: every event recorded so far, and
 *  the ending the row itself states if it has one. `null` is "no such
 *  scan" — an unknown or malformed id, which `route.ts` reads as 404, and
 *  a read error, which fails closed the same way rather than serving a
 *  stream for an id nobody can confirm is real. */
async function readLog(scanId: string): Promise<{ events: StageEvent[]; ending: Ending | null } | null> {
  const { data, error } = await client()
    .from("scans")
    .select("stage_events, status, stopped_reason")
    .eq("id", scanId)
    .limit(1);
  if (error !== null) return null;
  const row = data?.[0];
  if (row === undefined) return null;
  const recorded = Array.isArray(row.stage_events) ? row.stage_events : [];
  const events: StageEvent[] = [];
  for (const element of recorded) {
    const event = asStageEvent(element);
    if (event !== null) events.push(event);
  }
  return { events, ending: endingOf(row) };
}

/** The narrowing of BP-012's declared `progress(scanId: string):
 *  AsyncIterable<{ stage: StageName; done: boolean }>` — BP-023's union
 *  adds the heartbeat and the ending arms (that refinement is BP-023's
 *  contract, not re-decided here). Replays whatever this scan has already
 *  recorded — a subscriber that joins after the pipeline started, which is
 *  the ordinary case and now also the *cross-process* case, still receives
 *  the stages that ran before it subscribed — then re-reads the log until
 *  the one ending, filling any idle gap with a heartbeat at least every
 *  `TIMING.progressHeartbeatS`.
 *
 *  **The first event is never waited for.** A known scan that has recorded
 *  nothing yet yields one heartbeat immediately, so the response opens on
 *  the first database read rather than on the pass's first transition:
 *  `route.ts` pulls one event before it decides 200 or 404, and a visitor
 *  whose `EventSource` connected in the moment between the claim and the
 *  first stage must not hold an un-answered connection for a heartbeat
 *  interval to find that out. */
export async function* progress(scanId: string): AsyncIterable<StageEvent> {
  let log = await readLog(scanId);
  if (log === null) return;

  const wakers = localWakers.get(scanId) ?? new Set<() => void>();
  localWakers.set(scanId, wakers);
  // A nudge that lands while this subscriber is busy — reading, or handing
  // an event to the route — is remembered rather than lost, so the next
  // wait is skipped instead of sitting out a poll for an event already in
  // the log.
  let wake: (() => void) | null = null;
  let nudged = false;
  const waker = (): void => {
    const w = wake;
    wake = null;
    if (w === null) nudged = true;
    else w();
  };
  wakers.add(waker);

  try {
    let delivered = 0;
    let opened = false;
    let lastEventAt = Date.now();
    while (true) {
      while (delivered < log.events.length) {
        const event = log.events[delivered]!;
        delivered += 1;
        opened = true;
        lastEventAt = Date.now();
        yield event;
        if ("ending" in event) return;
      }

      // The row has ended and never recorded its ending: the row's own
      // word is the last one, and the stream closes on it.
      if (log.ending !== null) {
        yield { ending: log.ending };
        return;
      }

      if (!opened || Date.now() - lastEventAt >= TIMING.progressHeartbeatS * 1000) {
        opened = true;
        lastEventAt = Date.now();
        yield { heartbeat: true };
        continue;
      }

      if (!nudged) {
        await Promise.race([
          new Promise<void>((resolve) => {
            wake = resolve;
          }),
          delay(POLL_INTERVAL_MS),
        ]);
      }
      wake = null;
      nudged = false;
      const next = await readLog(scanId);
      if (next === null) return;
      log = next;
    }
  } finally {
    wakers.delete(waker);
    if (wakers.size === 0) localWakers.delete(scanId);
  }
}
