// tests/measure/domain/text-store.test.ts — a stored read's text, derived once
// from its payload and kept in `fetch_text`, reads back as the same
// `MeasuredText` the payload gives, and a read with no document is kept once
// and never downloaded again.
import { describe, expect, it } from "vitest";
import { OWN_FETCH_SOURCE, RENDERED_FETCH_SOURCE, toStoredDocument } from "../../../src/lib/measure/own-fetch.ts";
import { prose } from "../../../src/lib/measure/prose.ts";
import { storedText, type TextClient } from "../../../src/lib/measure/text-store.ts";

const SOURCES = [OWN_FETCH_SOURCE, RENDERED_FETCH_SOURCE];
const READ_AT = new Date("2026-09-05T09:30:00.123Z");
const HTML = "<html><body><nav>Menu</nav><h1>Plumbing in Leeds</h1><p>Call us &amp; we come the same day.</p><h2>Do you work weekends?</h2><p>Yes.</p></body></html>";
const SHELL = '<html><body><div id="root"></div></body></html>';

function payload(url: string, html: string): unknown {
  return toStoredDocument({ ok: true, status: 200, url, html, bytes: html.length, readAt: READ_AT, headers: {} });
}

type Row = Record<string, unknown>;

/** `fetches` and `fetch_text` in memory. A kept row goes through JSON, as a
 *  `text` and `jsonb` column does, and every request is logged. */
function store(fetches: Row[]) {
  const tables: Record<string, Row[]> = { fetches, fetch_text: [] };
  const log: string[] = [];
  const client = {
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      let columns = "";
      let wrote: Row[] | null = null;
      const self = {
        select(c: string) {
          columns = c;
          return self;
        },
        eq(column: string, value: string) {
          filters.push((row) => row[column] === value);
          return self;
        },
        in(column: string, values: readonly string[]) {
          if (values.length > 100) throw new Error("more than 100 ids in one filter");
          filters.push((row) => values.includes(row[column] as string));
          return self;
        },
        upsert(rows: readonly Row[]) {
          wrote = JSON.parse(JSON.stringify(rows)) as Row[];
          return self;
        },
        then(resolve: (r: { data: Row[] | null; error: null }) => unknown) {
          if (wrote !== null) {
            log.push(`upsert ${table} ${wrote.length}`);
            const ids = new Set(wrote.map((row) => row.fetch_id));
            tables[table] = [...(tables[table] ?? []).filter((row) => !ids.has(row.fetch_id)), ...wrote];
            return Promise.resolve(resolve({ data: null, error: null }));
          }
          log.push(`${table} ${columns}`);
          const data = (tables[table] ?? []).filter((row) => filters.every((f) => f(row)));
          return Promise.resolve(resolve({ data: data.map((row) => ({ ...row })), error: null }));
        },
      };
      return self;
    },
  };
  return { client: client as unknown as TextClient, tables, log };
}

const downloads = (log: readonly string[]) => log.filter((line) => line.includes("payload")).length;

describe("fetch_text: a read's text is derived once, kept, and read back the same", () => {
  it("derive → write → read gives the same MeasuredText, to the millisecond, for a served and a rendered read", async () => {
    const db = store([
      { id: "f-own", scan_id: "s1", source: OWN_FETCH_SOURCE, payload: payload("https://plumb.example/", HTML) },
      { id: "f-rendered", scan_id: "s1", source: RENDERED_FETCH_SOURCE, payload: [payload("https://plumb.example/app", HTML)] },
      { id: "f-other", scan_id: "s9", source: OWN_FETCH_SOURCE, payload: payload("https://elsewhere.example/", HTML) },
    ]);
    const read = prose(HTML);
    const expected = [
      { url: "https://plumb.example/", text: read.text, measuredAt: READ_AT, examples: read.examples, questions: read.questions },
      { url: "https://plumb.example/app", text: read.text, measuredAt: READ_AT, examples: read.examples, questions: read.questions, rendered: true },
    ];

    const derived = await storedText(db.client, ["s1"], SOURCES, "v1");
    expect(derived).toStrictEqual(expected);
    expect(db.tables.fetch_text?.map((row) => [row.fetch_id, row.text_version, row.document])).toEqual([
      ["f-own", "v1", true],
      ["f-rendered", "v1", true],
    ]);

    const before = downloads(db.log);
    const kept = await storedText(db.client, ["s1"], SOURCES, "v1");
    expect(kept).toStrictEqual(expected);
    expect(kept[0]?.measuredAt.getTime()).toBe(READ_AT.getTime());
    expect(downloads(db.log)).toBe(before);
    expect(db.log.slice(-2)).toEqual(["fetches id, scan_id, source", "fetch_text fetch_id, url, read_at, rendered, document, text, examples, questions"]);
  });

  it("a null or unreadable payload is kept once with document = false, returns nothing and is never downloaded again", async () => {
    const db = store([
      { id: "f-null", scan_id: "s1", source: OWN_FETCH_SOURCE, payload: null },
      { id: "f-junk", scan_id: "s1", source: RENDERED_FETCH_SOURCE, payload: { vendorFailure: "timeout", endpoint: RENDERED_FETCH_SOURCE, billed: true } },
    ]);
    expect(await storedText(db.client, ["s1"], SOURCES, "v1")).toEqual([]);
    expect(db.tables.fetch_text?.map((row) => [row.fetch_id, row.document, row.text, row.examples, row.questions])).toEqual([
      ["f-null", false, "", [], []],
      ["f-junk", false, "", [], []],
    ]);
    expect(downloads(db.log)).toBe(1);
    expect(await storedText(db.client, ["s1"], SOURCES, "v1")).toEqual([]);
    expect(downloads(db.log)).toBe(1);
  });

  it("a row kept at another text version is derived again and overwritten", async () => {
    const db = store([{ id: "f-own", scan_id: "s1", source: OWN_FETCH_SOURCE, payload: payload("https://plumb.example/", HTML) }]);
    db.tables.fetch_text = [{ fetch_id: "f-own", scan_id: "s1", text_version: "v0", url: "https://plumb.example/", read_at: READ_AT.toISOString(), rendered: false, document: true, text: "stale", examples: [], questions: [] }];
    const [page] = await storedText(db.client, ["s1"], SOURCES, "v1");
    expect(page?.text).toBe(prose(HTML).text);
    expect(db.tables.fetch_text.map((row) => [row.text_version, row.text])).toEqual([["v1", prose(HTML).text]]);
  });

  it("asks for at most 100 ids at a time and keeps the order fetches lists them in", async () => {
    const fetches = Array.from({ length: 230 }, (_, i) => ({ id: `f-${i}`, scan_id: "s1", source: OWN_FETCH_SOURCE, payload: i % 2 === 0 ? payload(`https://plumb.example/${229 - i}`, SHELL) : null }));
    const db = store(fetches);
    const pages = await storedText(db.client, ["s1"], SOURCES, "v1");
    expect(pages.map((page) => page.url)).toEqual(fetches.filter((_, i) => i % 2 === 0).map((row) => `https://plumb.example/${229 - Number(row.id.slice(2))}`));
    expect(db.log.filter((line) => line.startsWith("upsert"))).toEqual(["upsert fetch_text 100", "upsert fetch_text 100", "upsert fetch_text 30"]);
  });
});
