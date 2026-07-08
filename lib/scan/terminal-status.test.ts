import { expect, test, vi, beforeEach } from "vitest";

// Mock serverDb() modelling the two query shapes terminal-status.ts uses:
// - "scans": select("report_payload").eq(id).maybeSingle() (the report lookup)
//            and update({status}).eq(id) (the terminal write).
function makeDb(
  scanRow: { report_payload: unknown } | null,
  opts: { lookupError?: string | null; updateError?: string | null } = {},
) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: scanRow,
    error: opts.lookupError ? { message: opts.lookupError } : null,
  });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });
  const updateEq = vi.fn().mockResolvedValue({
    error: opts.updateError ? { message: opts.updateError } : null,
  });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  const from = vi.fn(() => ({ select, update }));
  const serverDb = vi.fn().mockReturnValue({ from });
  return { serverDb, spies: { from, select, selectEq, maybeSingle, update, updateEq } };
}

beforeEach(() => vi.resetModules());

async function load(db: ReturnType<typeof makeDb>, emitScanEvent: ReturnType<typeof vi.fn>) {
  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
  vi.doMock("@/lib/scan/progress", () => ({ emitScanEvent }));
  return import("./terminal-status");
}

// ---------------------------------------------------------------------------
// terminalStatusForFailure
// ---------------------------------------------------------------------------

test("terminalStatusForFailure resolves 'degraded' when a report_payload was already persisted", async () => {
  const db = makeDb({ report_payload: { whatYouOffer: {} } });
  const { terminalStatusForFailure } = await load(db, vi.fn());

  expect(await terminalStatusForFailure("s1")).toBe("degraded");
  expect(db.spies.selectEq).toHaveBeenCalledWith("id", "s1");
});

test("terminalStatusForFailure resolves 'failed' when report_payload is null", async () => {
  const db = makeDb({ report_payload: null });
  const { terminalStatusForFailure } = await load(db, vi.fn());

  expect(await terminalStatusForFailure("s2")).toBe("failed");
});

test("terminalStatusForFailure resolves 'failed' (fail-safe) when the scan row is missing", async () => {
  const db = makeDb(null);
  const { terminalStatusForFailure } = await load(db, vi.fn());

  expect(await terminalStatusForFailure("s3")).toBe("failed");
});

test("terminalStatusForFailure resolves 'failed' (fail-safe) when the lookup errors", async () => {
  const db = makeDb(null, { lookupError: "db down" });
  const { terminalStatusForFailure } = await load(db, vi.fn());

  expect(await terminalStatusForFailure("s4")).toBe("failed");
});

// ---------------------------------------------------------------------------
// handleScanPipelineFailure — the shared onFailure body for scan-requested /
// scan-deepen. Must never throw, always emit the error event, and write the
// status terminalStatusForFailure resolves to.
// ---------------------------------------------------------------------------

test("handleScanPipelineFailure degrades (not fails) a scan that already has a report", async () => {
  const db = makeDb({ report_payload: { whatYouOffer: {} } });
  const emitScanEvent = vi.fn().mockResolvedValue(undefined);
  const { handleScanPipelineFailure } = await load(db, emitScanEvent);

  await handleScanPipelineFailure("s5", new Error("adapter timeout"));

  expect(emitScanEvent).toHaveBeenCalledWith("s5", "error", { message: "adapter timeout" });
  expect(db.spies.update).toHaveBeenCalledWith({ status: "degraded" });
  expect(db.spies.updateEq).toHaveBeenCalledWith("id", "s5");
});

test("handleScanPipelineFailure fails a scan with no persisted report", async () => {
  const db = makeDb({ report_payload: null });
  const emitScanEvent = vi.fn().mockResolvedValue(undefined);
  const { handleScanPipelineFailure } = await load(db, emitScanEvent);

  await handleScanPipelineFailure("s6", new Error("collect blew up"));

  expect(db.spies.update).toHaveBeenCalledWith({ status: "failed" });
});

test("handleScanPipelineFailure stringifies a non-Error thrown value for the error event message", async () => {
  const db = makeDb({ report_payload: null });
  const emitScanEvent = vi.fn().mockResolvedValue(undefined);
  const { handleScanPipelineFailure } = await load(db, emitScanEvent);

  await handleScanPipelineFailure("s7", "raw string rejection");

  expect(emitScanEvent).toHaveBeenCalledWith("s7", "error", { message: "raw string rejection" });
});

test("handleScanPipelineFailure never throws even if the terminal status write itself errors", async () => {
  const db = makeDb({ report_payload: { whatYouOffer: {} } }, { updateError: "transient write failure" });
  const emitScanEvent = vi.fn().mockResolvedValue(undefined);
  const { handleScanPipelineFailure } = await load(db, emitScanEvent);

  await expect(handleScanPipelineFailure("s8", new Error("x"))).resolves.toBeUndefined();
});
