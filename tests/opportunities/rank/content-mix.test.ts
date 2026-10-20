// SPEC §7 — the week's rules beside the points: D42's seven types, at most
// two offering pages and one comparison (D52) in any seven days, read from
// the days before.
import "../env";
import { describe, expect, it } from "vitest";
import { CONTENT_MIX } from "../../../src/lib/config/constants";
import { contentTypeOf, type ContentType } from "../../../src/lib/opportunities/content-type";
import { mixOf, orderRanked, type Scored } from "../../../src/lib/opportunities/rank/open";
import type { DraftedPage } from "../../../src/lib/opportunities/store";
import type { Opportunity } from "../../../src/lib/opportunities/types";

const AT = new Date("2026-10-03T18:00:00.000Z");

function opportunity(id: string, type: Opportunity["type"], targetQuery: string): Opportunity {
  const family = type.endsWith("_page") && ["expand_page", "answerable_page", "refresh_page"].includes(type) ? "improve" : "write";
  const evidence = family === "improve" ? { family, shortfall: { kind: "position" } } : { family };
  return { id, family, type, status: "open", clusterKey: null, targetQuery, absorbedQueries: [], evidence, createdAt: AT } as unknown as Opportunity;
}

/** What reachkit.app's supply looked like: almost all "best X", a few of the
 *  rest, scored so the comparisons come first. */
function supply(): Scored[] {
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
    // D52 leaves a week one comparison, so the rest of it is these.
    ["keyword_page", "ai search statistics"],
    ["keyword_page", "answer engine optimization explained"],
    ["keyword_page", "latest ai search trends"],
  ];
  return rows.map(([type, query], index) => ({
    opportunity: opportunity(`o${index}`, type, query),
    points: 100 - index,
    parts: [],
  }));
}

describe("a page's type is read off its row (D42)", () => {
  it.each<[Opportunity["type"], string, ContentType | null]>([
    ["listed_page", "best ai seo software", "listicle"],
    ["comparison_page", "acme and globex", "listicle"],
    ["keyword_page", "how to get cited by chatgpt", "how_to"],
    ["keyword_page", "what is generative engine optimization", "documentation"],
    ["keyword_page", "ai search statistics", "research"],
    ["keyword_page", "latest ai search news", "insights"],
    ["answer_page", "why ai answers cite some sites", "qa"],
    ["refresh_page", "best ai seo software", "update"],
    ["fix_page", "", "update"],
    // It publishes no asset, so it has no type.
    ["unblock", "", null],
  ])("%s for “%s” is %s", (type, targetQuery, kind) => {
    expect(contentTypeOf({ type, targetQuery })).toBe(kind);
  });
});

describe("at most two offering pages in any seven days", () => {
  const offering = (id: string, points: number) => ({
    opportunity: { ...opportunity(id, "keyword_page", `${id} pricing`), pageType: "product" as const },
    points,
    parts: [],
  });
  const answer = { opportunity: opportunity("answer", "answer_page", "why do ai answers change"), points: 1, parts: [] };

  it("a third offering page waits for an answer, and fills a day only when nothing else is left", () => {
    const ranked = orderRanked([offering("a", 10), offering("b", 9), offering("c", 8), offering("d", 7), answer], { mix: { from: 100, recent: [] } });
    expect(ranked.map((entry) => [entry.opportunityId, entry.reason.rule])).toEqual([
      ["a", "best"],
      ["b", "best"],
      ["answer", "best"],
      ["c", "best, offering full"],
      ["d", "best, offering full"],
    ]);
  });

  it("offering pages already drafted this week count", () => {
    const recent = [
      { day: 97, kind: "qa" as const, offering: true },
      { day: 98, kind: "qa" as const, offering: true },
    ];
    expect(orderRanked([offering("a", 10), answer], { mix: { from: 100, recent } })[0]?.opportunityId).toBe("answer");
    // A week on, the window has room again.
    expect(orderRanked([offering("a", 10), answer], { mix: { from: 105, recent } })[0]?.opportunityId).toBe("a");
  });
});

