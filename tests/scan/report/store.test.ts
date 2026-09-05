// tests/scan/report/store.test.ts — issue #25.
//
// The write half: one transaction, and a pass that produced no report
// never touches the pointer. The transaction itself is the migration's
// (`store_current_report`, `20260905120000_scans_current_flip.sql`) — what
// this suite decides is that the pipeline reaches it exactly once per pass,
// with the arguments the promise rests on, and holds no lock of its own.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../run/harness";

const rpc = vi.fn(async () => ({ error: null as { message: string } | null }));
const from = vi.fn();

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({ rpc, from }),
  db: () => ({ rpc, from }),
}));

const { storeCurrentReport } = await import("../../../src/lib/scan/store");
const { assembleReport } = await import("../../../src/lib/scan/store");
const { fullSections, unreachedSections, AT, DOMAIN } = await import("./fixtures");

const STORE_SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/scan/store.ts"),
  "utf8"
);
const MIGRATION = readFileSync(
  path.resolve(import.meta.dirname, "../../../supabase/migrations/20260905120000_scans_current_flip.sql"),
  "utf8"
);

beforeEach(() => {
  rpc.mockClear();
  rpc.mockResolvedValue({ error: null });
  from.mockClear();
});

function argsOfLastCall(): Record<string, unknown> {
  const call = rpc.mock.calls.at(-1) as unknown as [string, Record<string, unknown>];
  return call[1];
}

describe("the row write and the pointer flip are one transaction", () => {
  it("is one call, and it is the function the migration declares", async () => {
    await storeCurrentReport({ report: assembleReport(fullSections()), drivers: DRIVERS, degraded: false, costCents: 6 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect((rpc.mock.calls[0] as unknown as [string])[0]).toBe("store_current_report");
    // No second round trip against `scans`: the two statements the partial
    // unique index forces are inside the function body, not here.
    expect(from).not.toHaveBeenCalled();
  });

  it("the migration clears the previous pointer before setting this one", () => {
    const clear = MIGRATION.indexOf("set is_current = false");
    const set = MIGRATION.indexOf("set is_current = true");
    expect(clear).toBeGreaterThan(-1);
    expect(set).toBeGreaterThan(clear);
    // The index is the constraint; the function only makes the pair atomic.
    expect(MIGRATION).not.toMatch(/for update/i);
    expect(MIGRATION).not.toMatch(/pg_advisory/i);
    expect(STORE_SOURCE).not.toMatch(/for update/i);
  });
});

describe("a failed pass changes nothing a reader can see", () => {
  it("never asks for the pointer to move", async () => {
    const result = await storeCurrentReport({
      report: assembleReport(unreachedSections({ stoppedReason: "failed" })),
      drivers: DRIVERS,
      degraded: false,
      costCents: 2,
    });
    expect(argsOfLastCall().p_make_current).toBe(false);
    expect(result.status).toBe("failed");
  });

  it("a ceiling still becomes the current report — the customer gets back what was measured", async () => {
    for (const stoppedReason of ["time_ceiling", "spend_ceiling"] as const) {
      const result = await storeCurrentReport({
        report: assembleReport(unreachedSections({ stoppedReason })),
        drivers: DRIVERS,
        degraded: false,
        costCents: 4,
      });
      expect(argsOfLastCall().p_make_current).toBe(true);
      expect(result.status).toBe("degraded");
    }
  });
});

describe("the row the pass writes", () => {
  it("keeps `score` and the blob's verdict in step — the check constraint's own rule", async () => {
    await storeCurrentReport({ report: assembleReport(fullSections()), drivers: DRIVERS, degraded: false, costCents: 6 });
    expect(argsOfLastCall().p_score).toBe(31);

    await storeCurrentReport({ report: assembleReport(unreachedSections()), drivers: DRIVERS, degraded: false, costCents: 6 });
    expect(argsOfLastCall().p_score).toBeNull();
  });

  it("carries the correction's superseded scan only when there is one", async () => {
    await storeCurrentReport({ report: assembleReport(fullSections()), drivers: DRIVERS, degraded: false, costCents: 6 });
    expect(argsOfLastCall().p_supersedes_scan_id).toBeNull();

    await storeCurrentReport({
      report: assembleReport(fullSections()),
      supersedesScanId: "22222222-2222-4222-8222-222222222222",
      drivers: DRIVERS,
      degraded: false,
      costCents: 6,
    });
    expect(argsOfLastCall().p_supersedes_scan_id).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("ledgers the money the pass spent, rounded up to the cent the column holds", async () => {
    await storeCurrentReport({ report: assembleReport(fullSections()), drivers: DRIVERS, degraded: false, costCents: 6.3 });
    expect(argsOfLastCall().p_cost_cents).toBe(7);
  });

  it("writes the domain and the date the report itself carries", async () => {
    await storeCurrentReport({ report: assembleReport(fullSections()), drivers: DRIVERS, degraded: false, costCents: 6 });
    const args = argsOfLastCall();
    expect(args.p_domain).toBe(DOMAIN);
    expect((args.p_report as { measuredAt: Date }).measuredAt).toBe(AT);
  });

  it("raises when the transaction did not commit — never reports a store that did not happen", async () => {
    rpc.mockResolvedValue({ error: { message: "deadlock detected" } });
    await expect(
      storeCurrentReport({ report: assembleReport(fullSections()), drivers: DRIVERS, degraded: false, costCents: 6 })
    ).rejects.toThrow(/deadlock detected/);
  });
});

const DRIVERS = {
  foundations: { kind: "measured" as const, value: 40, at: AT },
  answerability: { kind: "measured" as const, value: 30, at: AT },
  searchPresence: { kind: "zero" as const, value: 0, at: AT },
  aiPresence: { kind: "zero" as const, value: 1, at: AT },
};
