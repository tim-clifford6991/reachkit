// BUILD §4.7 — the declared answers, the measured answers, and the three
// saves.
//
// Three answers decide what every number in this product is a measurement
// of: the domain, the market category and the rival set (REQ-071). Each is
// stored **twice**, and the two are different facts:
//
//   *declared* — on `sites`. What setup wrote and what a save changes:
//               "what are we measuring against from now on".
//   *measured* — on the scan that produced the current report. What that
//               number was measured against, carrying its own date:
//               "what was this number measured against".
//
// **There is no pending-change record, and adding one is the mistake this
// module exists to prevent** (ADR-030, a landmine decision — read it before
// adding `sites.pending_category`, a `site_changes` table, or any "apply
// this later" queue). A pending change is the *difference* between these
// two reads and nothing else, which is why `pending.ts` is pure and why the
// pending state clears itself: the moment a pass completes, its scan is
// current, measured equals declared, and there is nothing left to drain.
//
// **A save writes the declared answer and nothing else.** No queue, no
// effective-from column, no second row. A pass reads the declared answers
// at the moment it begins — which is precisely REQ-071's "the first weekly
// re-measurement that begins after the moment of the save", with no
// scheduling arithmetic anywhere.
//
// **A save during a running pass is resolved by the database.** The pass
// reads the row; whichever write lands first wins. The effective date is
// therefore recomputed *after* the write and never before it, so a customer
// is never shown one date and given another.
//
// **This module never imports `src/lib/scan/`'s barrel.** `src/lib/scan/**`
// imports `@/lib/market`, so the reverse at node level would close a cycle.
// The one exception is by file: `@/lib/scan/weekly/week` imports nothing but
// `constants.ts`, and it owns the weekly clock — re-deriving "the next
// Monday in the customer's zone" here would be a second copy of the one
// date the shell, Overview and the weekly mail all state. ADR-092's idiom:
// the cycle is broken at file granularity, never by deleting a true
// dependency.
//
// The archived plans are WO-089 and WO-090.
import { dbAdmin } from "@/lib/db";
import { resolvesInDns } from "@/lib/egress";
import type { RivalSet } from "../setup/rivals";
import { registrableDomain } from "../rivals/domains";
import { effectiveOn } from "./pending";

/** The three answers, and no fourth. Each is a thing every number is a
 *  measurement *of*; the publishing settings are not — they decide when a
 *  page goes out, not what the numbers mean. */
export type ChangeKind = "domain" | "category" | "rivals";

export interface DeclaredAnswers {
  domain: string;
  /** `null` where setup has not settled one — a site can exist before its
   *  market is named, and an empty string would be a category. */
  category: string | null;
  /** The stored domains, in the customer's own order.
   *
   *  **`readonly string[]`, not `RivalSet`.** `sites.competitors` is a
   *  `jsonb` array of domains and carries no origin — origin is the
   *  editing type's (`addRival`/`removeRival` and REQ-026 c12's
   *  suggestion-clearing at setup), not the stored answer's. The archived
   *  WO-089 sketched `RivalSet` here; the column is what it is, and
   *  inventing an origin on read would be a fact this product does not
   *  have. */
  rivals: readonly string[];
}

export interface MeasuredAnswers {
  domain: string;
  category: string | null;
  rivals: readonly string[];
  /** The date the measurement carries — REQ-065 c1's date, the one every
   *  surface states for it. */
  at: Date;
  scanId: string;
}

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQuery<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
  eq(column: string, value: string): MinimalQuery<T>;
  is(column: string, value: boolean | null): MinimalQuery<T>;
  order(column: string, opts: { ascending: boolean }): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** The narrow, explicitly cast boundary this side of the codebase already
 *  carries (`rivals/tracked.ts`, `scan/run.ts`): the generated `Database`
 *  type predates several of these columns. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

