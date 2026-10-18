// SPEC §7 (2026-10-03, D36, issue 1209; D42) — the weekly content mix: seven
// types of page, at most two of one type in any seven days, never the same kind two
// days running, and an update each week where one is ready.
import "../env";
import { describe, expect, it } from "vitest";
import { CONTENT_MIX, PACE } from "../../../src/lib/config/constants";
import { contentTypeOf, type ContentType } from "../../../src/lib/opportunities/content-type";
import { mixOf, orderRanked } from "../../../src/lib/opportunities/rank/open";
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
    // D52 leaves a week one comparison, so the rest of it is these.
    ["keyword_page", "ai search statistics"],
    ["keyword_page", "answer engine optimization explained"],
    ["keyword_page", "latest ai search trends"],
  ];
  return rows.map(([type, query], index) => ({
    opportunity: opportunity(`o${index}`, type, query),
    score: 1 - index * 0.01,
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

describe("two weeks of pages hold the mix", () => {
  const scored = supply();
  const byId = new Map(scored.map((entry) => [entry.opportunity.id, entry.opportunity]));
  const kinds = orderRanked(scored, { mix: { from: 100, recent: [] } })
    .slice(0, 14)
    .map((entry) => contentTypeOf(byId.get(entry.opportunityId)!)!);

  it("never the same kind of new page two days running", () => {
    // An update may follow an update: once the week's four new pages are
    // in, the pace gives the day to an update (issue 1139).
    kinds.forEach((kind, day) => {
      if (day > 0 && kind !== "update") expect(kind, `day ${day}`).not.toBe(kinds[day - 1]);
    });
  });

  it("at most two of one kind of new page in any seven days, and the updates the pace leaves room for", () => {
    for (let start = 0; start + CONTENT_MIX.WINDOW_DAYS <= kinds.length; start++) {
      const window = kinds.slice(start, start + CONTENT_MIX.WINDOW_DAYS);
      for (const kind of new Set(window)) {
        expect(window.filter((k) => k === kind).length, `${kind} from day ${start}`).toBeLessThanOrEqual(
          kind === "update" ? CONTENT_MIX.WINDOW_DAYS - PACE.NEW_PAGES_PER_WEEK : CONTENT_MIX.MAX_PER_KIND
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
    const [today] = orderRanked(scored, { mix: { from: 100, recent: [{ day: 97, kind: "listicle" }] } });
    expect(today?.opportunityId).toBe("o6");
    // Seven days on, the window has room and the best page goes first again.
    const newPages = scored.filter((entry) => contentTypeOf(entry.opportunity) !== "update");
    expect(orderRanked(newPages, { mix: { from: 104, recent: [{ day: 97, kind: "listicle" }] } })[0]?.opportunityId).toBe("o0");
  });

  it("a supply of comparisons alone fills every day: one comparison a week, the rest answered as Q&As (issue 1455)", () => {
    // reachkit.app on 14 October: every ready topic a comparison, and
    // yesterday's page one. The day used to be empty.
    const only = scored.filter((entry) => contentTypeOf(entry.opportunity) === "listicle");
    const ranked = orderRanked(only, { mix: { from: 100, recent: [{ day: 99, kind: "listicle" }] } });
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

  it("yesterday's comparison sends today to another kind; a stopped page held no day", () => {
    const mix = mixOf(
      [
        drafted("2026-10-03", "in_review", "listed_page", "best ai seo software"),
        drafted("2026-10-02", "needs_attention", "keyword_page", "what is geo"),
      ],
      AT
    );
    expect(mix.recent).toEqual([{ day: mix.from - 1, kind: "listicle" }]);
    const ranked = orderRanked(supply(), { mix });
    expect(ranked[0]?.opportunityId).toBe("o6");
  });

  it("a page counts as the type it was written as: a comparison answered as a Q&A uses no comparison's week (issue 1455)", () => {
    const page = { ...drafted("2026-10-03", "published", "comparison_page", "acme vs globex"), writtenAs: "qa" };
    const mix = mixOf([page], AT);
    expect(mix.recent).toEqual([{ day: mix.from - 1, kind: "qa" }]);
    expect(orderRanked(supply(), { mix })[0]?.opportunityId).toBe("o0");
  });

  it("after a gap the first day planned is today, and nothing is the day before it", () => {
    const mix = mixOf([drafted("2026-09-20", "published", "listed_page", "best ai seo software")], AT);
    const newPages = supply().filter((entry) => contentTypeOf(entry.opportunity) !== "update");
    expect(orderRanked(newPages, { mix })[0]?.opportunityId).toBe("o0");
    // A site that has had pages for a week and no update takes one first.
    expect(orderRanked(supply(), { mix })[0]?.opportunityId).toBe("o14");
  });
});

describe("pages that answer: at least three of the last seven new pages where one is ready (issue 1506)", () => {
  const ANSWERS: readonly (ContentType | null)[] = CONTENT_MIX.NON_COMMERCIAL_TYPES;

  it("a week already full of other pages takes the answer, though a comparison scores first", () => {
    const rows = [
      opportunity("comparison", "listed_page", "best ai seo software"),
      opportunity("statistics", "keyword_page", "ai search statistics"),
      opportunity("how-to", "keyword_page", "how to measure ai mentions"),
    ].map((o, index) => ({ opportunity: o, score: 1 - index * 0.1 }));
    const recent = [
      { day: 95, kind: "research" as const },
      { day: 96, kind: "insights" as const },
      { day: 97, kind: "research" as const },
      { day: 99, kind: "insights" as const },
    ];
    expect(orderRanked(rows, { mix: { from: 100, recent } })[0]?.opportunityId).toBe("how-to");
  });

  it("the count is of new pages, not of days: refreshes between them do not count, and pages older than a week still do", () => {
    const rows = [
      opportunity("comparison", "listed_page", "best ai seo software"),
      opportunity("how-to", "keyword_page", "how to measure ai mentions"),
    ].map((o, index) => ({ opportunity: o, score: 1 - index * 0.1 }));
    const recent = [
      { day: 80, kind: "research" as const },
      { day: 85, kind: "insights" as const },
      { day: 90, kind: "research" as const },
      { day: 96, kind: "insights" as const },
      { day: 97, kind: "update" as const },
      { day: 98, kind: "update" as const },
      { day: 99, kind: "update" as const },
    ];
    expect(orderRanked(rows, { mix: { from: 100, recent } })[0]?.opportunityId).toBe("how-to");
    // Three of the last six new pages answer: the best page goes first.
    const answered = recent.map((page, index) => (index < 3 ? { ...page, kind: "qa" as const } : page));
    expect(orderRanked(rows, { mix: { from: 100, recent: answered } })[0]?.opportunityId).toBe("comparison");
  });

  it("two weeks of reachkit.app's supply hold three answers in every seven new pages", () => {
    const scored = supply();
    const byId = new Map(scored.map((entry) => [entry.opportunity.id, entry.opportunity]));
    const kinds = orderRanked(scored, { mix: { from: 100, recent: [] } })
      .slice(0, 14)
      .map((entry) => entry.writeAs ?? contentTypeOf(byId.get(entry.opportunityId)!)!);
    const newPages = kinds.filter((kind) => kind !== "update");
    expect(newPages.length).toBeGreaterThan(CONTENT_MIX.NON_COMMERCIAL_OF);
    for (let start = 0; start + CONTENT_MIX.NON_COMMERCIAL_OF <= newPages.length; start++) {
      const seven = newPages.slice(start, start + CONTENT_MIX.NON_COMMERCIAL_OF);
      expect(seven.filter((kind) => ANSWERS.includes(kind)).length, `from page ${start}: ${seven.join(", ")}`).toBeGreaterThanOrEqual(
        CONTENT_MIX.NON_COMMERCIAL_MIN
      );
    }
  });

  it("a supply with no page that answers still fills every day", () => {
    const rows = ["best ai seo software", "ai search statistics", "latest ai search trends", "ai visibility research data"].map(
      (query, index) => ({ opportunity: opportunity(`o${index}`, "keyword_page", query), score: 1 - index * 0.1 })
    );
    const recent = [95, 96, 97, 98].map((day) => ({ day, kind: "research" as const }));
    expect(orderRanked(rows, { mix: { from: 100, recent } })).toHaveLength(rows.length);
  });
});
