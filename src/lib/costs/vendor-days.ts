// SPEC §6: what the vendors billed, one row per vendor per UTC day.
//
// The ledger's figures are the price book's estimate, and DataForSEO's own
// charge where a response carried one. This is the vendors' side,
// stored where the owner's cost page and `npm run costs` read it, and read by
// `account/maintenance` with no owner step (`src/jobs/vendor-days.ts`):
//
//   * **DataForSEO, a day.** The balance and deposits are read at the first
//     tick of each UTC day. A day's bill is its opening balance less the next
//     day's, deposits added back — so it is written the day after.
//   * **Anthropic, a day.** The organisation's cost report, where the
//     deployment holds `ANTHROPIC_ADMIN_KEY`. Without it no row is written
//     and the page says AI spend is estimated.
//   * **The fixed vendors, a month.** One row each for the month just
//     closed. Stripe's is the fees on that month's balance transactions, in
//     euro cents. Vercel, Supabase, the job platform and Resend report no bill this
//     product can read, so their row is written with no figure — "not
//     reported", never 0.
//   * **DataForSEO running out.** The day's balance under `VENDOR_LOW` tells
//     the owner once a Berlin day; a balance not read tells nobody.
//
// Every reading is free. A vendor that does not answer leaves its row
// unwritten and the next tick asks again.
import { VENDOR_LOW } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import { dbAdmin } from "@/lib/db";

export const FIXED_VENDORS = ["vercel", "supabase", "jobs", "resend", "stripe"] as const;
export type FixedVendor = (typeof FIXED_VENDORS)[number];

/** Anthropic's report is asked for today and the seven days before it, so
 *  a late correction to a closed day is taken too. */
const REPORT_DAYS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface VendorDayRow {
  vendor: string;
  day: string;
  kind: "usage" | "fixed" | "box";
  domain?: string;
  billed_cents: number | null;
  currency?: "usd" | "eur";
  estimated_cents?: number | null;
  balance_cents?: number | null;
  deposited_cents?: number | null;
  source: string;
  read_at: string;
}

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  in(column: string, values: readonly string[]): MinimalQueryBuilder<T>;
  upsert(rows: readonly object[], options: { onConflict: string }): MinimalQueryBuilder<T>;
  update(values: object): MinimalQueryBuilder<T>;
  gte(column: string, value: string): MinimalQueryBuilder<T>;
  lt(column: string, value: string): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function dayBefore(day: string): string {
  return utcDay(new Date(Date.parse(`${day}T00:00:00.000Z`) - DAY_MS));
}

/** The first day of the month before `at`'s. */
export function previousMonth(at: Date): string {
  return utcDay(new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() - 1, 1)));
}

/** A table the migration has not created yet: PostgREST's `PGRST205`, or
 *  Postgres's own `42P01`. Nothing is due until it exists. */
function lacksTable(error: { message: string; code?: string }): boolean {
  return error.code === "PGRST205" || error.code === "42P01";
}

/**
 * What is still to be read: `usage:<day>` until today's DataForSEO opening
 * is stored, and `fixed:<month>` until every fixed vendor has a row for the
 * month before this one.
 */
export async function vendorDaysDue(now: Date = new Date()): Promise<readonly string[]> {
  const today = utcDay(now);
  const month = previousMonth(now);
  const { data, error } = await untyped()
    .from<{ vendor: string; day: string; kind: string }>("vendor_days")
    .select("vendor, day, kind")
    .in("day", [today, month]);
  if (error) {
    if (lacksTable(error)) return [];
    throw new Error(`vendorDaysDue: ${error.message}`);
  }
  const rows = data ?? [];
  const due: string[] = [];
  if (!rows.some((row) => row.vendor === "dataforseo" && row.kind === "usage" && row.day === today)) due.push(`usage:${today}`);
  if (!FIXED_VENDORS.every((vendor) => rows.some((row) => row.vendor === vendor && row.kind === "fixed" && row.day === month))) {
    due.push(`fixed:${month}`);
  }
  return due;
}

/** A day's DataForSEO bill from two openings: the balance's fall, with what
 *  was deposited in between added back. `null` where either is missing. */
export function billedBetween(
  opening: { balance_cents: number | string | null; deposited_cents: number | string | null },
  next: { balanceCents: number; depositedCents: number }
): number | null {
  if (opening.balance_cents === null || opening.deposited_cents === null) return null;
  const balance = Number(opening.balance_cents);
  const deposited = Number(opening.deposited_cents);
  if (!Number.isFinite(balance) || !Number.isFinite(deposited)) return null;
  return Math.round((balance - next.balanceCents + (next.depositedCents - deposited)) * 10000) / 10000;
}

async function upsert(rows: readonly VendorDayRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await untyped()
    .from<VendorDayRow>("vendor_days")
    .upsert(rows.map((row) => ({ domain: "", currency: "usd", ...row })), { onConflict: "vendor,day,kind,domain" });
  if (error) throw new Error(`vendor_days: ${error.message}`);
}

const DASHBOARD = "https://app.dataforseo.com/";
const SPEND_DAYS = 7;

/** The days a balance lasts at the trailing week's spend, `null` where the
 *  spend was not measured or was nothing, and whether the owner is told. */
export function runwayOf(balanceCents: number, weekSpendCents: number | null): { low: boolean; daysLeft: number | null } {
  const perDay = weekSpendCents === null ? 0 : weekSpendCents / SPEND_DAYS;
  const daysLeft = perDay > 0 ? balanceCents / perDay : null;
  return { low: balanceCents < VENDOR_LOW.floorC || (daysLeft !== null && daysLeft < VENDOR_LOW.runwayDays), daysLeft };
}

