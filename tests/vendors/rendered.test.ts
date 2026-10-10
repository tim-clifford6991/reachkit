// tests/vendors/rendered.test.ts — SPEC §6 (issue 1374): one page of a
// customer's site as a browser draws it.
//
// What the caller can observe: the page is drawn with JavaScript on and its
// HTML read back, as one ledgered call at the price book's figure; and a
// page that did not answer 200 is no document.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { envelope, fakeCostContext, setEnvFixture, stubVendorFetch } from "./harness";

let rendered: typeof import("../../src/lib/vendors/dataforseo/rendered.ts");
let constants: typeof import("../../src/lib/config/constants.ts");

beforeAll(async () => {
  setEnvFixture();
  rendered = await import("../../src/lib/vendors/dataforseo/rendered.ts");
  constants = await import("../../src/lib/config/constants.ts");
});
afterEach(() => vi.unstubAllGlobals());

const URL = "https://bakery.example/";
const HTML = '<html><body><div id="root"><h1>Bread since 1891</h1><a href="/news">News</a></div></body></html>';
const page = (status: number): unknown => envelope({ crawl_progress: "finished", items: [{ resource_type: "html", status_code: status, url: URL }] });

describe("a rendered read is the page's HTML after its scripts ran", () => {
  it("draws the page with JavaScript on, reads the HTML it kept, and ledgers one call", async () => {
    const stub = stubVendorFetch((request) =>
      request.url.endsWith("/raw_html") ? envelope({ crawl_progress: "finished", items: { html: HTML } }) : page(200)
    );
    const fake = fakeCostContext("DEEP");
    const read = await rendered.renderedPage(fake.ctx, { url: URL, freshnessDays: constants.CACHE_WINDOWS_D.own });

    expect(stub.requests.map((request) => request.url)).toEqual([
      "https://api.dataforseo.com/v3/on_page/instant_pages",
      "https://api.dataforseo.com/v3/on_page/raw_html",
    ]);
    // On-Page takes no country, no language and no depth.
    expect(stub.tasks).toEqual([
      { url: URL, enable_javascript: true, store_raw_html: true },
      { id: "task-id-fixture", url: URL },
    ]);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toMatchObject({ source: "on_page/instant_pages", cacheKey: URL, costCents: constants.PRICE_BOOK.RENDERED_PAGE_C });
    expect(read.kind === "measured" ? read.value : []).toMatchObject([{ url: URL, status: 200, html: HTML }]);
  });

  it("a page that answered 404 is no document, and its HTML is not asked for", async () => {
    const stub = stubVendorFetch(() => page(404));
    const read = await rendered.renderedPage(fakeCostContext("DEEP").ctx, { url: URL, freshnessDays: 7 });
    expect(read).toMatchObject({ kind: "zero", value: [] });
    expect(stub.requests).toHaveLength(2);
  });
});
