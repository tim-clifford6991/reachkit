// tests/app/calendar/stages.test.ts — BUILD §4.6, REQ-043 criterion 2
//
// WO-164 `## Test plan`, row 2: totality over the ten states, and the two
// placements the mapping is most likely to get wrong.
//
// Since issue #198 it also holds the coupling: the ten are §9's own set,
// read from the machine, and this module re-lists none of them. The
// assertion that keeps that true is the source one — a file that declared
// the ten again would pass every behavioural row here and fail that.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STATES as MACHINE_STATES } from "@/lib/publish/machine/table";
import { STOP_COMMAND, RESTART_COMMAND } from "@/app/(account)/app/calendar/actions";
import {
  STATES,
  STAGES,
  STAGE_FILTERS,
  STAGE_FILTER_COPY_KEY,
  STAGE_OF,
  STAGE_TONE,
  type State,
  type Stage,
} from "@/app/(account)/app/calendar/stages";
import { COPY } from "@/lib/presentation/copy";

describe('REQ-043 c2 — "no page renders without a stage"', () => {
  it("STAGE_OF is total over the ten publish states", () => {
    expect(STATES).toHaveLength(10);
    for (const state of STATES) {
      expect(Object.prototype.hasOwnProperty.call(STAGE_OF, state), state).toBe(true);
    }
    expect(Object.keys(STAGE_OF).sort()).toEqual([...STATES].sort());
  });

  it("every non-null arm names one of the five stages, and there is no sixth", () => {
    expect(STAGES).toHaveLength(5);
    for (const state of STATES) {
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
    const needsYou = STATES.filter((s) => STAGE_OF[s] === "needs_you");
    expect(needsYou).toEqual(["needs_attention"]);
  });

  it("skipped and unpublished occupy no date — they empty it instead (REQ-043 c4)", () => {
    const occupiesNoDate = STATES.filter((s) => STAGE_OF[s] === null);
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
    const mutated: Partial<Record<State, Stage | null>> = { ...STAGE_OF };
    delete mutated.published;
    expect(Object.keys(mutated).sort()).not.toEqual([...STATES].sort());
  });

  it("mapping failed to needs_you would give needs_you two states", () => {
    const mutated = { ...STAGE_OF, failed: "needs_you" as const };
    expect(STATES.filter((s) => mutated[s] === "needs_you")).toHaveLength(2);
  });
});

describe("issue #198 — one state set, and the calendar declares none of its own", () => {
  const ROOT = path.resolve(import.meta.dirname, "../../..");
  const source = readFileSync(
    path.join(ROOT, "src/app/(account)/app/calendar/stages.ts"),
    "utf8"
  );
  /** The module's code, with its comments stripped: the header explains the
   *  set it imports and names states in prose, and quoting a state in a
   *  comment is not declaring one. Same device as
   *  `tests/mail/leads/source.ts`. */
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
    .join("\n");

  it("the ten the projection is total over are the machine's own array, not a copy of it", () => {
    // Identity, not equality: a re-listing that happened to match today
    // would pass a deep-equal and fail this.
    expect(STATES).toBe(MACHINE_STATES);
  });

  it("stages.ts declares no state union of its own — the whole point of the issue", () => {
    // A second declaration is what drifts the day §9 gains a member, so it
    // is caught here as a fact about the file rather than remembered.
    // Probed on the four state names that are **only** ever states — never
    // a stage word — so a `STAGE_OF` key like `planned: "planned"` cannot
    // make this pass or fail for the wrong reason.
    for (const state of ["generating", "in_review", "needs_attention", "unpublished"]) {
      expect(code, state).not.toContain(`"${state}"`);
    }
    expect(code).not.toMatch(/\btype (PublishState|State)\s*=/);
    // And it does not re-spell the set under an old name.
    expect(code).not.toContain("PUBLISH_STATES");
  });

  it("every Record the calendar keys by state is total over the machine's set", () => {
    // The three the surfaces read. Totality is a compile-time property of
    // `Record<State, …>`; this is the runtime half, so a hand-written
    // object literal that lost a key fails here too.
    for (const table of [STAGE_OF, STOP_COMMAND, RESTART_COMMAND]) {
      expect(Object.keys(table).sort()).toEqual([...MACHINE_STATES].sort());
    }
  });

  it("a state added to the machine has nowhere to hide", () => {
    // The projection is read through the machine's array, so a new member
    // arrives in every loop above at once. Asserted as the coupling it is:
    // the calendar iterates §9's set and never a list of its own.
    const projected = MACHINE_STATES.map((state) => STAGE_OF[state]);
    expect(projected).toHaveLength(MACHINE_STATES.length);
    expect(projected.every((stage) => stage === null || STAGES.includes(stage))).toBe(true);
  });
});