describe("self-promoting pages are capped (D52, issue 1267)", () => {
  const scored = supply();
  const byId = new Map(scored.map((entry) => [entry.opportunity.id, entry.opportunity]));
  // A page counts as the type it is written as (issue 1455).
  const kindsOf = (ranked: { opportunityId: string; writeAs?: ContentType }[]) =>
    ranked.map((entry) => entry.writeAs ?? contentTypeOf(byId.get(entry.opportunityId)!)!);

  it("no seven days running hold a second comparison, though comparisons score first", () => {
    const kinds = kindsOf(orderRanked(scored, { mix: { from: 100, recent: [] } }));
    expect(kinds.filter((kind) => kind === "listicle").length).toBeGreaterThan(1);
    for (let start = 0; start < kinds.length; start++) {
      const week = kinds.slice(start, start + CONTENT_MIX.WINDOW_DAYS);
      expect(week.filter((kind) => kind === "listicle").length, `from day ${start}`).toBeLessThanOrEqual(1);
    }
  });

  it("a comparison three days ago: today's best comparison falls through to the next topic", () => {
    const [today] = orderRanked(scored, { mix: { from: 100, recent: [{ day: 97, kind: "listicle", offering: false }] } });
    expect(today?.opportunityId).toBe("o6");
    // Seven days on, the window has room and the best page goes first again.
    const newPages = scored.filter((entry) => contentTypeOf(entry.opportunity) !== "update");
    expect(orderRanked(newPages, { mix: { from: 104, recent: [{ day: 97, kind: "listicle", offering: false }] } })[0]?.opportunityId).toBe("o0");
  });

  it("a supply of comparisons alone fills every day: one comparison a week, the rest answered as Q&As (issue 1455)", () => {
    // reachkit.app on 14 October: every ready topic a comparison, and
    // yesterday's page one. The day used to be empty.
    const only = scored.filter((entry) => contentTypeOf(entry.opportunity) === "listicle");
    const ranked = orderRanked(only, { mix: { from: 100, recent: [{ day: 99, kind: "listicle", offering: false }] } });
    expect(ranked).toHaveLength(only.length);
    expect(ranked[0]).toMatchObject({ opportunityId: "o0", writeAs: "qa" });
    // The cap still holds: no seven days running publish two comparisons.
    const written = ranked.map((entry) => (entry.writeAs === undefined ? "listicle" : entry.writeAs));
    for (let start = 0; start < written.length; start++) {
      const week = ["listicle", ...written].slice(start, start + CONTENT_MIX.WINDOW_DAYS);
      expect(week.filter((kind) => kind === "listicle").length, `from day ${start}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("the days before are read from the site's own drafted pages", () => {
  function drafted(date: string, state: string, type: string, query: string): DraftedPage {
    return { date, state, title: null, row: { type, target_query: query, absorbed_queries: [] } } as unknown as DraftedPage;
  }

  it("yesterday's comparison holds the week's one; a stopped page held no day", () => {
    const mix = mixOf(
      [
        drafted("2026-10-03", "in_review", "listed_page", "best ai seo software"),
        drafted("2026-10-02", "needs_attention", "keyword_page", "what is geo"),
      ],
      AT
    );
    expect(mix.recent).toEqual([{ day: mix.from - 1, kind: "listicle", offering: false }]);
    const ranked = orderRanked(supply(), { mix });
    expect(ranked[0]?.opportunityId).toBe("o6");
  });

  it("a page counts as the type it was written as: a comparison answered as a Q&A uses no comparison's week (issue 1455)", () => {
    const page = { ...drafted("2026-10-03", "published", "comparison_page", "acme vs globex"), writtenAs: "qa" };
    const mix = mixOf([page], AT);
    expect(mix.recent).toEqual([{ day: mix.from - 1, kind: "qa", offering: false }]);
    expect(orderRanked(supply(), { mix })[0]?.opportunityId).toBe("o0");
  });

  it("after a gap the first day planned is today, and nothing is the day before it", () => {
    const mix = mixOf([drafted("2026-09-20", "published", "listed_page", "best ai seo software")], AT);
    const newPages = supply().filter((entry) => contentTypeOf(entry.opportunity) !== "update");
    expect(orderRanked(newPages, { mix })[0]?.opportunityId).toBe("o0");
  });
});
