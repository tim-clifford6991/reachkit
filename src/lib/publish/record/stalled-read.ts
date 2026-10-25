// SPEC §7 — the pages of a window of dates, counted by `./stalled`, in one read for one site or every site.
// The window is `drafts.scheduled_for`, a site-local date, so a week is the same seven dates in every zone.
import { publishDb } from "../db";
import { stalledCount, type StalledCount } from "./stalled";

interface StalledRow {
  site_id: string;
  state: string;
  transitions: unknown;
}

/** Each site's count over `from`…`to` (both inclusive, `YYYY-MM-DD`). A
 *  site with no page in the window is absent. */
export async function stalledBySite(a: {
  from: string;
  to: string;
  siteId?: string;
}): Promise<ReadonlyMap<string, StalledCount>> {
  let query = publishDb()
    .from<StalledRow>("drafts")
    .select("site_id, state, transitions")
    .gte("scheduled_for", a.from)
    .lte("scheduled_for", a.to);
  if (a.siteId !== undefined) query = query.eq("site_id", a.siteId);
  const { data, error } = await query;
  if (error !== null || data === null) throw new Error("stalledBySite: could not read the window's pages");

  const bySite = new Map<string, StalledRow[]>();
  for (const row of data) bySite.set(row.site_id, [...(bySite.get(row.site_id) ?? []), row]);
  return new Map([...bySite].map(([siteId, rows]) => [siteId, stalledCount(rows)]));
}
