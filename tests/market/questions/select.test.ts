// tests/market/questions/select.test.ts — BUILD §6.7 step 3, issue #26
// (WO-074's `## Test plan`).
//
// Selection is pure, so this suite stubs nothing and reaches nothing. The
// frozen fixture beside it is hand-authored synthetic input for a fictional
// user-onboarding SaaS — not a measurement, and no figure in it is a vendor
// result.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BATTERY, SELECTION } from "../../../src/lib/config/constants.ts";
import type { Profile } from "../../../src/lib/market/questions/profile.ts";
import type { SuggestionRow } from "../../../src/lib/market/questions/market-set.ts";
import {
  classifyIntent,
  selectTwelve,
  stemKey,
  type Intent,
} from "../../../src/lib/market/questions/select.ts";
import { difficultyCeiling, qualifyingDemand } from "../../../src/lib/opportunities/winnability/bars.ts";
import { QUESTIONS_DIR, runtimeImportClosure } from "./import-graph.ts";

const FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/market-set.json"), "utf8")
) as { profile: Profile; market: SuggestionRow[] };

const PROFILE = FIXTURE.profile;
/** An established site: 30,000 ranked keywords puts the demand ceiling
 *  (`qualifyingDemand`) far above every fixture search, so these suites
 *  read selection's other rules alone. */
const OWN_RANKED = 30_000;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

function keywords(market: SuggestionRow[]): string[] {
  return selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market }).map((s) => s.keyword);
}

/** A seeded LCG — the property tests generate the same markets on every run
 *  and on every machine, which is the point of a determinism suite. */
function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe("selectTwelve — the fixture, selected byte-identically", () => {
  it("selectTwelve/byte-identical-on-every-run — 100 runs, and a shuffled copy of the same market, yield the identical result including rank and score", () => {
    const first = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: FIXTURE.market });
    for (let run = 0; run < 100; run++) {
      expect(selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: FIXTURE.market })).toEqual(first);
    }

    const random = lcg(20260905);
    const shuffled = [...FIXTURE.market];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    expect(selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: shuffled })).toEqual(first);
  });

  it("selects exactly the twelve, in rank order, ranked 1…12", () => {
    const selected = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: FIXTURE.market });

    expect(selected).toHaveLength(BATTERY.QUESTIONS);
    expect(selected.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(selected.map((s) => s.keyword)).toEqual([
      "user onboarding software",
      "best user onboarding software",
      "appcues alternatives",
      "onboarding tool",
      "product tour software",
      "userpilot alternatives",
      "best product tour software",
      "appcues vs userpilot",
      "how to onboard new users",
      "how to onboard saas users",
      "user onboarding not working",
      "what is user onboarding",
    ]);
  });

  it("scores by the pinned law — intentWeight × log10(volume + 1) — and breaks an exact tie on volume, then on the keyword", () => {
    const selected = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: FIXTURE.market });

    for (const search of selected) {
      expect(search.score).toBeCloseTo(
        SELECTION.intentWeights[search.intent] * Math.log10(search.volume + 1),
        12
      );
    }
    // Two searches tie on score and volume at 1900; the keyword decides.
    const tied = selected.filter((s) => s.volume === 1900);
    expect(tied.map((s) => s.keyword)).toEqual(["appcues alternatives", "onboarding tool"]);
  });

  it("decision and solution intent beat raw volume past the answering floor — the 4,400/mo informational search ranks below 390/mo decision ones", () => {
    const selected = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: FIXTURE.market });
    const rank = (keyword: string) => selected.find((s) => s.keyword === keyword)?.rank ?? Infinity;

    // Issue 1549: it is in the twelve only as one of its answering searches.
    expect(rank("what is user onboarding")).toBe(BATTERY.QUESTIONS);
    expect(rank("appcues vs userpilot")).toBeLessThan(rank("what is user onboarding"));
  });
});

