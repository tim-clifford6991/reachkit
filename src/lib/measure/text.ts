// BUILD §5
// src/lib/measure/text.ts — `readMeasuredText`: the rendered text of every
// page the engine measured for a site, read back from the `fetches` rows
// `measureDomain` ledgered (BUILD §6.5: "one `fetches` table is ledger +
// cache + raw store"). The generation engine's comparison set — without a
// second read of the customer's own server at draft time, and without a
// second copy of the text anywhere.
//
// **It fetches nothing and stores nothing.** No `safeFetch`, no vendor
// call, no write. A site that serves an empty JavaScript shell has its
// pages' rendered reads beside the shells (SPEC §6, issue 1374), marked
// `rendered`. The extractor is `prose.ts`'s `prose`: the document
// the measurement scored, without its navigation, header, footer, buttons
// or example widgets (SPEC §5, 2026-09-29, #1130), because what is read
// back here is what a page quotes as a fact about the business.
//
// The horizon is the site's own scans, plus the free scans of the same
// domain: a site with no scans returns `[]` — a legitimate empty, not an
// error. A scan whose own-document read was served from cache ledgered no
// row of its own (a cache hit spends nothing, so there is nothing to
// ledger) — the bytes it read are the row the earlier scan wrote. On the
// paying path that earlier scan is the free scan the customer ran before
// paying, which belongs to no site, so it is read by its domain: without
// it, a deep pass run inside the own-document window has no text at all,
// and a paid site grounds no fact and starts no draft.
import { dbAdmin } from "@/lib/db";
import { OWN_FETCH_SOURCE, RENDERED_FETCH_SOURCE, siteDocumentOf, type StoredDocument } from "./own-fetch";
import { prose } from "./prose";

export interface MeasuredText {
  url: string;
  text: string;
  /** The date the document was read — the stored outcome's own `readAt`. */
  measuredAt: Date;
  /** What the page's example and demo elements said (`prose.ts`). Never
   *  part of `text`; the facts read drops these phrases site-wide. */
  examples?: readonly string[];
  /** The questions the page itself asks (`questions.ts`). */
  questions?: readonly string[];
  /** The text is the page as a browser draws it, not as it is served (SPEC
   *  §6, issue 1374): the site serves an empty JavaScript shell. */
  rendered?: true;
}

