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

/** A `fetches` row as listed, without its payload. */
export interface FetchRead {
  id: string;
  scan_id: string;
  source: string;
}

// A kept-text read slower than this is served from the payloads instead.
const KEPT_MS = 1500;

async function keptRows(client: TextClient, ids: readonly string[], version: string): Promise<(TextRow & { fetch_id: string })[]> {
  const kept = await client
    .from<TextRow & { fetch_id: string }>("fetch_text")
    .select("fetch_id, url, read_at, rendered, document, text, examples, questions")
    .eq("text_version", version)
    .in("fetch_id", ids);
  return rows(kept, "fetch_text");
}

/** The text of reads with none kept: their payloads are downloaded, derived and kept. */
async function derive(client: TextClient, reads: readonly FetchRead[], version: string): Promise<(TextRow & { fetch_id: string })[]> {
  const fetched = await client
    .from<{ id: string; payload: unknown }>("fetches")
    .select("id, payload")
    .in("id", reads.map((read) => read.id));
  const payloads = new Map(rows(fetched, "fetches").map((row) => [row.id, row.payload]));
  const derived = reads.filter((read) => payloads.has(read.id)).map((r) => ({ fetch_id: r.id, scan_id: r.scan_id, text_version: version, ...textRowOf(r.source, payloads.get(r.id)) }));
  if (derived.length > 0) {
    // A row Postgres refuses is derived again next time; the text read now is the same.
    const wrote = await client.from("fetch_text").upsert(derived.map((row) => ({ ...row, computed_at: new Date().toISOString() })), { onConflict: "fetch_id" });
    if (wrote.error) console.warn(`text.ts: write to fetch_text failed: ${wrote.error.message}`);
  }
  return derived;
}

function batches<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += IDS) out.push(items.slice(i, i + IDS));
  return out;
}

/** The measured text of each read by fetch id, in the order given, null for
 *  a read that holds no document; or null when the kept text cannot be read
 *  in time, so the caller serves the payloads rather than an empty set. */
export async function storedText(client: TextClient, reads: readonly FetchRead[], version: string): Promise<Map<string, MeasuredText | null> | null> {
  const byId = new Map<string, TextRow>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const kept = Promise.all(batches(reads).map((batch) => keptRows(client, batch.map((read) => read.id), version)));
  kept.catch(() => {});
  try {
    const slow = new Promise<never>((_, reject) => (timer = setTimeout(reject, KEPT_MS, new Error(`no answer in ${KEPT_MS} ms`))));
    for (const batch of await Promise.race([kept, slow])) for (const row of batch) byId.set(row.fetch_id, row);
  } catch (error) {
    console.warn("text: stored read failed, served payloads", error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    clearTimeout(timer);
  }
  const missing = reads.filter((read) => !byId.has(read.id));
  for (const batch of await Promise.all(batches(missing).map((batch) => derive(client, batch, version)))) for (const row of batch) byId.set(row.fetch_id, row);
  const out = new Map<string, MeasuredText | null>();
  for (const read of reads) {
    const row = byId.get(read.id);
    out.set(read.id, row === undefined ? null : measuredTextOf(row));
  }
  return out;
}
