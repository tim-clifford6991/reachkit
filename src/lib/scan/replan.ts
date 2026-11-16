// SPEC §7 *Re-plan follows each planner deploy* (owner, 2026-11-16): the
// deployment carries `RK_PLANNER`, `scripts/derivation.mjs`'s fingerprint of
// the code a week is chosen with. Finding no re-plan at it, the `scan/rescore`
// tick re-commits each paying site's week from its stored rows, from the
// first date no draft holds and no daily run can have claimed, at 0¢: the
// same `planWeek(from)` the on-demand recommit calls, so no pass runs and
// nothing is bought.
//
// Each site is dry-run first and logged (`week_replan_dry_run`), through a
// store that writes nothing; a week that would date fewer days than it does
// now is held (`replan-held`) and its old week stands. One claim per
// (fingerprint, site) in `ops_events`; the tick runs one at a time.
import { unmeasuredPartsOf } from "@/lib/scan/weekly/account";
import { claimOpsEvent } from "@/lib/ops/events";
import { publishDateAtOrAfter } from "@/lib/publish/settings/clock";
import { planWeek } from "@/lib/opportunities/plan";
import { firstOpenDay } from "@/lib/opportunities/rank/open";
import { opportunityStore, storeScope, type OpportunityRow, type OpportunityStore } from "@/lib/opportunities/store";
import type { UnreadyReason, Winnability } from "@/lib/opportunities/types";

const KIND = "week_replanned";
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** The deployed planner; `null` where the build carried none (a test, a local run), which asks for nothing. */
export function deployedPlanner(): string | null {
  const value = process.env.RK_PLANNER;
  return value === undefined || value === "" ? null : value;
}

/** A site's clock, as the daily tick reads it. */
export interface SiteClock {
  readonly siteId: string;
  readonly timeZone: string;
  readonly publishTime: string;
  readonly vetoHours: number;
}

/** One dated or spare row of a week, as the dry run lists it. */
export interface WeekRow {
  date: string | null;
  search: string | null;
  page: "new" | "update";
  type: string;
  points: number | null;
}

export interface Replan {
  siteId: string;
  fingerprint: string | null;
  from: string;
  before: WeekRow[];
  after: WeekRow[];
  /** What the site's stored pass did not measure, so a degraded pass shows. */
  unmeasured: string[];
  /** Why the new week is not committed, or `null` where it may be. */
  held: string | null;
}

/** A named, durable piece of the tick, as `src/jobs/types.ts` states it. */
type Step = <T>(name: string, body: () => Promise<T>) => Promise<T>;

/**
 * Each paying site not yet re-planned at the deployed planner: its dry run,
 * its claim, then its commit where the dry run did not hold it. `null` off
 * production or with nothing to do; else the sites committed and the sites held.
 */
export async function replanSites(
  paying: () => Promise<readonly SiteClock[]>,
  a: { now: Date; step?: Step }
): Promise<{ replanned: string[]; held: string[] } | null> {
  const fingerprint = deployedPlanner();
  if (process.env.VERCEL_ENV !== "production" || fingerprint === null) return null;
  const sites = await paying();
  const claimed = await claims(fingerprint);
  const due = sites.filter((site) => !claimed.has(site.siteId));
  const held = sites.filter((site) => claimed.get(site.siteId) === "held").map((site) => site.siteId);
  if (due.length + held.length === 0) return null;
  const inStep = <T>(name: string, body: () => Promise<T>) => (a.step === undefined ? body() : a.step(`${name}-${fingerprint}`, body));
  const replanned: string[] = [];
  for (const site of due) {
    const plan = await inStep(`replan-dry-${site.siteId}`, () => dryReplan(site.siteId, { now: a.now, clock: site, fingerprint }));
    if (!(await inStep(`replan-claim-${site.siteId}`, () => claimReplan(site.siteId, fingerprint, plan)))) continue;
    if (plan?.held != null) held.push(site.siteId);
    else if (plan !== null) await inStep(`replan-apply-${site.siteId}`, () => applyReplan(site.siteId, plan.from, a.now));
    if (plan !== null && plan.held === null) replanned.push(site.siteId);
  }
  return { replanned, held };
}

/** Each site's claim at this fingerprint: its `from`, `held` or `no-week`. */
async function claims(fingerprint: string): Promise<Map<string, string>> {
  const { dbAdmin } = await import("@/lib/db");
  const events = dbAdmin() as unknown as {
    from(t: string): { select(c: string): { eq(c: string, v: string): { eq(c: string, v: string): PromiseLike<{ data: { site_id: string; read: string }[] | null; error: { message: string } | null }> } } };
  };
  const { data, error } = await events.from("ops_events").select("site_id, read").eq("kind", KIND).eq("code", fingerprint);
  if (error !== null) throw new Error(`replan: ${error.message}`);
  return new Map((data ?? []).map((row) => [row.site_id, row.read]));
}

