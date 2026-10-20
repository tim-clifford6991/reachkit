// SPEC §6: what each site cost, each UTC day and the week, estimated beside billed.
//
// The owner's cost page (`/app/costs`) reads this and nothing else. Every
// figure is a sum of `cost_site_day` rows (the ledger, grouped) or of
// `vendor_days` rows, so each one equals the rows it was read from.
// Money stays in US cents, the ledger's unit, until a figure is set against
// a euro one: D34's two euros a day and a site's month against its net
// price, converted at `USD_PER_EUR`.
//
// A billed figure is never read as zero where it is missing: a cell carries
// how many of its calls the vendor priced, and `null` where none.
import { PLAN_NET_EUR_CENTS, TEST_DAY_EUR, USD_PER_EUR } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";
import { FIXED_VENDORS, previousMonth, utcDay } from "./vendor-days";

export const COST_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A month is this many weeks: 365.25 / 12 / 7. */
const WEEKS_A_MONTH = 4.348;

export type Segment = "free" | "smoke" | "test" | "box";
export type CostVendor = "dataforseo" | "anthropic" | "own";
export type Activity = "free_scan" | "onboarding" | "weekly" | "draft" | "rescore" | "smoke" | "test" | "box";

/** One `cost_site_day` row as PostgREST returns it: numerics as strings. */
export interface SiteDayRow {
  day: string;
  site_id: string | null;
  segment: Segment | null;
  vendor: CostVendor;
  activity: Activity;
  calls: number;
  estimated_cents: number | string;
  billed_cents: number | string | null;
  billed_calls: number;
  judged_cents: number | string;
  failed_calls: number;
  timeout_calls: number;
}

/** One `vendor_days` row. */
export interface VendorDay {
  vendor: string;
  day: string;
  kind: "usage" | "fixed" | "box";
  domain: string;
  billed_cents: number | string | null;
  currency: "usd" | "eur";
  estimated_cents: number | string | null;
}

export interface Cell {
  calls: number;
  estimatedCents: number;
  /** `null` where no call in the cell carried a charge. */
  billedCents: number | null;
  billedCalls: number;
  /** Billed where the vendor said, estimated where it did not (D34). */
  judgedCents: number;
  failedCalls: number;
  timeoutCalls: number;
}

/** A site by its domain, or a named segment. */
export type Who = { kind: "site"; siteId: string; domain: string } | { kind: "segment"; segment: Segment };

export interface WeekLine {
  who: Who;
  cell: Cell;
  /** A site's month at this week's pace with its share of the fixed costs
   *  that were reported, in euro cents; `null` for a segment. */
  monthEurCents: number | null;
  /** That month as a share of the plan's net price; `null` for a segment. */
  shareOfNet: number | null;
}

export interface VendorLine {
  day: string;
  vendor: "dataforseo" | "anthropic";
  /** The ledger's and the box's spend with this vendor, judged as D34 does. */
  recordedCents: number;
  /** What the vendor's own account says it billed; `null` where not read. */
  vendorBilledCents: number | null;
  /** Billed by the vendor less recorded; `null` where either is missing. */
  gapCents: number | null;
}

export interface CapDay {
  day: string;
  judgedCents: number;
  judgedEur: number;
  state: "ok" | "warn" | "over";
}

export interface FixedLine {
  vendor: (typeof FIXED_VENDORS)[number];
  /** In cents of `currency`; `null` where the vendor reported nothing. */
  cents: number | null;
  currency: "usd" | "eur";
}

export interface CostPage {
  /** The seven UTC days, newest first. */
  days: readonly string[];
  total: Cell;
  week: readonly WeekLine[];
  siteDays: readonly { day: string; who: Who; cell: Cell }[];
  activities: readonly { activity: Activity; cell: Cell }[];
  vendors: readonly VendorLine[];
  capDays: readonly CapDay[];
  fixedMonth: string;
  fixed: readonly FixedLine[];
  /** Whether Anthropic's own bill was read for any day of the week. */
  aiBilled: boolean;
}

const EMPTY: Cell = Object.freeze({ calls: 0, estimatedCents: 0, billedCents: null, billedCalls: 0, judgedCents: 0, failedCalls: 0, timeoutCalls: 0 });

