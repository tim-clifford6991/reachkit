// tests/app/draft/links-panel.test.ts — SPEC §7 (2026-10-10, issue 1391):
// *Links on this page* lists what the body carries, grouped, with why and
// whether each address answered.
import { describe, expect, it } from "vitest";
import { linksOnPage, NO_LINK_RECORD } from "../../../src/app/(account)/app/draft/[draftId]/links-panel";

const BODY = [
  "See [what each plan costs](https://example.com/pricing) and [the import guide](https://blog.example.com/import).",
  "",
  "Rival A charges [$99 a month](https://rival-a.example/pricing). Again: [plans](https://example.com/pricing).",
].join("\n");

describe("links on this page", () => {
  it("groups each address once as the site's, the articles' and the sources', each with why", () => {
    const links = linksOnPage(BODY, {
      domain: "example.com",
      record: {
        chosen: [
          { url: "https://example.com/pricing", source: "site", why: { kind: "topic", words: ["plans"] } },
          { url: "https://blog.example.com/import", source: "cluster", why: { kind: "cluster" } },
        ],
        factUrls: [],
        check: null,
      },
    });
    expect(links.site).toEqual([
      { text: "what each plan costs", url: "https://example.com/pricing", reason: { kind: "topic", words: "plans" }, live: "pending" },
    ]);
    expect(links.articles.map((link) => link.reason.kind)).toEqual(["cluster"]);
    expect(links.sources.map((link) => link.text)).toEqual(["$99 a month"]);
  });

  it("says live only for an address the check at publish found live, and lists what it removed", () => {
    const links = linksOnPage(BODY, {
      domain: "example.com",
      record: {
        ...NO_LINK_RECORD,
        check: {
          links: [
            { url: "https://example.com/pricing", status: "live" },
            { url: "https://rival-a.example/pricing", status: "unchecked" },
          ],
          removed: [{ url: "https://example.com/old", text: "our old page", kind: "site" }],
        },
      },
    });
    expect(links.site.map((link) => link.live)).toEqual(["live", "pending"]);
    expect(links.sources[0]?.live).toBe("unchecked");
    expect(links.removed).toHaveLength(1);
  });
});
