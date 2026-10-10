// tests/publish/links/live.test.ts — SPEC §7 (2026-10-10, issue 1391): the
// page that goes out links no address that answered gone.
import { describe, expect, it } from "vitest";
import { checkPageLinks, type AskAddress } from "@/lib/publish/links/live";

const AT = new Date("2026-10-10T09:00:00.000Z");
const BODY = [
  "## What does it cost?",
  "",
  "Plans are on [our pricing page](https://example.com/pricing). Rival A charges [$99 a month](https://rival-a.example/pricing). It also has a free tier.",
  "",
  "| Product | Price |",
  "| --- | --- |",
  "| Us | [€49](https://example.com/pricing) |",
  "| Rival A | [$99](https://rival-a.example/pricing) |",
  "",
  "- [Our old guide](https://content.example.com/old-guide)",
  "- [Features](https://example.com/features)",
  "",
  "## Sources",
  "",
  "- [Rival A pricing](https://rival-a.example/pricing), read 9 October 2026",
  "",
].join("\n");

function answering(statuses: Record<string, number | null>): AskAddress {
  return async (url) => {
    if (statuses[url] === null) throw new Error("timeout");
    return { status: statuses[url] ?? 200 };
  };
}

describe("the live check at publish", () => {
  it("a page whose links all answer goes out as written, each recorded live", async () => {
    const checked = await checkPageLinks({ markdown: BODY, domain: "example.com", at: AT, ask: answering({}) });
    expect(checked.markdown).toBe(BODY);
    expect(checked.record.removed).toEqual([]);
    expect(checked.record.links.map((link) => link.status)).toEqual(["live", "live", "live", "live"]);
  });

  it("a gone page of the customer's is unwrapped — the sentence stays — and a listed one leaves its line", async () => {
    const checked = await checkPageLinks({
      markdown: BODY,
      domain: "example.com",
      at: AT,
      ask: answering({ "https://example.com/pricing": 404, "https://content.example.com/old-guide": 410 }),
    });
    expect(checked.markdown).toContain("Plans are on our pricing page. Rival A charges");
    expect(checked.markdown).toContain("| Us | €49 |");
    expect(checked.markdown).not.toContain("old guide");
    expect(checked.markdown).toContain("- [Features](https://example.com/features)");
    expect(checked.record.removed.map((link) => link.kind)).toEqual(["site", "site", "site"]);
  });

  it("a gone source takes its claim with it: the sentence, the table row and the sources entry", async () => {
    const checked = await checkPageLinks({
      markdown: BODY,
      domain: "example.com",
      at: AT,
      ask: answering({ "https://rival-a.example/pricing": 404 }),
    });
    expect(checked.markdown).not.toContain("rival-a.example");
    expect(checked.markdown).not.toContain("$99");
    expect(checked.markdown).toContain("Plans are on [our pricing page](https://example.com/pricing). It also has a free tier.");
    expect(checked.markdown).toContain("| Us | [€49](https://example.com/pricing) |");
    expect(checked.markdown).not.toContain("## Sources");
    expect(checked.record.removed.every((link) => link.kind === "source")).toBe(true);
  });

  it("a timeout, a bot wall and a server error are not gone: the link stays, recorded unchecked", async () => {
    const checked = await checkPageLinks({
      markdown: BODY,
      domain: "example.com",
      at: AT,
      ask: answering({ "https://rival-a.example/pricing": 403, "https://example.com/pricing": null, "https://example.com/features": 503 }),
    });
    expect(checked.markdown).toBe(BODY);
    expect(checked.record.links.filter((link) => link.status === "unchecked")).toHaveLength(3);
  });
});
