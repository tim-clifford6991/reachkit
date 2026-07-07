import { expect, test, vi, beforeEach } from "vitest";

// Mock serverDb() modelling the query shapes ensureDeepScan / hasDeepReport use:
// - "scans": a select(...).eq(...).maybeSingle() lookup and an update(...).eq().
// - "actions": a select(...).eq() count/head lookup (the deep-pass sentinel).
function makeDb(
  scanRow: { id: string; tier: string } | null,
  opts: { actionsCount?: number; actionsError?: string | null } = {},
) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: scanRow, error: null });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const scansSelect = vi.fn().mockReturnValue({ eq: selectEq });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  const actionsCount = opts.actionsCount ?? 0;
  const actionsError = opts.actionsError ?? null;
  const actionsEq = vi.fn().mockResolvedValue({
    count: actionsCount,
    error: actionsError ? { message: actionsError } : null,
  });
  const actionsSelect = vi.fn().mockReturnValue({ eq: actionsEq });

  const from = vi.fn((table: string) => {
    if (table === "actions") return { select: actionsSelect };
    return { select: scansSelect, update };
  });
  const serverDb = vi.fn().mockReturnValue({ from });
  return {
    serverDb,
    spies: { from, select: scansSelect, selectEq, maybeSingle, update, updateEq, actionsSelect, actionsEq },
  };
}

beforeEach(() => vi.resetModules());

async function load(db: ReturnType<typeof makeDb>, send: ReturnType<typeof vi.fn>) {
  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
  vi.doMock("@/lib/inngest/client", () => ({ inngest: { send } }));
  return (await import("./deepen")).ensureDeepScan;
}

test("ensureDeepScan promotes a free scan with no deep pass yet and enqueues deepen", async () => {
  const db = makeDb({ id: "s1", tier: "free" }, { actionsCount: 0 });
  const send = vi.fn().mockResolvedValue(undefined);
  const ensureDeepScan = await load(db, send);

  expect(await ensureDeepScan("s1")).toBe(true);
  expect(db.spies.update).toHaveBeenCalledWith({ tier: "full" });
  expect(send).toHaveBeenCalledWith({ name: "scan/deepen", data: { scanId: "s1" } });
});

test("ensureDeepScan no-ops when the deep pass already ran (actions rows exist)", async () => {
  const db = makeDb({ id: "s2", tier: "full" }, { actionsCount: 3 });
  const send = vi.fn();
  const ensureDeepScan = await load(db, send);

  expect(await ensureDeepScan("s2")).toBe(false);
  expect(db.spies.update).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

test("ensureDeepScan skips the tier write when already full but still enqueues", async () => {
  const db = makeDb({ id: "s3", tier: "full" }, { actionsCount: 0 });
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
  expect(db.spies.actionsEq).not.toHaveBeenCalled();
});
