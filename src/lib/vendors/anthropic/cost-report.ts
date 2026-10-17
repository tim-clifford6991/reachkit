// src/lib/vendors/anthropic/cost-report.ts — issue 1478, SPEC §6.
//
// What Anthropic billed the organisation, per UTC day: the Admin API's cost
// report (`GET /v1/organizations/cost_report`). It needs an admin key —
// `ANTHROPIC_ADMIN_KEY`; the key the product calls the model with cannot
// read it — and it covers everything billed to the organisation, not only
// ReachKit's key. Free to read. The same reading `scripts/vendor-snapshot.mjs`
// takes on the box.
const COST_REPORT = "https://api.anthropic.com/v1/organizations/cost_report";
const REQUEST_MS = 20_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The report's buckets as US cents per UTC day. `amount` is already in
 *  cents, as a decimal string; only US dollar items are summed. */
export function costReportDays(buckets: readonly unknown[]): Record<string, number> {
  const days: Record<string, number> = {};
  for (const bucket of buckets) {
    const b = bucket as { starting_at?: unknown; results?: unknown } | null;
    if (typeof b?.starting_at !== "string" || Number.isNaN(Date.parse(b.starting_at))) continue;
    const day = new Date(b.starting_at).toISOString().slice(0, 10);
    let sum = days[day] ?? 0;
    for (const item of Array.isArray(b.results) ? (b.results as { amount?: unknown; currency?: unknown }[]) : []) {
      const amount = Number(item?.amount);
      if (item?.currency === "USD" && Number.isFinite(amount)) sum += amount;
    }
    days[day] = Math.round(sum * 10000) / 10000;
  }
  return days;
}

/** The last `days` UTC days, today included, or `null` where the report
 *  could not be read. */
export async function readCostReport(adminKey: string, now: Date, days: number): Promise<Record<string, number> | null> {
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const buckets: unknown[] = [];
  let page: string | undefined;
  try {
    do {
      const url = new URL(COST_REPORT);
      url.searchParams.set("starting_at", new Date(today - (days - 1) * DAY_MS).toISOString());
      url.searchParams.set("bucket_width", "1d");
      url.searchParams.set("limit", "31");
      if (page !== undefined) url.searchParams.set("page", page);
      const response = await fetch(url, {
        headers: { "x-api-key": adminKey, "anthropic-version": "2023-06-01" },
        signal: AbortSignal.timeout(REQUEST_MS),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as { data?: unknown; has_more?: unknown; next_page?: unknown };
      buckets.push(...(Array.isArray(body.data) ? body.data : []));
      page = body.has_more === true && typeof body.next_page === "string" ? body.next_page : undefined;
    } while (page !== undefined);
  } catch {
    return null;
  }
  return costReportDays(buckets);
}