describe("selectTwelve — what never reaches the ranking", () => {
  it("drops every row under the pinned volume floor", () => {
    const selected = keywords(FIXTURE.market);

    expect(selected).not.toContain("user onboarding tooltip guide"); // 40/mo
    expect(selected).not.toContain("product tour walkthrough"); // 20/mo
    for (const search of selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: FIXTURE.market })) {
      expect(search.volume).toBeGreaterThanOrEqual(SELECTION.volumeFloorPerMonth);
    }
  });

  it("drops every own-brand search, however high its volume", () => {
    const selected = keywords(FIXTURE.market);

    for (const keyword of ["acme onboarding", "acme pricing", "best acme alternatives"]) {
      expect(selected).not.toContain(keyword);
      expect(classifyIntent(keyword, PROFILE)).toBe("own_brand");
    }
  });

  it("drops seed drift at the relevance guard — the market's three biggest searches are off-market and none survives", () => {
    const selected = keywords(FIXTURE.market);

    expect(selected).not.toContain("employee onboarding checklist hr"); // 5,400/mo
    expect(selected).not.toContain("best employee onboarding software"); // 3,200/mo
    expect(selected).not.toContain("warehouse management software"); // 2,100/mo
  });

  it("selectTwelve/no-two-share-a-stem-key — near-duplicates collapse to the highest-volume member", () => {
    const selected = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: FIXTURE.market });
    const stems = selected.map((s) => stemKey(s.keyword));
    expect(new Set(stems).size).toBe(stems.length);

    const chosen = selected.map((s) => s.keyword);
    expect(chosen).toContain("user onboarding software"); // 3,600 beats "…softwares" at 300
    expect(chosen).not.toContain("user onboarding softwares");
    expect(chosen).toContain("onboarding tool"); // 1,900 beats "onboarding tools" at 900
    expect(chosen).not.toContain("onboarding tools");
    expect(chosen).toContain("best user onboarding software"); // 2,400 beats the word-order variant at 2,000
    expect(chosen).not.toContain("software user onboarding best");
  });
});

describe("selectTwelve — the tracked twelve stay the same from week to week", () => {
  it("the same market on two Mondays selects the identical twelve, whatever was measured the week before", () => {
    const first = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: FIXTURE.market });
    const second = selectTwelve({
      profile: PROFILE,
      ownRanked: OWN_RANKED,
      market: FIXTURE.market,
      recent: first.map((s) => s.keyword),
    });

    expect(first).toHaveLength(BATTERY.QUESTIONS);
    expect(second).toEqual(first);
  });

  it("a market that loses one tracked search changes only that search", () => {
    const first = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: FIXTURE.market });
    const gone = first[0]!.keyword;
    const second = selectTwelve({
      profile: PROFILE,
      ownRanked: OWN_RANKED,
      market: FIXTURE.market.filter((row) => row.keyword !== gone),
      recent: first.map((s) => s.keyword),
    });

    const before = first.map((s) => s.keyword);
    const after = second.map((s) => s.keyword);
    expect(after).not.toContain(gone);
    expect(after.filter((keyword) => !before.includes(keyword))).toHaveLength(1);
    expect(before.filter((keyword) => !after.includes(keyword))).toEqual([gone]);
  });

  it("keeps a floor of how-to and informational searches", () => {
    const selected = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: FIXTURE.market });
    const answering = selected.filter((s) => s.intent === "problem" || s.intent === "informational");
    expect(answering.length).toBeGreaterThanOrEqual(SELECTION.minAnswering);
  });
});

describe("selectTwelve — the composition constraints (a portfolio, not a leaderboard)", () => {
  it("breaks neither cap on the fixture", () => {
    const selected = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: FIXTURE.market });
    const namesRival = (keyword: string) =>
      PROFILE.namedRivals.some((rival) => keyword.toLowerCase().includes(rival));

    expect(selected.filter((s) => namesRival(s.keyword)).length).toBeLessThanOrEqual(
      SELECTION.maxRivalBrand
    );
    expect(selected.filter((s) => /^how to\b/.test(s.keyword)).length).toBeLessThanOrEqual(
      SELECTION.maxHowTo
    );
  });

  it("the rival-brand cap skips a search that would exceed it, even though it outranks the twelfth", () => {
    const selected = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: FIXTURE.market });
    const skipped = "best appcues alternative for saas teams";

    expect(selected.map((s) => s.keyword)).not.toContain(skipped);
    const twelfth = selected.at(-1)!;
    const skippedScore =
      SELECTION.intentWeights.decision * Math.log10(640 + 1);
    expect(skippedScore).toBeGreaterThan(twelfth.score);
  });

  it("the how-to cap holds even in a market made almost entirely of how-to searches", () => {
    const market: SuggestionRow[] = [
      { keyword: "how to onboard new users", volume: 900 },
      { keyword: "how to onboard saas users", volume: 800 },
      { keyword: "how to onboard product teams", volume: 700 },
      { keyword: "how to onboard new saas users", volume: 600 },
      { keyword: "how to onboard saas product teams", volume: 500 },
      { keyword: "user onboarding software", volume: 400 },
      { keyword: "best onboarding tool", volume: 300 },
    ];

    const selected = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market });

    expect(selected.filter((s) => /^how to\b/.test(s.keyword))).toHaveLength(SELECTION.maxHowTo);
    expect(selected.map((s) => s.keyword)).toContain("user onboarding software");
  });

  it("holds no quota of best and vs searches — the twelve are the twelve best-scoring (SPEC §6, 2026-09-29)", () => {
    const market: SuggestionRow[] = [];
    for (let i = 0; i < 12; i++) {
      market.push({ keyword: `user onboarding software ${"tour ".repeat(i)}tool`, volume: 9000 - i });
    }
    for (let i = 0; i < 5; i++) {
      market.push({ keyword: `best onboarding ${"walkthrough ".repeat(i)}platform`, volume: 100 - i });
    }

    const selected = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market });
    const decision: Intent = "decision";

    expect(selected).toHaveLength(BATTERY.QUESTIONS);
    expect(selected.filter((s) => s.intent === decision)).toHaveLength(0);
  });

  it("a market whose only decision searches are rival-brand ones keeps the rival cap", () => {
    const market: SuggestionRow[] = [
      { keyword: "appcues alternatives", volume: 900 },
      { keyword: "userpilot alternatives", volume: 800 },
      { keyword: "appcues vs userpilot", volume: 700 },
      { keyword: "best appcues tool", volume: 600 },
      { keyword: "best userpilot walkthrough", volume: 500 },
      { keyword: "user onboarding", volume: 400 },
      { keyword: "product adoption", volume: 300 },
      { keyword: "user activation", volume: 200 },
    ];

    const selected = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market });
    const rivals = selected.filter((s) =>
      PROFILE.namedRivals.some((rival) => s.keyword.includes(rival))
    );

    expect(rivals).toHaveLength(SELECTION.maxRivalBrand);
  });
});

