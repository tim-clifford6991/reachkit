// BUILD §4.3 — the release latch: four triggers, one monotonic write, no
// scheduled job.
//
// "on completion straight to the app with the first draft already in the
// calendar. A degraded pass still releases setup (zero proposals is legal,
// never faked)." (§4.3)
//
// The founder leaves the waiting screen exactly once, and four different
// things can be the reason: the pass finished, it degraded, it failed
// outright, or `TIMING.deepReleaseMin` minutes passed since they submitted
// setup and it has still not ended. All four write the same latch, the
// first writer wins, and no caller can clear it — so "the wait is over for
// that founder for good" is a property of the write, not of every reader
// remembering to check first.
//
// **No scheduled job anywhere in this file.** The deadline is not a timer
// that has to fire; it is a fact about `setup_completed_at` that becomes
// true on its own, and `isReleased` latches it on the read path the first
// time anybody asks. A founder whose pass never reported and who signs in
// a week later is released by their own first read, with nothing having
// run in between.
//
// **It consults no opportunity count.** A pass that produced nothing
// releases down the identical path as one that produced twelve
// proposals — the emptiness is something the app states plainly (§7), never
// a reason to hold somebody on a progress screen.
import { TIMING } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";

/** Why the latch was written. Closed: a fifth reason is a change here and
 *  a change to the check constraint in
 *  `supabase/migrations/20260906130000_sites_setup.sql`, never a string a
 *  caller invents. */
export type ReleaseReason = "completed" | "degraded" | "failed" | "deadline";

export const RELEASE_REASONS: readonly ReleaseReason[] = Object.freeze([
  "completed",
  "degraded",
  "failed",
  "deadline",
]);

export type Released = { released: true; at: Date; reason: ReleaseReason };

export type ReleaseState = { released: false; deadlineAt: Date } | Released;

/** The generated `Database` type carries none of the `sites.setup_*`
 *  columns this issue's own migration adds. One narrow, explicitly cast
 *  boundary — the same worked-around gap `src/lib/scan/report.ts` and
 *  `admission.ts` already carry; regenerating `types.generated.ts` needs
 *  the Supabase CLI against a live database and is not this change's to
 *  do. */
interface SetupRow {
  id: string;
  setup_completed_at: string | null;
  setup_released_at: string | null;
  setup_released_reason: ReleaseReason | null;
}

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  is(column: string, value: null): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

function untyped(client: ReturnType<typeof dbAdmin>): MinimalClient {
  return client as unknown as MinimalClient;
}

const MS_PER_MINUTE = 60_000;

/** When a founder who submitted at `completedAt` is released whatever the
 *  pass is doing. */
export function deadlineFrom(completedAt: Date): Date {
  return new Date(completedAt.getTime() + TIMING.deepReleaseMin * MS_PER_MINUTE);
}

async function readSetupRow(siteId: string): Promise<SetupRow | null> {
  const { data, error } = await untyped(dbAdmin())
    .from<SetupRow>("sites")
    .select("id, setup_completed_at, setup_released_at, setup_released_reason")
    .eq("id", siteId)
    .limit(1);
  if (error) throw new Error(`release: could not read site ${siteId}: ${error.message}`);
  return data?.[0] ?? null;
}

function latched(row: SetupRow): Released | null {
  if (row.setup_released_at === null || row.setup_released_reason === null) return null;
  return {
    released: true,
    at: new Date(row.setup_released_at),
    reason: row.setup_released_reason,
  };
}

/**
 * Writes the latch, or reports the one already there.
 *
 * A single conditional update — `set … where setup_released_at is null` —
 * so two triggers racing produce one release and one of them learns it
 * lost. The loser does not overwrite, does not retry and does not report
 * its own reason: the first writer's reason is the one that stands, which
 * is what makes a pass that finishes *after* the deadline unable to
 * un-say "the measurement did not complete".
 */
export async function releaseToApp(a: {
  siteId: string;
  reason: ReleaseReason;
  now?: Date;
}): Promise<{ releasedAt: Date; reason: ReleaseReason }> {
  const now = a.now ?? new Date();

  const { data, error } = await untyped(dbAdmin())
    .from<SetupRow>("sites")
    .update({ setup_released_at: now.toISOString(), setup_released_reason: a.reason })
    .eq("id", a.siteId)
    .is("setup_released_at", null)
    .select("id, setup_completed_at, setup_released_at, setup_released_reason");
  if (error) throw new Error(`releaseToApp: ${error.message}`);

  const written = data?.[0];
  if (written !== undefined) return { releasedAt: now, reason: a.reason };

  // Zero rows: somebody latched first, or there is no such site. Read
  // back rather than assume — the caller is owed the reason that actually
  // stands, not the one it offered.
  const row = await readSetupRow(a.siteId);
  const already = row === null ? null : latched(row);
  if (already === null) {
    throw new Error(`releaseToApp: no site ${a.siteId} to release`);
  }
  return { releasedAt: already.at, reason: already.reason };
}

/**
 * Whether this founder has been released, latching the deadline if it has
 * passed.
 *
 * The read path is the deadline's only trigger. A founder who is still
 * inside the window gets `{ released: false }` and the instant they will
 * be released at — a fact about their own submit, not a countdown, and
 * nothing renders it.
 */
export async function isReleased(siteId: string, now: Date = new Date()): Promise<ReleaseState> {
  const row = await readSetupRow(siteId);
  if (row === null) throw new Error(`isReleased: no site ${siteId}`);

  const already = latched(row);
  if (already !== null) return already;

  if (row.setup_completed_at === null) {
    // Setup was never submitted, so no pass was ever started and no
    // deadline has begun to run. Reported as unreleased with the deadline
    // it *would* have; the incomplete-setup gate is what keeps this
    // founder off the waiting screen, not this function.
    return { released: false, deadlineAt: deadlineFrom(now) };
  }

  const deadlineAt = deadlineFrom(new Date(row.setup_completed_at));
  if (now.getTime() < deadlineAt.getTime()) return { released: false, deadlineAt };

  const written = await releaseToApp({ siteId, reason: "deadline", now });
  return { released: true, at: written.releasedAt, reason: written.reason };
}
