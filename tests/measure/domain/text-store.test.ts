// tests/measure/domain/text-store.test.ts — a read's text kept in `fetch_text` reads back as the payload's and is served in production.
import "../../generate/env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { dbAdminMock } = vi.hoisted(() => ({ dbAdminMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbAdmin: dbAdminMock }));

import { OWN_FETCH_SOURCE, RENDERED_FETCH_SOURCE, toStoredDocument } from "../../../src/lib/measure/own-fetch.ts";
import { prose } from "../../../src/lib/measure/prose.ts";
import { storedText as storedById, textRowOf, type FetchRead, type TextClient } from "../../../src/lib/measure/text-store.ts";
import { readDomainText } from "../../../src/lib/measure/text.ts";

const READ_AT = new Date("2026-09-05T09:30:00.123Z");
const HTML = "<html><body><nav>Menu</nav><h1>Plumbing in Leeds</h1><p>Call us &amp; we come the same day.</p><h2>Do you work weekends?</h2><p>Yes.</p></body></html>";
const SHELL = '<html><body><div id="root"></div></body></html>';

const payload = (url: string, html: string) => toStoredDocument({ ok: true, status: 200, url, html, bytes: html.length, readAt: READ_AT, headers: {} });

type Row = Record<string, unknown>;

/** `fetches` and `fetch_text` in memory. A kept row goes through JSON, as a
 *  `text` and `jsonb` column does, and every request is logged. */
function store(fetches: Row[], scans: Row[] = [], failing: Record<string, "down" | "hang"> = {}) {
  const tables: Record<string, Row[]> = { fetches, fetch_text: [], scans };
  const log: string[] = [];
  const ids: string[][] = [];
  const client = {
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      let columns = "";
      let wrote: Row[] | null = null;
      const self = {
        select: (c: string) => ((columns = c), self),
        eq: (column: string, value: string) => (filters.push((row) => row[column] === value), self),
        in(column: string, values: readonly string[]) {
          if (values.length > 100) throw new Error("more than 100 ids in one filter");
          if (table === "fetches" && column === "id") ids.push([...values]);
          filters.push((row) => values.includes(row[column] as string));
          return self;
        },
        upsert: (rows: readonly Row[]) => ((wrote = JSON.parse(JSON.stringify(rows)) as Row[]), self),
        then(resolve: (r: { data: Row[] | null; error: null }) => unknown) {
          if (wrote !== null) {
            log.push(`upsert ${table} ${wrote.length}`);
            const ids = new Set(wrote.map((row) => row.fetch_id));
            tables[table] = [...(tables[table] ?? []).filter((row) => !ids.has(row.fetch_id)), ...wrote];
            return Promise.resolve(resolve({ data: null, error: null }));
          }
          log.push(`${table} ${columns}`);
          if (failing[table] === "hang") return new Promise(() => {});
          if (failing[table] === "down") return Promise.resolve(resolve({ data: null, error: { message: "down" } } as never));
          const data = (tables[table] ?? []).filter((row) => filters.every((f) => f(row)));
          return Promise.resolve(resolve({ data: data.map((row) => ({ ...row })), error: null }));
        },
      };
      return self;
    },
  };
  return { client: client as unknown as TextClient, tables, log, ids };
}

