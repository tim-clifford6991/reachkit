// BUILD §4.3: the release latch. The founder leaves the waiting screen once, for any of four reasons (finished, degraded, failed, or `TIMING.deepReleaseMin` passed);
// all write the same latch, the first writer wins and no caller can clear it.
// No scheduled job: the deadline is a fact about `setup_completed_at` that `isReleased` latches on the first read.
// It consults no opportunity count: an empty pass releases down the same path.
import { TIMING } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";

/** Closed: a fifth reason needs a change here and to the check constraint on `sites`. */
export type ReleaseReason = "completed" | "degraded" | "failed" | "deadline";

export const RELEASE_REASONS: readonly ReleaseReason[] = Object.freeze([
  "completed",
  "degraded",
  "failed",
  "deadline",
]);

export type Released = { released: true; at: Date; reason: ReleaseReason };

export type ReleaseState = { released: false; deadlineAt: Date } | Released;

/** The generated `Database` type carries none of the `sites.setup_*` columns: one narrow cast boundary. */
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

/** When a founder who submitted at `completedAt` is released whatever the pass is doing. */
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

/** Writes the latch, or reports the one already there: one conditional update, so racing triggers produce one release.
 *  The first writer's reason stands, so a pass finishing after the deadline cannot un-say it. */
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

/** Whether this founder has been released, latching the deadline if it passed; the read path is the deadline's only trigger. */
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
