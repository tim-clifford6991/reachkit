// tests/scan/deep/run.test.ts — BUILD §4.3, issue #36
//
// The deep pass is `runScan` at `tier: 'deep'` — one pipeline, tier a
// parameter — plus the two things onboarding needs: the founder's named
// stage written where the waiting screen can read it, and the release
// latch written whatever the pass ended as.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb, type FakeDb } from "./fake-db";

applyEnvFixture();

let db: FakeDb = fakeDb();

/** What the pipeline is asked to do, and what it answers. The pipeline
 *  itself is issue #100's and is not re-tested here; what is tested is
 *  that this module passes the tier through and adds no second pipeline. */
const pipeline = vi.fn();

vi.mock("@/lib/db", () => ({
  dbAdmin: () => db.client,
  db: () => db.client,
}));

vi.mock("@/lib/scan/run", () => ({
  runScan: (a: unknown) => pipeline(a),
}));

const { reasonFor, runDeepPass } = await import("../../../src/lib/scan/deep/run");
const { STAGES } = await import("../../../src/lib/scan/stages");

const SITE = "site-1";
const SUBMITTED = new Date(Date.UTC(2026, 8, 6, 12, 0, 0));

const RUN_CODE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/scan/deep/run.ts"),
  "utf8"
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

beforeEach(() => {
  pipeline.mockReset();
  db = fakeDb({
    sites: [
      {
        id: SITE,
        domain: "example.com",
        setup_completed_at: SUBMITTED.toISOString(),
        setup_released_at: null,
        setup_released_reason: null,
        setup_stage: null,
      },
    ],
  });
});

describe("§4.3 — the deep pass is the one pipeline with tier as a parameter", () => {
  it("calls runScan once, at tier 'deep', with the founder's own site and domain", async () => {
    pipeline.mockResolvedValue({ scanId: "scan-1", status: "done" });
    await runDeepPass({ siteId: SITE, domain: "example.com" });

    expect(pipeline).toHaveBeenCalledTimes(1);
    const args = pipeline.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.tier).toBe("deep");
    expect(args.domain).toBe("example.com");
    expect(args.siteId).toBe(SITE);
  });

  it("holds no stage list, no ceiling and no cost arithmetic of its own", () => {
    // `StageName` is imported as a type; the ordered list of stages, the
    // bounds and the spend are all the pipeline's and are named nowhere
    // here.
    expect(RUN_CODE).not.toMatch(/\bSTAGES\b|withScanBounds|\bcap\b|cents/);
  });
});

describe("REQ-029 c1 — the step named is the step actually running", () => {
  it("every stage the pipeline enters is written to the founder's row, in order", async () => {
    const seen: unknown[] = [];
    pipeline.mockImplementation(async (a: { onStage: (s: string) => Promise<void> }) => {
      for (const stage of STAGES) {
        await a.onStage(stage);
        seen.push(db.tables.sites![0]!.setup_stage);
      }
      return { scanId: "scan-1", status: "done" };
    });

    await runDeepPass({ siteId: SITE, domain: "example.com" });
    expect(seen).toEqual([...STAGES]);
  });

  it("the stage is cleared when the pass ends, so nothing reads as still running", async () => {
    pipeline.mockImplementation(async (a: { onStage: (s: string) => Promise<void> }) => {
      await a.onStage("scoring");
      return { scanId: "scan-1", status: "done" };
    });
    await runDeepPass({ siteId: SITE, domain: "example.com" });
    expect(db.tables.sites![0]!.setup_stage).toBeNull();
  });

  it("nothing written alongside the stage could carry a duration", () => {
    expect(RUN_CODE).not.toMatch(/elapsed|percent|\beta\b|\bETA\b|remaining|Date\.now/);
  });
});

describe("§4.3 — the pass releases the founder whatever it ended as", () => {
  it.each([
    ["done", "completed"],
    ["degraded", "degraded"],
    ["failed", "failed"],
  ] as const)("a %s pass latches '%s'", async (status, reason) => {
    expect(reasonFor(status)).toBe(reason);

    pipeline.mockResolvedValue({ scanId: "scan-1", status });
    const result = await runDeepPass({ siteId: SITE, domain: "example.com" });

    expect(result.reason).toBe(reason);
    expect(db.tables.sites![0]!.setup_released_reason).toBe(reason);
    expect(db.tables.sites![0]!.setup_released_at).not.toBeNull();
  });

  it("there is no arm in which a founder is held — every end state releases", () => {
    const statuses = ["done", "degraded", "failed"] as const;
    expect(new Set(statuses.map(reasonFor)).size).toBe(3);
  });

  it("a pass that finishes after the deadline already latched cannot overwrite it", async () => {
    db.tables.sites![0]!.setup_released_at = SUBMITTED.toISOString();
    db.tables.sites![0]!.setup_released_reason = "deadline";

    pipeline.mockResolvedValue({ scanId: "scan-1", status: "done" });
    await runDeepPass({ siteId: SITE, domain: "example.com" });

    expect(db.tables.sites![0]!.setup_released_reason).toBe("deadline");
  });
});

describe("a stage write that fails never stops a paid pass", () => {
  it("the pass completes and releases even when the row cannot be written", async () => {
    const broken = {
      from: () => {
        throw new Error("row unavailable");
      },
    };
    // Only the *stage* write goes through the throwing client; the latch
    // reads its own client, so this isolates the swallow to the stage.
    pipeline.mockImplementation(async (a: { onStage: (s: string) => Promise<void> }) => {
      const original = db.client.from;
      db.client.from = broken.from;
      await a.onStage("scoring");
      db.client.from = original;
      return { scanId: "scan-1", status: "done" };
    });

    const result = await runDeepPass({ siteId: SITE, domain: "example.com" });
    expect(result.status).toBe("done");
    expect(db.tables.sites![0]!.setup_released_reason).toBe("completed");
  });
});
