// tests/jobs/setup-wiring.test.ts — BUILD §4.3, issue #36
//
// The two places setup meets the queue: the deep pass, run by `scan/run`
// with tier as a parameter, and the setup reminders, ticked by
// `account/maintenance` as its sixth obligation — and, since issue #438,
// the seventh obligation on the same tick, which is not setup's but rides
// the harness this file already builds for that tick.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();

const deepPass = vi.fn();
const dueReminders = vi.fn();
const sendReminder = vi.fn();
const dueStuckScans = vi.fn();
const finishStuckScan = vi.fn();

vi.mock("@/lib/scan/deep/run", () => ({ runDeepPass: (a: unknown) => deepPass(a) }));
vi.mock("@/lib/mail/setup/reminders", () => ({
  sitesDueSetupReminder: () => dueReminders(),
  sendSetupReminder: (id: string) => sendReminder(id),
}));
// The payment half of the tick is built too (issue #33) and reads rows.
// Stood in with nothing due, so this suite reaches no database — what it
// is about is the sixth obligation and the two queue wires.
vi.mock("@/lib/account/provisioning/due-work", () => ({
  paymentsAwaitingSignIn: async () => [],
  paymentsWithoutAccounts: async () => [],
}));
// The seventh obligation (issue #438) reads `scans` rows on every tick, so
// it is stood in here for the same reason as the payment half.
vi.mock("@/lib/scan/stuck", () => ({
  scansLeftRunning: () => dueStuckScans(),
  finishScanLeftRunning: (id: string) => finishStuckScan(id),
}));

const engine = await import("../../src/jobs/engine");
const { scanRun } = await import("../../src/jobs/scan-run");
const { accountMaintenance } = await import("../../src/jobs/account-maintenance");
const { jobs } = await import("../../src/jobs/index");
const { JOB_IDS } = await import("../../src/jobs/types");
// The hosting half of the tick is built too (issue #34) and reads rows. It
// reads through the billing module's own store, so it is stood in through
// that module's door rather than by mocking the module — an empty store is
// a tick with nothing due, which is the state every case below wants.
const { setBillingStore } = await import("../../src/lib/account/billing");
const { memoryBillingStore, newMemoryBilling } = await import(
  "../account/billing/memory-store"
);
// The erasure half of the tick is built too (issue #52) and reads rows, on
// the same footing: stood in through its own module's door, with nothing
// tombstoned, so a tick has no account due for purge.
const { setLifecycleStore } = await import("../../src/lib/account/lifecycle");
const { memoryLifecycleStore, newMemoryLifecycle } = await import(
  "../account/lifecycle/memory-store"
);

const NOW = new Date(Date.UTC(2026, 8, 6, 12, 0, 0));

beforeEach(() => {
  setBillingStore(memoryBillingStore(newMemoryBilling()));
  setLifecycleStore(memoryLifecycleStore(newMemoryLifecycle()));
  deepPass.mockReset();
  dueReminders.mockReset();
  sendReminder.mockReset();
  deepPass.mockResolvedValue({ scanId: "scan-1", status: "done", reason: "completed" });
  dueReminders.mockResolvedValue([]);
  sendReminder.mockResolvedValue({ sent: true, index: 0 });
  dueStuckScans.mockReset();
  finishStuckScan.mockReset();
  dueStuckScans.mockResolvedValue([]);
  finishStuckScan.mockResolvedValue({ finished: true });
});

describe("§11 — the registry stays closed; setup adds no job of its own", () => {
  it("the ids are unchanged by anything in this file", () => {
    // Eight since issue #200 added §9's retry sweep. The number is what
    // makes an id arriving by accident fail here; what this suite is about
    // is that *setup* adds none.
    expect(jobs.map((j) => j.id)).toEqual([...JOB_IDS]);
    expect(JOB_IDS).toHaveLength(8);
  });
});

