// tests/market/questions/widen.test.ts — SPEC §6 thin markets (2026-09-16), #778.
//
// Pure: the seed ladder's order, the pool, the volume steps and the
// relevance guard's rival support. The pipeline that buys the seeds is
// driven in `tests/scan/run/thin-market.test.ts`.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BATTERY } from "../../../src/lib/config/constants.ts";
import type { Profile } from "../../../src/lib/market/questions/profile.ts";
import type { SuggestionRow } from "../../../src/lib/market/questions/market-set.ts";
import { derivableMarket, rederiveQuestions } from "../../../src/lib/market/questions/rederive.ts";
import { passesRelevanceGuard, selectTwelve } from "../../../src/lib/market/questions/select.ts";
import {
  headTermOf,
  pooledMarket,
  seedLadder,
  selectWidened,
} from "../../../src/lib/market/questions/widen.ts";

const FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/market-set.json"), "utf8")
) as { profile: Profile; market: SuggestionRow[] };
const PROFILE = FIXTURE.profile;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("the seed ladder", () => {
  it("a head term is the 2–3 words before the category's first connective, and none where that is the category", () => {
    expect(headTermOf("user onboarding software for saas teams")).toBe("user onboarding software");
    expect(headTermOf("AI SEO content platform")).toBe("seo content platform");
    expect(headTermOf("user onboarding software")).toBeNull();
    expect(headTermOf("scheduling")).toBeNull();
  });

  it("orders the confirmed category, its head term, then the vocabulary — each once", () => {
    const profile = { ...PROFILE, vocabulary: ["onboarding", "User Onboarding Software", "tooltip"] };
    expect(seedLadder(profile, "user onboarding software for saas teams")).toEqual([
      "user onboarding software for saas teams",
      "user onboarding software",
      "onboarding",
      "tooltip",
    ]);
    expect(seedLadder({ ...profile, category: "" })).toEqual(["onboarding", "User Onboarding Software", "tooltip"]);
  });
});

describe("the pool and the steps", () => {
  it("an established market selects exactly what the suggestions alone select, whatever the pool holds", () => {
    const pool = [
      { keyword: "appcues pricing", volume: 90000, rival: "appcues.com" },
      { keyword: "onboarding", volume: 50000, rival: null },
    ];
    expect(selectWidened({ profile: PROFILE, suggestions: FIXTURE.market, pool })).toEqual(
      selectTwelve({ profile: PROFILE, market: FIXTURE.market })
    );
  });

  it("de-duplicates the pool against the suggestions and names every rival that ranks for a search", () => {
    const market = pooledMarket(
      [{ keyword: "Onboarding Tool", volume: 30 }],
      [
        { keyword: "onboarding tool", volume: 30, rival: "appcues.com" },
        { keyword: "onboarding  tool", volume: 30, rival: "userpilot.com" },
      ]
    );
    expect(market).toEqual([{ keyword: "Onboarding Tool", volume: 30, rivals: ["appcues.com", "userpilot.com"] }]);
  });

  it("steps the floor down only while short, and records the step on each question", () => {
    const suggestions = [
      { keyword: "user onboarding software", volume: 400 },
      { keyword: "onboarding checklist", volume: 20 },
      { keyword: "product tour tool", volume: 10 },
      { keyword: "walkthrough software", volume: 9 },
    ];
    const selected = selectWidened({ profile: PROFILE, suggestions, pool: [] });
    expect(selected.map((s) => [s.keyword, s.floor])).toEqual(
      expect.arrayContaining([
        ["user onboarding software", 50],
        ["onboarding checklist", 20],
        ["product tour tool", 10],
      ])
    );
    expect(selected.some((s) => s.keyword === "walkthrough software")).toBe(false);
    expect(selected.length).toBeLessThan(BATTERY.QUESTIONS);
  });

  it("stops at the first step that reaches twelve", () => {
    const eleven = selectTwelve({ profile: PROFILE, market: FIXTURE.market })
      .slice(0, 11)
      .map((s) => ({ keyword: s.keyword, volume: s.volume }));
    expect(selectTwelve({ profile: PROFILE, market: eleven })).toHaveLength(11);

    const selected = selectWidened({
      profile: PROFILE,
      suggestions: [...eleven, { keyword: "tooltip software", volume: 25 }, { keyword: "signup checklist", volume: 12 }],
      pool: [],
    });
    expect(selected).toHaveLength(BATTERY.QUESTIONS);
    expect(selected.find((s) => s.keyword === "tooltip software")?.floor).toBe(20);
    expect(selected.some((s) => s.keyword === "signup checklist")).toBe(false);
  });
});

describe("the relevance guard for a rival's rows", () => {
  it("a rival-sourced search is supported by that rival's brand, and nothing else is widened", () => {
    const profile = { ...PROFILE, namedRivals: [] };
    expect(passesRelevanceGuard("chameleon alternatives", profile)).toBe(false);
    expect(passesRelevanceGuard("chameleon alternatives", profile, undefined, ["chameleon.io"])).toBe(true);
    // The brand is the whole label, never its parts.
    expect(passesRelevanceGuard("user pilot alternatives", profile, undefined, ["user-pilot.com"])).toBe(false);
    expect(passesRelevanceGuard("pilot training courses", profile, undefined, ["user-pilot.com"])).toBe(false);
  });
});

describe("a category corrected at setup re-derives with the same pool and steps", () => {
  it("a thin stored market yields questions where the 50/mo cut yielded none", () => {
    const carried = derivableMarket({
      profile: PROFILE,
      suggestions: [
        { keyword: "employee scheduling app", volume: 20 },
        { keyword: "shift planner", volume: 4 },
      ],
      pool: [
        { keyword: "deputy alternatives", volume: 10, rival: "deputy.com" },
        { keyword: "rota", volume: 3, rival: null },
      ],
    });
    expect(carried.market).toEqual([{ keyword: "employee scheduling app", volume: 20 }]);
    expect(carried.pool).toEqual([{ keyword: "deputy alternatives", volume: 10, rival: "deputy.com" }]);

    const questions = rederiveQuestions({ ...carried, category: "employee scheduling" });
    expect(questions.map((q) => q.search)).toEqual(
      expect.arrayContaining(["employee scheduling app", "deputy alternatives"])
    );
  });
});
