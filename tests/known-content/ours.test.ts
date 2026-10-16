// SPEC §5 (2026-10-15, issue 1456) — facts never come from a page ReachKit
// wrote.
//
// Found on Settings › Your business: *Facts we can quote* listed passages
// off blog posts ReachKit had published on the customer's own domain. The
// readers of facts now read the customer's pages only, and these cases are
// what "a page ReachKit wrote" means: any address a publication was
// delivered at, however the crawl spells it, and anything on the host the
// site's hosted destination serves.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ dbAdmin: vi.fn() }));

import { dbAdmin } from "@/lib/db";
import { isOurPage, readOurPages } from "@/lib/known-content/ours";
import { OWN_FETCH_SOURCE, toStoredDocument } from "../../src/lib/measure/own-fetch.ts";
import { readMeasuredText } from "../../src/lib/measure/text.ts";

const SITE = "site-1";
const READ_AT = new Date("2026-10-14T09:00:00.000Z");

type Row = Record<string, unknown>;

/** Every table the read touches, answering only the rows its filters keep. */
function useDb(tables: Record<string, Row[]>): void {
  const from = (table: string) => {
    const keep: ((row: Row) => boolean)[] = [];
    const self = {
      select: () => self,
      eq: (column: string, value: unknown) => (keep.push((row) => row[column] === value), self),
      in: (column: string, values: readonly unknown[]) => (keep.push((row) => values.includes(row[column])), self),
      is: (column: string, value: unknown) => (keep.push((row) => row[column] === value), self),
      not: (column: string, _op: string, value: unknown) => (keep.push((row) => row[column] !== value), self),
      then: (resolve: (r: { data: Row[]; error: null }) => unknown) =>
        Promise.resolve(resolve({ data: (tables[table] ?? []).filter((row) => keep.every((test) => test(row))), error: null })),
    };
    return self;
  };
  vi.mocked(dbAdmin).mockReturnValue({ from } as unknown as ReturnType<typeof dbAdmin>);
}

function page(url: string, sentence: string): Row {
  const html = `<html><body><main><p>${sentence}</p></main></body></html>`;
  return {
    scan_id: "scan-1",
    source: OWN_FETCH_SOURCE,
    payload: toStoredDocument({ ok: true, status: 200, url, html, bytes: html.length, readAt: READ_AT, headers: {} }),
  };
}

const TABLES = {
  sites: [{ id: SITE, domain: "acme.example" }],
  scans: [{ id: "scan-1", site_id: SITE, domain: "acme.example", tier: "deep" }],
  publications: [
    { site_id: SITE, live_url: "https://acme.example/blog/winter-care" },
    { site_id: SITE, live_url: null },
  ],
  destinations: [{ site_id: SITE, kind: "hosted", hostname: "content.acme.example", deleted_at: null }],
  fetches: [
    page("https://acme.example/pricing", "A basic service is $85 and takes about two hours."),
    page("https://www.acme.example/blog/winter-care/?utm=feed", "Winter salt eats a chain in about six weeks."),
    page("https://content.acme.example/choosing-a-commuter-bike", "A commuter bike wants mudguards before it wants gears."),
  ],
};

beforeEach(() => {
  vi.mocked(dbAdmin).mockReset();
});

describe("issue 1456 — a reader of facts reads the customer's pages only", () => {
  it("leaves out a published post, however it is spelled, and every page on the hosted host", async () => {
    useDb(TABLES);
    const theirs = await readMeasuredText({ siteId: SITE, customerOnly: true });
    expect(theirs.map((read) => read.url)).toEqual(["https://acme.example/pricing"]);
  });

  it("a measurement still reads every page on the site, ours included", async () => {
    useDb(TABLES);
    expect(await readMeasuredText({ siteId: SITE })).toHaveLength(3);
  });

  it("a `www` hosted label never makes the customer's own site ours", async () => {
    useDb({ ...TABLES, destinations: [{ site_id: SITE, kind: "hosted", hostname: "www.acme.example", deleted_at: null }] });
    const ours = await readOurPages({ domain: "acme.example" });
    expect(isOurPage(ours, "https://acme.example/pricing")).toBe(false);
    expect(isOurPage(ours, "https://acme.example/blog/winter-care")).toBe(true);
  });

  it("a removed hosted destination no longer claims its host; a page published there is still ours", async () => {
    useDb({
      ...TABLES,
      publications: [{ site_id: SITE, live_url: "https://content.acme.example/old-post" }],
      destinations: [{ site_id: SITE, kind: "hosted", hostname: "content.acme.example", deleted_at: "2026-10-01" }],
    });
    const ours = await readOurPages({ siteId: SITE });
    expect(isOurPage(ours, "https://content.acme.example/old-post")).toBe(true);
    expect(isOurPage(ours, "https://content.acme.example/their-own-page")).toBe(false);
  });
});
