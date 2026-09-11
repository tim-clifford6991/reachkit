// src/lib/scan/admission.ts — BP-023 `## Public interface`, WO-057, WO-058
//
// `admitFreeScan` answers *may a free scan start* against the free path's
// bounds, in BP-012's fixed order, without side effects and without
// consuming an allowance — every render of a report address can ask the
// question (BP-023 decision 5: this function checks, `claimFreeScanSlot`,
// WO-058, consumes). The order is BP-012's, reproduced here as the step
// list only; the reasoning lives in BP-012's `## Decisions` (rule 2.4):
//
//   removed → cooldown → switched off / daily ceiling → in-flight → hourly
//
// what each step reads and returns is BP-023's `## Error & edge behavior`
// table. `evaluateAdmission`, below, is that order extracted once (WO-058
// `## Steps` step 2, rule 2.4): both `admitFreeScan` and `claimFreeScanSlot`
// call it, so the order exists exactly once in this file.
//
// **`claimFreeScanSlot`'s transaction, and a deviation flagged once here
// (constitution rule 4.2) — full reasoning in `supabase/migrations/
// 00000000000006_scans_freepath_claim.sql`'s own header:** BP-023's NFR
// budget calls `claimFreeScanSlot` "one serialisable transaction". Reached
// only through `dbAdmin()` (`@supabase/supabase-js`, a PostgREST client), a
// literal client-driven `BEGIN` / `SET TRANSACTION ISOLATION LEVEL
// SERIALIZABLE` / `COMMIT` spanning the six-step re-evaluation and the
// insert is not reachable from this module alone — each `.from(...)` call
// is its own HTTP request and its own implicit transaction, and neither a
// stored procedure (a migration function body) nor a raw `pg` connection is
// in WO-058's file plan. `claimFreeScanSlot` instead re-evaluates the same
// order and then attempts the insert; two concurrent claims for one
// network can both pass the in-memory re-evaluation, but the migration
// above's partial unique index — at most one `running` scan per network —
// lets Postgres allow only one of the resulting inserts to succeed,
// atomically and regardless of the calling transaction's isolation level.
// The loser's insert is rejected by the database, not raced against in
// application code, and is reported as an `in_flight` refusal below — the
// same outcome the NFR budget names, reached by a constraint rather than
// an isolation level this client cannot request.
//
// **Two schema gaps, each flagged once here (constitution rule 4.2), not
// fabricated around:**
//
//  1. The removal table (BP-002's; the removal address holds it) had
//     not landed in this repo when this module was written. **The table
//     landed on 2026-09-05** (`supabase/migrations/
//     20260905120000_domainblocks.sql`, issue #28), so the gap is now
//     half closed: the read below hits a real table. What remains is the
//     generated `Database` type (`src/lib/db/types.generated.ts`), which
//     was not regenerated with it and still carries no entry for
//     it — so the `untyped` hatch below stays until a
//     regeneration lands.
//  2. `scans.network_hash` and `scans.from_incomplete_rescan` were added to
//     the live schema by WO-056's migration (`supabase/migrations/
//     00000000000005_scans_freepath.sql`), but `types.generated.ts` was not
//     regenerated in that WO's own file plan, so both columns are absent
//     from the generated `Database` type too, even though they exist.
//
// Both gaps are worked around the same way: a minimal, locally declared
// row shape and a narrow, explicitly cast query builder (`untyped`,
// below) for exactly the calls that touch them — the removal table
// entirely (its own reader is `./removal` since #104);
// `scans.network_hash` on the in-flight and hourly reads and on
// `claimFreeScanSlot`'s insert; `scans.from_incomplete_rescan` on that same
// insert (WO-058). Every other query in this file is fully typed against
// the generated `Database`. Regenerating `types.generated.ts` closes both
// gaps at once and is its own change (a WO-267-shaped one, not an
// admission-order one); the migration half of gap 1 is closed.
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { env } from "@/lib/config/env";
import {
  DAILY_WINDOW_H,
  FAILURE_COOLDOWN_H,
  FREE_BOUNDS,
  HOURLY_WINDOW_H,
} from "@/lib/config/constants";
import { now } from "@/lib/config/now";
// By file, not through `@/lib/costs`: the barrel is the spending seam and
// drags the ledger write and the cache read behind it, where admission
// only ever asks this one module a question.
import {
  ceilingReached,
  readDaySpendCents,
  secondsUntilDayRollsOver,
} from "@/lib/costs/daily";
import { dbAdmin } from "@/lib/db";
import { isRemovedWith } from "./removal";
import type { CanonicalDomain } from "./domain";