/** The ledger's DataForSEO estimate over the seven UTC days before `day`, or
 *  `null` where it could not be read. */
async function weekSpendCents(day: string): Promise<number | null> {
  const from = utcDay(new Date(Date.parse(`${day}T00:00:00.000Z`) - SPEND_DAYS * DAY_MS));
  const { data, error } = await untyped()
    .from<{ estimated_cents: number | string | null }>("cost_site_day")
    .select("estimated_cents")
    .eq("vendor", "dataforseo")
    .gte("day", from)
    .lt("day", day);
  if (error) return null;
  const sum = (data ?? []).reduce((total, row) => total + Number(row.estimated_cents ?? 0), 0);
  return Number.isFinite(sum) ? sum : null;
}

function berlinDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

async function readUsage(day: string, now: Date): Promise<{ done: true } | { degraded: string }> {
  const { readAccount } = await import("@/lib/vendors/dataforseo/account");
  const reading = await readAccount().catch(() => null);
  // Not measured is never a balance of 0, so nothing is told.
  if (reading === null) console.warn(JSON.stringify({ event: "vendor_balance_unread", vendor: "dataforseo" }));
  if (reading !== null) {
    const before = dayBefore(day);
    const { data, error } = await untyped()
      .from<{ balance_cents: number | string | null; deposited_cents: number | string | null; read_at: string | null }>("vendor_days")
      .select("balance_cents, deposited_cents, read_at")
      .eq("vendor", "dataforseo")
      .eq("kind", "usage")
      .eq("day", before);
    if (error) throw new Error(`vendor_days: ${error.message}`);
    const opening = data?.[0];
    const billed = opening === undefined ? null : billedBetween(opening, reading);
    await upsert([
      { vendor: "dataforseo", day, kind: "usage", billed_cents: null, balance_cents: reading.balanceCents, deposited_cents: reading.depositedCents, source: "balance", read_at: now.toISOString() },
      ...(opening === undefined || billed === null
        ? []
        : [{ vendor: "dataforseo", day: before, kind: "usage" as const, billed_cents: billed, balance_cents: Number(opening.balance_cents), deposited_cents: Number(opening.deposited_cents), source: "balance", read_at: now.toISOString() }]),
    ]);
    const spend = await weekSpendCents(day);
    const runway = runwayOf(reading.balanceCents, spend);
    console.log(JSON.stringify({ event: "vendor_balance", vendor: "dataforseo", balanceCents: reading.balanceCents, weekSpendCents: spend, daysLeft: runway.daysLeft }));
    // The day's row is the stamp; a late read of yesterday's row on the same Berlin day already told it.
    const toldToday =
      typeof opening?.read_at === "string" &&
      opening.balance_cents !== null &&
      berlinDay(new Date(opening.read_at)) === berlinDay(now) &&
      runwayOf(Number(opening.balance_cents), spend).low;
    if (runway.low && !toldToday) {
      const { reportIncident } = await import("@/lib/mail/ops");
      await reportIncident({ occasion: "vendor-low", balanceCents: reading.balanceCents, daysLeft: runway.daysLeft, dashboard: DASHBOARD });
    }
  }

  if (env.ANTHROPIC_ADMIN_KEY !== undefined) {
    const { readCostReport } = await import("@/lib/vendors/anthropic/cost-report");
    const days = await readCostReport(env.ANTHROPIC_ADMIN_KEY, now, REPORT_DAYS);
    if (days !== null) {
      // A day still running is not a bill yet.
      await upsert(
        Object.entries(days)
          .filter(([reported]) => reported < day)
          .map(([reported, cents]) => ({ vendor: "anthropic", day: reported, kind: "usage" as const, billed_cents: cents, source: "cost_report", read_at: now.toISOString() }))
      );
    }
  }

  return reading === null ? { degraded: "vendor-days:dataforseo-unread" } : { done: true };
}

/** Stripe's fees on the month's balance transactions, in euro cents, or
 *  `null` where they could not be read. */
async function stripeFees(month: string): Promise<number | null> {
  const start = Date.parse(`${month}T00:00:00.000Z`);
  const from = new Date(start);
  const end = Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1);
  try {
    const { stripe } = await import("@/lib/account/stripe/client");
    let fees = 0;
    for await (const transaction of stripe().balanceTransactions.list({ created: { gte: start / 1000, lt: end / 1000 }, limit: 100 })) {
      if (transaction.currency === "eur") fees += transaction.fee;
    }
    return fees;
  } catch {
    return null;
  }
}

async function readFixed(month: string, now: Date): Promise<{ done: true } | { degraded: string }> {
  const fees = await stripeFees(month);
  await upsert([
    ...FIXED_VENDORS.filter((vendor) => vendor !== "stripe").map((vendor) => ({
      vendor,
      day: month,
      kind: "fixed" as const,
      billed_cents: null,
      source: "not_reported",
      read_at: now.toISOString(),
    })),
    ...(fees === null
      ? []
      : [{ vendor: "stripe", day: month, kind: "fixed" as const, billed_cents: fees, currency: "eur" as const, source: "stripe_fees", read_at: now.toISOString() }]),
  ]);
  return fees === null ? { degraded: "vendor-days:stripe-unread" } : { done: true };
}

/** Reads one subject `vendorDaysDue` returned. */
export async function readVendorDay(subject: string, now: Date = new Date()): Promise<{ done: true } | { degraded: string }> {
  const [kind, day] = subject.split(":");
  if (day === undefined) return { done: true };
  if (kind === "usage") return readUsage(day, now);
  if (kind === "fixed") return readFixed(day, now);
  return { done: true };
}
