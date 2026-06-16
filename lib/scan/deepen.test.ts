import { expect, test, vi, beforeEach } from "vitest";

// Mock serverDb() modelling the two query shapes ensureDeepScan uses against
// "scans": a select(...).eq(...).maybeSingle() lookup and an update(...).eq().
function makeDb(scanRow: { id: string; tier: string; report_payload: unknown } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: scanRow, error: null });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const from = vi.fn().mockReturnValue({ select, update });
  const serverDb = vi.fn().mockReturnValue({ from });
  return { serverDb, spies: { from, select, selectEq, maybeSingle, update, updateEq } };
}

beforeEach(() => vi.resetModules());

async function load(db: ReturnType<typeof makeDb>, send: ReturnType<typeof vi.fn>) {
  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
  vi.doMock("@/lib/inngest/client", () => ({ inngest: { send } }));
  return (await import("./deepen")).ensureDeepScan;
}

test("ensureDeepScan promotes a free scan with no report and enqueues deepen", async () => {
  const db = makeDb({ id: "s1", tier: "free", report_payload: null });
  const send = vi.fn().mockResolvedValue(undefined);
  const ensureDeepScan = await load(db, send);

  expect(await ensureDeepScan("s1")).toBe(true);
  expect(db.spies.update).toHaveBeenCalledWith({ tier: "full" });
  expect(send).toHaveBeenCalledWith({ name: "scan/deepen", data: { scanId: "s1" } });
});

test("ensureDeepScan no-ops when the scan already has a report", async () => {
  const db = makeDb({ id: "s2", tier: "full", report_payload: { x: 1 } });
  const send = vi.fn();
  const ensureDeepScan = await load(db, send);

  expect(await ensureDeepScan("s2")).toBe(false);
  expect(db.spies.update).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

test("ensureDeepScan skips the tier write when already full but still enqueues", async () => {
  const db = makeDb({ id: "s3", tier: "full", report_payload: null });
  const send = vi.fn().mockResolvedValue(undefined);
  const ensureDeepScan = await load(db, send);

  expect(await ensureDeepScan("s3")).toBe(true);
  expect(db.spies.update).not.toHaveBeenCalled(); // already full
  expect(send).toHaveBeenCalledWith({ name: "scan/deepen", data: { scanId: "s3" } });
});

test("ensureDeepScan returns false for a missing scan and enqueues nothing", async () => {
  const db = makeDb(null);
  const send = vi.fn();
  const ensureDeepScan = await load(db, send);

  expect(await ensureDeepScan("nope")).toBe(false);
  expect(send).not.toHaveBeenCalled();
});