// ── NetworkKey — BP-023 decision 3 ──────────────────────────────────────

/** Opaque, salted, non-reversible. REQ-003 counts by network; no raw address is
 *  stored or logged anywhere in the product. */
export type NetworkKey = string & { readonly __networkKey: unique symbol };

const UNKNOWN_NETWORK_SEED = "unknown";

/** Accepts the first entry of `x-forwarded-for`, truncates an IPv6 address
 *  to its /64 prefix (BP-023 decision 3: a single subscriber routinely
 *  holds a whole /64), and HMACs the result with `IP_HASH_SALT` — never the
 *  raw address itself. A null or unparseable header still yields a key — a
 *  stable one shared for every unparseable input, so a visitor with a
 *  malformed header is still counted rather than crashing the check — and
 *  this function never throws. */
export function networkKeyOf(forwardedFor: string | null): NetworkKey {
  try {
    const entry = firstForwardedEntry(forwardedFor);
    const seed = entry === null ? UNKNOWN_NETWORK_SEED : addressSeed(entry);
    return hashSeed(seed);
  } catch {
    return hashSeed(UNKNOWN_NETWORK_SEED);
  }
}

function firstForwardedEntry(forwardedFor: string | null): string | null {
  if (!forwardedFor) return null;
  const first = forwardedFor.split(",")[0]?.trim() ?? "";
  return first.length > 0 ? first : null;
}

function addressSeed(candidate: string): string {
  const stripped = stripBrackets(candidate.split("%")[0] ?? candidate);
  const kind = isIP(stripped);
  if (kind === 4) return stripped;
  if (kind === 6) return ipv6Prefix64(stripped) ?? UNKNOWN_NETWORK_SEED;
  return UNKNOWN_NETWORK_SEED;
}

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/** The address's /64 network prefix, as its first four (of eight) 16-bit
 *  groups, fully expanded — `null` when the address does not expand to
 *  eight groups (defence in depth; `isIP` has already validated it). */
function ipv6Prefix64(address: string): string | null {
  const groups = expandIPv6Groups(address);
  if (!groups || groups.length !== 8) return null;
  return groups.slice(0, 4).join(":");
}

function expandIPv6Groups(address: string): string[] | null {
  const halves = address.split("::");
  if (halves.length > 2) return null;
  if (halves.length === 2) {
    const head = halves[0] ? halves[0].split(":") : [];
    const tail = halves[1] ? halves[1].split(":") : [];
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    return [...head, ...Array(missing).fill("0"), ...tail];
  }
  const groups = address.split(":");
  return groups.length === 8 ? groups : null;
}

function hashSeed(seed: string): NetworkKey {
  return createHmac("sha256", env.IP_HASH_SALT).update(seed).digest("hex") as NetworkKey;
}

// ── Admission — BP-012's declared union, reproduced verbatim ────────────

/** Verbatim BP-012's declared union — the refusal reasons and their fields are
 *  that node's contract and are not restated differently here — plus one
 *  field it lacked: `in_flight`'s `runningSince`, the running row's
 *  `created_at`, so a refusal can say how long the network stays held
 *  (issue #510). Absent only when no running row could be re-read. */
export type Admission =
  | { admit: true }
  | { refuse: "hourly"; retryAfterSeconds: number }
  | { refuse: "in_flight"; sameDomain: boolean; runningScanId?: string; runningSince?: Date }
  | { refuse: "daily"; retryAfterSeconds: number }
  | { refuse: "switched_off" }
  | { refuse: "cooldown"; retryAfterSeconds: number }
  | { refuse: "removed" };

// ── The narrow, explicitly cast escape hatch for the two schema gaps ────

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** PostgREST's own error shape carries `code` — the Postgres SQLSTATE
 *  (`23505` for a unique-violation) — alongside `message`; the read-only
 *  queries above never need it, `claimFreeScanSlot`'s insert does
 *  (`isUniqueViolation`, below). */
interface MutationError {
  message: string;
  code?: string;
}

interface SingleResult<T> {
  data: T | null;
  error: MutationError | null;
}