function num(value: number | string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(cents: number): number {
  return Math.round(cents * 10000) / 10000;
}

function add(cell: Cell, more: Cell): Cell {
  return {
    calls: cell.calls + more.calls,
    estimatedCents: round(cell.estimatedCents + more.estimatedCents),
    billedCents: cell.billedCents === null && more.billedCents === null ? null : round((cell.billedCents ?? 0) + (more.billedCents ?? 0)),
    billedCalls: cell.billedCalls + more.billedCalls,
    judgedCents: round(cell.judgedCents + more.judgedCents),
    failedCalls: cell.failedCalls + more.failedCalls,
    timeoutCalls: cell.timeoutCalls + more.timeoutCalls,
  };
}

function cellOf(row: SiteDayRow): Cell {
  return {
    calls: row.calls,
    estimatedCents: num(row.estimated_cents) ?? 0,
    billedCents: num(row.billed_cents),
    billedCalls: row.billed_calls,
    judgedCents: num(row.judged_cents) ?? 0,
    failedCalls: row.failed_calls,
    timeoutCalls: row.timeout_calls,
  };
}

/** A box line: one row of spend a script on the box logged for a domain. */
function boxCell(row: VendorDay): Cell {
  const estimated = num(row.estimated_cents) ?? 0;
  const billed = num(row.billed_cents);
  return { calls: 0, estimatedCents: estimated, billedCents: billed, billedCalls: 0, judgedCents: billed ?? estimated, failedCalls: 0, timeoutCalls: 0 };
}

function whoKey(who: Who): string {
  return who.kind === "site" ? `site:${who.siteId}` : `segment:${who.segment}`;
}

export function usdCentsToEur(cents: number): number {
  return cents / 100 / USD_PER_EUR.rate;
}

/** The seven UTC days ending with `now`'s, newest first. */
export function costDays(now: Date): string[] {
  return Array.from({ length: COST_DAYS }, (_, i) => utcDay(new Date(now.getTime() - i * DAY_MS)));
}

/** The page's figures, from the rows. Pure. */
export function costPage(a: {
  now: Date;
  rows: readonly SiteDayRow[];
  vendorDays: readonly VendorDay[];
  domains: ReadonlyMap<string, string>;
}): CostPage {
  const days = costDays(a.now);
  const inWeek = new Set(days);
  const fixedMonth = previousMonth(a.now);
  const rows = a.rows.filter((row) => inWeek.has(row.day));
  const box = a.vendorDays.filter((row) => row.kind === "box" && inWeek.has(row.day));

  const whoOf = (row: SiteDayRow): Who =>
    row.site_id === null
      ? { kind: "segment", segment: row.segment ?? "free" }
      : { kind: "site", siteId: row.site_id, domain: a.domains.get(row.site_id) ?? row.site_id };

  const byWho = new Map<string, { who: Who; cell: Cell }>();
  const byWhoDay = new Map<string, { day: string; who: Who; cell: Cell }>();
  const byActivity = new Map<Activity, Cell>();
  const judgedByDay = new Map<string, number>();
  const recorded = new Map<string, number>();
  const into = (who: Who, day: string, cell: Cell) => {
    const key = whoKey(who);
    byWho.set(key, { who, cell: add(byWho.get(key)?.cell ?? EMPTY, cell) });
    const dayKey = `${day}|${key}`;
    byWhoDay.set(dayKey, { day, who, cell: add(byWhoDay.get(dayKey)?.cell ?? EMPTY, cell) });
    judgedByDay.set(day, round((judgedByDay.get(day) ?? 0) + cell.judgedCents));
  };
  for (const row of rows) {
    const cell = cellOf(row);
    into(whoOf(row), row.day, cell);
    byActivity.set(row.activity, add(byActivity.get(row.activity) ?? EMPTY, cell));
    if (row.vendor !== "own") recorded.set(`${row.day}|${row.vendor}`, round((recorded.get(`${row.day}|${row.vendor}`) ?? 0) + cell.judgedCents));
  }
  for (const row of box) {
    const cell = boxCell(row);
    into({ kind: "segment", segment: "box" }, row.day, cell);
    byActivity.set("box", add(byActivity.get("box") ?? EMPTY, cell));
    if (row.vendor === "dataforseo" || row.vendor === "anthropic") {
      recorded.set(`${row.day}|${row.vendor}`, round((recorded.get(`${row.day}|${row.vendor}`) ?? 0) + cell.judgedCents));
    }
  }

  const fixed: FixedLine[] = FIXED_VENDORS.map((vendor) => {
    const row = a.vendorDays.find((day) => day.kind === "fixed" && day.vendor === vendor && day.day === fixedMonth);
    return { vendor, cents: row === undefined ? null : num(row.billed_cents), currency: row?.currency ?? "usd" };
  });
  const fixedEurCents = fixed.reduce((sum, line) => (line.cents === null ? sum : sum + (line.currency === "eur" ? line.cents : usdCentsToEur(line.cents) * 100)), 0);

  const sites = [...byWho.values()].filter((line) => line.who.kind === "site");
  const week: WeekLine[] = [...byWho.values()]
    .map(({ who, cell }) => {
      if (who.kind !== "site") return { who, cell, monthEurCents: null, shareOfNet: null };
      const month = Math.round(usdCentsToEur(cell.judgedCents) * 100 * WEEKS_A_MONTH + fixedEurCents / sites.length);
      return { who, cell, monthEurCents: month, shareOfNet: month / PLAN_NET_EUR_CENTS };
    })
    .sort((x, y) => y.cell.judgedCents - x.cell.judgedCents);

  const usage = (vendor: string, day: string) =>
    num(a.vendorDays.find((row) => row.kind === "usage" && row.vendor === vendor && row.day === day)?.billed_cents ?? null);
  const vendors: VendorLine[] = days.flatMap((day) =>
    (["dataforseo", "anthropic"] as const).map((vendor) => {
      const recordedCents = recorded.get(`${day}|${vendor}`) ?? 0;
      const vendorBilledCents = usage(vendor, day);
      return { day, vendor, recordedCents, vendorBilledCents, gapCents: vendorBilledCents === null ? null : round(vendorBilledCents - recordedCents) };
    })
  );

  const capDays: CapDay[] = days.map((day) => {
    const judgedCents = judgedByDay.get(day) ?? 0;
    const judgedEur = usdCentsToEur(judgedCents);
    return { day, judgedCents, judgedEur, state: judgedEur >= TEST_DAY_EUR.cap ? "over" : judgedEur >= TEST_DAY_EUR.warn ? "warn" : "ok" };
  });

  const order = new Map(days.map((day, i) => [day, i]));
  return {
    days,
    total: [...byWho.values()].reduce((sum, line) => add(sum, line.cell), EMPTY),
    week,
    siteDays: [...byWhoDay.values()].sort((x, y) => (order.get(x.day) ?? 0) - (order.get(y.day) ?? 0) || y.cell.judgedCents - x.cell.judgedCents),
    activities: [...byActivity.entries()].map(([activity, cell]) => ({ activity, cell })).sort((x, y) => y.cell.judgedCents - x.cell.judgedCents),
    vendors,
    capDays,
    fixedMonth,
    fixed,
    aiBilled: vendors.some((line) => line.vendor === "anthropic" && line.vendorBilledCents !== null),
  };
}

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  gte(column: string, value: string): MinimalQueryBuilder<T>;
  in(column: string, values: readonly string[]): MinimalQueryBuilder<T>;
  or(filters: string): MinimalQueryBuilder<T>;
}

