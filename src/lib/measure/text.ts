// BUILD §5
// src/lib/measure/text.ts — `readMeasuredText`: the rendered text of every
// page the engine measured for a site, read back from the `fetches` rows
// `measureDomain` ledgered (BUILD §6.5: "one `fetches` table is ledger +
// cache + raw store"). The generation engine's comparison set — without a
// second read of the customer's own server at draft time, and without a
// second copy of the text anywhere.
//
// **It fetches nothing and stores nothing.** No `safeFetch`, no vendor
// call, no write. The extractor is `parse.ts`'s `visibleText`, imported —
// the same one the measurement itself used, so the text handed to
// generation cannot disagree with the text the page was scored on.
//
// The horizon is the site's own scans: a site with no scans returns `[]`
// — a legitimate empty, not an error. A scan whose own-document read was
// served from cache ledgered no row of its own (a cache hit spends
// nothing, so there is nothing to ledger), and so contributes no text here
// — the bytes it read are the row the earlier scan wrote.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-05: A citation is a reference whose host is the customer's domain or a
//   subdomain; a mention is any other reference carrying the brand token whole (the domain's
//   first label, tokenised on non-alphanumerics). — #74

import { dbAdmin } from "@/lib/db";
import { OWN_FETCH_SOURCE, isStoredDocument } from "./own-fetch";
import { visibleText } from "./parse";

export interface MeasuredText {
  url: string;
  text: string;
  /** The date the document was read — the stored outcome's own `readAt`. */
  measuredAt: Date;
}

// `fetches` is outside the generated `Database` type (the same schema gap
// `src/lib/costs/ledger.ts` names and works around); the narrow builder
// below is the cast boundary — nothing else in this file bypasses the
// generated client.
interface OwnFetchRow {
  scan_id: string;
  payload: unknown;
}
interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string | number): MinimalQueryBuilder<T>;
  in(column: string, values: readonly string[]): MinimalQueryBuilder<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** Fixed, locale-free ordering: by read date, then by URL as code units.
 *  A comparison set that comes back in a different order on a different
 *  machine is a second source of non-determinism the engine does not need. */
function compareMeasuredText(a: MeasuredText, b: MeasuredText): number {
  const byDate = a.measuredAt.getTime() - b.measuredAt.getTime();
  if (byDate !== 0) return byDate;
  return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
}

/** Every page measured for `siteId` — or for one of its scans, when
 *  `scanId` is given — as rendered text. One indexed read of `scans`, one
 *  of `fetches`; no fetch, no write. */
export async function readMeasuredText(a: { siteId: string; scanId?: string }): Promise<MeasuredText[]> {
  const client = dbAdmin();

  let scansQuery = client.from("scans").select("id").eq("site_id", a.siteId);
  if (a.scanId !== undefined) scansQuery = scansQuery.eq("id", a.scanId);
  const scans = await scansQuery;
  if (scans.error) {
    throw new Error(`text.ts: read from scans failed: ${scans.error.message}`);
  }
  const scanIds = (scans.data ?? []).map((row) => row.id);
  if (scanIds.length === 0) return [];

  const rows = await (client as unknown as MinimalClient)
    .from<OwnFetchRow>("fetches")
    .select("scan_id, payload")
    .eq("source", OWN_FETCH_SOURCE)
    .in("scan_id", scanIds);
  if (rows.error) {
    throw new Error(`text.ts: read from fetches failed: ${rows.error.message}`);
  }

  const out: MeasuredText[] = [];
  for (const row of rows.data ?? []) {
    // A `null` payload is a ledgered failed read (`own-fetch.ts`) — no
    // text was measured, so none is returned. Any other shape under this
    // source is skipped the same way, never thrown on.
    if (!isStoredDocument(row.payload)) continue;
    out.push({
      url: row.payload.url,
      text: visibleText(row.payload.html),
      measuredAt: new Date(row.payload.readAt),
    });
  }
  return out.sort(compareMeasuredText);
}