/** The subset of the PostgREST filter-builder chain this file calls,
 *  typed against a locally declared row shape rather than the generated
 *  `Database` (see the module header's two gaps). Thenable, matching the
 *  real client's own builder. `insert` and `single` are WO-058's addition,
 *  for `claimFreeScanSlot`'s write; every other member is WO-057's. */
interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  gte(column: string, value: string): MinimalQueryBuilder<T>;
  order(column: string, opts: { ascending: boolean }): MinimalQueryBuilder<T>;
  limit(count: number): MinimalQueryBuilder<T>;
  insert<R extends object>(row: R): MinimalQueryBuilder<T>;
  single(): PromiseLike<SingleResult<T>>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** Cast boundary for gap 1 and gap 2 (module header). Nothing else in this
 *  file bypasses the generated `Database` type. */
function untyped(client: ReturnType<typeof dbAdmin>): MinimalClient {
  return client as unknown as MinimalClient;
}

interface ScanNetworkRow {
  id: string;
  domain: string;
  created_at: string;
}

/** The row `claimFreeScanSlot` inserts — BP-023 `## Data model delta`'s
 *  three added columns plus the base columns every `scans` row carries. */
interface FreeScanInsert {
  domain: string;
  tier: "free";
  status: "running";
  network_hash: string;
  from_incomplete_rescan: boolean;
}

interface InsertedScanRow {
  id: string;
}

// ── The six-step order — BP-012's, evaluated here ───────────────────────

type Client = ReturnType<typeof dbAdmin>;

/** Whether the domain's report was taken down on a written request
 *  (REQ-002 c4). Exported because this file is the one place under `src/`
 *  that reads the removal table at all, and the correction offer
 *  (`src/lib/scan/correction.ts`) has to know the same fact the admission
 *  order's first step reads — one reader of that table in the product, not
 *  two. Since #104 that reader is `./removal`, which imports the database
 *  client and nothing else so the report address's own removal check can
 *  reach it from the Edge runtime without dragging `node:crypto` along;
 *  this export stays as the name admission's callers already use. */
export function isDomainRemoved(domain: CanonicalDomain): Promise<boolean> {
  return isRemovedWith(dbAdmin(), domain);
}

async function checkCooldown(client: Client, domain: CanonicalDomain): Promise<Admission | null> {
  const { data, error } = await client
    .from("scans")
    .select("created_at")
    .eq("domain", domain)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const latest = data?.[0];
  if (!latest) return null;
  const windowMs = FAILURE_COOLDOWN_H * 3_600_000;
  const elapsedMs = Date.now() - new Date(latest.created_at).getTime();
  if (elapsedMs >= windowMs) return null;
  return { refuse: "cooldown", retryAfterSeconds: Math.ceil((windowMs - elapsedMs) / 1000) };
}

/**
 * The day's spend, as a refusal — the free path's half of the product-wide
 * daily ceiling (issue #329, BUILD §6.5).
 *
 * "Free scans refuse first, paid passes hold": a paid pass that meets the
 * ceiling mid-flight degrades and keeps its report (`src/lib/costs/`),
 * because the customer has already paid for the pass. A free scan is the
 * spend the product chooses to make, so on a day that has reached its
 * ceiling it is not started at all — refusing at the door costs a visitor
 * a wait, where admitting them would cost them a report that stops
 * half-measured.
 *
 * It refuses under the **existing** `daily` arm rather than a new one.
 * REQ-003 c8's sentence is already the true one for this cause — free
 * scanning is paused for the day and resumes at a stated time — and the
 * time it promises is honest here in a way it is nowhere else: the day's
 * ledger goes to zero at the next UTC midnight whatever anyone does.
 *
 * Unreadable ledger admits, like every other step in this handler
 * (REQ-003 c9): `readDaySpendCents` answers `null` rather than throwing,
 * and a guard that cannot see is not a reason to stop the product.
 */
async function checkDailySpend(): Promise<Admission | null> {
  const at = now();
  const spentCents = await readDaySpendCents(at);
  if (spentCents === null || !ceilingReached(spentCents)) return null;
  return { refuse: "daily", retryAfterSeconds: secondsUntilDayRollsOver(at) };
}

