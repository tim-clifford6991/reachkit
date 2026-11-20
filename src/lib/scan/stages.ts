// The six stage handles for one scan, one per dataset boundary of §6.3's free-scan list, and the stream carrying their transitions, a heartbeat
// and exactly one `ending` to `progress(scanId)`. No word a visitor reads appears here: the handles are internal.
// Producers (`enterStage`, `exitStage`, `emitEnding`) record transitions on the scan's own row (`scans.stage_events`), and `progress()` reads them back:
// the pass and the progress route run in different invocations, so an in-process bus would leave the visitor on the first stage forever.
// One read of `scans` is the transport and also answers whether the `scanId` exists, so an unknown id yields nothing (a 404) instead of hanging.
import { dbAdmin } from "@/lib/db";
import { BATTERY, TIMING } from "@/lib/config/constants";
import { isBusinessKind, type BusinessKind } from "@/lib/market/kinds";
import { isCountry, type Country } from "@/lib/locale/locales";
import type { Ending } from "./ceilings";

// ── StageName, STAGES ────────────────────────────────────────────────────

/** Internal handles; every word a visitor reads comes from the copy registry. */
export type StageName =
  | "reading_your_site" // own fetches: home + detected pricing page
  | "reading_access_rules" // robots.txt and the home document's reader rules
  | "reading_your_market" // profile + keyword_suggestions → market set + the 12 questions
  | "checking_your_presence" // ranked_keywords@50
  | "asking_the_twelve" // 12 live organic SERPs, with their AI overviews
  | "scoring"; // drivers, score, band, problems, first page

/** One entry per `StageName`, in order: `satisfies Record<StageName, true>` refuses to build if the union and this list diverge, and `STAGES` derives from its keys. */
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

// Runtime half of the six-stage assertion, at module load.
if (STAGES.length !== 6) {
  throw new Error(`src/lib/scan/stages.ts: expected exactly 6 stages, found ${STAGES.length}.`);
}
if (new Set(STAGES).size !== STAGES.length) {
  throw new Error("src/lib/scan/stages.ts: STAGES contains a duplicate stage name.");
}

// ── StageEvent ───────────────────────────────────────────────────────────

/** What a finished stage already knew, for the screen to fill its card with:
 *  counts and short labels only, never page text or a vendor payload. */
export interface StageSummary {
  /** Pages the site's crawl read; never 0, which would read as measured. */
  pagesRead?: number;
  category?: string;
  /** The kind of business the market read, so the screen names it before the report. */
  kind?: BusinessKind;
  /** Who buys, as the report's reading words it: a phrase, never cut. */
  buyer?: string;
  /** The town a local site sells in; absent for a site that sells wider. */
  place?: string;
  /** How far a site with no town sells, and the country that reach is read in. */
  reach?: "national" | "international";
  country?: Country;
  readers?: { google: "in" | "out"; ai: "in" | "out" };
  searches?: readonly { words: string; onPageOne: boolean }[];
}

export const CATEGORY_MAX = 60;
const BUYER_MAX = 200;
const PLACE_MAX = 60;
const WORDS_MAX = 80;

const isReader = (value: unknown): value is "in" | "out" => value === "in" || value === "out";

/** A summary as the log may hold it: each field kept only where it is well
 *  formed and inside its cap, and nothing at all where no field is left. */