function untyped(): { from<T>(table: string): MinimalQueryBuilder<T> } {
  return dbAdmin() as unknown as { from<T>(table: string): MinimalQueryBuilder<T> };
}

function rowsOf<T>(result: QueryResult<T>, what: string): T[] {
  if (result.error) throw new Error(`readCostPage: could not read ${what}: ${result.error.message}`);
  return result.data ?? [];
}

/** The page's figures for the seven UTC days ending `now`. Throws where a
 *  store cannot be read; the page then says so. */
export async function readCostPage(now: Date = new Date()): Promise<CostPage> {
  const days = costDays(now);
  const from = days[days.length - 1] ?? utcDay(now);
  const [ledger, vendorDays] = await Promise.all([
    untyped()
      .from<SiteDayRow>("cost_site_day")
      .select("day, site_id, segment, vendor, activity, calls, estimated_cents, billed_cents, billed_calls, judged_cents, failed_calls, timeout_calls")
      .gte("day", from),
    untyped()
      .from<VendorDay>("vendor_days")
      .select("vendor, day, kind, domain, billed_cents, currency, estimated_cents")
      .or(`day.gte.${from},day.eq.${previousMonth(now)}`),
  ]);
  const rows = rowsOf(ledger, "the ledger");
  const siteIds = [...new Set(rows.flatMap((row) => (row.site_id === null ? [] : [row.site_id])))];
  const sites = siteIds.length === 0 ? [] : rowsOf(await untyped().from<{ id: string; domain: string | null }>("sites").select("id, domain").in("id", siteIds), "the sites");
  return costPage({
    now,
    rows,
    vendorDays: rowsOf(vendorDays, "what the vendors billed"),
    domains: new Map(sites.flatMap((site) => (site.domain === null ? [] : [[site.id, site.domain] as const]))),
  });
}
