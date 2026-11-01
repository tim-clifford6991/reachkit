// A page ChatGPT read while answering but did not link: known only where the answer kept its reads.
import { describe, expect, it } from "vitest";
import { foundNotLinked } from "../../../src/lib/market/prompts/answer.ts";

const PAGE = "https://acme-widgets.test/guide";

describe("foundNotLinked", () => {
  it("is true for a page ChatGPT retrieved and did not cite, tracking parameters aside", () => {
    const answer = { citedUrls: ["https://rival.test/"], retrievedUrls: [`${PAGE}?utm_source=chatgpt.com`, "https://rival.test/"] };
    expect(foundNotLinked(answer, PAGE)).toBe(true);
  });

  it("is false for a page it cited, and for one it never retrieved", () => {
    expect(foundNotLinked({ citedUrls: [PAGE], retrievedUrls: [PAGE] }, PAGE)).toBe(false);
    expect(foundNotLinked({ citedUrls: [], retrievedUrls: ["https://rival.test/"] }, PAGE)).toBe(false);
  });

  it("is null, never false, on an answer that kept no reads", () => {
    expect(foundNotLinked({ citedUrls: [] }, PAGE)).toBeNull();
  });
});