export function asSummary(value: unknown): StageSummary | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as Record<string, unknown>;
  const out: { -readonly [K in keyof StageSummary]: StageSummary[K] } = {};
  if (typeof v.pagesRead === "number" && Number.isInteger(v.pagesRead) && v.pagesRead >= 1) out.pagesRead = v.pagesRead;
  if (typeof v.category === "string" && v.category.trim() !== "" && v.category.length <= CATEGORY_MAX) out.category = v.category;
  if (typeof v.kind === "string" && isBusinessKind(v.kind)) out.kind = v.kind;
  // Past its cap a phrase is dropped, never cut, so the screen never shows half of one.
  if (typeof v.buyer === "string" && v.buyer.trim() !== "" && v.buyer.length <= BUYER_MAX) out.buyer = v.buyer;
  if (typeof v.place === "string" && v.place.trim() !== "" && v.place.length <= PLACE_MAX) out.place = v.place;
  if (v.reach === "national" || v.reach === "international") out.reach = v.reach;
  if (isCountry(v.country)) out.country = v.country;
  const readers = v.readers as Record<string, unknown> | null | undefined;
  if (typeof readers === "object" && readers !== null && isReader(readers.google) && isReader(readers.ai)) {
    out.readers = { google: readers.google, ai: readers.ai };
  }
  if (Array.isArray(v.searches)) {
    const searches = v.searches
      .filter(
        (s): s is { words: string; onPageOne: boolean } =>
          typeof s === "object" && s !== null && typeof s.words === "string" && s.words !== "" && s.words.length <= WORDS_MAX && typeof s.onPageOne === "boolean"
      )
      .slice(0, BATTERY.QUESTIONS)
      .map((s) => ({ words: s.words, onPageOne: s.onPageOne }));
    if (searches.length > 0) out.searches = searches;
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

export type StageEvent =
  | { stage: StageName; done: boolean; summary?: StageSummary }
  | { heartbeat: true } // ≥ every 30 s
  | { ending: Ending }; // terminal; the stream then closes

// ── The transport: the scan's own recorded log ───────────────────────────
// `scans.stage_events` is an ordered jsonb log of `StageEvent` values: producers append one per transition, `progress()` replays and re-reads it.
// Not LISTEN/NOTIFY: PostgREST carries no `LISTEN`, and a notification is not durable while subscribers usually attach after the pass started.
// The in-process wake below is only an optimisation: it carries nothing and only saves a local subscriber one poll.

/** How long a subscriber waits before re-reading the log when no local producer nudged it: one second bounds a stage's on-screen lag
 *  and costs one primary-key read a second. */
const POLL_INTERVAL_MS = 1000;

/** The generated `Database` type carries neither `scans.stage_events` nor `append_scan_stage_event`: one narrow cast boundary. */
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

/** Wakers registered by subscribers in this process: never the transport, only a shorter wait for a read it would make anyway. */
const localWakers = new Map<string, Set<() => void>>();

function wakeLocal(scanId: string): void {
  const wakers = localWakers.get(scanId);
  if (wakers === undefined) return;
  for (const wake of [...wakers]) wake();
}

/** One line per stage transition, entry and exit only; heartbeats and the ending are accounted elsewhere. */
function logStageTransition(scanId: string, stage: StageName, done: boolean): void {
  console.log(JSON.stringify({ event: "stage_transition", scanId, stage, done }));
}

/** Records one event on the scan's log, then nudges local subscribers. A failed recording logs and returns: a pass is never taken down by its
 *  own progress stream, which degrades to what the row says. "No event after the ending" is `append_scan_stage_event`'s `where`, so it cannot be raced. */
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

/** Reports a stage's entry, as `runScan` starts a unit of measurable work. */
export async function enterStage(scanId: string, stage: StageName): Promise<void> {
  await publish(scanId, { stage, done: false });
  logStageTransition(scanId, stage, false);
}

/** Reports a stage's exit; never called for a stage the ceilings cut off. */
export async function exitStage(scanId: string, stage: StageName, summary?: StageSummary): Promise<void> {
  const kept = asSummary(summary);
  await publish(scanId, kept === undefined ? { stage, done: true } : { stage, done: true, summary: kept });
  logStageTransition(scanId, stage, true);
}

/** Reports the one terminal `Ending`; a second call is a no-op by the append's own guard. */
export async function emitEnding(scanId: string, ending: Ending): Promise<void> {
  await publish(scanId, { ending });
}

// ── progress(scanId) — the reader side ───────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One `StageEvent` as it came back out of the `jsonb` log: a handle this engine no longer names, or an older shape, is dropped rather than sent
 *  as something the client has no arm for. */
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
    const done = record.done === true;
    const summary = done ? asSummary(record.summary) : undefined;
    return summary === undefined ? { stage: stage as StageName, done } : { stage: stage as StageName, done, summary };
  }
  if (record.heartbeat === true) return { heartbeat: true };
  return null;
}

/** The `Ending` a row states about itself, for a log that carries none: a pass frozen before recording it (since swept by `stuck.ts`),
 *  one older than the log, or §6.4's free re-scan that ran no stage. The visitor is still owed the report replacing the progress view.
 *  Only a present non-`running` `status` is an ending; one with no `stopped_reason` ended without a report, so `failed`. */
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

/** What one read of the scan's row says: every event so far and the row's own ending, if any. `null` is "no such scan" (a 404),
 *  and a read error fails closed the same way. */
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

/** Replays what this scan has recorded, so a subscriber who joins late (or in another process) still sees earlier stages, then re-reads
 *  until the one ending, with a heartbeat at least every `TIMING.progressHeartbeatS`.
 *  The first event is never waited for: a known scan with nothing recorded yields a heartbeat at once, so the route can decide 200 or 404. */
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
