// tests/generate/rules/demo-chrome.test.ts — SPEC §7 (D41 stage 4; owner
// R-B 2026-10-31): the site's menus are not demo text; its demo phrases are.
import "../env";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ dbAdmin: vi.fn() }));

import { dbAdmin } from "@/lib/db";
import fixture from "../fixtures/dogfood-stopped-2026-10.json";
import { readDemoPhrases } from "../../../src/lib/generate/pipeline/grounding";
import { checkDemoText } from "../../../src/lib/generate/rules/demo";
import { OWN_FETCH_SOURCE, toStoredDocument } from "../../../src/lib/measure/own-fetch";

const DEMO = "Demo data · An example business";
// The real menu lines in the page's chrome, beside one demo widget in its body.
const html = [
  "<html><body><header><nav><ul>",
  ...fixture.menus.map((line) => `<li><a href="/">${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</a></li>`),
  "</ul></nav></header><main><h1>The product</h1><p>What the business says.</p>",
  `<section><p>${DEMO}</p></section></main><footer><a href="/">How it works</a></footer></body></html>`,
].join("\n");

function storedSite(): void {
  const rows = {
    scans: [{ id: "scan-1", domain: "reachkit.app" }],
    fetches: [{ scan_id: "scan-1", source: OWN_FETCH_SOURCE, payload: toStoredDocument({ ok: true, status: 200, url: "https://reachkit.app/", html, bytes: html.length, readAt: new Date("2026-10-31T09:00:00Z"), headers: {} }) }],
  };
  const query = (table: keyof typeof rows) => {
    const self = { select: () => self, eq: () => self, in: () => self, then: (resolve: (r: unknown) => unknown) => Promise.resolve(resolve({ data: rows[table], error: null })) };
    return self;
  };
  vi.mocked(dbAdmin).mockReturnValue({ from: query } as unknown as ReturnType<typeof dbAdmin>);
}

const page = (line: string): string => ["The opening paragraph answers the question.", "", line, "", "A paragraph of the page's own words."].join("\n");

describe("no_demo_text reads the site's demo phrases and not its menus", () => {
  it.each(fixture.noDemoTextFailures.map((failure) => failure.markdown))("“%s”, a line of the site's menus, no longer stops the page", async (markdown) => {
    storedSite();
    const phrases = await readDemoPhrases({ siteId: "site-1" });
    expect(checkDemoText({ markdown: page(markdown), phrases })).toBeNull();
  });

  it("a menu line written as a paragraph of the page's own no longer stops it", async () => {
    storedSite();
    const phrases = await readDemoPhrases({ siteId: "site-1" });
    expect(checkDemoText({ markdown: page("What do you need before you start?"), phrases })).toBeNull();
  });

  it("the fixture replay leaves no no_demo_text fault", async () => {
    storedSite();
    const phrases = await readDemoPhrases({ siteId: "site-1" });
    const markdown = fixture.noDemoTextFailures.map((failure) => failure.markdown).join("\n\n");
    expect(checkDemoText({ markdown: page(markdown), phrases })).toBeNull();
  });

  it("a paragraph that is the site's demo widget line still stops the page", async () => {
    storedSite();
    const phrases = await readDemoPhrases({ siteId: "site-1" });
    expect(checkDemoText({ markdown: page(DEMO), phrases })).toEqual({ rule: "no_demo_text", detail: { rule: "no_demo_text", sentence: DEMO } });
  });
});
