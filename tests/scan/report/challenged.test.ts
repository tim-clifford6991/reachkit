// Issue 1383 — a report stored before issue 1379 that was measured off a
// bot-protection page is re-scannable and reads as unmeasured, decided from
// the ledgered home document.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../run/harness";

type Row = Record<string, unknown>;
const tables: { scans: Row[]; fetches: Row[] } = { scans: [], fetches: [] };

/** The ledger as PostgREST answers it: `source`, `cache_key` and `id`
 *  filters, and the `alias:payload->field` columns of the light read. */
function builder(table: "scans" | "fetches") {
  let rows = tables[table];
  let columns = "";
  const self = {
    select(c: string) {
      columns = c;
      return self;
    },
    eq(column: string, value: unknown) {
      if (table === "fetches") rows = rows.filter((r) => r[column] === value);
      return self;
    },
    in(column: string, values: readonly unknown[]) {
      rows = rows.filter((r) => values.includes(r[column]));
      return self;
    },
    is: () => self,
    limit: () => self,
    then(resolve: (v: { data: Row[]; error: null }) => unknown) {
      const data =
        table === "fetches" && !columns.includes(", payload")
          ? rows.map((r) => {
              const p = r.payload as Row;
              return { ...r, payload: undefined, status: p.status, bytes: p.bytes, headers: p.headers ?? null, readAt: p.readAt };
            })
          : rows;
      return Promise.resolve({ data, error: null }).then(resolve);
    },
  };
  return self;
}

vi.mock("@/lib/db", () => ({ dbAdmin: () => ({ from: builder }), db: () => ({ from: builder }) }));

const { readCurrentReport } = await import("../../../src/lib/scan/report");
const { challengedHomes } = await import("../../../src/lib/scan/challenged");
const { assembleReport } = await import("../../../src/lib/scan/store");
const { fullSections, AT, DOMAIN } = await import("./fixtures");

const BLOCK_PAGE = readFileSync(new URL("../../measure/domain/fixtures/challenge/cloudflare-block.sage.com.html", import.meta.url), "utf8");
const SITE_PAGE = `<html><head><title>Example</title></head><body><h1>Accounting software</h1><p>${"Real words about the product. ".repeat(80)}</p></body></html>`;
const HOME = `https://${DOMAIN}/`;

function document(html: string, status: number): Row {
  return { url: HOME, status, html, bytes: html.length, readAt: AT.toISOString() };
}
function plainRead(html: string, status: number): Row {
  return { id: "plain", source: "egress.safeFetch", cache_key: HOME, created_at: "2026-09-05T10:00:01.000Z", payload: document(html, status) };
}
const RENDERED_SITE: Row = {
  id: "drawn",
  source: "on_page/instant_pages",
  cache_key: HOME,
  created_at: "2026-09-05T10:00:04.000Z",
  payload: [document(SITE_PAGE, 200)],
};

beforeEach(() => {
  tables.scans = [{ report: JSON.parse(JSON.stringify(assembleReport(fullSections({ siteIssues: { pagesChecked: 1, checkedPages: ["/"], stoppedBy: "complete", issues: [] } })))) }];
  tables.fetches = [];
});

describe("a stored report measured off a bot-protection page (issue 1383)", () => {
  it("reads as unmeasured and incomplete, so the re-scan window does not protect it", async () => {
    tables.fetches = [plainRead(BLOCK_PAGE, 403)];
    const report = await readCurrentReport(DOMAIN);
    if (report === null) throw new Error("unreachable");

    expect(report.complete).toBe(false);
    expect(report.onPage).toMatchObject({ kind: "unmeasured", because: "bot_protection" });
    expect(report.verdict.scoreAndBand.kind).toBe("unmeasured");
    expect(report.verdict.factors.foundations.kind).toBe("unmeasured");
    expect(report.verdict.factors.answerability.kind).toBe("unmeasured");
    expect(report.verdict.factors.presence.kind).toBe("measured");
    expect(report.verdict.missing.map((m) => m.factor)).toEqual(["foundations", "answerability"]);
    // No check read off a page is stated: each one could not run.
    const onPageChecks = (report.siteIssues?.issues ?? []).filter((issue) => issue.check !== "ai_readers_blocked");
    expect(onPageChecks.length).toBeGreaterThan(0);
    expect(onPageChecks.every((issue) => !issue.ran)).toBe(true);
  });

  it("leaves a report measured off the site's own page as it is stored", async () => {
    tables.fetches = [plainRead(SITE_PAGE, 200)];
    const report = await readCurrentReport(DOMAIN);
    expect(report?.complete).toBe(true);
    expect(report?.verdict.scoreAndBand).toMatchObject({ kind: "measured", value: { score: 31 } });
  });

  it("leaves a report the vendor's browser measured past the protection", async () => {
    tables.fetches = [plainRead(BLOCK_PAGE, 403), RENDERED_SITE];
    const report = await readCurrentReport(DOMAIN);
    expect(report?.complete).toBe(true);
    expect(report?.verdict.scoreAndBand.kind).toBe("measured");
  });

  it("judges the read the report was measured from, not an older one its scan's date falls after (issue 1392)", async () => {
    // The report is dated by its scan, a moment before the home page was
    // read; a protection's page read a week earlier is not its home.
    const scanAt = new Date(AT.getTime() - 2_000).toISOString();
    const stored = JSON.parse(JSON.stringify(tables.scans[0]!.report).replaceAll(AT.toISOString(), scanAt)) as { onPage: { at: string } };
    stored.onPage.at = AT.toISOString();
    tables.scans = [{ report: stored }];
    const weekBefore = new Date(AT.getTime() - 7 * 86_400_000).toISOString();
    tables.fetches = [
      { ...plainRead(BLOCK_PAGE, 403), id: "old", payload: { ...document(BLOCK_PAGE, 403), readAt: weekBefore } },
      plainRead(SITE_PAGE, 200),
    ];
    const report = await readCurrentReport(DOMAIN);
    expect(report?.complete).toBe(true);
    expect(report?.verdict.scoreAndBand.kind).toBe("measured");
  });

  it("names the gallery's challenged domains, and none whose home was read after the card's scan", async () => {
    tables.fetches = [plainRead(BLOCK_PAGE, 403)];
    expect([...(await challengedHomes([{ domain: DOMAIN, at: new Date(AT.getTime() + 60_000) }]))]).toEqual([DOMAIN]);
    expect([...(await challengedHomes([{ domain: DOMAIN, at: new Date(AT.getTime() - 60_000) }]))]).toEqual([]);
  });
});
