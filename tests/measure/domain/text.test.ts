// tests/measure/domain/text.test.ts — BUILD §5
//
// `readMeasuredText` — the re-read of the bytes the measurement already
// bought (BUILD §6.5: "one `fetches` table is ledger + cache + raw
// store"). It fetches nothing, stores nothing and extracts with
// `parse.ts`'s own `visibleText`, so the text handed to generation cannot
// disagree with the text the page was scored on.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  dbAdmin: vi.fn(),
}));

import { dbAdmin } from "@/lib/db";
import { visibleText } from "../../../src/lib/measure/parse.ts";
import { OWN_FETCH_SOURCE, toStoredDocument } from "../../../src/lib/measure/own-fetch.ts";
import { readMeasuredText } from "../../../src/lib/measure/text.ts";

const SOURCE_PATH = path.resolve(import.meta.dirname, "../../../src/lib/measure/text.ts");
const SOURCE = readFileSync(SOURCE_PATH, "utf8");
const CODE_ONLY = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const SITE = "site-1";
const OTHER_SITE = "site-2";
const READ_AT = new Date("2026-09-05T09:30:00.000Z");
const LATER = new Date("2026-09-05T10:00:00.000Z");

const HOME_HTML = `
  <html><head><style>.a{color:red}</style></head><body>
    <script>console.log("not visible")</script>
    <h1>How ReachKit measures a site</h1>
    <p>It reads the page &amp; counts what is there.</p>
  </body></html>
`;

function storedDocument(url: string, html: string, readAt: Date): unknown {
  return toStoredDocument({ ok: true, status: 200, url, html, bytes: html.length, readAt, headers: {} });
}

interface ScanRow {
  id: string;
  site_id: string;
}
interface FetchRow {
  scan_id: string;
  source: string;
  payload: unknown;
}
interface QueryLog {
  table: string;
  method: string;
}

/** A chainable double of the two reads this module makes, recording every
 *  method called on it so "reads only" can be asserted rather than assumed.
 *  Any write method is deliberately absent: calling one is a TypeError the
 *  test would surface. */