describe("selectTwelve — right-sized to the site's own footprint (SPEC §6, 2026-09-16, issue 830)", () => {
  // The journey 09 shape: one head term beside long-tail rows.
  const market: SuggestionRow[] = [
    { keyword: "user onboarding software", volume: 22_000 },
    { keyword: "user onboarding checklist", volume: 40 },
    { keyword: "product tour tool", volume: 30 },
    { keyword: "onboarding tooltip", volume: 20 },
  ];

  it("a site ranking for 3 keywords is never given a search above qualifyingDemand(3), and the long tail keeps its slots", () => {
    const selected = selectTwelve({ profile: PROFILE, ownRanked: 3, market, floor: 20 });

    expect(selected.map((s) => s.keyword)).not.toContain("user onboarding software");
    for (const search of selected) expect(search.volume).toBeLessThanOrEqual(qualifyingDemand(3));
    expect(selected.map((s) => s.keyword)).toEqual(
      expect.arrayContaining(["user onboarding checklist", "product tour tool", "onboarding tooltip"])
    );
  });

  it("an established site (30,000 ranked) still selects the head term", () => {
    const selected = selectTwelve({ profile: PROFILE, ownRanked: 30_000, market, floor: 20 });

    expect(selected[0]?.keyword).toBe("user onboarding software");
  });

  it("the ceiling is the derivation's own bar: a search at it is kept, one above it is not", () => {
    const at = qualifyingDemand(3);
    const edge: SuggestionRow[] = [
      { keyword: "user onboarding software", volume: at },
      { keyword: "product tour software", volume: at + 1 },
    ];

    expect(selectTwelve({ profile: PROFILE, ownRanked: 3, market: edge }).map((s) => s.keyword)).toEqual([
      "user onboarding software",
    ]);
  });
});