describe("§4.3 — the deep pass is `scan/run` at tier deep", () => {
  it("a deep delivery carrying a site goes through runDeepPass, not a second pipeline", async () => {
    const outcome = await scanRun.run({
      data: { scanId: "scan-1", domain: "example.com", tier: "deep", siteId: "site-1" },
      now: NOW,
    });

    expect(deepPass).toHaveBeenCalledWith({ siteId: "site-1", domain: "example.com" });
    expect(outcome).toEqual({ outcome: "ran", subjectId: "scan-1" });
  });

  it("a free delivery does not take the deep path — it is not a job path at all, and fails loudly rather than reporting a pass nobody ran", async () => {
    // Was `EngineNotBuilt` pointing at #24 (issue #229): the free arm is
    // not an engine waiting to be built. The free report runs inline on
    // `POST /api/scan` because §6.4 puts it at "≈60s live" with a human
    // waiting, so a `scan/run` event for it should never exist — and if
    // one arrives, the refusal says which it is.
    const { NotAJobPath } = await import("../../src/jobs/engine");
    await expect(
      scanRun.run({ data: { scanId: "scan-2", domain: "example.com", tier: "free" }, now: NOW })
    ).rejects.toBeInstanceOf(NotAJobPath);
    expect(deepPass).not.toHaveBeenCalled();
  });

  it("a degraded deep pass is reported as degraded, never as a plain run", async () => {
    deepPass.mockResolvedValue({ scanId: "scan-1", status: "degraded", reason: "degraded" });
    const outcome = await scanRun.run({
      data: { scanId: "scan-1", domain: "example.com", tier: "deep", siteId: "site-1" },
      now: NOW,
    });
    expect(outcome).toEqual({ outcome: "degraded", subjectId: "scan-1", step: "deep-pass" });
  });

  it("the job holds no tier logic — it reads the tier off the payload and refuses anything else", async () => {
    await expect(
      scanRun.run({ data: { scanId: "s", domain: "example.com", tier: "monthly" }, now: NOW })
    ).rejects.toThrow(/not one of/);
  });
});

describe("REQ-025 c6 — the reminders are the maintenance tick's sixth obligation", () => {
  it("a founder returned by the due-work query is handed to the sender", async () => {
    dueReminders.mockResolvedValue(["site-1", "site-2"]);
    const outcome = await accountMaintenance.run({ data: {}, now: NOW });

    expect(sendReminder).toHaveBeenCalledWith("site-1");
    expect(sendReminder).toHaveBeenCalledWith("site-2");
    expect(outcome).toEqual({ outcome: "ran", subjectId: null });
  });

  it("a tick with nobody due sends nothing and is recorded as a skip, never a silent pass", async () => {
    const outcome = await accountMaintenance.run({ data: {}, now: NOW });
    expect(sendReminder).not.toHaveBeenCalled();
    expect(outcome).toEqual({ outcome: "skipped", subjectId: null, reason: "no-subject" });
  });

  it("a reminder that did not send is not a degradation — the tick carries on", async () => {
    dueReminders.mockResolvedValue(["site-1"]);
    sendReminder.mockResolvedValue({ sent: false, reason: "no-link" });
    expect(await accountMaintenance.run({ data: {}, now: NOW })).toEqual({
      outcome: "ran",
      subjectId: null,
    });
  });

  it("the sixth obligation runs behind the other five, all of which are now built", async () => {
    // Every obligation in the list has an engine today: the payment pair
    // (issue #33), the hosting pair (issue #34), the purge (issue #52) and
    // these reminders (issue #36). Before issue #36 the first unbuilt
    // obligation ended the run, so nothing behind it in the list ever ran;
    // the skip that replaced it is asserted in
    // `tests/jobs/definitions.test.ts`, which still has a subject for it.
    dueReminders.mockResolvedValue(["site-1"]);
    await expect(accountMaintenance.run({ data: {}, now: NOW })).resolves.toBeDefined();
    expect(sendReminder).toHaveBeenCalledWith("site-1");
  });

  it("a query that fails for any other reason still stops the tick — an absence is not a fault", async () => {
    dueReminders.mockRejectedValue(new Error("the database is unreachable"));
    await expect(accountMaintenance.run({ data: {}, now: NOW })).rejects.toThrow(/unreachable/);
  });
});

describe("the engine seam holds no rule of its own", () => {
  it("both setup members are one call into the module that owns the rule", async () => {
    dueReminders.mockResolvedValue(["site-1"]);
    expect(await engine.sitesDueSetupReminder()).toEqual(["site-1"]);
    expect(await engine.remindSetup("site-1")).toEqual({ done: true });
    expect(sendReminder).toHaveBeenCalledWith("site-1");
  });
});

// ── Issue #438 — the seventh obligation ────────────────────────────────

describe("§6.4 — a free pass a frozen invocation left `running` is finished by the tick", () => {
  it("the row the sweep names is handed to the finisher, and the tick reports a run", async () => {
    dueStuckScans.mockResolvedValue(["scan-ghost-1"]);
    const outcome = await accountMaintenance.run({ data: {}, now: NOW });

    expect(finishStuckScan).toHaveBeenCalledWith("scan-ghost-1");
    expect(outcome).toEqual({ outcome: "ran", subjectId: null });
  });

  it("a tick with nothing stuck writes nothing — the ordinary hour", async () => {
    await accountMaintenance.run({ data: {}, now: NOW });
    expect(finishStuckScan).not.toHaveBeenCalled();
  });

  it("a row that finished itself between the query and the write is not a degradation", async () => {
    dueStuckScans.mockResolvedValue(["scan-ghost-1"]);
    finishStuckScan.mockResolvedValue({ finished: false });
    expect(await accountMaintenance.run({ data: {}, now: NOW })).toEqual({
      outcome: "ran",
      subjectId: null,
    });
  });
});
