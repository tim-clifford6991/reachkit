// SPEC §7 (2026-10-03, D36, issue 1209) — the weekly content mix: four kinds
// of page, at most two of one kind in any seven days, never the same kind two
// days running, and an update each week where one is ready.
import "../env";
import { describe, expect, it } from "vitest";
import { CONTENT_MIX } from "../../../src/lib/config/constants";
import { contentKindOf, type ContentKind } from "../../../src/lib/opportunities/content-kind";
import { skeletonFor } from "../../../src/lib/generate/pipeline/skeletons";
import { mixOf, orderRanked } from "../../../src/lib/opportunities/rank/open";
import type { DraftedPage } from "../../../src/lib/opportunities/store";
import type { Opportunity } from "../../../src/lib/opportunities/types";

const AT = new Date("2026-10-03T18:00:00.000Z");

function opportunity(id: string, type: Opportunity["type"], targetQuery: string): Opportunity {
  const family = type.endsWith("_page") && ["expand_page", "answerable_page", "refresh_page"].includes(type) ? "improve" : "write";
  return { id, family, type, status: "open", clusterKey: null, targetQuery, absorbedQueries: [], createdAt: AT } as unknown as Opportunity;
}

/** What reachkit.app's supply looked like: almost all "best X", a few of the
 *  rest, scored so the comparisons come first. */
function supply(): { opportunity: Opportunity; score: number }[] {
  const rows: [Opportunity["type"], string][] = [
    ["listed_page", "best ai seo software"],
    ["listed_page", "best geo tools for startups"],
    ["listed_page", "top ai visibility trackers"],
    ["comparison_page", "acme vs globex"],
    ["listed_page", "globex alternatives"],
    ["listed_page", "best rank trackers for agencies"],
    ["keyword_page", "what is generative engine optimization"],
    ["answer_page", "why ai answers cite some sites"],
    ["keyword_page", "ai search visibility for saas"],
    ["keyword_page", "how to get cited by chatgpt"],
    ["keyword_page", "how to set up an llms txt file"],
    ["answer_page", "ai overview tracking checklist"],
    ["keyword_page", "answer engine optimization for b2b"],
    ["keyword_page", "how to measure ai mentions"],
    ["refresh_page", "seo reporting for founders"],
    ["expand_page", "discoverability score explained"],
    ["refresh_page", "ai visibility pricing"],
    ["answerable_page", "weekly scan"],
  ];
  return rows.map(([type, query], index) => ({
    opportunity: opportunity(`o${index}`, type, query),
    score: 1 - index * 0.01,
  }));
}

describe("a page's kind is read off its row", () => {
  it.each<[Opportunity["type"], string, ContentKind]>([
    ["listed_page", "best ai seo software", "comparison"],
    ["keyword_page", "acme vs globex", "comparison"],
    ["keyword_page", "how to get cited by chatgpt", "how_to"],
    ["answer_page", "llms txt setup guide", "how_to"],
    ["keyword_page", "what is generative engine optimization", "explainer"],
    ["refresh_page", "best ai seo software", "update"],
    ["fix_page", "", "update"],
  ])("%s for “%s” is %s", (type, targetQuery, kind) => {
    expect(contentKindOf({ type, targetQuery })).toBe(kind);
  });

  it("a how-to page is outlined as steps, a comparison as a comparison", () => {
    expect(skeletonFor({ type: "keyword_page", targetQuery: "how to get cited by chatgpt" })).toContain("steps");
    expect(skeletonFor({ type: "listed_page", targetQuery: "best ai seo software" })).toContain("comparison");
    expect(skeletonFor({ type: "keyword_page", targetQuery: "what is geo" })).toEqual(["answer", "detail", "evidence", "business"]);
  });
});

describe("two weeks of pages hold the mix", () => {
  const scored = supply();
  const byId = new Map(scored.map((entry) => [entry.opportunity.id, entry.opportunity]));
  const kinds = orderRanked(scored, { mix: { from: 100, recent: [] } })
    .slice(0, 14)
    .map((entry) => contentKindOf(byId.get(entry.opportunityId)!)!);

  it("never the same kind two days running", () => {
    kinds.forEach((kind, day) => {
      if (day > 0) expect(kind, `day ${day}`).not.toBe(kinds[day - 1]);
    });
  });

  it("at most two of one kind in any seven days", () => {
    for (let start = 0; start + CONTENT_MIX.WINDOW_DAYS <= kinds.length; start++) {
      const window = kinds.slice(start, start + CONTENT_MIX.WINDOW_DAYS);
      for (const kind of new Set(window)) {
        expect(window.filter((k) => k === kind).length, `${kind} from day ${start}`).toBeLessThanOrEqual(
          CONTENT_MIX.MAX_PER_KIND
        );
      }
    }
  });

  it("every seven days hold an update, though both updates score last", () => {
    for (let start = 0; start + CONTENT_MIX.WINDOW_DAYS <= kinds.length; start++) {
      expect(kinds.slice(start, start + CONTENT_MIX.WINDOW_DAYS), `from day ${start}`).toContain("update");
    }
  });

  it("the best page still goes first", () => {
    expect(orderRanked(scored, { mix: { from: 100, recent: [] } })[0]?.opportunityId).toBe("o0");
  });
});

describe("the mix never empties a day", () => {
  it("a supply of one kind is still written, a page a day", () => {
    const only = supply().filter((entry) => contentKindOf(entry.opportunity) === "comparison");
    expect(orderRanked(only, { mix: { from: 100, recent: [] } }).map((entry) => entry.opportunityId)).toEqual(
      only.map((entry) => entry.opportunity.id)
    );
  });
});

describe("the days before are read from the site's own drafted pages", () => {
  function drafted(date: string, state: string, type: string, query: string): DraftedPage {
    return { date, state, title: null, row: { type, target_query: query, absorbed_queries: [] } } as unknown as DraftedPage;
  }

  it("yesterday's comparison sends today to another kind; a stopped page held no day", () => {
    const mix = mixOf(
      [
        drafted("2026-10-03", "in_review", "listed_page", "best ai seo software"),
        drafted("2026-10-02", "needs_attention", "keyword_page", "what is geo"),
      ],
      AT
    );
    expect(mix.recent).toEqual([{ day: mix.from - 1, kind: "comparison" }]);
    const ranked = orderRanked(supply(), { mix });
    expect(ranked[0]?.opportunityId).toBe("o6");
  });

  it("after a gap the first day planned is today, and nothing is the day before it", () => {
    const mix = mixOf([drafted("2026-09-20", "published", "listed_page", "best ai seo software")], AT);
    const newPages = supply().filter((entry) => contentKindOf(entry.opportunity) !== "update");
    expect(orderRanked(newPages, { mix })[0]?.opportunityId).toBe("o0");
    // A site that has had pages for a week and no update takes one first.
    expect(orderRanked(supply(), { mix })[0]?.opportunityId).toBe("o14");
  });
});
