// tests/scan/free/stuck-scans.test.ts — issue #438
//
// The sweep that finishes a free pass nobody is coming back for, and the
// engine seam the maintenance tick reaches it through.
//
// The live check on 2026-09-10 found the defect this closes: a claimed
// row `running` at zero cents with no `fetches` rows and no `finished_at`,
// because the invocation that was to run the pass had been frozen the
// moment the response went out. The row is not inert — §6.4's in-flight
// bound reads exactly `status = 'running'`, so it refuses that network's
// next visitor for ever. Every case below is about the row, never about
// the pipeline.
//
// `@/lib/db` is doubled with a PostgREST-shaped builder, on the same
// footing as `tests/scan/free/admission-claim.test.ts`'s own harness: what
// is under test is which filters the queries carry and what the answers
// mean, and a real socket would discriminate neither.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

// `@/jobs/engine` parses the environment the moment it is imported (its
// own static half reaches the deep pass, which reaches the model tiers),
// and the seam suite at the foot of this file imports it. Fixture values;
// no vendor and no database is reached with them.
applyEnvFixture();

vi.mock("@/lib/db", () => ({ dbAdmin: vi.fn() }));

import { dbAdmin } from "@/lib/db";
import { FREE_BOUNDS, TIMING } from "@/lib/config/constants";
import { finishScanLeftRunning, scansLeftRunning } from "@/lib/scan/stuck";

/** One recorded call: the table, the verb, every filter in the order the
 *  module applied them, and the values a write carried. */
interface Recorded {
  table: string;
  verb: "select" | "update";
  filters: [string, string, string][];
  values: Record<string, unknown> | null;
  order: { column: string; ascending: boolean } | null;
  limit: number | null;
}

const calls: Recorded[] = [];

/** What the next query answers with. A `null` error and a row list is the
 *  ordinary case; a message is the database refusing. */
let answer: { data: unknown[] | null; error: { message: string } | null } = { data: [], error: null };

function fakeClient(): unknown {
  return {
    from(table: string) {
      const call: Recorded = { table, verb: "select", filters: [], values: null, order: null, limit: null };
      calls.push(call);
      const builder = {
        select() {
          return builder;
        },
        update(values: Record<string, unknown>) {
          call.verb = "update";
          call.values = values;
          return builder;
        },
        eq(column: string, value: string) {
          call.filters.push([column, "eq", value]);
          return builder;
        },
        lt(column: string, value: string) {
          call.filters.push([column, "lt", value]);
          return builder;
        },
        order(column: string, opts: { ascending: boolean }) {
          call.order = { column, ascending: opts.ascending };
          return builder;
        },
        limit(n: number) {
          call.limit = n;
          return builder;
        },
        then(resolve: (value: typeof answer) => unknown) {
          return Promise.resolve(answer).then(resolve);
        },
      };
      return builder;
    },
  };
}

const NOW = new Date("2026-09-10T04:18:00.000Z");
/** The stuck row the live check found, by its own id. */
const GHOST = "2507cd65-a899-4dd1-9fbb-b7284eca688d";

beforeEach(() => {
  calls.length = 0;
  answer = { data: [], error: null };
  vi.mocked(dbAdmin).mockReturnValue(fakeClient() as ReturnType<typeof dbAdmin>);
});

