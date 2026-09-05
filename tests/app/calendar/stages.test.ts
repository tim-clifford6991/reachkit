// tests/app/calendar/stages.test.ts — BUILD §4.6, REQ-043 criterion 2
//
// WO-164 `## Test plan`, row 2: totality over the ten states, and the two
// placements the mapping is most likely to get wrong.
import { describe, expect, it } from "vitest";
import {
  PUBLISH_STATES,
  STAGES,
  STAGE_FILTERS,
  STAGE_FILTER_COPY_KEY,
  STAGE_OF,
  STAGE_TONE,
  type PublishState,
  type Stage,
} from "@/app/(account)/app/calendar/stages";
import { COPY } from "@/lib/presentation/copy";

describe('REQ-043 c2 — "no page renders without a stage"', () => {
  it("STAGE_OF is total over the ten publish states", () => {
    expect(PUBLISH_STATES).toHaveLength(10);
    for (const state of PUBLISH_STATES) {
      expect(Object.prototype.hasOwnProperty.call(STAGE_OF, state), state).toBe(true);
    }
    expect(Object.keys(STAGE_OF).sort()).toEqual([...PUBLISH_STATES].sort());
  });

  it("every non-null arm names one of the five stages, and there is no sixth", () => {
    expect(STAGES).toHaveLength(5);
    for (const state of PUBLISH_STATES) {
      const stage = STAGE_OF[state];
      if (stage !== null) expect(STAGES, state).toContain(stage);
    }
  });

  it("failed maps to scheduled, and needs_attention is the only state mapping to needs_you", () => {
    // BUILD §9 puts a failed publish "back in the queue with a written
    // reason" and retries ×3, so it is still on its way out; the state
    // after those retries are spent is the one that asks the customer for
    // something. Mutating `failed` to `needs_you` fails here.
    expect(STAGE_OF.failed).toBe("scheduled");
    const needsYou = PUBLISH_STATES.filter((s) => STAGE_OF[s] === "needs_you");
    expect(needsYou).toEqual(["needs_attention"]);
  });

  it("skipped and unpublished occupy no date — they empty it instead (REQ-043 c4)", () => {
    const occupiesNoDate = PUBLISH_STATES.filter((s) => STAGE_OF[s] === null);
    expect(occupiesNoDate.sort()).toEqual(["skipped", "unpublished"]);
  });
});

describe("BUILD §4.6 — the six filter cards, each with a word and a tone", () => {
  it("the filters are All plus the five stages, in §4.6's order", () => {
    expect([...STAGE_FILTERS]).toEqual(["all", "live", "your_review", "scheduled", "planned", "needs_you"]);
  });

  it("every filter's word is a registry key the owner has filled", () => {
    for (const filter of STAGE_FILTERS) {
      const key = STAGE_FILTER_COPY_KEY[filter];
      expect(Object.keys(COPY), filter).toContain(key);
      // §4.6 prints all six of these words, so none is owner-owed: a
      // filter card with no word would be a colour alone.
      expect(COPY[key], filter).not.toBe("");
    }
  });

  it("the five stages have five distinct tones — no two stages read as the same chip", () => {
    const tones = STAGES.map((s: Stage) => STAGE_TONE[s]);
    expect(new Set(tones).size).toBe(STAGES.length);
  });
});

describe("mutation checks", () => {
  it("a state dropped from STAGE_OF is caught by the totality check", () => {
    const mutated: Partial<Record<PublishState, Stage | null>> = { ...STAGE_OF };
    delete mutated.published;
    expect(Object.keys(mutated).sort()).not.toEqual([...PUBLISH_STATES].sort());
  });

  it("mapping failed to needs_you would give needs_you two states", () => {
    const mutated = { ...STAGE_OF, failed: "needs_you" as const };
    expect(PUBLISH_STATES.filter((s) => mutated[s] === "needs_you")).toHaveLength(2);
  });
});