async function checkDaily(client: Client): Promise<Admission | null> {
  const windowMs = DAILY_WINDOW_H * 3_600_000;
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data, error } = await client
    .from("scans")
    .select("created_at")
    .eq("tier", "free")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(FREE_BOUNDS.scansPerDay);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length < FREE_BOUNDS.scansPerDay) return null;
  const oldest = rows[rows.length - 1];
  if (!oldest) return null;
  const ageMs = Date.now() - new Date(oldest.created_at).getTime();
  const remainingMs = Math.max(0, windowMs - ageMs);
  return { refuse: "daily", retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}

async function checkInFlight(
  client: Client,
  network: NetworkKey,
  domain: CanonicalDomain
): Promise<Admission | null> {
  const { data, error } = await untyped(client)
    .from<ScanNetworkRow>("scans")
    .select("id, domain, created_at")
    .eq("network_hash", network)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const running = data?.[0];
  if (!running) return null;
  // A clock that does not parse is left off rather than guessed at: the
  // reader of `runningSince` then falls back to the whole bound.
  const since = new Date(running.created_at);
  const runningSince = Number.isNaN(since.getTime()) ? {} : { runningSince: since };
  return running.domain === domain
    ? { refuse: "in_flight", sameDomain: true, runningScanId: running.id, ...runningSince }
    : { refuse: "in_flight", sameDomain: false, ...runningSince };
}

async function checkHourly(client: Client, network: NetworkKey): Promise<Admission | null> {
  const windowMs = HOURLY_WINDOW_H * 3_600_000;
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data, error } = await untyped(client)
    .from<{ created_at: string }>("scans")
    .select("created_at")
    .eq("network_hash", network)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(FREE_BOUNDS.scansPerIpPerHour);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length < FREE_BOUNDS.scansPerIpPerHour) return null;
  const oldest = rows[rows.length - 1];
  if (!oldest) return null;
  const ageMs = Date.now() - new Date(oldest.created_at).getTime();
  const remainingMs = Math.max(0, windowMs - ageMs);
  return { refuse: "hourly", retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}

type FreeStep = "removed" | "cooldown" | "switched_off" | "daily" | "in_flight" | "hourly" | "none";

/** BP-023 NFR budget: "one line per admission carrying the decision, the
 *  step that produced it, the network key (hashed) and the domain. Never a
 *  raw address." `network` is already the HMAC output — `networkKeyOf`
 *  never returns a raw address. */
function logAdmission(result: Admission, step: FreeStep, network: NetworkKey, domain: CanonicalDomain): void {
  const decision = "admit" in result ? "admit" : result.refuse;
  console.log(
    JSON.stringify({ event: "admission", decision, step, network, domain })
  );
}

function finish<T extends Admission>(
  result: T,
  step: FreeStep,
  network: NetworkKey,
  domain: CanonicalDomain
): T {
  logAdmission(result, step, network, domain);
  return result;
}

/** The six-step order (WO-058 `## Steps` step 2, rule 2.4: stated once,
 *  called by both `admitFreeScan` and `claimFreeScanSlot`). Returns the
 *  `Admission` the order settles on and the step that produced it, for the
 *  caller's own logging — this function does not log itself, so a caller
 *  that discards the result without calling `finish` cannot double-log. */
async function evaluateAdmission(
  client: Client,
  domain: CanonicalDomain,
  network: NetworkKey
): Promise<{ result: Admission; step: FreeStep }> {
  // Step 1 — removed. Outside the fail-open handler (WO-057 `## Steps`
  // step 4, BP-023 `## Error & edge behavior`): a removal-table read
  // that errors refuses rather than admits, because failing open there
  // would serve a removed report, which REQ-002 criterion 3 forbids
  // absolutely.
  let removed: boolean;
  try {
    removed = await isRemovedWith(client, domain);
  } catch {
    return { result: { refuse: "removed" }, step: "removed" };
  }
  if (removed) return { result: { refuse: "removed" }, step: "removed" };

  // Steps 2 to 6 — cooldown, switched off, daily, in-flight, hourly — are
  // wrapped in one fail-open handler: any read error here admits (REQ-003
  // c9), and the failure is logged as such (the step that threw is the
  // step the log line names).
  let step: FreeStep = "cooldown";
  try {
    const cooldown = await checkCooldown(client, domain);
    if (cooldown) return { result: cooldown, step: "cooldown" };

    step = "switched_off";
    if (env.KILL_SWITCH) return { result: { refuse: "switched_off" }, step: "switched_off" };

    // The `daily` step now asks two questions, in the order of what
    // outranks what: the product's daily *spend* ceiling first (one figure
    // for everyone, BUILD §6.5), then BUILD §11's count of free scans.
    // Both settle on the same refusal — free scanning is paused for the
    // day — so the visitor is told one thing and the step keeps its name.
    step = "daily";
    const dailySpend = await checkDailySpend();
    if (dailySpend) return { result: dailySpend, step: "daily" };

    const daily = await checkDaily(client);
    if (daily) return { result: daily, step: "daily" };

    step = "in_flight";
    const inFlight = await checkInFlight(client, network, domain);
    if (inFlight) return { result: inFlight, step: "in_flight" };

    step = "hourly";
    const hourly = await checkHourly(client, network);
    if (hourly) return { result: hourly, step: "hourly" };

    return { result: { admit: true }, step: "none" };
  } catch {
    return { result: { admit: true }, step };
  }
}

