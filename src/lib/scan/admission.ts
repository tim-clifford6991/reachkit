// Free-scan admission: `admitFreeScan` only checks (every render of a report address asks), `claimFreeScanSlot` consumes; both run `evaluateAdmission`, so the order exists once.
// Order: removed → cooldown → switched off / daily ceiling → in-flight → hourly → network's day → domain's day. The last two live here, not in the route, because `POST /api/scan` calls `claimFreeScanSlot` directly.
// PostgREST cannot hold a serialisable transaction, so two concurrent claims are settled by the partial unique index of one `running` scan per network; the loser is an `in_flight` refusal.
// The removal table and `scans.network_hash`/`from_incomplete_rescan` are missing from the generated `Database` type, so those calls go through `untyped` below.
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
  publishFreeScanBoundReached,
  readDayCeilingCents,
  readDaySpendCents,
  secondsUntilDayRollsOver,
  type FreeScanBound,
} from "@/lib/costs/daily";
import { dbAdmin } from "@/lib/db";
import { isRemovedWith } from "./removal";
import type { CanonicalDomain } from "./domain";
import type { RefTag } from "@/lib/analytics/ref";

// ── NetworkKey ───────────────────────────────────────────────────────────

/** Opaque, salted, non-reversible: free scans count by network, and no raw address is stored or logged anywhere. */
export type NetworkKey = string & { readonly __networkKey: unique symbol };

const UNKNOWN_NETWORK_SEED = "unknown";

/** The platform's client address, for a check that never stores it. On Vercel a
 *  client writes the first `x-forwarded-for` entry itself, so it is never read there. */
export function clientAddressOf(headers: Pick<Headers, "get">): string | null {
  const platform = firstEntry(headers.get("x-vercel-forwarded-for")) ?? firstEntry(headers.get("x-real-ip"));
  return platform ?? (process.env.VERCEL === "1" ? null : firstEntry(headers.get("x-forwarded-for")));
}

/** Truncates IPv6 to its /64 and HMACs with `IP_HASH_SALT`; a missing or unparseable address yields one shared key, so a malformed header is still counted. Never throws. */
export function networkKeyOf(headers: Pick<Headers, "get">): NetworkKey {
  try {
    const entry = clientAddressOf(headers);
    const seed = entry === null ? UNKNOWN_NETWORK_SEED : addressSeed(entry);
    return hashSeed(seed);
  } catch {
    return hashSeed(UNKNOWN_NETWORK_SEED);
  }
}