// `fetches` is outside the generated `Database` type (the same schema gap
// `src/lib/costs/ledger.ts` names and works around); the narrow builder
// below is the cast boundary — nothing else in this file bypasses the
// generated client.
/** What the light pass reads of a row: enough to choose, never the page. */
interface FetchGlance {
  id: string;
  url: unknown;
  readAt: unknown;
  status: unknown;
}
/** The fields the document check and `prose()` read, and nothing else. */
interface FetchDocument {
  id: string;
  url: unknown;
  status: unknown;
  html: unknown;
  readAt: unknown;
  headers: unknown;
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

/** Where each source keeps its document: own reads at the top, a rendered read as the vendor's one-row list. */
const DOCUMENT_AT: Readonly<Record<string, string>> = {
  [OWN_FETCH_SOURCE]: "payload",
  [RENDERED_FETCH_SOURCE]: "payload->0",
};

/** Keeps each `in` list well inside PostgREST's URL length. */
const IDS_PER_READ = 100;

/** Fixed, locale-free ordering: by read date, then by URL as code units.
 *  A comparison set that comes back in a different order on a different
 *  machine is a second source of non-determinism the engine does not need. */
function compareMeasuredText(a: MeasuredText, b: MeasuredText): number {
  const byDate = a.measuredAt.getTime() - b.measuredAt.getTime();
  if (byDate !== 0) return byDate;
  return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
}

/** Which pages a read is for. `customerOnly` is every reader of facts about
 *  the business: it leaves out the pages ReachKit wrote (SPEC §5,
 *  2026-10-15, issue 1456). A measurement, a comparison or a link reads
 *  them all — our pages are on the site and are measured as its pages. */
export interface TextRead {
  customerOnly?: boolean;
}

async function customerPages(
  pages: MeasuredText[],
  read: TextRead | undefined,
  whose: { siteId: string } | { domain: string }
): Promise<MeasuredText[]> {
  if (read?.customerOnly !== true || pages.length === 0) return pages;
  const { readOurPages, withoutOurPages } = await import("@/lib/known-content/ours");
  return withoutOurPages(pages, await readOurPages(whose));
}

/** Every page measured for `siteId` — or for one of its scans, when
 *  `scanId` is given — as rendered text. One indexed read of `scans`, one
 *  of `fetches`; no fetch, no write. */
export async function readMeasuredText(a: { siteId: string; scanId?: string } & TextRead): Promise<MeasuredText[]> {
  return customerPages(await measuredText(a), a, { siteId: a.siteId });
}

async function measuredText(a: { siteId: string; scanId?: string }): Promise<MeasuredText[]> {
  const client = dbAdmin();

  let scansQuery = client.from("scans").select("id, domain").eq("site_id", a.siteId);
  if (a.scanId !== undefined) scansQuery = scansQuery.eq("id", a.scanId);
  const scans = await scansQuery;
  if (scans.error) {
    throw new Error(`text.ts: read from scans failed: ${scans.error.message}`);
  }
  const own = scans.data ?? [];
  if (own.length === 0) return [];

  // The free scans of this site's domain, which served its cached reads.
  const domains = [...new Set(own.map((row) => row.domain))];
  const free = await client.from("scans").select("id").eq("tier", "free").in("domain", domains);
  if (free.error) {
    throw new Error(`text.ts: read from scans failed: ${free.error.message}`);
  }
  const scanIds = [...new Set([...own.map((row) => row.id), ...(free.data ?? []).map((row) => row.id)])];

  const text = await textOfScans(scanIds);
  // A scan whose pages are all an empty shell says as little as one with no
  // page (issue 1374): the rendered reads are the rows of the pass that
  // bought them.
  if (text.some((page) => page.text !== "") || a.scanId === undefined) return text;

  // A pass measured again now (issue 837) runs inside the own-document window
  // of the site's earlier pass, so every page it read was served from that
  // pass's rows and it ledgered none of its own. Its pages are then the ones
  // the site's other scans of the same domain wrote — never another site's.
  const siblings = await client.from("scans").select("id").eq("site_id", a.siteId).in("domain", domains);
  if (siblings.error) {
    throw new Error(`text.ts: read from scans failed: ${siblings.error.message}`);
  }
  const wider = (siblings.data ?? []).map((row) => row.id).filter((id) => !scanIds.includes(id));
  return wider.length === 0 ? text : textOfScans([...scanIds, ...wider]);
}

/** The pages the free scans of `domain` measured (issue 787): a free report's
 *  lead has no site, so its page is grounded on the domain's own reads. */
export async function readDomainText(domain: string, read?: TextRead): Promise<MeasuredText[]> {
  const free = await dbAdmin().from("scans").select("id").eq("tier", "free").eq("domain", domain);
  if (free.error) {
    throw new Error(`text.ts: read from scans failed: ${free.error.message}`);
  }
  const scanIds = (free.data ?? []).map((row) => row.id);
  return scanIds.length === 0 ? [] : customerPages(await textOfScans(scanIds), read, { domain });
}

async function textOfScans(scanIds: readonly string[]): Promise<MeasuredText[]> {
  const client = dbAdmin() as unknown as MinimalClient;
  const out: MeasuredText[] = [];
  for (const source of [OWN_FETCH_SOURCE, RENDERED_FETCH_SOURCE]) {
    const rendered = source === RENDERED_FETCH_SOURCE;
    for (const document of await newestDocuments(client, source, scanIds)) {
      const read = prose(document.html);
      out.push({
        url: document.url,
        text: read.text,
        measuredAt: new Date(document.readAt),
        examples: read.examples,
        questions: read.questions,
        ...(rendered ? { rendered: true as const } : {}),
      });
    }
  }
  return out.sort(compareMeasuredText);
}

/** Each URL's newest read the document check accepts. A refused, challenged
 *  or error re-read falls back to the URL's next newest, so a page never
 *  loses its text to a failed re-read; only the chosen rows' html is read. */
async function newestDocuments(client: MinimalClient, source: string, scanIds: readonly string[]): Promise<StoredDocument[]> {
  const at = DOCUMENT_AT[source];
  const glances = await client
    .from<FetchGlance>("fetches")
    .select(`id, url:${at}->url, readAt:${at}->readAt, status:${at}->status`)
    .eq("source", source)
    .in("scan_id", scanIds);
  if (glances.error) {
    throw new Error(`text.ts: read from fetches failed: ${glances.error.message}`);
  }

  // A row with no document (a refusal, a failed vendor read) or an error status is one the check would refuse.
  const candidates = (glances.data ?? [])
    .flatMap((row) =>
      typeof row.url === "string" && typeof row.readAt === "string" && typeof row.status === "number" && row.status < 400
        ? [{ id: row.id, url: row.url, at: new Date(row.readAt).getTime() }]
        : []
    )
    .filter((row) => !Number.isNaN(row.at))
    .sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byUrl = new Map<string, string[]>();
  for (const row of candidates) byUrl.set(row.url, [...(byUrl.get(row.url) ?? []), row.id]);

  const found: StoredDocument[] = [];
  let waiting = [...byUrl.entries()];
  while (waiting.length > 0) {
    const turn = new Map(waiting.map(([url, ids]) => [ids[0]!, url]));
    const read = new Set<string>();
    for (const row of await readDocuments(client, source, [...turn.keys()])) {
      const document = siteDocumentOf(storedDocumentOf(row));
      const url = turn.get(row.id);
      if (document === null || url === undefined) continue;
      found.push(document);
      read.add(url);
    }
    waiting = waiting.flatMap(([url, ids]) => (read.has(url) || ids.length === 1 ? [] : [[url, ids.slice(1)] as [string, string[]]]));
  }
  return found;
}

async function readDocuments(client: MinimalClient, source: string, ids: readonly string[]): Promise<FetchDocument[]> {
  const at = DOCUMENT_AT[source];
  const out: FetchDocument[] = [];
  for (let from = 0; from < ids.length; from += IDS_PER_READ) {
    const rows = await client
      .from<FetchDocument>("fetches")
      .select(`id, url:${at}->url, status:${at}->status, html:${at}->html, readAt:${at}->readAt, headers:${at}->headers`)
      .in("id", ids.slice(from, from + IDS_PER_READ));
    if (rows.error) {
      throw new Error(`text.ts: read from fetches failed: ${rows.error.message}`);
    }
    out.push(...(rows.data ?? []));
  }
  return out;
}

/** The stored shape back from its read fields; `bytes` is not read, so it is the html's own length. */
function storedDocumentOf(row: FetchDocument): unknown {
  return {
    url: row.url,
    status: row.status,
    html: row.html,
    bytes: typeof row.html === "string" ? row.html.length : null,
    readAt: row.readAt,
    ...(row.headers !== null && row.headers !== undefined ? { headers: row.headers } : {}),
  };
}