interface SiteAnswersRow {
  domain: string;
  category: string | null;
  competitors: unknown;
  timezone: string | null;
}

/** The stored list, read defensively. The column is `not null default
 *  '[]'::jsonb`, so anything else is a value the schema does not admit —
 *  read as the empty list rather than guessed at, exactly as
 *  `trackedRivals` reads the same column. */
export function storedDomains(stored: unknown): readonly string[] {
  if (!Array.isArray(stored)) return [];
  const domains: string[] = [];
  for (const entry of stored) {
    if (typeof entry !== "string") continue;
    const domain = registrableDomain(entry);
    if (domain === null || domains.includes(domain)) continue;
    domains.push(domain);
  }
  return Object.freeze(domains) as readonly string[];
}

export class NoSuchSiteError extends Error {
  constructor(siteId: string) {
    super(`src/lib/market/changes: no site ${siteId}`);
    this.name = "NoSuchSiteError";
  }
}

/**
 * What this site is measured against from now on.
 *
 * A site that does not exist is a throw and not an empty answer: every
 * caller here is acting for a signed-in customer on their own site, so a
 * missing row is a fault rather than a state, and an empty answer would be
 * read as "measured against nothing".
 */
export async function declaredAnswers(siteId: string): Promise<DeclaredAnswers> {
  const { data, error } = await untyped()
    .from<SiteAnswersRow>("sites")
    .select("domain, category, competitors, timezone")
    .eq("id", siteId)
    .limit(1);
  if (error !== null) throw new Error(`declaredAnswers: ${error.message}`);
  const row = data?.[0];
  if (row === undefined) throw new NoSuchSiteError(siteId);
  return {
    domain: row.domain,
    category: row.category,
    rivals: storedDomains(row.competitors),
  };
}

/** REQ-073 c1's stated zone, or `null`. Every date this module names is
 *  site-local, and no read path falls back to the server's. */
export async function declaredTimezone(siteId: string): Promise<string | null> {
  const { data, error } = await untyped()
    .from<SiteAnswersRow>("sites")
    .select("domain, category, competitors, timezone")
    .eq("id", siteId)
    .limit(1);
  if (error !== null) throw new Error(`declaredTimezone: ${error.message}`);
  return data?.[0]?.timezone ?? null;
}

interface CurrentScanRow {
  id: string;
  domain: string;
  report: unknown;
  created_at: string;
}

/** The rival domains one stored report measured against — the presence
 *  card's own rows, which is where `deriveRivals` put them. */
function reportRivals(report: Record<string, unknown>): readonly string[] {
  const presence = report.presence;
  if (typeof presence !== "object" || presence === null) return [];
  const rivals = (presence as Record<string, unknown>).rivals;
  if (!Array.isArray(rivals)) return [];
  const domains: string[] = [];
  for (const rival of rivals) {
    if (typeof rival !== "object" || rival === null) continue;
    const domain = (rival as Record<string, unknown>).domain;
    if (typeof domain === "string" && domain !== "") domains.push(domain);
  }
  return Object.freeze(domains) as readonly string[];
}

/** The date a stored report carries. The verdict's own `measuredAt` where
 *  the blob has one — that is the date every surface states for it — and
 *  the row's `created_at` otherwise, which is when the pass that wrote it
 *  began. Never `now`: a measurement's date is a stored fact. */
function measuredAtOf(report: Record<string, unknown>, createdAt: string): Date {
  const verdict = report.verdict;
  if (typeof verdict === "object" && verdict !== null) {
    const at = (verdict as Record<string, unknown>).measuredAt;
    if (typeof at === "string") return new Date(at);
  }
  return new Date(createdAt);
}

/**
 * What the numbers on screen right now were measured against, or `null`
 * where nothing has been measured yet.
 *
 * `null` is a real state and not a failure: a site between setup and its
 * first pass has declared answers and no measured ones, and
 * `pendingChanges` reads that as "nothing pending" rather than as three
 * changes — there is no old answer for the new one to differ from.
 */
