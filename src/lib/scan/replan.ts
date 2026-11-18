// SPEC §7 *Re-plan follows each planner deploy* (owner, 2026-11-16): the
// deployment carries `RK_PLANNER`, `scripts/derivation.mjs`'s fingerprint of
// the code a week is chosen with. Finding no re-plan at it, the `scan/rescore`
// tick re-commits each paying site's week from its stored rows, from the first
// date no draft holds and no daily run can have claimed, at 0¢: the same
// `planWeek(from)` the on-demand recommit calls, so no pass runs and nothing
// is bought. The owner's OK of each new week stands (owner, 2026-11-16).
//
// Each site is dry-run first through a store that writes nothing and logged
// (`week_replan_dry_run`); a week that would date fewer days than the
// committed one is held (`replan-held`) and its old week stands. The owner is
// mailed each site's old and new week once per planner, for information:
// production holds no GitHub key. One claim per (planner, site) in
// `ops_events`; the tick runs one at a time.
import { unmeasuredPartsOf } from "@/lib/scan/weekly/account";
import { reportIncident } from "@/lib/mail/ops/incident";
import { claimOpsEvent } from "@/lib/ops/events";
import { publishDateAtOrAfter } from "@/lib/publish/settings/clock";
import { planWeek } from "@/lib/opportunities/plan";
import { firstOpenDay } from "@/lib/opportunities/rank/open";
import { opportunityStore, storeScope, type OpportunityRow, type OpportunityStore } from "@/lib/opportunities/store";
import type { PlanReason, UnreadyReason, Winnability } from "@/lib/opportunities/types";

/** Per site: its `from`, `held` or `no-week`. */
const KIND = "week_replanned";
/** The owner's mail of the planner's weeks, sent. */
const TOLD = "week_replan_told";
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
  /** What the commit read of its research (`met`, `at_margin`, `queued`, `short`); `null` where none was read. */
  state: string | null;
}

export interface Replan {
  siteId: string;
  fingerprint: string | null;
  from: string;
  /** The committed week from `from`, as stored, whoever set it. */
  before: WeekRow[];
  after: WeekRow[];
  /** What the site's stored pass did not measure, so a degraded pass shows. */
  unmeasured: string[];
  /** Why the new week is not committed, or `null` where it may be. */
  held: string | null;
}

/** A named, durable piece of the tick, as `src/jobs/types.ts` states it. */
type Step = <T>(name: string, body: () => Promise<T>) => Promise<T>;
type Event = { kind: string; site_id: string | null; read: string };

/**
 * Each paying site not yet re-planned at the deployed planner: its dry run,
 * its commit where the dry run did not hold it, then its claim; then the
 * owner's mail of the weeks. `null` off production or with nothing to do.
 */
export async function replanSites(
  paying: () => Promise<readonly SiteClock[]>,
  a: { now: Date; step?: Step }
): Promise<{ replanned: string[]; held: string[] } | null> {
  const fingerprint = deployedPlanner();
  if (process.env.VERCEL_ENV !== "production" || fingerprint === null) return null;
  const inStep = <T>(name: string, body: () => Promise<T>) => (a.step === undefined ? body() : a.step(`${name}-${fingerprint}`, body));
  // Read inside steps, so a replay after its own claim keeps the first invocation's view and still tells the owner.
  const sites = await inStep("replan-paying", paying);
  const events = await inStep("replan-events", () => eventsAt(fingerprint));
  const claimed = new Map(events.filter((e) => e.kind === KIND).map((e) => [e.site_id, e.read]));
  const due = sites.filter((site) => !claimed.has(site.siteId));
  const held = sites.filter((site) => claimed.get(site.siteId) === "held").map((site) => site.siteId);
  if (due.length + held.length === 0) return null;
  const replanned: string[] = [];
  const told: Replan[] = [];
  for (const site of due) {
    const id = site.siteId;
    const plan = await inStep(`replan-dry-${id}`, () => dryReplan(id, { now: a.now, clock: site, fingerprint }));
    const state = plan === null ? "no-week" : plan.held === null ? plan.from : "held";
    // Claimed only after the apply, so an apply that never ran is tried again on the next tick.
    if (plan !== null && plan.held === null) await inStep(`replan-apply-${id}`, () => applyReplan(id, plan.from, a.now));
    if (!(await inStep(`replan-claim-${id}`, () => claimOpsEvent(KIND, id, fingerprint, state))) || plan === null) continue;
    told.push(plan);
    (plan.held === null ? replanned : held).push(id);
  }
  if (told.length > 0 && !events.some((e) => e.kind === TOLD)) await inStep("replan-told", () => tellOwner(told, fingerprint));
  return { replanned, held };
}