const reads = (db: ReturnType<typeof store>) => (db.tables.fetches ?? []).filter((row) => row.scan_id === "s1") as unknown as FetchRead[];
const storedText = async (db: ReturnType<typeof store>, version: string) => [...((await storedById(db.client, reads(db), version)) ?? []).values()].filter((page) => page !== null);
const upserts = (log: readonly string[]) => log.filter((line) => line.startsWith("upsert")).length;

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

    const derived = await storedText(db, "v1");
    expect(derived).toStrictEqual(expected);
    expect(db.tables.fetch_text?.map((row) => [row.fetch_id, row.text_version, row.document])).toEqual([
      ["f-own", "v1", true],
      ["f-rendered", "v1", true],
    ]);

    expect(db.ids).toEqual([["f-own", "f-rendered"]]);

    const kept = await storedText(db, "v1");
    expect(kept).toStrictEqual(expected);
    expect(kept[0]?.measuredAt.getTime()).toBe(READ_AT.getTime());
    expect(upserts(db.log)).toBe(1);
    expect(db.ids).toHaveLength(1);
  });

  it("a null or unreadable payload is kept once with document = false and returns nothing", async () => {
    const db = store([
      { id: "f-null", scan_id: "s1", source: OWN_FETCH_SOURCE, payload: null },
      { id: "f-junk", scan_id: "s1", source: RENDERED_FETCH_SOURCE, payload: { vendorFailure: "timeout", endpoint: RENDERED_FETCH_SOURCE, billed: true } },
    ]);
    expect(await storedText(db, "v1")).toEqual([]);
    expect(db.tables.fetch_text?.map((row) => [row.fetch_id, row.document, row.text, row.examples, row.questions])).toEqual([
      ["f-null", false, "", [], []],
      ["f-junk", false, "", [], []],
    ]);
    expect(await storedText(db, "v1")).toEqual([]);
    expect(upserts(db.log)).toBe(1);
  });

  it("a row kept at another text version is derived again and overwritten", async () => {
    const db = store([{ id: "f-own", scan_id: "s1", source: OWN_FETCH_SOURCE, payload: payload("https://plumb.example/", HTML) }]);
    db.tables.fetch_text = [{ fetch_id: "f-own", scan_id: "s1", text_version: "v0", url: "https://plumb.example/", read_at: READ_AT.toISOString(), rendered: false, document: true, text: "stale", examples: [], questions: [] }];
    const [page] = await storedText(db, "v1");
    expect(page?.text).toBe(prose(HTML).text);
    expect(db.tables.fetch_text.map((row) => [row.text_version, row.text])).toEqual([["v1", prose(HTML).text]]);
  });

  it("asks for at most 100 ids at a time and keeps the order fetches lists them in", async () => {
    const fetches = Array.from({ length: 230 }, (_, i) => ({ id: `f-${i}`, scan_id: "s1", source: OWN_FETCH_SOURCE, payload: i % 2 === 0 ? payload(`https://plumb.example/${229 - i}`, SHELL) : null }));
    const db = store(fetches);
    const pages = await storedText(db, "v1");
    expect(pages.map((page) => page.url)).toEqual(fetches.filter((_, i) => i % 2 === 0).map((row) => `https://plumb.example/${229 - Number(row.id.slice(2))}`));
    expect(db.log.filter((line) => line.startsWith("upsert"))).toEqual(["upsert fetch_text 100", "upsert fetch_text 100", "upsert fetch_text 30"]);
  });
});