describe("selectTwelve — difficulty and the cold-start ceiling (SPEC §6, owner walk 2026-09-17, issue 858)", () => {
  // reachkit.app on the owner's walk: three ranked keywords.
  const SEO: Profile = {
    category: "seo software",
    job: "write seo content for startups",
    offeringType: "saas",
    audienceTerms: ["startups", "founders"],
    namedRivals: [],
    vocabulary: ["seo content", "content brief", "ai seo"],
    brandTokens: ["reachkit"],
  };
  const market: SuggestionRow[] = [
    { keyword: "best seo software", volume: 1000, difficulty: 78 },
    { keyword: "seo software tool", volume: 880, difficulty: 70 },
    { keyword: "seo software comparison", volume: 250, difficulty: 55 },
    { keyword: "seo content brief template for startups", volume: 40, difficulty: 8 },
    { keyword: "seo content software", volume: 90, difficulty: 29 },
    { keyword: "seo content brief", volume: 90 },
    { keyword: "content briefs", volume: 90, difficulty: 10 },
  ];
  const picked = (ownRanked: number): string[] =>
    selectTwelve({ profile: SEO, ownRanked, market, floor: 10 }).map((s) => s.keyword);

  it("own ranked 3: 'best seo software' (hard, 1 000/mo) is excluded and 'seo content brief template for startups' (easy, 40/mo) selected", () => {
    const keywords = picked(3);
    expect(keywords).not.toContain("best seo software");
    expect(keywords).not.toContain("seo software tool");
    expect(keywords).toContain("seo content brief template for startups");
  });

  it("a search above the site's difficulty ceiling is dropped even inside the volume window, and one with no difficulty is read on volume", () => {
    expect(difficultyCeiling(3)).toBeLessThan(55);
    expect(picked(3)).not.toContain("seo software comparison");
    expect(picked(3)).toContain("seo content brief");
  });

  it("at cold start a specific long-tail search leads a shorter, larger one of the same intent", () => {
    const keywords = picked(3);
    expect(keywords.indexOf("seo content brief template for startups")).toBeLessThan(keywords.indexOf("content briefs"));
    // An established site reads them on volume again.
    const warm = picked(30_000);
    expect(warm.indexOf("content briefs")).toBeLessThan(warm.indexOf("seo content brief template for startups"));
  });

  it("the ceilings rise with own ranked: a site ranking for a million is offered the head terms", () => {
    expect(difficultyCeiling(30_000)).toBeGreaterThan(difficultyCeiling(3));
    expect(picked(1_000_000)).toEqual(expect.arrayContaining(["best seo software", "seo software tool"]));
  });

  it("the difficulty rides with the selected search", () => {
    const selected = selectTwelve({ profile: SEO, ownRanked: 3, market, floor: 10 });
    expect(selected.find((s) => s.keyword === "seo content brief template for startups")?.difficulty).toBe(8);
    expect(selected.find((s) => s.keyword === "seo content brief")).not.toHaveProperty("difficulty");
  });
});

describe("selectTwelve — fewer than twelve is a complete result (the cold-start law)", () => {
  it("selectTwelve/short-market-is-a-complete-result — a market that survives with 5 rows returns exactly 5, ranked 1…5, with no sixth", () => {
    const market: SuggestionRow[] = [
      { keyword: "best user onboarding software", volume: 900 },
      { keyword: "user onboarding software", volume: 800 },
      { keyword: "onboarding tool", volume: 700 },
      { keyword: "appcues alternatives", volume: 600 },
      { keyword: "product tour", volume: 500 },
      { keyword: "user onboarding tooltip", volume: 10 }, // under the floor
      { keyword: "acme pricing", volume: 5000 }, // own brand
      { keyword: "warehouse management software", volume: 9000 }, // off market
    ];

    const selected = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market });

    expect(selected).toHaveLength(5);
    expect(selected.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("an empty market selects nothing and completes — a domain that ranks for nothing still finishes this step", () => {
    expect(selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: [] })).toEqual([]);
  });

  it("a market of nothing but off-market rows selects nothing rather than relaxing the guard to fill twelve", () => {
    const market: SuggestionRow[] = Array.from({ length: 30 }, (_, i) => ({
      keyword: `warehouse forklift maintenance ${i}`,
      volume: 5000,
    }));

    expect(selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market })).toEqual([]);
  });

  it("the founder's confirmed category joins the guard's support set — the searches its seed bought survive (#767)", () => {
    const market: SuggestionRow[] = [{ keyword: "warehouse forklift maintenance", volume: 5000 }];

    expect(selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market })).toEqual([]);
    expect(
      selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market, category: "warehouse forklift maintenance" }).map((s) => s.keyword)
    ).toEqual(["warehouse forklift maintenance"]);
  });

  it("selectTwelve/never-pads-and-never-repeats — over generated markets of size 0…60, the result is at most twelve, every keyword comes from the market, and no keyword repeats", () => {
    const pool = FIXTURE.market.map((row) => row.keyword);
    const random = lcg(1013904223);

    for (let size = 0; size <= 60; size++) {
      const market: SuggestionRow[] = Array.from({ length: size }, () => ({
        keyword: pool[Math.floor(random() * pool.length)]!,
        volume: Math.floor(random() * 5000),
      }));
      const inMarket = new Set(market.map((row) => row.keyword));

      const selected = selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market });

      expect(selected.length).toBeLessThanOrEqual(BATTERY.QUESTIONS);
      expect(selected.map((s) => s.rank)).toEqual(selected.map((_, i) => i + 1));
      for (const search of selected) expect(inMarket.has(search.keyword)).toBe(true);
      expect(new Set(selected.map((s) => s.keyword)).size).toBe(selected.length);
      expect(new Set(selected.map((s) => stemKey(s.keyword))).size).toBe(selected.length);
    }
  });
});

