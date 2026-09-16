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
import { QUESTIONS_DIR, runtimeImportClosure } from "./import-graph.ts";

const FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/market-set.json"), "utf8")
) as { profile: Profile; market: SuggestionRow[] };

const PROFILE = FIXTURE.profile;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

function keywords(market: SuggestionRow[]): string[] {
  return selectTwelve({ profile: PROFILE, market }).map((s) => s.keyword);
}

function countIntent(market: SuggestionRow[], intent: Intent): number {
  return selectTwelve({ profile: PROFILE, market }).filter((s) => s.intent === intent).length;
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
    const first = selectTwelve({ profile: PROFILE, market: FIXTURE.market });
    for (let run = 0; run < 100; run++) {
      expect(selectTwelve({ profile: PROFILE, market: FIXTURE.market })).toEqual(first);
    }

    const random = lcg(20260905);
    const shuffled = [...FIXTURE.market];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    expect(selectTwelve({ profile: PROFILE, market: shuffled })).toEqual(first);
  });

  it("selects exactly the twelve, in rank order, ranked 1…12", () => {
    const selected = selectTwelve({ profile: PROFILE, market: FIXTURE.market });

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
      "user adoption platform",
      "best in-app guidance tools",
      "in-app guidance",
      "top user onboarding tools",
    ]);
  });

  it("scores by the pinned law — intentWeight × log10(volume + 1) — and breaks an exact tie on volume, then on the keyword", () => {
    const selected = selectTwelve({ profile: PROFILE, market: FIXTURE.market });

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

  it("decision and solution intent beat raw volume — a 4,400/mo informational search loses to a 390/mo decision one", () => {
    const selected = keywords(FIXTURE.market);

    expect(selected).toContain("top user onboarding tools"); // 390/mo, decision
    expect(selected).not.toContain("what is user onboarding"); // 4,400/mo, informational
  });
});

describe("selectTwelve — what never reaches the ranking", () => {
  it("drops every row under the pinned volume floor", () => {
    const selected = keywords(FIXTURE.market);

    expect(selected).not.toContain("user onboarding tooltip guide"); // 40/mo
    expect(selected).not.toContain("product tour walkthrough"); // 20/mo
    for (const search of selectTwelve({ profile: PROFILE, market: FIXTURE.market })) {
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
    const selected = selectTwelve({ profile: PROFILE, market: FIXTURE.market });
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

describe("selectTwelve — the composition constraints (a portfolio, not a leaderboard)", () => {
  it("meets both floors and breaks neither cap on the fixture", () => {
    const selected = selectTwelve({ profile: PROFILE, market: FIXTURE.market });
    const namesRival = (keyword: string) =>
      PROFILE.namedRivals.some((rival) => keyword.toLowerCase().includes(rival));

    expect(selected.filter((s) => s.intent === "decision").length).toBeGreaterThanOrEqual(
      SELECTION.minDecision
    );
    expect(selected.filter((s) => s.intent === "solution").length).toBeGreaterThanOrEqual(
      SELECTION.minSolution
    );
    expect(selected.filter((s) => namesRival(s.keyword)).length).toBeLessThanOrEqual(
      SELECTION.maxRivalBrand
    );
    expect(selected.filter((s) => /^how to\b/.test(s.keyword)).length).toBeLessThanOrEqual(
      SELECTION.maxHowTo
    );
  });

  it("the rival-brand cap skips a search that would exceed it, even though it outranks the twelfth", () => {
    const selected = selectTwelve({ profile: PROFILE, market: FIXTURE.market });
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

    const selected = selectTwelve({ profile: PROFILE, market });

    expect(selected.filter((s) => /^how to\b/.test(s.keyword))).toHaveLength(SELECTION.maxHowTo);
    expect(selected.map((s) => s.keyword)).toContain("user onboarding software");
  });

  it("enforces a floor by promoting the next-ranked search of that intent over a surplus one", () => {
    const market: SuggestionRow[] = [];
    for (let i = 0; i < 12; i++) {
      market.push({ keyword: `user onboarding software ${"tour ".repeat(i)}tool`, volume: 9000 - i });
    }
    for (let i = 0; i < 5; i++) {
      market.push({ keyword: `best onboarding ${"walkthrough ".repeat(i)}platform`, volume: 100 - i });
    }

    const selected = selectTwelve({ profile: PROFILE, market });

    expect(selected).toHaveLength(BATTERY.QUESTIONS);
    expect(countIntent(market, "decision")).toBe(SELECTION.minDecision);
    expect(countIntent(market, "solution")).toBe(BATTERY.QUESTIONS - SELECTION.minDecision);
  });

  it("relaxes the floor rather than the cap — a market whose only decision searches are rival-brand ones keeps the cap and returns fewer decisions", () => {
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

    const selected = selectTwelve({ profile: PROFILE, market });
    const rivals = selected.filter((s) =>
      PROFILE.namedRivals.some((rival) => s.keyword.includes(rival))
    );

    expect(rivals).toHaveLength(SELECTION.maxRivalBrand);
    expect(selected.filter((s) => s.intent === "decision").length).toBeLessThan(
      SELECTION.minDecision
    );
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

    const selected = selectTwelve({ profile: PROFILE, market });

    expect(selected).toHaveLength(5);
    expect(selected.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("an empty market selects nothing and completes — a domain that ranks for nothing still finishes this step", () => {
    expect(selectTwelve({ profile: PROFILE, market: [] })).toEqual([]);
  });

  it("a market of nothing but off-market rows selects nothing rather than relaxing the guard to fill twelve", () => {
    const market: SuggestionRow[] = Array.from({ length: 30 }, (_, i) => ({
      keyword: `warehouse forklift maintenance ${i}`,
      volume: 5000,
    }));

    expect(selectTwelve({ profile: PROFILE, market })).toEqual([]);
  });

  it("the founder's confirmed category joins the guard's support set — the searches its seed bought survive (#767)", () => {
    const market: SuggestionRow[] = [{ keyword: "warehouse forklift maintenance", volume: 5000 }];

    expect(selectTwelve({ profile: PROFILE, market })).toEqual([]);
    expect(
      selectTwelve({ profile: PROFILE, market, category: "warehouse forklift maintenance" }).map((s) => s.keyword)
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

      const selected = selectTwelve({ profile: PROFILE, market });

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

    selectTwelve({ profile: PROFILE, market: FIXTURE.market });

    const logged = JSON.parse(logSpy.mock.calls.at(-1)![0] as string) as Record<string, unknown>;
    expect(logged.event).toBe("selection");
    expect(logged.selected).toBe(BATTERY.QUESTIONS);
    expect(logged.boundBy).toBe("questions");
    expect(JSON.stringify(logged)).not.toContain("onboarding");
  });
});