function firstEntry(header: string | null): string | null {
  const first = header?.split(",")[0]?.trim() ?? "";
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

/** The first four of eight expanded groups; `null` if it does not expand to eight. */
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

// ── Admission ────────────────────────────────────────────────────────────

/** Why a free scan may not start; `in_flight.runningSince` (the running row's `created_at`) says how long the network stays held, absent when it could not be re-read. */
export type Admission =
  | { admit: true }
  | { refuse: "hourly"; retryAfterSeconds: number }
  /** This network has had its day's free scans (`FREE_BOUNDS.scansPerIpPerDay`); its own arm, since `hourly`'s sentence names the hour. */
  | { refuse: "network_daily"; retryAfterSeconds: number }
  /** This domain has had its day's free scans (`FREE_BOUNDS.scansPerDomainPerDay`), whoever asked. */
  | { refuse: "domain_daily"; retryAfterSeconds: number }
  | { refuse: "in_flight"; sameDomain: boolean; runningScanId?: string; runningSince?: Date }
  | { refuse: "daily"; retryAfterSeconds: number }
  | { refuse: "switched_off" }
  | { refuse: "cooldown"; retryAfterSeconds: number }
  | { refuse: "removed" }
  /** A bound could not be read: no scan starts on a count nobody has, and the visitor did not cause it. */
  | { refuse: "unreadable" };

// ── Cast escape hatch for the two schema gaps ─────────────────────────────

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** PostgREST's error carries the SQLSTATE `code`, which `isUniqueViolation` reads. */
interface MutationError {
  message: string;
  code?: string;
}

interface SingleResult<T> {
  data: T | null;
  error: MutationError | null;
}

/** The filter-builder chain this file calls, typed against a local row shape instead of the generated `Database`. */
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

/** Cast boundary for the two schema gaps; nothing else here bypasses the generated `Database` type. */
function untyped(client: ReturnType<typeof dbAdmin>): MinimalClient {
  return client as unknown as MinimalClient;
}

interface ScanNetworkRow {
  id: string;
  domain: string;
  created_at: string;
}

/** The `scans` row `claimFreeScanSlot` inserts. */
interface FreeScanInsert {
  domain: string;
  tier: "free";
  status: "running";
  network_hash: string;
  from_incomplete_rescan: boolean;
  /** `scans.smoke`: set only on a smoke test's row. */
  smoke?: true;
  /** `scans.ref`: the landing link's allow-listed channel tag, only where there was one. */
  ref?: RefTag;
}

interface InsertedScanRow {
  id: string;
}

// ── The admission order ──────────────────────────────────────────────────

type Client = ReturnType<typeof dbAdmin>;

/** Whether the domain's report was taken down on a written request; the correction offer reads it here so the removal table has one reader. */
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

/** The day's spend ceiling (BUILD §6.5) as a refusal under the existing `daily` arm: free scans refuse first, paid passes hold (they degrade, having been paid for).
 *  An unreadable ledger refuses, since nothing is spent on a figure nobody has. */
async function checkDailySpend(): Promise<Admission | null> {
  const at = now();
  const [spentCents, ceilingCents] = await Promise.all([readDaySpendCents(at), readDayCeilingCents(at)]);
  if (spentCents === null) throw new Error("daily spend unreadable");
  if (!ceilingReached(spentCents, ceilingCents)) return null;
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

/** Free scans one network has had today: `checkHourly` alone allows 120 a day. Counts free-tier rows only.
 *  `fills` is true where this claim takes the count to the bound, so the owner is told once. */
async function checkNetworkDaily(
  client: Client,
  network: NetworkKey
): Promise<{ result: Admission | null; fills: boolean }> {
  const bound = FREE_BOUNDS.scansPerIpPerDay;
  const windowMs = DAILY_WINDOW_H * 3_600_000;
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data, error } = await untyped(client)
    .from<{ created_at: string }>("scans")
    .select("created_at")
    .eq("tier", "free")
    .eq("network_hash", network)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(bound);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length < bound) return { result: null, fills: rows.length === bound - 1 };
  return { result: refusalAfter(rows, windowMs, "network_daily"), fills: false };
}

/** Free scans one domain has had today, whoever asked: a script with many networks could otherwise re-buy one domain's report. */
async function checkDomainDaily(
  client: Client,
  domain: CanonicalDomain
): Promise<{ result: Admission | null; fills: boolean }> {
  const bound = FREE_BOUNDS.scansPerDomainPerDay;
  const windowMs = DAILY_WINDOW_H * 3_600_000;
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data, error } = await client
    .from("scans")
    .select("created_at")
    .eq("tier", "free")
    .eq("domain", domain)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(bound);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length < bound) return { result: null, fills: rows.length === bound - 1 };
  return { result: refusalAfter(rows, windowMs, "domain_daily"), fills: false };
}