/** The first date no draft holds and whose daily run has not started: its due hour is after this one. */
export async function firstUnwritten(siteId: string, now: Date, clock: SiteClock | null): Promise<string> {
  const open = new Date(firstOpenDay(await opportunityStore().draftedPages(siteId, 1), now) * DAY_MS).toISOString().slice(0, 10);
  if (clock === null) return open;
  const nextHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS + HOUR_MS;
  const settings = { mode: "autopilot" as const, vetoHours: clock.vetoHours, publishTime: clock.publishTime, timezone: clock.timeZone };
  const unclaimed = publishDateAtOrAfter(new Date(nextHour + clock.vetoHours * HOUR_MS), settings);
  return open > unclaimed ? open : unclaimed;
}

/** The week `planWeek` would commit from `from`, its readiness check and all, with nothing written; `null` with no committed week. */
export async function dryReplan(siteId: string, a: { now: Date; from?: string; clock: SiteClock | null; fingerprint: string | null }): Promise<Replan | null> {
  const base = opportunityStore();
  const committed = await base.plannedRows(siteId);
  if (committed.length === 0) return null;
  const from = a.from ?? (await firstUnwritten(siteId, a.now, a.clock));
  const dry = dryStore(base);
  const entries = await storeScope.run(dry, () => planWeek(siteId, { now: a.now, from }));
  const rows = new Map([...committed, ...(await dry.openRankable(siteId)), ...(await dry.openFixPages(siteId))].map((row) => [row.id, row]));
  const report = await base.currentReport(siteId);
  const before = committed.filter((row) => row.status === "open" && (row.planned_for == null || row.planned_for >= from));
  const plan: Replan = {
    siteId,
    fingerprint: a.fingerprint,
    from,
    before: before.map((row) => weekRow(row, row.planned_for ?? null, row.plan_reason?.points ?? null)),
    after: entries.flatMap((entry) => {
      const row = rows.get(entry.opportunityId);
      return row === undefined ? [] : [weekRow(row, entry.plannedFor, entry.reason.points)];
    }),
    unmeasured: report === null ? ["report"] : [...unmeasuredPartsOf(report)],
    held: null,
  };
  const days = (week: WeekRow[]) => week.filter((row) => row.date !== null).length;
  if (days(plan.after) < days(plan.before)) plan.held = `${days(plan.after)} dated days where the committed week has ${days(plan.before)}`;
  console.log(JSON.stringify({ event: "week_replan_dry_run", ...plan }));
  return plan;
}

/** Records the site's one re-plan at this fingerprint; `false` where one is already held. */
function claimReplan(siteId: string, fingerprint: string, plan: Replan | null): Promise<boolean> {
  return claimOpsEvent(KIND, siteId, fingerprint, plan === null ? "no-week" : plan.held === null ? plan.from : "held");
}

/** Commits the week from `from`, unguarded: the tick calls it only for a week its dry run did not hold. */
export async function applyReplan(siteId: string, from: string, now: Date): Promise<number> {
  return (await planWeek(siteId, { now, from })).length;
}

function weekRow(row: OpportunityRow, date: string | null, points: number | null): WeekRow {
  return { date, search: row.target_query, page: row.family === "improve" ? "update" : "new", type: row.type, points };
}

// The store's reads, which a dry run passes through; anything else it is asked is a write, and it refuses one it does not hold.
const READS = new Set<keyof OpportunityStore>([
  "openRankable", "countUnused", "clusterable", "draftedOpportunityIds", "draftedPages", "citedPages", "clustersAt", "topTens",
  "topTenRows", "askedBeside", "dismissedSearches", "plannedRows", "weeklyCommit", "currentReport", "listicleHeld",
  "lastStatusChangeAt", "latestCompletedScanAt", "byId", "openFixPages", "marketFor", "notWorkingVerdicts", "hostedHostFor",
  "hostedOwnPages", "inventoryFor", "profileForSite", "knownContentNear", "refreshInputs", "refreshPages", "trackedPrompts",
]);

/** The real store's reads with the readiness check's writes held in memory over them, and the commit dropped. */
function dryStore(base: OpportunityStore): OpportunityStore {
  const patches = new Map<string, Partial<OpportunityRow>>();
  const held: Partial<Record<keyof OpportunityStore, (...args: never[]) => Partial<OpportunityRow>>> = {
    setReadiness: (reason: UnreadyReason | null) => ({ ready: reason === null, unready_reason: reason }),
    setFitBand: (band: Winnability) => ({ fit_band: band }),
    setEvidence: (evidence: OpportunityRow["evidence"]) => ({ evidence }),
    markDone: () => ({ status: "done" }),
  };
  const patch = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(patch);
    const id = (value as { id?: unknown } | null)?.id;
    return typeof id === "string" && patches.has(id) ? { ...(value as object), ...patches.get(id) } : value;
  };
  return new Proxy(base, {
    get(target, key: string | symbol) {
      if (typeof key !== "string" || key === "then") return undefined;
      const name = key as keyof OpportunityStore;
      if (name === "commitPlan") return async () => undefined;
      const write = held[name];
      if (write !== undefined) {
        return async (id: string, ...args: never[]) => void patches.set(id, { ...patches.get(id), ...write(...args) });
      }
      if (!READS.has(name)) throw new Error(`a dry re-plan writes nothing, and ${String(name)} is not a read`);
      const read = target[name] as (...args: unknown[]) => Promise<unknown>;
      return async (...args: unknown[]) => patch(await read.apply(target, args));
    },
  });
}