function fakeDb(a: { scans: ScanRow[]; fetches: FetchRow[]; error?: { table: string; message: string } }) {
  const log: QueryLog[] = [];

  function builder(table: string) {
    const filters: { column: string; value: unknown }[] = [];
    const inFilters: { column: string; values: readonly string[] }[] = [];
    const self = {
      select(columns: string) {
        log.push({ table, method: `select(${columns})` });
        return self;
      },
      eq(column: string, value: unknown) {
        log.push({ table, method: `eq(${column})` });
        filters.push({ column, value });
        return self;
      },
      in(column: string, values: readonly string[]) {
        log.push({ table, method: `in(${column})` });
        inFilters.push({ column, values });
        return self;
      },
      then(resolve: (r: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
        if (a.error && a.error.table === table) {
          return Promise.resolve(resolve({ data: null, error: { message: a.error.message } }));
        }
        const rows = (table === "scans" ? [...a.scans] : [...a.fetches]) as unknown as Record<string, unknown>[];
        const kept = rows.filter(
          (row) =>
            filters.every((f) => row[f.column] === f.value) &&
            inFilters.every((f) => f.values.includes(row[f.column] as string))
        );
        return Promise.resolve(resolve({ data: kept, error: null }));
      },
    };
    return self;
  }

  return { client: { from: (table: string) => builder(table) }, log };
}

/** `rows[0]` under `noUncheckedIndexedAccess` — asserts the row is there
 *  rather than silently reading `undefined`. */
function only<T>(rows: readonly T[]): T {
  expect(rows).not.toHaveLength(0);
  return rows[0] as T;
}

function useDb(a: Parameters<typeof fakeDb>[0]): { log: QueryLog[] } {
  const { client, log } = fakeDb(a);
  vi.mocked(dbAdmin).mockReturnValue(client as unknown as ReturnType<typeof dbAdmin>);
  return { log };
}

beforeEach(() => {
  vi.mocked(dbAdmin).mockReset();
});

describe('BP-010 decision 4 — "Nothing new is stored: BP-007\'s `fetches` row already holds the payload … and this function is the read of it keyed by the site\'s scans"', () => {
  it("the re-read fetches nothing and stores nothing", async () => {
    expect(CODE_ONLY).not.toMatch(/\bfetch\s*\(/);
    expect(CODE_ONLY).not.toMatch(/safeFetch/);
    expect(CODE_ONLY).not.toMatch(/@\/lib\/(egress|vendors)/);
    expect(CODE_ONLY).not.toMatch(/\.(insert|update|upsert|delete)\s*\(/);

    const { log } = useDb({
      scans: [{ id: "scan-1", site_id: SITE }],
      fetches: [{ scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/", HOME_HTML, READ_AT) }],
    });
    await readMeasuredText({ siteId: SITE });
    expect(log.map((entry) => entry.method).every((method) => /^(select|eq|in)\(/.test(method))).toBe(true);
  });

  it("it is two indexed reads — the site's scans, then their own-fetch rows", async () => {
    const { log } = useDb({
      scans: [{ id: "scan-1", site_id: SITE }],
      fetches: [{ scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/", HOME_HTML, READ_AT) }],
    });
    await readMeasuredText({ siteId: SITE });
    expect(log.filter((entry) => entry.table === "scans")).toHaveLength(2); // select + eq(site_id)
    expect(log.filter((entry) => entry.table === "fetches").map((entry) => entry.method)).toEqual([
      "select(scan_id, payload)",
      "eq(source)",
      "in(scan_id)",
    ]);
  });
});

describe('BP-010 decision 4 `## Consequences` — "the comparison set reaches back only as far as the `fetches` rows for the site\'s scans"', () => {
  const SCANS: ScanRow[] = [
    { id: "scan-1", site_id: SITE },
    { id: "scan-2", site_id: SITE },
    { id: "scan-9", site_id: OTHER_SITE },
  ];
  const FETCHES: FetchRow[] = [
    { scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/", HOME_HTML, READ_AT) },
    { scan_id: "scan-2", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/pricing", "<p>Twelve pounds.</p>", LATER) },
    { scan_id: "scan-9", source: OWN_FETCH_SOURCE, payload: storedDocument("https://elsewhere.example/", "<p>Not ours.</p>", READ_AT) },
  ];

  it("the horizon is the site's own scans", async () => {
    useDb({ scans: SCANS, fetches: FETCHES });
    const rows = await readMeasuredText({ siteId: SITE });
    expect(rows.map((row) => row.url)).toEqual(["https://a.example/", "https://a.example/pricing"]);
  });

  it("`scanId` narrows to that one scan", async () => {
    useDb({ scans: SCANS, fetches: FETCHES });
    const rows = await readMeasuredText({ siteId: SITE, scanId: "scan-2" });
    expect(rows.map((row) => row.url)).toEqual(["https://a.example/pricing"]);
    expect(only(rows).measuredAt.toISOString()).toBe(LATER.toISOString());
  });

  it("a site with no scans returns `[]` — a legitimate empty, not an error", async () => {
    useDb({ scans: [], fetches: FETCHES });
    await expect(readMeasuredText({ siteId: "site-with-nothing" })).resolves.toEqual([]);
  });

  it("a ledgered failed read contributes no text and is never thrown on", async () => {
    useDb({
      scans: [{ id: "scan-1", site_id: SITE }],
      fetches: [
        { scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: null },
        { scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: { url: "https://a.example/", status: 200 } },
        { scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/", HOME_HTML, READ_AT) },
      ],
    });
    const rows = await readMeasuredText({ siteId: SITE });
    expect(rows).toHaveLength(1);
  });

  it("the order is fixed and locale-free — by read date, then by URL", async () => {
    useDb({
      scans: [{ id: "scan-1", site_id: SITE }],
      fetches: [
        { scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/z", "<p>z</p>", LATER) },
        { scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/b", "<p>b</p>", READ_AT) },
        { scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/a", "<p>a</p>", READ_AT) },
      ],
    });
    const rows = await readMeasuredText({ siteId: SITE });
    expect(rows.map((row) => row.url)).toEqual(["https://a.example/a", "https://a.example/b", "https://a.example/z"]);
  });

  it("a read that fails says which read failed rather than returning an empty comparison set", async () => {
    useDb({ scans: [], fetches: [], error: { table: "scans", message: "boom" } });
    await expect(readMeasuredText({ siteId: SITE })).rejects.toThrow(/read from scans failed: boom/);

    useDb({
      scans: [{ id: "scan-1", site_id: SITE }],
      fetches: [],
      error: { table: "fetches", message: "kaboom" },
    });
    await expect(readMeasuredText({ siteId: SITE })).rejects.toThrow(/read from fetches failed: kaboom/);
  });
});

describe('BP-010 decision 4 `## Alternatives considered` — a fresh fetch at generation "can disagree with the measurement the page was derived from"', () => {
  it("the re-read text is the text the measurement was taken from", async () => {
    useDb({
      scans: [{ id: "scan-1", site_id: SITE }],
      fetches: [{ scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/", HOME_HTML, READ_AT) }],
    });
    const rows = await readMeasuredText({ siteId: SITE });
    expect(only(rows).text).toBe(visibleText(HOME_HTML));
    // Neither the stylesheet nor the script survives the extractor.
    expect(only(rows).text).not.toMatch(/not visible|color:red/);
  });

  it("`text.ts` declares no extractor of its own — it imports `visibleText`", () => {
    expect(CODE_ONLY).toMatch(/import \{ visibleText \} from "\.\/parse"/);
    expect(CODE_ONLY).not.toMatch(/replace\(\/</);
  });
});
