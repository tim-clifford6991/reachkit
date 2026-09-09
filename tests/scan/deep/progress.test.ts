// tests/scan/deep/progress.test.ts — BUILD §4.3, issue #36
//
// The progress frame: which step, never how long — and the read that
// latches the ten-minute deadline, because there is no scheduled job to
// do it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb, type FakeDb } from "./fake-db";

applyEnvFixture();

let db: FakeDb = fakeDb();

vi.mock("@/lib/db", () => ({
  dbAdmin: () => db.client,
  db: () => db.client,
}));

const { passProgressFor } = await import("../../../src/lib/scan/deep/progress");
const { STAGES } = await import("../../../src/lib/scan/stages");
const { TIMING } = await import("../../../src/lib/config/constants");

const SITE = "site-1";
const SUBMITTED = new Date(Date.UTC(2026, 8, 6, 12, 0, 0));
const INSIDE = new Date(SUBMITTED.getTime() + 60_000);
const PAST = new Date(SUBMITTED.getTime() + (TIMING.deepReleaseMin + 1) * 60_000);

const PROGRESS_SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/scan/deep/progress.ts"),
  "utf8"
);

function site(overrides: Record<string, unknown> = {}) {
  return {
    id: SITE,
    setup_completed_at: SUBMITTED.toISOString(),
    setup_released_at: null,
    setup_released_reason: null,
    setup_stage: null,
    setup_stage_times: {},
    ...overrides,
  };
}

beforeEach(() => {
  db = fakeDb({ sites: [site()] });
});

describe("REQ-029 c1 — which step is under way, in written words", () => {
  it.each([...STAGES])("a founder mid-pass at %s is told that step", async (stage) => {
    db = fakeDb({ sites: [site({ setup_stage: stage })] });
    expect(await passProgressFor(SITE, INSIDE)).toEqual({ running: true, stage, enteredAt: {} });
  });

  it("a pass that has recorded no stage yet reports the first one, never a blank", async () => {
    expect(await passProgressFor(SITE, INSIDE)).toEqual({
      running: true,
      stage: STAGES[0],
      enteredAt: {},
    });
  });

  it("a value in the column that is not a stage is not passed through as one", async () => {
    db = fakeDb({ sites: [site({ setup_stage: "something-else" })] });
    expect(await passProgressFor(SITE, INSIDE)).toEqual({ running: true, stage: STAGES[0], enteredAt: {} });
  });
});

describe("REQ-029 c1 as amended — recorded instants, and still no clock", () => {
  // The running frame carried `stage` alone, and this block asserted that
  // no member could hold a duration. UI-SPEC S11 draws a finished stage's
  // elapsed time, so the frame now carries the instant each stage began
  // (`sites.setup_stage_times`, issue #356) and the screen subtracts.
  //
  // What the frame still cannot carry is an estimate, a countdown, a
  // percentage or a running clock: three fields, and the third is a map of
  // *past* instants. The screen draws the current stage as a dash.
  it("the running frame carries the stage and the recorded entries, and nothing else", async () => {
    const frame = await passProgressFor(SITE, INSIDE);
    expect(Object.keys(frame).sort()).toEqual(["enteredAt", "running", "stage"]);
  });

  it("the ended frame has exactly two fields and neither can carry a duration", async () => {
    db = fakeDb({
      sites: [site({ setup_released_at: SUBMITTED.toISOString(), setup_released_reason: "completed" })],
    });
    const frame = await passProgressFor(SITE, INSIDE);
    expect(Object.keys(frame).sort()).toEqual(["degraded", "running"]);
  });

  it("the entries it passes through are only the stages this engine names", async () => {
    // A key the column carries that `STAGES` does not name is a stage from
    // an older shape; timing it would draw a row the screen has no name
    // for, so the reader drops it rather than passing it on.
    db = fakeDb({
      sites: [
        site({
          setup_stage: "scoring",
          setup_stage_times: { scoring: "2026-09-05T09:31:59.000Z", gone_away: "2026-09-05T09:00:00.000Z" },
        }),
      ],
    });
    const frame = await passProgressFor(SITE, INSIDE);
    expect(frame).toEqual({
      running: true,
      stage: "scoring",
      enteredAt: { scoring: "2026-09-05T09:31:59.000Z" },
    });
  });

  it("the reader passes instants through and computes no duration of its own", () => {
    // The subtraction is the screen's (`_setup/stages.ts`), and keeping it
    // there is what makes every number on S11 a difference between two
    // instants the pass recorded. A reader that subtracted would be a
    // second place a duration could be invented.
    // Code, not prose: the header discusses estimates in order to rule
    // them out, so the scan is for the operations a duration would need.
    const code = PROGRESS_SOURCE.split("\n")
      .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
      .join("\n");
    expect(code).not.toMatch(/Date\.parse|\bsetInterval\b|\bsetTimeout\b/);
  });

  it("an unreadable map is an empty one, never a claim that a stage took no time", async () => {
    db = fakeDb({ sites: [site({ setup_stage: "scoring", setup_stage_times: null })] });
    const frame = await passProgressFor(SITE, INSIDE);
    expect(frame).toEqual({ running: true, stage: "scoring", enteredAt: {} });
  });
});

describe("§4.3 — a degraded pass still releases setup", () => {
  it.each([
    ["completed", false],
    ["degraded", true],
    ["failed", true],
    ["deadline", true],
  ] as const)("a pass released as '%s' reports degraded = %s", async (reason, degraded) => {
    db = fakeDb({
      sites: [site({ setup_released_at: SUBMITTED.toISOString(), setup_released_reason: reason })],
    });
    expect(await passProgressFor(SITE, INSIDE)).toEqual({ running: false, degraded });
  });
});

describe("REQ-029 c5 — the read is the deadline's only trigger", () => {
  it("asking past the window releases the founder, with nothing scheduled", async () => {
    expect(await passProgressFor(SITE, PAST)).toEqual({ running: false, degraded: true });
    expect(db.tables.sites![0]!.setup_released_reason).toBe("deadline");
  });

  it("asking inside the window releases nobody", async () => {
    expect(await passProgressFor(SITE, INSIDE)).toEqual({ running: true, stage: STAGES[0], enteredAt: {} });
    expect(db.tables.sites![0]!.setup_released_at).toBeNull();
  });

  it("once released, a later read never puts the founder back on the progress screen", async () => {
    await passProgressFor(SITE, PAST);
    const muchLater = new Date(PAST.getTime() + 7 * 24 * 60 * 60_000);
    expect(await passProgressFor(SITE, muchLater)).toEqual({ running: false, degraded: true });
  });
});