export async function measuredAnswers(siteId: string): Promise<MeasuredAnswers | null> {
  const { data, error } = await untyped()
    .from<CurrentScanRow>("scans")
    .select("id, domain, report, created_at")
    .eq("site_id", siteId)
    .is("is_current", true)
    .limit(1);
  if (error !== null) throw new Error(`measuredAnswers: ${error.message}`);
  const row = data?.[0];
  if (row === undefined) return null;
  const report =
    typeof row.report === "object" && row.report !== null
      ? (row.report as Record<string, unknown>)
      : {};
  const category = report.category;
  return {
    domain: row.domain,
    category: typeof category === "string" ? category : null,
    rivals: reportRivals(report),
    at: measuredAtOf(report, row.created_at),
    scanId: row.id,
  };
}

// ── The three saves ─────────────────────────────────────────────────────

export type SaveOk = { ok: true; effectiveOn: Date };

/** The one refusal a save can carry. REQ-071 c6: a new address is not
 *  accepted unless the product can reach it — the same reachability check
 *  setup applies, and the only proof of control the product asks for
 *  (REQ-071's own non-goal). */
export type SaveDomainResult = SaveOk | { ok: false; because: "unreachable" };

/** Written after the write, never before it: a save landing beside a
 *  running pass is resolved by the database, and the date the customer is
 *  given has to be the one their own write earned. */
async function effectiveAfterWrite(siteId: string): Promise<Date> {
  const timezone = await declaredTimezone(siteId);
  if (timezone === null) {
    // REQ-073 c1: no read path falls back to the server's zone. A site with
    // no stated zone cannot be told when its change lands, and the setup
    // gate is what keeps a customer from reaching Settings in that state.
    throw new Error(`src/lib/market/changes: site ${siteId} has stated no time zone (REQ-073 c1)`);
  }
  return effectiveOn({ savedAt: new Date(), timezone });
}

async function writeSite(siteId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await untyped().from<SiteAnswersRow>("sites").update(values).eq("id", siteId);
  if (error !== null) throw new Error(`src/lib/market/changes: could not save: ${error.message}`);
}

/**
 * REQ-071 c6 and c9 — the domain the site is measured and published under.
 *
 * Reachability first, and the write only after it: a refused address
 * changes nothing, so a customer who mistypes does not find their site
 * measured against a name that answers nobody.
 */
export async function saveDomain(a: {
  siteId: string;
  domain: string;
}): Promise<SaveDomainResult> {
  const domain = registrableDomain(a.domain);
  if (domain === null) return { ok: false, because: "unreachable" };
  if (!(await resolvesInDns(domain))) return { ok: false, because: "unreachable" };

  await writeSite(a.siteId, { domain });
  return { ok: true, effectiveOn: await effectiveAfterWrite(a.siteId) };
}

/** REQ-071 c1 and c7 — the market the site is measured in. */
export async function saveCategory(a: {
  siteId: string;
  category: string;
}): Promise<SaveOk> {
  await writeSite(a.siteId, { category: a.category });
  return { ok: true, effectiveOn: await effectiveAfterWrite(a.siteId) };
}

/**
 * REQ-071 c2, c3, c8 and c16 — the set the site is compared against.
 *
 * Adding and removing are `setup/rivals.ts`'s `addRival` / `removeRival`,
 * which are the same rules REQ-071 c4 says they are; this persists the
 * result. **An empty set is saved like any other** (c16): the account goes
 * on running with none, and the screen says no comparison will be shown
 * until one is added.
 */
export async function saveRivals(a: {
  siteId: string;
  rivals: RivalSet;
}): Promise<SaveOk> {
  await writeSite(a.siteId, { competitors: a.rivals.map((rival) => rival.domain) });
  return { ok: true, effectiveOn: await effectiveAfterWrite(a.siteId) };
}