/** Mails the owner each site's old and new week, then marks the planner told. */
async function tellOwner(plans: readonly Replan[], fingerprint: string): Promise<void> {
  const db = await opsDb();
  const { data } = await db.from("sites").select("id, domain").in("id", plans.map((plan) => plan.siteId));
  const domains = new Map((data ?? []).map((row) => [row.id, row.domain]));
  const sites = plans.map((plan) => ({ ...plan, domain: domains.get(plan.siteId) ?? "unknown" }));
  if (await reportIncident({ occasion: "replan-committed", fingerprint, sites })) {
    await db.from("ops_events").insert({ kind: TOLD, read: "owner-mail", code: fingerprint });
  }
}

/** Every re-plan row at this planner. */
async function eventsAt(fingerprint: string): Promise<Event[]> {
  const db = await opsDb();
  const { data, error } = await db.from("ops_events").select("kind, site_id, read").eq("code", fingerprint).in("kind", [KIND, TOLD]);
  if (error !== null) throw new Error(`replan: ${error.message}`);
  return data ?? [];
}

type Answer<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
async function opsDb() {
  return (await import("@/lib/db")).dbAdmin() as unknown as {
    from(t: "sites"): { select(c: string): { in(c: string, v: readonly string[]): Answer<{ id: string; domain: string }> } };
    from(t: "ops_events"): {
      select(c: string): { eq(c: string, v: string): { in(c: string, v: readonly string[]): Answer<Event> } };
      insert(row: object): PromiseLike<{ error: { message: string } | null }>;
    };
  };
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
export async function dryReplan(
  siteId: string,
  a: { now: Date; from?: string; clock: SiteClock | null; fingerprint: string | null }
): Promise<Replan | null> {
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
    before: before.map((row) => weekRow(row, row.planned_for ?? null, row.plan_reason ?? null)),
    after: entries.flatMap((entry) => {
      const row = rows.get(entry.opportunityId);
      return row === undefined ? [] : [weekRow(row, entry.plannedFor, entry.reason)];
    }),
    unmeasured: report === null ? ["report"] : [...unmeasuredPartsOf(report)],
    held: null,
  };
  const days = (week: WeekRow[]) => week.filter((row) => row.date !== null).length;
  if (days(plan.after) < days(plan.before)) plan.held = `${days(plan.after)} dated days where the committed week has ${days(plan.before)}`;
  console.log(JSON.stringify({ event: "week_replan_dry_run", ...plan, rejected: entries.rejected }));
  return plan;
}

/** Commits the week from `from`, unguarded: the tick calls it only for a week its dry run did not hold. */
export async function applyReplan(siteId: string, from: string, now: Date): Promise<number> {
  return (await planWeek(siteId, { now, from })).length;
}

function weekRow(row: OpportunityRow, date: string | null, reason: PlanReason | null): WeekRow {
  return { date, search: row.target_query, page: row.family === "improve" ? "update" : "new", type: row.type, points: reason?.points ?? null, state: reason?.research?.state ?? null };
}

// The store's reads, which a dry run passes through; anything else it is asked is a write, and it refuses one it does not hold.
const READS = new Set<keyof OpportunityStore>([
  "openRankable", "countUnused", "clusterable", "draftedOpportunityIds", "draftedPages", "citedPages", "clustersAt", "topTens",
  "topTenRows", "askedBeside", "dismissedSearches", "plannedRows", "weeklyCommit", "currentReport", "listicleHeld",
  "lastStatusChangeAt", "latestCompletedScanAt", "byId", "openFixPages", "marketFor", "notWorkingVerdicts", "hostedHostFor",
  "hostedOwnPages", "inventoryFor", "profileForSite", "knownContentNear", "refreshInputs", "refreshPages", "trackedPrompts", "footprintOpened",
  "draftsOnTopics", "researchHeld",
]);

/** The real store's reads with the readiness check's writes held in memory over them, and the commit dropped. */
function dryStore(base: OpportunityStore): OpportunityStore {
  const patches = new Map<string, Partial<OpportunityRow>>();
  const held: Partial<Record<keyof OpportunityStore, (...args: never[]) => Partial<OpportunityRow>>> = {
    setReadiness: (reason: UnreadyReason | null) => ({ ready: reason === null, unready_reason: reason }),
    setFitBand: (band: Winnability) => ({ fit_band: band }),
    setEvidence: (evidence: OpportunityRow["evidence"]) => ({ evidence }),
    markDone: () => ({ status: "done" }),
    markDismissed: () => ({ status: "dismissed", ready: false }),
    rest: (until: Date) => ({ rest_until: until.toISOString(), ready: false, unready_reason: "resting" }),
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
      const read = target[name] as ((...args: unknown[]) => Promise<unknown>) | undefined;
      // An optional read the store does not hold stays absent.
      if (read === undefined) return undefined;
      return async (...args: unknown[]) => patch(await read.apply(target, args));
    },
  });
}
