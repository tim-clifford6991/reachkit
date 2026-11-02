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
import { project } from "../../publish/select";
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
  id?: string;
  scan_id: string;
  source: string;
  payload: unknown;
}
interface QueryLog {
  table: string;
  method: string;
  /** The values of an `in` filter, so a pass's id count can be read. */
  values?: readonly string[];
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
    let selected = "";
    const self = {
      select(columns: string) {
        log.push({ table, method: `select(${columns})` });
        selected = columns;
        return self;
      },
      eq(column: string, value: unknown) {
        log.push({ table, method: `eq(${column})` });
        filters.push({ column, value });
        return self;
      },
      in(column: string, values: readonly string[]) {
        log.push({ table, method: `in(${column})`, values });
        inFilters.push({ column, values });
        return self;
      },
      not() {
        return self;
      },
      is() {
        return self;
      },
      then(resolve: (r: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
        if (a.error && a.error.table === table) {
          return Promise.resolve(resolve({ data: null, error: { message: a.error.message } }));
        }
        const rows = (
          table === "scans" ? [...a.scans] : table === "fetches" ? a.fetches.map((row, at) => ({ id: `fetch-${at}`, ...row })) : []
        ) as unknown as Record<string, unknown>[];
        const kept = rows.filter(
          (row) =>
            filters.every((f) => row[f.column] === f.value) &&
            inFilters.every((f) => f.values.includes(row[f.column] as string))
        );
        const shaped = kept.map((row) => project(selected, row));
        return Promise.resolve(resolve({ data: shaped, error: null }));
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

  it("it reads the site's scans, its domain's free scans, then each source's rows in a light pass and the chosen rows' text", async () => {
    const { log } = useDb({
      scans: [{ id: "scan-1", site_id: SITE }],
      fetches: [{ scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: storedDocument("https://a.example/", HOME_HTML, READ_AT) }],
    });
    await readMeasuredText({ siteId: SITE });
    // select + eq(site_id), then select + eq(tier) + in(domain)
    expect(log.filter((entry) => entry.table === "scans")).toHaveLength(5);
    expect(log.filter((entry) => entry.table === "fetches").map((entry) => entry.method)).toEqual([
      "select(id, url:payload->url, readAt:payload->readAt, status:payload->status)",
      "eq(source)",
      "in(scan_id)",
      "select(id, url:payload->url, status:payload->status, html:payload->html, readAt:payload->readAt, headers:payload->headers)",
      "in(id)",
      "select(id, url:payload->0->url, readAt:payload->0->readAt, status:payload->0->status)",
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
    // The weekly shell supersedes the deep pass's shell of the same URL; the rendered read stands beside it.
    expect(all.map((page) => [page.text === "", page.rendered ?? false])).toEqual([[true, false], [false, true]]);
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

describe("the read takes only the fields it uses, and each URL's newest usable read", () => {
  const SITE_URL = "https://harborplumbing.example";
  const T1 = new Date("2026-09-01T08:00:00.000Z");
  const T2 = new Date("2026-09-08T08:00:00.000Z");
  const T3 = new Date("2026-09-15T08:00:00.000Z");
  const page = (title: string, body: string) => `<html><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
  const HOME = page("Harbor Plumbing in Austin", "We replace tankless water heaters in one day and quote the price before work starts.");
  const SERVICES = page("Drain cleaning", "Every drain call includes a camera inspection so you see the blockage we clear.");
  const ABOUT = page("About Harbor", "The company was started by two licensed plumbers who grew up on the east side of town.");
  const RENDERED = page("Emergency repairs", "A plumber reaches most Austin addresses within ninety minutes of your call.");
  const SHELL = '<html><body><div id="root"></div></body></html>';
  const refused = (url: string, status: number, readAt: Date) =>
    toStoredDocument({ ok: true, status, url, html: "<html><body>Forbidden</body></html>", bytes: 40, readAt, headers: {} });

  /** A customer site read by its free scan, its deep pass and two weekly re-reads. */
  const SCANS: ScanRow[] = [
    { id: "free-1", site_id: null, domain: "harborplumbing.example", tier: "free" },
    { id: "deep-1", site_id: SITE, domain: "harborplumbing.example", tier: "deep" },
    { id: "week-1", site_id: SITE, domain: "harborplumbing.example", tier: "deep" },
    { id: "week-2", site_id: SITE, domain: "harborplumbing.example", tier: "deep" },
  ];
  const FETCHES: FetchRow[] = [
    { scan_id: "free-1", source: OWN_FETCH_SOURCE, payload: storedDocument(`${SITE_URL}/`, HOME, T1) },
    { scan_id: "week-1", source: OWN_FETCH_SOURCE, payload: storedDocument(`${SITE_URL}/`, HOME, T2) },
    { scan_id: "week-2", source: OWN_FETCH_SOURCE, payload: storedDocument(`${SITE_URL}/`, HOME, T3) },
    { scan_id: "deep-1", source: OWN_FETCH_SOURCE, payload: storedDocument(`${SITE_URL}/services`, SERVICES, T1) },
    { scan_id: "week-2", source: OWN_FETCH_SOURCE, payload: refused(`${SITE_URL}/services`, 403, T3) },
    { scan_id: "deep-1", source: OWN_FETCH_SOURCE, payload: storedDocument(`${SITE_URL}/about`, ABOUT, T1) },
    { scan_id: "week-2", source: OWN_FETCH_SOURCE, payload: storedDocument(`${SITE_URL}/about`, "local_rate_limited", T3) },
    { scan_id: "deep-1", source: OWN_FETCH_SOURCE, payload: storedDocument(`${SITE_URL}/emergency`, SHELL, T1) },
    { scan_id: "deep-1", source: RENDERED_FETCH_SOURCE, payload: [storedDocument(`${SITE_URL}/emergency`, RENDERED, T2)] },
    { scan_id: "deep-1", source: RENDERED_FETCH_SOURCE, payload: { vendorFailure: "timeout", endpoint: RENDERED_FETCH_SOURCE, billed: true } },
    { scan_id: "deep-1", source: OWN_FETCH_SOURCE, payload: null },
  ];
  const URLS = new Set(FETCHES.flatMap((row) => [siteDocumentOf(row.payload)?.url, renderedDocumentOf(row.payload)?.url]).filter(Boolean));

  /** The read before this change, kept as the reference: every row's whole payload, each one a page. */
  function fullPayloadText(rows: readonly FetchRow[]): MeasuredText[] {
    return rows
      .flatMap((row) => {
        const rendered = row.source === RENDERED_FETCH_SOURCE;
        const document = rendered ? renderedDocumentOf(row.payload) : siteDocumentOf(row.payload);
        if (document === null) return [];
        const read = prose(document.html);
        return [{ url: document.url, text: read.text, measuredAt: new Date(document.readAt), examples: read.examples, questions: read.questions, ...(rendered ? { rendered: true as const } : {}) }];
      })
      .sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime() || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  }

  it("(i) no select sent to `fetches` names the bare payload", async () => {
    const { log } = useDb({ scans: SCANS, fetches: FETCHES });
    await readMeasuredText({ siteId: SITE });
    const selects = log.filter((entry) => entry.table === "fetches" && entry.method.startsWith("select("));
    expect(selects.length).toBeGreaterThan(0);
    for (const entry of selects) {
      const columns = entry.method.slice("select(".length, -1).split(",").map((spec) => spec.trim().split(":").at(-1));
      expect(columns, entry.method).not.toContain("payload");
      expect(entry.method).not.toMatch(/bytes/);
    }
  });

  it("(ii) the text pass asks for at most one row per URL, however many re-reads there are", async () => {
    const { log } = useDb({ scans: SCANS, fetches: FETCHES });
    await readMeasuredText({ siteId: SITE });
    const textPasses = log.filter((entry) => entry.method === "in(id)");
    expect(textPasses.length).toBeGreaterThan(0);
    // The first text pass of each source; any later one is a fallback for a refused row.
    const firstOwn = textPasses[0]?.values ?? [];
    expect(firstOwn.length).toBeLessThanOrEqual(URLS.size);
    expect(new Set(firstOwn).size).toBe(firstOwn.length);
    const asked = textPasses.reduce((sum, entry) => sum + (entry.values?.length ?? 0), 0);
    expect(asked).toBeLessThan(FETCHES.length);
  });

  it("(iii) a 403 or a rate-limit answer on the newest read leaves the older good read's text", async () => {
    useDb({ scans: SCANS, fetches: FETCHES });
    const pages = await readMeasuredText({ siteId: SITE });
    const of = (path: string) => pages.filter((row) => row.url === `${SITE_URL}${path}`);
    expect(of("/services").map((row) => [row.measuredAt.toISOString(), row.text.includes("camera inspection")])).toEqual([[T1.toISOString(), true]]);
    expect(of("/about").map((row) => [row.measuredAt.toISOString(), row.text.includes("licensed plumbers")])).toEqual([[T1.toISOString(), true]]);
    expect(of("/").map((row) => row.measuredAt.toISOString())).toEqual([T3.toISOString()]);
  });

  it("(iv) a rendered read and an own read of the same URL both stand, the rendered one flagged", async () => {
    useDb({ scans: SCANS, fetches: FETCHES });
    const emergency = (await readMeasuredText({ siteId: SITE })).filter((row) => row.url === `${SITE_URL}/emergency`);
    expect(emergency.map((row) => [row.rendered ?? false, row.text.includes("ninety minutes")])).toEqual([
      [false, false],
      [true, true],
    ]);
  });

  it("each URL's newest usable read is today's read less the superseded ones", async () => {
    useDb({ scans: SCANS, fetches: FETCHES });
    const now = await readMeasuredText({ siteId: SITE });
    const before = fullPayloadText(FETCHES);
    const newest = (rows: MeasuredText[]) =>
      rows.filter((row) => !rows.some((other) => other.url === row.url && (other.rendered ?? false) === (row.rendered ?? false) && other.measuredAt > row.measuredAt));
    expect(now).toEqual(newest(before));
  });

  it("readAllFacts quotes the same passages, pages and dates through the new read as through the full-payload read", async () => {
    useDb({ scans: SCANS, fetches: FETCHES });
    const { readAllFacts } = await import("../../../src/lib/generate/pipeline/grounding");
    const now = await readAllFacts({ siteId: SITE });

    vi.resetModules();
    vi.doMock("@/lib/measure/text", () => ({ readMeasuredText: async () => fullPayloadText(FETCHES) }));
    try {
      const reference = await import("../../../src/lib/generate/pipeline/grounding");
      const before = await reference.readAllFacts({ siteId: SITE });
      expect(before.length).toBeGreaterThan(0);
      expect(now).toEqual(before);
    } finally {
      vi.doUnmock("@/lib/measure/text");
      vi.resetModules();
    }
  });

  it("a URL whose every read is refused has no page, and the fallback stops", async () => {
    const { log } = useDb({
      scans: [{ id: "scan-1", site_id: SITE }],
      fetches: [
        { scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: storedDocument(`${SITE_URL}/x`, "local_rate_limited", T1) },
        { scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: storedDocument(`${SITE_URL}/x`, "local_rate_limited", T2) },
        { scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: refused(`${SITE_URL}/x`, 429, T3) },
      ],
    });
    expect(await readMeasuredText({ siteId: SITE })).toEqual([]);
    // The 429 is never read for text; the two rate-limit bodies are read once each.
    expect(log.filter((entry) => entry.method === "in(id)").map((entry) => entry.values?.length)).toEqual([1, 1]);
  });
});