/** Seconds until the oldest row in the window ages out, rounded up, as `checkHourly` and `checkDaily` answer. */
function refusalAfter(
  rows: readonly { created_at: string }[],
  windowMs: number,
  refuse: "network_daily" | "domain_daily"
): Admission | null {
  const oldest = rows[rows.length - 1];
  if (!oldest) return null;
  const ageMs = Date.now() - new Date(oldest.created_at).getTime();
  const remainingMs = Math.max(0, windowMs - ageMs);
  return { refuse, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}

/** Which bound a claim filled, for the owner's telling. */
const BOUND_SIZE: Readonly<Record<FreeScanBound, number>> = Object.freeze({
  "network-day": FREE_BOUNDS.scansPerIpPerDay,
  "domain-day": FREE_BOUNDS.scansPerDomainPerDay,
});

type FreeStep =
  | "removed"
  | "cooldown"
  | "switched_off"
  | "daily"
  | "in_flight"
  | "hourly"
  | "network_daily"
  | "domain_daily"
  | "none";

/** One line per admission: decision, step, hashed network key and domain, never a raw address. */
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

/** The admission order, stated once for `admitFreeScan` and `claimFreeScanSlot`. It does not log, so a caller that discards the result cannot double-log. */
async function evaluateAdmission(
  client: Client,
  domain: CanonicalDomain,
  network: NetworkKey
): Promise<{ result: Admission; step: FreeStep; fills: FreeScanBound | null }> {
  // Step 1, outside the handler: a removal read that errors refuses, because failing open would serve a removed report.
  let removed: boolean;
  try {
    removed = await isRemovedWith(client, domain);
  } catch {
    return { result: { refuse: "removed" }, step: "removed", fills: null };
  }
  if (removed) return { result: { refuse: "removed" }, step: "removed", fills: null };

  // Steps 2–6 fail closed: any read error refuses and the log names the step that threw.
  let step: FreeStep = "cooldown";
  try {
    const cooldown = await checkCooldown(client, domain);
    if (cooldown) return { result: cooldown, step: "cooldown", fills: null };

    step = "switched_off";
    if (env.KILL_SWITCH) return { result: { refuse: "switched_off" }, step: "switched_off", fills: null };

    // `daily` asks the spend ceiling (BUILD §6.5) before BUILD §11's free-scan count; both settle on the same refusal.
    step = "daily";
    const dailySpend = await checkDailySpend();
    if (dailySpend) return { result: dailySpend, step: "daily", fills: null };

    const daily = await checkDaily(client);
    if (daily) return { result: daily, step: "daily", fills: null };

    step = "in_flight";
    const inFlight = await checkInFlight(client, network, domain);
    if (inFlight) return { result: inFlight, step: "in_flight", fills: null };

    step = "hourly";
    const hourly = await checkHourly(client, network);
    if (hourly) return { result: hourly, step: "hourly", fills: null };

    // The widest windows go last, so a visitor is never sent away with a day's wait for an hour's cause.
    step = "network_daily";
    const networkDaily = await checkNetworkDaily(client, network);
    if (networkDaily.result) return { result: networkDaily.result, step: "network_daily", fills: null };

    step = "domain_daily";
    const domainDaily = await checkDomainDaily(client, domain);
    if (domainDaily.result) return { result: domainDaily.result, step: "domain_daily", fills: null };

    // Where this claim takes a count to its bound the owner is told, once even where it fills both.
    const fills: FreeScanBound | null = networkDaily.fills
      ? "network-day"
      : domainDaily.fills
        ? "domain-day"
        : null;
    return { result: { admit: true }, step: "none", fills };
  } catch {
    return { result: { refuse: "unreadable" }, step, fills: null };
  }
}

/** Free of side effects: every render of a report address calls it, and a render must never consume an allowance. */
export async function admitFreeScan(a: {
  domain: CanonicalDomain;
  network: NetworkKey;
}): Promise<Admission> {
  const client = dbAdmin();
  const { result, step } = await evaluateAdmission(client, a.domain, a.network);
  return finish(result, step, a.network, a.domain);
}

/** A correction's share of the visitor's free bounds: it re-measures a stored report, so only the network's own three apply. Fails closed. */
export async function networkAdmits(network: NetworkKey): Promise<boolean> {
  const client = dbAdmin();
  try {
    const held =
      (await checkInFlight(client, network, "" as CanonicalDomain)) ??
      (await checkHourly(client, network)) ??
      (await checkNetworkDaily(client, network)).result;
    return held === null;
  } catch {
    return false;
  }
}

/** Postgres's unique-violation SQLSTATE: the only insert error read as losing the race; any other rethrows. */
function isUniqueViolation(error: MutationError): boolean {
  return error.code === "23505";
}

/** Inserts the running row; `{ conflict: true }` where the one-running-per-network index refused it. */
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

/** Consumes: re-runs the admission order, then inserts the `scans` row that is the in-flight record. A refusal at either step writes no row. */
export async function claimFreeScanSlot(a: {
  domain: CanonicalDomain;
  network: NetworkKey;
  fromIncompleteRescan: boolean;
  /** `scripts/smoke.sh` started it: recorded on the row, never an argument to a limit. */
  smoke?: boolean;
  /** The channel tag the scan was started under; recorded, never read by admission. */
  ref?: RefTag;
}): Promise<{ claimed: true; scanId: string } | { claimed: false; refusal: Admission }> {
  const client = dbAdmin();

  const { result, step, fills } = await evaluateAdmission(client, a.domain, a.network);
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
    ...(a.smoke === true ? { smoke: true as const } : {}),
    ...(a.ref ? { ref: a.ref } : {}),
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

  // The claim that fills a bound tells the owner, after the row exists; later refusals are silent, so the telling stays news.
  if (fills !== null) publishFreeScanBoundReached(fills, BOUND_SIZE[fills]);

  finish({ admit: true }, "none", a.network, a.domain);
  return { claimed: true, scanId: inserted.id };
}