describe("selectTwelve — purity (BP-025 decision 1)", () => {
  it("selectTwelve/takes-no-cost-context — one argument object, and select.ts resolves no runtime import into costs, llm or vendors", () => {
    expect(selectTwelve.length).toBe(1);

    const closure = runtimeImportClosure(path.join(QUESTIONS_DIR, "select.ts"));
    expect(closure).toEqual(
      expect.arrayContaining(["lib/config/constants.ts", "lib/market/questions/select.ts"])
    );
    for (const forbidden of ["lib/llm/", "lib/vendors/", "lib/costs/"]) {
      expect(closure.filter((file) => file.startsWith(forbidden))).toEqual([]);
    }
  });
});

describe("selectTwelve — observability (BP-025 `## NFR budget`)", () => {
  it("logs the selected count and which constraint bound it, and never a keyword", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    selectTwelve({ profile: PROFILE, ownRanked: OWN_RANKED, market: FIXTURE.market });

    const logged = JSON.parse(logSpy.mock.calls.at(-1)![0] as string) as Record<string, unknown>;
    expect(logged.event).toBe("selection");
    expect(logged.selected).toBe(BATTERY.QUESTIONS);
    expect(logged.boundBy).toBe("questions");
    expect(JSON.stringify(logged)).not.toContain("onboarding");
  });
});

describe("selectTwelve — a free scan with a town (issue 1441)", () => {
  // laynescafe.co.uk's own profile and three of the vendor's suggestions for
  // "coffee shop leeds", as the free scan of 2026-10-15 read them.
  const cafe: Profile = {
    category: "coffee shop",
    job: "serves coffee and breakfast",
    offeringType: "café",
    audienceTerms: ["commuters", "coffee lovers"],
    namedRivals: [],
    vocabulary: ["coffee shop", "espresso", "breakfast", "coffee"],
    brandTokens: ["laynes"],
  };
  const market = [
    { keyword: "best coffee shop in leeds", volume: 1600 },
    { keyword: "coffee shop leeds city centre", volume: 2400 },
    { keyword: "speciality coffee leeds", volume: 110 },
  ];

  it("the town is where a search is asked, not a word the business has to sell", () => {
    expect(selectTwelve({ profile: cafe, ownRanked: 600, market })).toEqual([]);
    const local = selectTwelve({ profile: cafe, ownRanked: 600, market, place: { name: "Leeds" } }).map((s) => s.keyword);
    expect(local.length).toBeGreaterThan(0);
    for (const keyword of local) expect(market.map((row) => row.keyword)).toContain(keyword);
  });
});

describe("selectTwelve — a business measured in its town is searched for by what it offers (issue 1449)", () => {
  // zunicafe.com's and flintplumb.com's own profiles, as the free scans of
  // 2026-10-15 read them, and searches their markets held.
  const restaurant: Profile = {
    category: "fine dining restaurant San Francisco",
    job: "provide a memorable dining experience with seasonal, locally-sourced cuisine",
    offeringType: "full-service restaurant",
    audienceTerms: ["fine dining enthusiasts"],
    namedRivals: [],
    vocabulary: ["seasonal ingredients", "French cuisine", "wine list", "oysters"],
    brandTokens: ["Zuni Café"],
  };
  const plumber: Profile = {
    category: "plumbers",
    job: "fix plumbing problems and install plumbing systems",
    offeringType: "local plumbing services",
    audienceTerms: ["residential homeowners"],
    namedRivals: [],
    vocabulary: ["water heater repair", "drain cleaning", "slab leaks"],
    brandTokens: ["Flint Plumbing"],
  };
  const pick = (profile: Profile, keywords: string[], place?: { name: string }) =>
    selectTwelve({ profile, ownRanked: 600, market: keywords.map((keyword) => ({ keyword, volume: 500 })), ...(place === undefined ? {} : { place }) }).map(
      (s) => s.keyword
    );

  it("drops a search about what the business uses, keeps one for what it is", () => {
    const sf = { name: "San Francisco" };
    const kept = pick(restaurant, ["seasonal ingredients", "what are seasonal ingredients", "french restaurant in san francisco", "wine list"], sf);
    expect(kept).toEqual(["french restaurant in san francisco"]);
  });

  it("keeps a trade's services, whatever the category says", () => {
    const kept = pick(plumber, ["water heater repair austin", "drain cleaning austin", "slab leaks austin"], { name: "Austin" });
    expect(kept.sort()).toEqual(["drain cleaning austin", "water heater repair austin"]);
  });

  it("a site measured in no town is selected as before", () => {
    expect(pick(restaurant, ["seasonal ingredients"])).toEqual(["seasonal ingredients"]);
  });
});
