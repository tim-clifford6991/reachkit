// src/lib/measure/text-store.ts — one stored page read's text, derived once
// from its payload and kept in `fetch_text` at the deployed text version, so
// a reader downloads only the payloads that have none there yet.
import { RENDERED_FETCH_SOURCE, renderedDocumentOf, siteDocumentOf } from "./own-fetch";
import { prose } from "./prose";
import type { MeasuredText } from "./text";

/** A `fetch_text` row's columns past its keys. `document` false is a read
 *  with no payload or none that parses: it holds no text and returns none. */
export interface TextRow {
  url: string;
  read_at: string;
  rendered: boolean;
  document: boolean;
  text: string;
  examples: string[];
  questions: string[];
}

export function textRowOf(source: string, payload: unknown): TextRow {
  const rendered = source === RENDERED_FETCH_SOURCE;
  const document = rendered ? renderedDocumentOf(payload) : siteDocumentOf(payload);
  if (document === null) return { url: "", read_at: "", rendered, document: false, text: "", examples: [], questions: [] };
  const read = prose(document.html);
  return { url: document.url, read_at: document.readAt, rendered, document: true, text: read.text, examples: read.examples, questions: read.questions };
}

export function measuredTextOf(row: TextRow): MeasuredText | null {
  if (!row.document) return null;
  return {
    url: row.url,
    text: row.text,
    measuredAt: new Date(row.read_at),
    examples: row.examples,
    questions: row.questions,
    ...(row.rendered ? { rendered: true as const } : {}),
  };
}

// `fetches` and `fetch_text` are outside the generated `Database` type; this is the cast boundary.
interface Result<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface Query<T> extends PromiseLike<Result<T>> {
  select(columns: string): Query<T>;
  eq(column: string, value: string): Query<T>;
  in(column: string, values: readonly string[]): Query<T>;
  upsert(rows: readonly Record<string, unknown>[], options: { onConflict: string }): Query<T>;
}
export interface TextClient {
  from<T>(table: string): Query<T>;
}

function rows<T>(result: Result<T>, table: string): T[] {
  if (result.error) throw new Error(`text.ts: read from ${table} failed: ${result.error.message}`);
  return result.data ?? [];
}

// Ids per `in` filter, so a long read history never outgrows a request's address.
const IDS = 100;

/** A `fetches` row as the reader already holds it. */
export interface FetchRead {
  id: string;
  scan_id: string;
  source: string;
  payload: unknown;
}

/** The text of each read: kept rows at `version`, the rest derived from the
 *  payloads already in hand and kept. */
async function textById(client: TextClient, reads: readonly FetchRead[], version: string): Promise<Map<string, TextRow>> {
  const out = new Map<string, TextRow>();
  const kept = await client
    .from<TextRow & { fetch_id: string }>("fetch_text")
    .select("fetch_id, url, read_at, rendered, document, text, examples, questions")
    .eq("text_version", version)
    .in("fetch_id", reads.map((read) => read.id));
  for (const row of rows(kept, "fetch_text")) out.set(row.fetch_id, row);
  const derived = reads.filter((read) => !out.has(read.id)).map((r) => ({ fetch_id: r.id, scan_id: r.scan_id, text_version: version, ...textRowOf(r.source, r.payload) }));
  for (const row of derived) out.set(row.fetch_id, row);
  if (derived.length > 0) {
    // A row Postgres refuses is derived again next time; the text read now is the same.
    const wrote = await client.from("fetch_text").upsert(derived.map((row) => ({ ...row, computed_at: new Date().toISOString() })), { onConflict: "fetch_id" });
    if (wrote.error) console.warn(`text.ts: write to fetch_text failed: ${wrote.error.message}`);
  }
  return out;
}

/** The measured text of each read by fetch id, in the order given; null for
 *  a read that holds no document. */
export async function storedText(client: TextClient, reads: readonly FetchRead[], version: string): Promise<Map<string, MeasuredText | null>> {
  const batches = [];
  for (let i = 0; i < reads.length; i += IDS) batches.push(textById(client, reads.slice(i, i + IDS), version));
  const byId = new Map<string, TextRow>();
  for (const batch of await Promise.all(batches)) for (const [id, row] of batch) byId.set(id, row);
  const out = new Map<string, MeasuredText | null>();
  for (const read of reads) {
    const row = byId.get(read.id);
    out.set(read.id, row === undefined ? null : measuredTextOf(row));
  }
  return out;
}
