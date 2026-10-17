// tests/generate/rules/cites.test.ts — SPEC §7 (2026-10-17, issue 1486):
// `cites_market`, a how-to or a Q&A links the outside pages it is built from.
import "../env";
import { describe, expect, it } from "vitest";
import { checkCitesMarket } from "../../../src/lib/generate/rules/cites";
import { withoutReferenceLists } from "../../../src/lib/generate/rules/text";
import { CLEAN_MARKDOWN } from "../fixtures";

const GOOGLE = "https://developers.google.com/search/docs/appearance/ai-features";
const GUIDE = "https://airankchecker.example/blog/ai-overviews";
const cites = { claimUrls: [GOOGLE, GUIDE, "https://otterly.ai/features"], min: 2 };

describe("cites_market", () => {
  it("a body that links none of its pack's pages is stopped; two distinct ones pass", () => {
    expect(checkCitesMarket({ markdown: CLEAN_MARKDOWN, cites })?.detail).toEqual({ rule: "cites_market", cited: 0, min: 2 });
    expect(checkCitesMarket({ markdown: `[Google's guidance](${GOOGLE}) and [a guide](${GUIDE}/) agree.`, cites })).toBeNull();
  });

  it("one page twice, a page the pack holds no claim from, or the appended sources list is not a second citation", () => {
    const once = `[Google](${GOOGLE}) says so, [and again](${GOOGLE}), as [a blog](https://elsewhere.example/post) does.`;
    expect(checkCitesMarket({ markdown: once, cites })?.detail).toMatchObject({ cited: 1 });
    const listed = `${CLEAN_MARKDOWN}\n\n## Sources\n\n- [Google](${GOOGLE}), read on 10 October 2026\n- [Guide](${GUIDE}), read on 10 October 2026\n`;
    expect(checkCitesMarket({ markdown: withoutReferenceLists(listed), cites })?.detail).toMatchObject({ cited: 0 });
  });
});
