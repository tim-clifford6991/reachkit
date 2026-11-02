// tests/measure/domain/text.test.ts — BUILD §5
//
// `readMeasuredText` — the re-read of the bytes the measurement already
// bought (BUILD §6.5: "one `fetches` table is ledger + cache + raw
// store"). It fetches nothing, stores nothing, and returns each page's
// prose (`prose.ts`).
import "../../generate/env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbAdminMock } = vi.hoisted(() => ({ dbAdminMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbAdmin: dbAdminMock }));

import { dbAdmin } from "@/lib/db";
import { OWN_FETCH_SOURCE, RENDERED_FETCH_SOURCE, renderedDocumentOf, siteDocumentOf, toStoredDocument } from "../../../src/lib/measure/own-fetch.ts";
import { prose } from "../../../src/lib/measure/prose.ts";
import { readMeasuredText, type MeasuredText } from "../../../src/lib/measure/text.ts";

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
  site_id: string | null;
  domain?: string;
  tier?: string;
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
      not: () => self,
      is: () => self,
      then(resolve: (r: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
        if (a.error && a.error.table === table) {
          return Promise.resolve(resolve({ data: null, error: { message: a.error.message } }));
        }
        const rows = (table === "scans" ? a.scans : table === "fetches" ? a.fetches : []) as unknown as Record<string, unknown>[];
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

  it("it is three indexed reads — the site's scans, its domain's free scans, then their own-fetch rows", async () => {
    const { log } = useDb({
      scans: [{ id: "scan-1", site_id: SITE }],
      fetches: [{ scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/", HOME_HTML, READ_AT) }],
    });
    await readMeasuredText({ siteId: SITE });
    // select + eq(site_id), then select + eq(tier) + in(domain)
    expect(log.filter((entry) => entry.table === "scans")).toHaveLength(5);
    expect(log.filter((entry) => entry.table === "fetches").map((entry) => entry.method)).toEqual([
      "select(scan_id, source, payload)",
      "in(source)",
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

  it("a deep pass served from cache still reads the free scan that wrote the rows, and never another site's", async () => {
    // The paying path: a free scan (no site) read the pages, and the site's
    // deep pass minutes later was served them from cache, ledgering nothing.
    useDb({
      scans: [
        { id: "free-1", site_id: null, domain: "a.example", tier: "free" },
        { id: "deep-1", site_id: SITE, domain: "a.example", tier: "deep" },
        { id: "free-9", site_id: null, domain: "elsewhere.example", tier: "free" },
        { id: "scan-9", site_id: OTHER_SITE, domain: "a.example", tier: "deep" },
      ],
      fetches: [
        { scan_id: "free-1", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/", HOME_HTML, READ_AT) },
        { scan_id: "free-9", source: OWN_FETCH_SOURCE, payload: storedDocument("https://elsewhere.example/", "<p>No.</p>", READ_AT) },
        { scan_id: "scan-9", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/x", "<p>No.</p>", READ_AT) },
      ],
    });
    for (const scanId of [undefined, "deep-1"]) {
      const rows = await readMeasuredText({ siteId: SITE, scanId });
      expect(rows.map((row) => row.url)).toEqual(["https://a.example/"]);
    }
  });

  it("a pass measured again from cache reads the site's earlier pass of the same domain, and never another site's (issue 837)", async () => {
    useDb({
      scans: [
        { id: "deep-1", site_id: SITE, domain: "a.example", tier: "deep" },
        { id: "deep-2", site_id: SITE, domain: "a.example", tier: "deep" },
        { id: "old-domain", site_id: SITE, domain: "before.example", tier: "deep" },
        { id: "scan-9", site_id: OTHER_SITE, domain: "a.example", tier: "deep" },
      ],
      fetches: [
        { scan_id: "deep-1", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/", HOME_HTML, READ_AT) },
        { scan_id: "old-domain", source: OWN_FETCH_SOURCE, payload: storedDocument("https://before.example/", "<p>No.</p>", READ_AT) },
        { scan_id: "scan-9", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/x", "<p>No.</p>", READ_AT) },
      ],
    });
    const rows = await readMeasuredText({ siteId: SITE, scanId: "deep-2" });
    expect(rows.map((row) => row.url)).toEqual(["https://a.example/"]);
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

describe("issue 1374 — a site drawn by JavaScript is read back as a browser drew it", () => {
  const SHELL = '<html><body><div id="root"></div></body></html>';

  it("the rendered read stands beside the empty shell and says it is rendered; a later pass that holds only shells still reads it", async () => {
    useDb({
      scans: [
        { id: "scan-deep", site_id: SITE, domain: "a.example" },
        { id: "scan-weekly", site_id: SITE, domain: "a.example" },
      ],
      fetches: [
        { scan_id: "scan-deep", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/", SHELL, READ_AT) },
        { scan_id: "scan-deep", source: RENDERED_FETCH_SOURCE, payload: [storedDocument("https://a.example/", HOME_HTML, LATER)] },
        { scan_id: "scan-weekly", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/", SHELL, LATER) },
        // A rendered read that failed is a row with no document.
        { scan_id: "scan-deep", source: RENDERED_FETCH_SOURCE, payload: { vendorFailure: "timeout", endpoint: RENDERED_FETCH_SOURCE, billed: true } },
      ],
    });
    const all = await readMeasuredText({ siteId: SITE });
    expect(all.map((page) => [page.text === "", page.rendered ?? false])).toEqual([[true, false], [false, true], [true, false]]);
    expect(all[1]?.text).toContain("It reads the page & counts what is there.");

    const weekly = await readMeasuredText({ siteId: SITE, scanId: "scan-weekly" });
    expect(weekly.some((page) => page.rendered === true)).toBe(true);
  });
});

describe("#1130 — the re-read text is the page's prose, never its chrome or its example", () => {
  it("drops navigation, header, footer, buttons, hidden text and a card captioned as an example", async () => {
    const html = `<html><body>
      <header><nav><a href="/pricing">Pricing</a> <a href="/in">Sign in</a></nav></header>
      <main>
        <h1>How ReachKit measures a site</h1>
        <p>It reads the page &amp; counts what is there.</p>
        <div class="card"><div class="stat">Discoverability Score 62</div><p>An example business. It measures no site.</p></div>
        <button>Start free</button><span aria-hidden="true">decoration</span>
      </main>
      <footer>© ReachKit</footer>
    </body></html>`;
    useDb({
      scans: [{ id: "scan-1", site_id: SITE }],
      fetches: [{ scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/", html, READ_AT) }],
    });
    const rows = await readMeasuredText({ siteId: SITE });
    expect(only(rows).text).toBe("How ReachKit measures a site\nIt reads the page & counts what is there.");
  });
});

describe("every stored read is a page: re-reads, refusals and rendered reads, row for row", () => {
  const SITE_URL = "https://harborplumbing.example";
  const [T1, T2, T3] = ["2026-09-01", "2026-09-08", "2026-09-15"].map((day) => new Date(`${day}T08:00:00.000Z`)) as [Date, Date, Date];
  // Every page carries the same paragraph, which grounding's chrome threshold weighs against the row count.
  const page = (title: string, body: string) =>
    `<html><body><main><h1>${title}</h1><p>${body}</p><p>Call Harbor Plumbing any day of the week for a same-day visit from a licensed plumber.</p></main></body></html>`;
  const own = (scan: string, path: string, html: string, at: Date, status = 200): FetchRow => ({
    scan_id: scan,
    source: OWN_FETCH_SOURCE,
    payload: toStoredDocument({ ok: true, status, url: `${SITE_URL}${path}`, html, bytes: html.length, readAt: at, headers: { server: "nginx" } }),
  });
  const HOME = page("Harbor Plumbing in Austin", "We replace tankless water heaters in one day and quote the price before work starts.");
  const SHELL = '<html><body><div id="root"></div></body></html>';
  // A free scan, a deep pass and two weekly re-reads: repeated reads, a 403, a rate-limit body, an empty shell after real text.
  const SCANS: ScanRow[] = ["free-1", "deep-1", "week-1", "week-2"].map((id) => ({ id, site_id: id === "free-1" ? null : SITE, domain: "harborplumbing.example", tier: id === "free-1" ? "free" : "deep" }));
  const FETCHES: FetchRow[] = [
    own("free-1", "/", HOME, T1),
    own("week-1", "/", HOME, T2),
    own("week-2", "/", page("Harbor Plumbing in Austin", "Tankless water heaters replaced in one day, priced before we start."), T3),
    own("deep-1", "/services", page("Drain cleaning", "Every drain call includes a camera inspection so you see the blockage we clear."), T1),
    own("week-2", "/services", "<html><body>Forbidden</body></html>", T3, 403),
    own("deep-1", "/about", page("About Harbor", "The company was started by two licensed plumbers who grew up on the east side of town."), T1),
    own("week-2", "/about", "local_rate_limited", T3),
    own("deep-1", "/emergency", page("Emergency repairs", "A plumber reaches most Austin addresses within ninety minutes of your call."), T1),
    own("week-1", "/emergency", SHELL, T2),
    { scan_id: "week-1", source: RENDERED_FETCH_SOURCE, payload: [storedDocument(`${SITE_URL}/emergency`, page("Emergency repairs", "Burst pipe? A plumber reaches most Austin addresses within ninety minutes."), T2)] },
    { scan_id: "deep-1", source: RENDERED_FETCH_SOURCE, payload: { vendorFailure: "timeout", endpoint: RENDERED_FETCH_SOURCE, billed: true } },
    { scan_id: "deep-1", source: OWN_FETCH_SOURCE, payload: null },
  ];

  /** The reference, written out: every row whose document passes the check is a page. */
  const fullPayloadText = (rows: readonly FetchRow[]): MeasuredText[] =>
    rows
      .flatMap((row) => {
        const rendered = row.source === RENDERED_FETCH_SOURCE;
        const document = rendered ? renderedDocumentOf(row.payload) : siteDocumentOf(row.payload);
        const read = document === null ? null : prose(document.html);
        return document === null || read === null ? [] : [{ url: document.url, text: read.text, measuredAt: new Date(document.readAt), examples: read.examples, questions: read.questions, ...(rendered ? { rendered: true as const } : {}) }];
      })
      .sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime() || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));

  it("readMeasuredText keeps every re-read, skips each refused one and flags each rendered one", async () => {
    useDb({ scans: SCANS, fetches: FETCHES });
    const before = fullPayloadText(FETCHES);
    expect(before.filter((row) => row.url === `${SITE_URL}/`)).toHaveLength(3);
    expect(await readMeasuredText({ siteId: SITE })).toEqual(before);
  });

  it("readAllFacts quotes the same passages, pages and dates, with the same chrome threshold", async () => {
    useDb({ scans: SCANS, fetches: FETCHES });
    const now = await (await import("../../../src/lib/generate/pipeline/grounding")).readAllFacts({ siteId: SITE });
    vi.resetModules();
    vi.doMock("@/lib/measure/text", () => ({ readMeasuredText: async () => fullPayloadText(FETCHES) }));
    try {
      const before = await (await import("../../../src/lib/generate/pipeline/grounding")).readAllFacts({ siteId: SITE });
      expect(before.length).toBeGreaterThan(0);
      // Four of eight rows carry it: not over half, so it is quoted; counting each URL once would drop it.
      expect(now.some((fact) => fact.fact.passage.includes("same-day visit"))).toBe(true);
      expect(now).toEqual(before);
    } finally {
      vi.doUnmock("@/lib/measure/text");
      vi.resetModules();
    }
  });
});
