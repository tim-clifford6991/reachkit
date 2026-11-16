// SPEC §7 *Re-plan follows each planner deploy* (owner, 2026-11-16): the
// deployment carries `RK_PLANNER`, `scripts/derivation.mjs`'s fingerprint of
// the code a week is chosen with. Finding no re-plan at it, the `scan/rescore`
// tick dry-runs each paying site's week from its stored rows, from the first
// date no draft holds and no daily run can have claimed, at 0¢: the same
// `planWeek(from)` the on-demand recommit calls, through a store that writes
// nothing, logged as `week_replan_dry_run`.
//
// Production holds no GitHub key, so the owner is told through the incident
// mail: every held site's committed and re-planned week. Nothing commits until
// the owner writes the OK row (`OWNER_OK`); `ops_events` is `service_role`
// only, so no customer and no app path can. No OK after 48 h mails the owner
// again, and nothing commits on its own. A planner first seen from 30 Nov on
// needs no OK. A week that would date fewer days than the committed one is
// held either way (`replan-held`). Each step is claimed once per (planner,
// site); the tick runs one at a time.
import { unmeasuredPartsOf } from "@/lib/scan/weekly/account";
import { reportIncident } from "@/lib/mail/ops/incident";
import { claimOpsEvent } from "@/lib/ops/events";
import { publishDateAtOrAfter } from "@/lib/publish/settings/clock";
import { planWeek } from "@/lib/opportunities/plan";
import { firstOpenDay } from "@/lib/opportunities/rank/open";
import { opportunityStore, storeScope, type OpportunityRow, type OpportunityStore } from "@/lib/opportunities/store";
import type { UnreadyReason, Winnability } from "@/lib/opportunities/types";

/** Per site, its dry run: `no-week`, `held` or `waiting`. */
const KIND = "week_replanned";
/** Per site, its commit once no OK is owed: its `from`, `held` or `no-week`. */
const APPLIED = "week_replan_applied";
/** The owner's OK of one planner, a row with no site: `insert into ops_events (kind, read, code) values ('week_replan_ok', 'owner', '<planner>')`. */
export const OWNER_OK = "week_replan_ok";
const ASKED = "week_replan_asked";
const ALERTED = "week_replan_alerted";
/** Owner, 2026-11-16: every planner deploy before 30 Nov waits on the owner's OK. */
const OK_NEEDED_BEFORE = Date.parse("2026-11-30T00:00:00Z");
const OK_ALERT_MS = 48 * 3_600_000;
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
type Event = { kind: string; site_id: string | null; read: string; at: string };

/**
 * Each paying site at the deployed planner: its dry run, claimed once; the
 * owner's mail while the OK is owed; then its commit once it is not. `null`
 * off production or with nothing left to do.
 */
export async function replanSites(
  paying: () => Promise<readonly SiteClock[]>,
  a: { now: Date; step?: Step }
): Promise<{ replanned: string[]; held: string[]; waiting: string[] } | null> {
  const fingerprint = deployedPlanner();
  if (process.env.VERCEL_ENV !== "production" || fingerprint === null) return null;
  const sites = await paying();
  const events = await eventsAt(fingerprint);
  const read = (kind: string, siteId: string) => events.find((e) => e.kind === kind && e.site_id === siteId)?.read;
  const inStep = <T>(name: string, body: () => Promise<T>) => (a.step === undefined ? body() : a.step(`${name}-${fingerprint}`, body));
  const first = Math.min(a.now.getTime(), ...events.filter((e) => e.kind === KIND).map((e) => Date.parse(e.at)).filter(Number.isFinite));
  const okOwed = first < OK_NEEDED_BEFORE && !events.some((e) => e.kind === OWNER_OK);
  const out = { replanned: [] as string[], held: [] as string[], waiting: [] as string[] };
  for (const site of sites) {
    const id = site.siteId;
    const dry = read(KIND, id) ?? (await inStep(`replan-dry-${id}`, () => dryClaim(site, fingerprint, a.now)));
    const applied = read(APPLIED, id);
    if (dry === "held" || applied === "held") out.held.push(id);
    if (dry !== "waiting" || applied !== undefined) continue;
    if (okOwed) {
      out.waiting.push(id);
      continue;
    }
    // Checked again at the commit, which can come days after the dry run.
    const plan = await inStep(`replan-check-${id}`, async () => {
      const p = await dryReplan(id, { now: a.now, clock: site, fingerprint, log: false });
      const state = p === null ? "no-week" : p.held === null ? p.from : "held";
      return (await claimOpsEvent(APPLIED, id, fingerprint, state)) ? p : null;
    });
    if (plan?.held != null) out.held.push(id);
    else if (plan != null) {
      await inStep(`replan-apply-${id}`, () => applyReplan(id, plan.from, a.now));
      out.replanned.push(id);
    }
  }
  const owed = sites.filter((site) => out.waiting.includes(site.siteId) || out.held.includes(site.siteId));
  if (okOwed && owed.length > 0) {
    const mark = a.now.getTime() - first >= OK_ALERT_MS ? ALERTED : ASKED;
    if (!events.some((e) => e.kind === mark)) await inStep(mark, () => askOwner(owed, fingerprint, a.now, mark));
  }
  return out.replanned.length + owed.length === 0 ? null : out;
}

/** The site's dry run, logged and claimed once at this planner; what the claim holds. */
async function dryClaim(site: SiteClock, fingerprint: string, now: Date): Promise<string> {
  const plan = await dryReplan(site.siteId, { now, clock: site, fingerprint });
  const state = plan === null ? "no-week" : plan.held === null ? "waiting" : "held";
  await claimOpsEvent(KIND, site.siteId, fingerprint, state);
  return state;
}

/** Mails the owner each site's committed and re-planned week as they stand now, then marks the mail sent. */
async function askOwner(sites: readonly SiteClock[], fingerprint: string, now: Date, mark: string): Promise<void> {
  const db = await opsDb();
  const { data } = await db.from("sites").select("id, domain").in("id", sites.map((site) => site.siteId));
  const domains = new Map((data ?? []).map((row) => [row.id, row.domain]));
  const plans = await Promise.all(sites.map((site) => dryReplan(site.siteId, { now, clock: site, fingerprint, log: false })));
  const told = await reportIncident({
    occasion: "replan-waiting",
    fingerprint,
    okKind: OWNER_OK,
    overdue: mark === ALERTED,
    sites: plans.flatMap((plan) => (plan === null ? [] : [{ ...plan, domain: domains.get(plan.siteId) ?? "unknown" }])),
  });
  if (told) await db.from("ops_events").insert({ kind: mark, read: "owner-mail", code: fingerprint });
}

/** Every re-plan row at this planner. */
async function eventsAt(fingerprint: string): Promise<Event[]> {
  const db = await opsDb();
  const { data, error } = await db.from("ops_events").select("kind, site_id, read, at").eq("code", fingerprint).in("kind", [KIND, APPLIED, OWNER_OK, ASKED, ALERTED]);
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
  a: { now: Date; from?: string; clock: SiteClock | null; fingerprint: string | null; log?: boolean }
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
  if (a.log !== false) console.log(JSON.stringify({ event: "week_replan_dry_run", ...plan }));
  return plan;
}

/** Commits the week from `from`, unguarded: the tick calls it only for a week its check did not hold. */
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
