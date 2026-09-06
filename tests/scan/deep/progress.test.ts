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
    ...overrides,
  };
}

beforeEach(() => {
  db = fakeDb({ sites: [site()] });
});

describe("REQ-029 c1 — which step is under way, in written words", () => {
  it.each([...STAGES])("a founder mid-pass at %s is told that step", async (stage) => {
    db = fakeDb({ sites: [site({ setup_stage: stage })] });
    expect(await passProgressFor(SITE, INSIDE)).toEqual({ running: true, stage });
  });

  it("a pass that has recorded no stage yet reports the first one, never a blank", async () => {
    expect(await passProgressFor(SITE, INSIDE)).toEqual({ running: true, stage: STAGES[0] });
  });

  it("a value in the column that is not a stage is not passed through as one", async () => {
    db = fakeDb({ sites: [site({ setup_stage: "something-else" })] });
    expect(await passProgressFor(SITE, INSIDE)).toEqual({ running: true, stage: STAGES[0] });
  });
});

describe("REQ-029 c1 — nothing on the screen states how long", () => {
  it("the running frame has exactly two fields and neither can carry a duration", async () => {
    const frame = await passProgressFor(SITE, INSIDE);
    expect(Object.keys(frame).sort()).toEqual(["running", "stage"]);
  });

  it("the ended frame has exactly two fields and neither can carry a duration", async () => {
    db = fakeDb({
      sites: [site({ setup_released_at: SUBMITTED.toISOString(), setup_released_reason: "completed" })],
    });
    const frame = await passProgressFor(SITE, INSIDE);
    expect(Object.keys(frame).sort()).toEqual(["degraded", "running"]);
  });

  it("mutation check — the union names no third field, so nothing here could hold one", () => {
    const union = PROGRESS_SOURCE.slice(
      PROGRESS_SOURCE.indexOf("export type DeepPassProgress"),
      PROGRESS_SOURCE.indexOf("interface StageRow")
    );
    expect(union).not.toMatch(/elapsed|percent|remaining|startedAt|heartbeat|At\b/);
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
    expect(await passProgressFor(SITE, INSIDE)).toEqual({ running: true, stage: STAGES[0] });
    expect(db.tables.sites![0]!.setup_released_at).toBeNull();
  });

  it("once released, a later read never puts the founder back on the progress screen", async () => {
    await passProgressFor(SITE, PAST);
    const muchLater = new Date(PAST.getTime() + 7 * 24 * 60 * 60_000);
    expect(await passProgressFor(SITE, muchLater)).toEqual({ running: false, degraded: true });
  });
});