describe("scansLeftRunning — which free passes are not coming back", () => {
  it("asks for free rows still running older than the ceiling a free pass bounds itself by", async () => {
    answer = { data: [{ id: GHOST }], error: null };
    expect(await scansLeftRunning(NOW)).toEqual([GHOST]);

    const call = calls[0]!;
    expect(call.table).toBe("scans");
    expect(call.verb).toBe("select");
    expect(call.filters).toContainEqual(["tier", "eq", "free"]);
    expect(call.filters).toContainEqual(["status", "eq", "running"]);
  });

  it("the threshold is the report ceiling itself, read from the pin and never written twice", async () => {
    await scansLeftRunning(NOW);
    const cutoff = calls[0]!.filters.find(([column, op]) => column === "created_at" && op === "lt");
    expect(cutoff).toBeDefined();
    expect(new Date(cutoff![2]).getTime()).toBe(NOW.getTime() - TIMING.reportCeilingS * 1000);
  });

  it("a row inside the ceiling is not this sweep's business — the pass may still be running", async () => {
    // The query is what decides it, so the assertion is on the boundary
    // the query carries: a row created one second inside the cutoff is not
    // matched by `created_at < cutoff`.
    await scansLeftRunning(NOW);
    const cutoff = new Date(calls[0]!.filters.find(([c, op]) => c === "created_at" && op === "lt")![2]);
    const stillRunning = new Date(NOW.getTime() - (TIMING.reportCeilingS - 1) * 1000);
    expect(stillRunning.getTime()).toBeGreaterThan(cutoff.getTime());
  });

  it("is bounded and ordered — oldest first, and never an unbounded walk of the table", async () => {
    await scansLeftRunning(NOW);
    expect(calls[0]!.limit).toBe(FREE_BOUNDS.scansPerDay);
    expect(calls[0]!.order).toEqual({ column: "created_at", ascending: true });
  });

  it("a database that cannot answer is a fault, not an empty sweep", async () => {
    answer = { data: null, error: { message: "the database is unreachable" } };
    await expect(scansLeftRunning(NOW)).rejects.toThrow(/unreachable/);
  });
});

describe("finishScanLeftRunning — the row stops blocking the next visitor", () => {
  it("finishes it as failed, with a reason and an instant, and touches nothing else", async () => {
    answer = { data: [{ id: GHOST }], error: null };
    expect(await finishScanLeftRunning(GHOST)).toEqual({ finished: true });

    const call = calls[0]!;
    expect(call.verb).toBe("update");
    expect(call.values).toMatchObject({ status: "failed", stopped_reason: "failed" });
    expect(typeof call.values!.finished_at).toBe("string");
    // The money the frozen pass did spend stays where the ledger is
    // (§6.5's `fetches`), and `cost_cents` is the stored report's field.
    expect(call.values).not.toHaveProperty("cost_cents");
    expect(call.values).not.toHaveProperty("report");
  });

  it("never claims a ceiling that would mean a stored report — a ghost stored none", async () => {
    answer = { data: [{ id: GHOST }], error: null };
    await finishScanLeftRunning(GHOST);
    expect(calls[0]!.values!.stopped_reason).not.toBe("time_ceiling");
    expect(calls[0]!.values!.stopped_reason).not.toBe("spend_ceiling");
  });

  it("writes only a row that is still running, so a pass finishing underneath it keeps its report", async () => {
    answer = { data: [], error: null };
    expect(await finishScanLeftRunning(GHOST)).toEqual({ finished: false });
    expect(calls[0]!.filters).toContainEqual(["id", "eq", GHOST]);
    expect(calls[0]!.filters).toContainEqual(["status", "eq", "running"]);
  });

  it("a database that cannot write is a fault the tick sees", async () => {
    answer = { data: null, error: { message: "the database is unreachable" } };
    await expect(finishScanLeftRunning(GHOST)).rejects.toThrow(/unreachable/);
  });
});

describe("the engine seam holds no rule of its own", () => {
  it("both members are one call into the module that owns the rule", async () => {
    const engine = await import("@/jobs/engine");

    answer = { data: [{ id: GHOST }], error: null };
    expect(await engine.scansLeftRunning()).toEqual([GHOST]);
    expect(calls[0]!.filters).toContainEqual(["status", "eq", "running"]);

    expect(await engine.finishScanLeftRunning(GHOST)).toEqual({ done: true });
    expect(calls[1]!.verb).toBe("update");
  });

  it("a row that had already finished itself is not a degraded tick", async () => {
    const engine = await import("@/jobs/engine");
    answer = { data: [], error: null };
    expect(await engine.finishScanLeftRunning(GHOST)).toEqual({ done: true });
  });
});
