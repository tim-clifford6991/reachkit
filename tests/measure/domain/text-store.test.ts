// tests/measure/domain/text-store.test.ts — a stored read's text, derived once
// from its payload and kept in `fetch_text`, reads back as the same
// `MeasuredText` the payload gives, and a read with no document is kept once
// and never downloaded again.
import "../../generate/env";
import { afterEach, describe, expect, it, vi } from "vitest";

const { dbAdminMock } = vi.hoisted(() => ({ dbAdminMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbAdmin: dbAdminMock }));

import { OWN_FETCH_SOURCE, RENDERED_FETCH_SOURCE, toStoredDocument } from "../../../src/lib/measure/own-fetch.ts";
import { prose } from "../../../src/lib/measure/prose.ts";
import { storedText as storedById, type TextClient } from "../../../src/lib/measure/text-store.ts";
import { readDomainText } from "../../../src/lib/measure/text.ts";

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
function store(fetches: Row[], scans: Row[] = [], failing: readonly string[] = []) {
  const tables: Record<string, Row[]> = { fetches, fetch_text: [], scans };
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
          if (failing.includes(table)) return Promise.resolve(resolve({ data: null, error: { message: "down" } } as never));
          const data = (tables[table] ?? []).filter((row) => filters.every((f) => f(row)));
          return Promise.resolve(resolve({ data: data.map((row) => ({ ...row })), error: null }));
        },
      };
      return self;
    },
  };
  return { client: client as unknown as TextClient, tables, log };
}

const storedText = async (...args: Parameters<typeof storedById>) => [...(await storedById(...args)).values()].filter((page) => page !== null);

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

describe("shadow parity: the payload text is served, the stored text is only compared", () => {
  const FETCHES = () => [
    { id: "f-home", scan_id: "s1", source: OWN_FETCH_SOURCE, payload: payload("https://plumb.example/", HTML) },
    { id: "f-about", scan_id: "s1", source: OWN_FETCH_SOURCE, payload: payload("https://plumb.example/about", HTML) },
    { id: "f-null", scan_id: "s1", source: OWN_FETCH_SOURCE, payload: null },
  ];
  const SCANS = [{ id: "s1", tier: "free", domain: "plumb.example" }];
  const stale = { fetch_id: "f-about", scan_id: "s1", text_version: "v1", url: "https://plumb.example/about", read_at: READ_AT.toISOString(), rendered: false, document: true, text: "stale", examples: [], questions: [] };

  const served = (db: ReturnType<typeof store>) => (dbAdminMock.mockReturnValue(db.client), readDomainText("plumb.example"));

  afterEach(() => void (vi.unstubAllEnvs(), vi.restoreAllMocks()));

  it("serves exactly the payload path's text when the stored rows differ and when the stored read fails", async () => {
    vi.stubEnv("RK_TEXT_VERSION", "");
    const payloadPath = await served(store(FETCHES(), SCANS));
    expect(payloadPath.map((page) => page.url)).toEqual(["https://plumb.example/", "https://plumb.example/about"]);

    vi.stubEnv("RK_TEXT_VERSION", "v1");
    vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const differing = store(FETCHES(), SCANS);
    differing.tables.fetch_text = [stale];
    expect(await served(differing)).toStrictEqual(payloadPath);
    expect(await served(store(FETCHES(), SCANS, ["fetch_text"]))).toStrictEqual(payloadPath);
    expect(warn).toHaveBeenCalledWith("text parity: shadow read failed: text.ts: read from fetch_text failed: down");
  });

  it("logs one line per read that counts each matching and mismatching fetch and names the first mismatch", async () => {
    vi.stubEnv("RK_TEXT_VERSION", "v1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const db = store(FETCHES(), SCANS);
    await served(db);
    db.tables.fetch_text = (db.tables.fetch_text ?? []).map((row) => (row.fetch_id === "f-about" ? stale : row));
    await served(db);
    expect(info.mock.calls).toEqual([["text parity: match=3 mismatch=0"], ["text parity: match=2 mismatch=1 first=f-about"]]);
  });
});