describe("production serves the kept text and downloads a payload only for a read not kept yet", () => {
  const FETCHES = () => [
    { id: "f-home", scan_id: "s1", source: OWN_FETCH_SOURCE, payload: payload("https://plumb.example/", HTML) },
    { id: "f-about", scan_id: "s1", source: OWN_FETCH_SOURCE, payload: payload("https://plumb.example/about", HTML) },
    { id: "f-null", scan_id: "s1", source: OWN_FETCH_SOURCE, payload: null },
  ];
  const SCANS = [{ id: "s1", tier: "free", domain: "plumb.example" }];

  const served = (db: ReturnType<typeof store>) => (dbAdminMock.mockReturnValue(db.client), readDomainText("plumb.example"));
  const payloadPath = (fetches: Row[]) => (vi.stubEnv("RK_TEXT_VERSION", ""), served(store(fetches, SCANS)));
  const fetchLines = (log: readonly string[]) => log.filter((line) => line.startsWith("fetches"));

  beforeEach(() => vi.stubEnv("VERCEL_ENV", "production"));
  afterEach(() => void (vi.useRealTimers(), vi.unstubAllEnvs(), vi.restoreAllMocks()));

  it("serves the stored text: lists fetches without payload, reads fetch_text once, downloads only the missing ids", async () => {
    vi.stubEnv("RK_TEXT_VERSION", "v1");
    const db = store(FETCHES(), SCANS);
    const home = { fetch_id: "f-home", scan_id: "s1", text_version: "v1", ...textRowOf(OWN_FETCH_SOURCE, FETCHES()[0]?.payload) };
    db.tables.fetch_text = [home];
    await served(db);
    expect(fetchLines(db.log)).toEqual(["fetches id, scan_id, source", "fetches id, payload"]);
    expect(db.log.filter((line) => line.startsWith("fetch_text"))).toHaveLength(1);
    expect(db.ids).toEqual([["f-about", "f-null"]]);

    db.log.length = 0;
    await served(db);
    expect(fetchLines(db.log)).toEqual(["fetches id, scan_id, source"]);
    expect(db.log.filter((line) => line.startsWith("fetch_text"))).toHaveLength(1);
    expect(db.ids).toHaveLength(1);
  });

  it("serves exactly what the payload path serves, on the first read and the kept one", async () => {
    const fixtures: Row[][] = [
      [{ id: "f-own", scan_id: "s1", source: OWN_FETCH_SOURCE, payload: payload("https://plumb.example/", HTML) }],
      [{ id: "f-rendered", scan_id: "s1", source: RENDERED_FETCH_SOURCE, payload: [payload("https://plumb.example/app", HTML)] }],
      [{ id: "f-null", scan_id: "s1", source: OWN_FETCH_SOURCE, payload: null }, ...FETCHES()],
      [{ id: "f-junk", scan_id: "s1", source: RENDERED_FETCH_SOURCE, payload: { vendorFailure: "timeout", endpoint: RENDERED_FETCH_SOURCE, billed: true } }, ...FETCHES()],
      Array.from({ length: 230 }, (_, i) => ({ id: `f-${i}`, scan_id: "s1", source: i % 3 === 0 ? RENDERED_FETCH_SOURCE : OWN_FETCH_SOURCE, payload: i % 5 === 0 ? null : i % 3 === 0 ? [payload(`https://plumb.example/${i % 7}`, HTML)] : payload(`https://plumb.example/${i % 7}`, i % 2 ? HTML : SHELL) })),
    ];
    for (const fetches of fixtures) {
      const expected = await payloadPath(fetches);
      vi.stubEnv("RK_TEXT_VERSION", "v1");
      const db = store(fetches, SCANS);
      expect(await served(db)).toStrictEqual(expected);
      expect(await served(db)).toStrictEqual(expected);
      expect(db.ids.flat()).toHaveLength(fetches.length);
    }
  });

  it("serves the payload path, never an empty set, when the fetch_text read fails or outlasts its 1.5 s", async () => {
    const expected = await payloadPath(FETCHES());
    expect(expected).toHaveLength(2);
    vi.stubEnv("RK_TEXT_VERSION", "v1");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await served(store(FETCHES(), SCANS, { fetch_text: "down" }))).toStrictEqual(expected);
    expect(warn.mock.calls).toEqual([["text: stored read failed, served payloads", "text.ts: read from fetch_text failed: down"]]);

    vi.useFakeTimers();
    const db = store(FETCHES(), SCANS, { fetch_text: "hang" });
    const hanging = served(db);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await hanging).toStrictEqual(expected);
    expect(fetchLines(db.log)).toEqual(["fetches id, scan_id, source", "fetches id, scan_id, source, payload"]);
  });

  it("dev and preview, which share production's database, never read or write fetch_text", async () => {
    vi.stubEnv("RK_TEXT_VERSION", "v1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    for (const env of ["development", "preview"]) {
      vi.stubEnv("VERCEL_ENV", env);
      const db = store(FETCHES(), SCANS);
      await served(db);
      expect(db.log.filter((line) => line.includes("fetch_text"))).toEqual([]);
    }
    expect(info).not.toHaveBeenCalled();
  });
});