/** Idempotent and free of side effects: BP-022 calls it on every render of a
 *  report address, and a render must never consume an allowance. */
export async function admitFreeScan(a: {
  domain: CanonicalDomain;
  network: NetworkKey;
}): Promise<Admission> {
  const client = dbAdmin();
  const { result, step } = await evaluateAdmission(client, a.domain, a.network);
  return finish(result, step, a.network, a.domain);
}

/** `error.code === '23505'` — Postgres's unique-violation SQLSTATE. The
 *  only error `insertRunningScan` treats as "lost the race" rather than
 *  rethrowing; every other insert failure propagates (WO-058's own test
 *  plan and BP-023 `## Error & edge behavior` name no other insert-failure
 *  contract for `claimFreeScanSlot` to honour, unlike the counting reads'
 *  explicit fail-open budget). */
function isUniqueViolation(error: MutationError): boolean {
  return error.code === "23505";
}

/** The insert `claimFreeScanSlot` guards with `idx_scans_one_running_per_
 *  network` (`supabase/migrations/00000000000006_scans_freepath_claim.sql`).
 *  Returns the new row's id, or `{ conflict: true }` when the database
 *  itself refused a second `running` row for this network — the mutual
 *  exclusion mechanism the module header describes. */
async function insertRunningScan(
  client: Client,
  row: FreeScanInsert
): Promise<{ id: string } | { conflict: true }> {
  const { data, error } = await untyped(client)
    .from<InsertedScanRow>("scans")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    if (isUniqueViolation(error)) return { conflict: true };
    throw new Error(error.message);
  }
  if (!data) throw new Error("scans insert: no row returned");
  return { id: data.id };
}

/** BP-023 decision 5: consumes. Re-evaluates the same six-step order
 *  `admitFreeScan` checks, then inserts the `scans` row that *is* the
 *  in-flight record — the module header explains how two concurrent
 *  claims for one network can only ever resolve to one insert succeeding.
 *  A refusal at either the re-evaluation or the insert produces no
 *  `scans` row at all (BP-023, "produces no report of its own"). */
export async function claimFreeScanSlot(a: {
  domain: CanonicalDomain;
  network: NetworkKey;
  fromIncompleteRescan: boolean;
}): Promise<{ claimed: true; scanId: string } | { claimed: false; refusal: Admission }> {
  const client = dbAdmin();

  const { result, step } = await evaluateAdmission(client, a.domain, a.network);
  if ("refuse" in result) {
    finish(result, step, a.network, a.domain);
    return { claimed: false, refusal: result };
  }

  const inserted = await insertRunningScan(client, {
    domain: a.domain,
    tier: "free",
    status: "running",
    network_hash: a.network,
    from_incomplete_rescan: a.fromIncompleteRescan,
  });

  if ("conflict" in inserted) {
    // Lost the race the database itself decided: re-read the winner's row
    // to report `sameDomain`/`runningScanId` exactly as `checkInFlight`
    // would have, had it seen the row a moment earlier.
    const lost = await checkInFlight(client, a.network, a.domain);
    const refusal: Admission = lost ?? { refuse: "in_flight", sameDomain: false };
    finish(refusal, "in_flight", a.network, a.domain);
    return { claimed: false, refusal };
  }

  finish({ admit: true }, "none", a.network, a.domain);
  return { claimed: true, scanId: inserted.id };
}
