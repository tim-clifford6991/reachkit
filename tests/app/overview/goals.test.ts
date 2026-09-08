// tests/app/overview/goals.test.ts — BUILD §4.5's data rule, and DECISIONS
// 2026-09-03's amendment to it.
//
// Two things are decided here: every goal's number comes from the pins and
// from nowhere else, and there is no score goal — because there is no score
// tile.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GOAL_VALUES } from "@/lib/config/constants";
import { GOAL_KEYS, GOALS } from "@/app/(account)/app/_overview/goals";

const OVERVIEW_DIR = path.resolve(import.meta.dirname, "../../../src/app/(account)/app/_overview");

describe("the three goals, and their values", () => {
  it("every goal key has a value and a meaning key", () => {
    for (const key of GOAL_KEYS) {
      expect(GOALS[key].value).toBeTypeOf("number");
      expect(GOALS[key].meansKey).toBeTruthy();
    }
  });

  it("each value is read from GOAL_VALUES, so changing a pin moves the screen", () => {
    expect(GOALS.searches_appeared_in.value).toBe(GOAL_VALUES.searches_appeared_in);
    expect(GOALS.ai_answers.value).toBe(GOAL_VALUES.ai_answers);
    expect(GOALS.pages_published.value).toBe(GOAL_VALUES.pages_published);
  });

  it("the pages-published goal is the owner's ruled 30, and it is not optional", () => {
    expect(GOALS.pages_published.value).toBe(30);
    expect(Object.prototype.hasOwnProperty.call(GOALS.pages_published, "value")).toBe(true);
  });

  it("the three meaning keys are distinct — three goals are never one sentence", () => {
    const keys = GOAL_KEYS.map((key) => GOALS[key].meansKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("UI-SPEC ruling 6a — the score's tile came back to Overview", () => {
  // DECISIONS 2026-09-03 read "The composite score has no tile on
  // Overview", and this block asserted exactly that. The owner's approved
  // screen set (2026-09-08) reverses it: ruling 6a names "Overview tile"
  // among the surfaces that label the Discoverability Score, and S12 draws
  // it first of the three. The DECISIONS row recording the supersession is
  // the owner's to write; the set is the newer artifact and #353 follows
  // it.
  it("there is a score goal key, and it is the pin the free report already used", () => {
    expect(GOAL_KEYS).toContain("score");
    expect(Object.keys(GOALS)).toContain("score");
    expect(GOALS.score.value).toBe(GOAL_VALUES.score);
  });

  it("the first half of the 2026-09-03 ruling stands — the AI tile still shows one reading", () => {
    // No second AI-answers goal, and no per-question key: the amendment
    // that survived is the one about movement, not the one about the tile.
    expect(GOAL_KEYS.filter((key) => key.startsWith("ai"))).toEqual(["ai_answers"]);
  });
});

describe("no goal number is written inside the screen", () => {
  it("goals.ts is the only file in the directory that reads GOAL_VALUES", () => {
    const readers = readdirSync(OVERVIEW_DIR).filter((file) =>
      readFileSync(path.join(OVERVIEW_DIR, file), "utf8").includes("GOAL_VALUES")
    );
    expect(readers).toEqual(["goals.ts"]);
  });

  it("goals.ts itself writes no numeric literal for a goal", () => {
    const source = readFileSync(path.join(OVERVIEW_DIR, "goals.ts"), "utf8");
    for (const value of Object.values(GOAL_VALUES)) {
      // The values may appear in prose (the file explains where they come
      // from); what must not appear is one being assigned.
      expect(source).not.toMatch(new RegExp(`value:\\s*${value}\\b`));
    }
  });
});
