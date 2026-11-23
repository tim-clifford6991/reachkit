// src/lib/measure/text-store.ts — one stored page read's text, derived once
// from its payload as the read is written and kept in `fetch_text`, so a
// reader never downloads a payload.
import { OWN_FETCH_SOURCE, RENDERED_FETCH_SOURCE, renderedDocumentOf, siteDocumentOf } from "./own-fetch";
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

// `fetch_text` is outside the generated `Database` type; this is the cast boundary.
interface Result<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface Query<T> extends PromiseLike<Result<T>> {
  select(columns: string): Query<T>;
  eq(column: string, value: string): Query<T>;
  in(column: string, values: readonly string[]): Query<T>;
  upsert(rows: readonly Record<string, unknown>[], options: { onConflict: string; ignoreDuplicates?: boolean }): Query<T>;
}
export interface TextClient {
  from<T>(table: string): Query<T>;
}

// Ids per `in` filter, so a long read history never outgrows a request's address.
const IDS = 100;

/** A `fetches` row as listed, without its payload. */
export interface FetchRead {
  id: string;
  scan_id: string;
  source: string;
}

/** Keeps the text of one own or rendered page read as it is written, so no reader ever downloads its payload.
 *  Never throws: the `fetches` row is the ledger and stands either way. */
export async function keepText(client: TextClient, read: FetchRead, payload: unknown, version: string): Promise<void> {
  if (read.source !== OWN_FETCH_SOURCE && read.source !== RENDERED_FETCH_SOURCE) return;
  try {
    const row = { fetch_id: read.id, scan_id: read.scan_id, text_version: version, computed_at: new Date().toISOString(), ...textRowOf(read.source, payload) };
    const wrote = await client.from("fetch_text").upsert([row], { onConflict: "fetch_id", ignoreDuplicates: true });
    if (wrote.error) throw new Error(wrote.error.message);
  } catch (error) {
    console.warn(JSON.stringify({ event: "fetch_text_unkept", fetchId: read.id, message: error instanceof Error ? error.message : String(error) }));
  }
}

/** The measured text of each read by fetch id, in the order given, null for a read that holds no document or has
 *  no text kept. Only `fetch_text` is read, by key and at most `IDS` keys a request: a payload is never selected. */
export async function storedText(client: TextClient, reads: readonly FetchRead[]): Promise<Map<string, MeasuredText | null>> {
  const byId = new Map<string, TextRow>();
  const ask = async (ids: readonly string[]) => {
    const kept = await client.from<TextRow & { fetch_id: string }>("fetch_text").select("fetch_id, url, read_at, rendered, document, text, examples, questions").in("fetch_id", ids);
    if (kept.error) throw new Error(`text.ts: read from fetch_text failed: ${kept.error.message}`);
    return kept.data ?? [];
  };
  const ids = reads.map((read) => read.id);
  const asks: Promise<(TextRow & { fetch_id: string })[]>[] = [];
  for (let i = 0; i < ids.length; i += IDS) asks.push(ask(ids.slice(i, i + IDS)));
  for (const batch of await Promise.all(asks)) for (const row of batch) byId.set(row.fetch_id, row);
  // A read written before its text was kept is left out until the html prune keeps it.
  if (byId.size < reads.length) console.warn(JSON.stringify({ event: "measured_text_unkept", reads: reads.length, unkept: reads.length - byId.size }));
  const out = new Map<string, MeasuredText | null>();
  for (const read of reads) {
    const row = byId.get(read.id);
    out.set(read.id, row === undefined ? null : measuredTextOf(row));
  }
  return out;
}
