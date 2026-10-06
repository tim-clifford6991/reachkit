// SPEC §6 (owner, D57, 2026-10-06, issue 1286) — what a week cost, for the
// Monday owner digest (`./market-digest`).
//
// The week is the one the digest already reports stalled pages for: the seven
// dates before `week_start`, which every zone has finished. Three stores are
// read and none is recomputed:
//
//   * `scans` — a paid pass's `cost_cents` is what that measurement cost; a
//     free pass's is a free scan's, or a smoke test's where `scans.smoke`
//     says `scripts/smoke.sh` started it. A scan is in the week by the UTC
//     instant it was created.
//   * `drafts` — a page's `cost_cents`, for every page of the week's dates,
//     stopped or not (the same pages `stalledBySite` counts as written).
//   * `fetches` — the ledger's own total for the week, product-wide.
//
// No cost figure is ever rendered to a customer (`docs/RUNBOOK.md` §8): this
// is read for the owner's mail and for nothing else.
import { dbAdmin } from "@/lib/db";

export interface CostLine {
  count: number;
  cents: number;
}

export interface CostWeek {
  /** The first of the week's seven dates, `YYYY-MM-DD`. */
  weekStart: string;
  /** Most expensive first. A site is named by its domain. */
  sites: readonly { domain: string; measurements: CostLine; pages: CostLine }[];
  freeScans: CostLine;
  smokeTests: CostLine;
  /** The `fetches` ledger's total for the week; `null` where it could not be
   *  read, which leaves the line out. */
  totalCents: number | null;
}

export interface CostScanRow {
  domain: string;
  tier: string;
  smoke: boolean | null;
  cost_cents: number | string | null;
}

export interface CostDraftRow {
  site_id: string;
  cost_cents: number | string | null;
}

function centsOf(value: number | string | null): number {
  const cents = Number(value ?? 0);
  return Number.isFinite(cents) && cents > 0 ? cents : 0;
}

function add(line: CostLine, cents: number): CostLine {
  return { count: line.count + 1, cents: line.cents + cents };
}

const NONE: CostLine = Object.freeze({ count: 0, cents: 0 });

/** The week's rows as the digest reports them, or `null` where the week
 *  holds no scan and no page. */
export function costWeek(a: {
  weekStart: string;
  scans: readonly CostScanRow[];
  drafts: readonly CostDraftRow[];
  /** `sites.id` → `sites.domain`. */
  domains: ReadonlyMap<string, string>;
  totalCents: number | null;
}): CostWeek | null {
  if (a.scans.length === 0 && a.drafts.length === 0) return null;

  const sites = new Map<string, { measurements: CostLine; pages: CostLine }>();
  const siteOf = (domain: string) => sites.get(domain) ?? { measurements: NONE, pages: NONE };
  let freeScans = NONE;
  let smokeTests = NONE;

  for (const scan of a.scans) {
    const cents = centsOf(scan.cost_cents);
    if (scan.tier !== "free") {
      const site = siteOf(scan.domain);
      sites.set(scan.domain, { ...site, measurements: add(site.measurements, cents) });
    } else if (scan.smoke === true) {
      smokeTests = add(smokeTests, cents);
    } else {
      freeScans = add(freeScans, cents);
    }
  }
  for (const draft of a.drafts) {
    const domain = a.domains.get(draft.site_id) ?? "unknown";
    const site = siteOf(domain);
    sites.set(domain, { ...site, pages: add(site.pages, centsOf(draft.cost_cents)) });
  }

  return {
    weekStart: a.weekStart,
    sites: [...sites]
      .map(([domain, site]) => ({ domain, ...site }))
      .sort((x, y) => y.measurements.cents + y.pages.cents - (x.measurements.cents + x.pages.cents) || x.domain.localeCompare(y.domain)),
    freeScans,
    smokeTests,
    totalCents: a.totalCents,
  };
}

// `scans.smoke` and the money columns are on disk and not in the generated
// `Database` type — the same narrow cast `./market-digest` carries.
interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  in(column: string, values: readonly string[]): MinimalQueryBuilder<T>;
  gte(column: string, value: string): MinimalQueryBuilder<T>;
  lte(column: string, value: string): MinimalQueryBuilder<T>;
  lt(column: string, value: string): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function rowsOf<T>(result: QueryResult<T>, what: string): T[] {
  if (result.error) throw new Error(`readCostWeek: could not read ${what}: ${result.error.message}`);
  return result.data ?? [];
}

/** What the ledger holds since `since`, or `null` where it cannot say. */
async function spentSince(since: string): Promise<number | null> {
  const { data, error } = await untyped().rpc("fetches_spend_since", { p_since: since });
  const cents = Number(data);
  return error || data === null || !Number.isFinite(cents) ? null : cents;
}

/** The seven dates from `from` (`YYYY-MM-DD`), read. Throws where a store
 *  could not be read; the digest leaves the section out and goes on. */
export async function readCostWeek(from: string): Promise<CostWeek | null> {
  const start = `${from}T00:00:00.000Z`;
  const end = new Date(Date.parse(start) + 7 * DAY_MS).toISOString();
  const lastDate = new Date(Date.parse(start) + 6 * DAY_MS).toISOString().slice(0, 10);

  const [scans, drafts, sinceStart, sinceEnd] = await Promise.all([
    untyped().from<CostScanRow>("scans").select("domain, tier, smoke, cost_cents").gte("created_at", start).lt("created_at", end),
    untyped().from<CostDraftRow>("drafts").select("site_id, cost_cents").gte("scheduled_for", from).lte("scheduled_for", lastDate),
    spentSince(start),
    spentSince(end),
  ]);
  const draftRows = rowsOf(drafts, "the week's pages");
  const siteIds = [...new Set(draftRows.map((draft) => draft.site_id))];
  const sites = siteIds.length === 0 ? [] : rowsOf(await untyped().from<{ id: string; domain: string }>("sites").select("id, domain").in("id", siteIds), "the sites");

  return costWeek({
    weekStart: from,
    scans: rowsOf(scans, "the week's scans"),
    drafts: draftRows,
    domains: new Map(sites.map((site) => [site.id, site.domain])),
    totalCents: sinceStart === null || sinceEnd === null ? null : Math.max(0, sinceStart - sinceEnd),
  });
}
