// tests/app/overview/goals.test.ts — the goal pins, where they are still
// read.
//
// SPEC §4, D22 and D23 (2026-10-02): the app leads with four numbers and
// has no fixed goals, and since issue 1319 (2026-10-07) the Overview tab
// draws neither a goal nor the Discoverability Score — `page.test.tsx`
// asserts that on the rendered screen. The Search and AI answers tabs still
// read `goals.ts`, so what is decided here is only that every number they
// read comes from the pins and from nowhere else.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GOAL_VALUES, WEEK_PLAN } from "@/lib/config/constants";
import { measured } from "@/lib/measure/measured";
import { copy } from "@/lib/presentation/copy";
import { GOAL_KEYS, GOALS } from "@/app/(account)/app/_overview/goals";
import { carriedBy } from "@/app/(account)/app/_overview/present";

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

describe("the pages goal says the week plan's pace", () => {
  it("its means line is the week's pages from the plan, never a daily pace", () => {
    const carried = carriedBy({ value: measured(3, new Date("2026-10-19T00:00:00.000Z")), goal: "pages_published" }, "overview.tile.pages.means");
    const means = copy("overview.tile.pages.means", { days: String(WEEK_PLAN.days) });
    expect(carried.kind === "goal" && carried.means).toBe(means);
    expect(means).toContain(`up to ${WEEK_PLAN.days} a week`);
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
