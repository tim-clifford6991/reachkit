// tests/jobs/registry.test.ts — BUILD §11
//
// The registry's four structural promises:
//   1. `serve()` exposes exactly GET, POST and PUT, over exactly the eight
//      definitions in `jobs` — an unregistered job is unreachable.
//   2. The `JobId` union is closed at eight; a ninth fails here.
//   3. The platform is named in exactly one file under `src/jobs/`, and
//      under `src/lib/` in exactly one: `src/lib/config/env.ts`, whose two
//      rows are the platform's bindings (issue #315). So the reversal is
//      that file, the one route, and two rows in the boot contract — named
//      here rather than left to be discovered.
//   4. No file under `src/jobs/` imports from `src/app/` (ARCHITECTURE:
//      dependency direction is one-way).
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubEnv } from "./env-fixture";
import { JOB_IDS, type JobId } from "@/jobs/types";
import { lineFor, LINE_FIELDS } from "@/jobs/observability";

const ROOT = path.resolve(import.meta.dirname, "../..");

// `src/jobs/kill-switch.ts` reads `env` at module load; every dynamic
// import below happens after this.
beforeEach(() => stubEnv(false));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, entry);
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...filesUnder(rel));
    else if (/\.tsx?$/.test(rel)) out.push(rel);
  }
  return out;
}

describe("the eight job ids", () => {
  it("is exactly the eight: BUILD §11's six, the maintenance tick, and §9's retry sweep", () => {
    expect([...JOB_IDS]).toEqual([
      "scan/run",
      "draft/generate",
      "publish/execute",
      "publish/verify",
      "publish/retry",
      "weekly/refresh",
      "lead/nurture",
      "account/maintenance",
    ]);
  });

  it("holds no duplicate", () => {
    expect(new Set(JOB_IDS).size).toBe(JOB_IDS.length);
  });
});

describe("the registry is closed over those eight", () => {
  it("`jobs` holds exactly one definition per id, in JOB_IDS order", async () => {
    const { jobs } = await import("@/jobs");
    expect(jobs.map((j) => j.id)).toEqual([...JOB_IDS]);
  });

  it("every definition carries a trigger and a run function", async () => {
    const { jobs } = await import("@/jobs");
    for (const job of jobs) {
      expect(["event", "cron"]).toContain(job.trigger.kind);
      expect(typeof job.run).toBe("function");
    }
  });

  it("serve() exposes exactly GET, POST and PUT, over exactly the registered eight", async () => {
    const served: unknown[][] = [];
    vi.resetModules();
    vi.doMock("inngest/next", () => ({
      serve: (options: { functions: unknown[] }) => {
        served.push(options.functions);
        return { GET: () => {}, POST: () => {}, PUT: () => {} };
      },
    }));
    const { serve, jobs } = await import("@/jobs");
    const handlers = serve();
    expect(Object.keys(handlers).sort()).toEqual(["GET", "POST", "PUT"]);
    expect(served).toHaveLength(1);
    expect(served[0]).toHaveLength(jobs.length);
    vi.doUnmock("inngest/next");
    vi.resetModules();
  });
});

describe("the platform is named in exactly one file", () => {
  const PLATFORM = /inngest/i;

  it("only src/jobs/client.ts names it under src/jobs/", () => {
    const naming = filesUnder("src/jobs").filter((f) => PLATFORM.test(readFileSync(path.join(ROOT, f), "utf8")));
    expect(naming).toEqual(["src/jobs/client.ts"]);
  });

  // Issue #315 put `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` into the
  // env schema: `BUILD.md` §15 names them, and a boot contract that omitted
  // them let a deployment start with no way to run a job and say nothing.
  // Naming two bindings is not importing an SDK — the claim this suite
  // protects is that swapping the platform is a bounded edit, and it stays
  // bounded — but the file is listed, so a third naming site fails here.
  it("only src/lib/config/env.ts names it under src/lib/, and only as its two bindings", () => {
    const naming = filesUnder("src/lib").filter((f) => PLATFORM.test(readFileSync(path.join(ROOT, f), "utf8")));
    expect(naming).toEqual(["src/lib/config/env.ts"]);
  });

  it("env.ts names no import of the platform's SDK", () => {
    const source = readFileSync(path.join(ROOT, "src/lib/config/env.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["']inngest/);
  });
});

describe("dependency direction is one-way", () => {
  it("no file under src/jobs/ imports from src/app/", () => {
    for (const file of filesUnder("src/jobs")) {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      expect(source, file).not.toMatch(/from\s+["']@\/app/);
    }
  });
});

describe("one log line per invocation, four fields plus the degraded step", () => {
  it("carries exactly the allow-listed fields", () => {
    const line = lineFor({ jobId: "scan/run" as JobId, subjectId: "s1", outcome: "ran", durationMs: 3 });
    expect(Object.keys(line)).toEqual(["event", "jobId", "subjectId", "outcome", "durationMs"]);
    for (const key of Object.keys(line)) expect(LINE_FIELDS).toContain(key);
  });

  it("a degraded outcome carries which step degraded and nothing else", () => {
    const line = lineFor({
      jobId: "scan/run" as JobId,
      subjectId: "s1",
      outcome: "degraded",
      durationMs: 3,
      step: "serp",
    });
    expect(line.step).toBe("serp");
    expect(Object.keys(line)).toEqual(["event", "jobId", "subjectId", "outcome", "durationMs", "step"]);
  });

  it("drops anything not on the allow-list — a vendor payload never reaches a line", () => {
    const line = lineFor({
      jobId: "scan/run" as JobId,
      subjectId: "s1",
      outcome: "ran",
      durationMs: 3,
      // @ts-expect-error — the point of the test: a field outside the interface
      vendorResponse: { body: "secret" },
    });
    expect(line).not.toHaveProperty("vendorResponse");
  });
});
