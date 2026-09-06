// tests/jobs/setup-wiring.test.ts — BUILD §4.3, issue #36
//
// The two places setup meets the queue: the deep pass, run by `scan/run`
// with tier as a parameter, and the setup reminders, ticked by
// `account/maintenance` as its sixth obligation.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();

const deepPass = vi.fn();
const dueReminders = vi.fn();
const sendReminder = vi.fn();

vi.mock("@/lib/scan/deep/run", () => ({ runDeepPass: (a: unknown) => deepPass(a) }));
vi.mock("@/lib/mail/setup/reminders", () => ({
  sitesDueSetupReminder: () => dueReminders(),
  sendSetupReminder: (id: string) => sendReminder(id),
}));

const engine = await import("../../src/jobs/engine");
const { scanRun } = await import("../../src/jobs/scan-run");
const { accountMaintenance } = await import("../../src/jobs/account-maintenance");
const { jobs } = await import("../../src/jobs/index");
const { JOB_IDS } = await import("../../src/jobs/types");

const NOW = new Date(Date.UTC(2026, 8, 6, 12, 0, 0));

beforeEach(() => {
  deepPass.mockReset();
  dueReminders.mockReset();
  sendReminder.mockReset();
  deepPass.mockResolvedValue({ scanId: "scan-1", status: "done", reason: "completed" });
  dueReminders.mockResolvedValue([]);
  sendReminder.mockResolvedValue({ sent: true, index: 0 });
});

describe("§11 — the registry stays closed at seven; setup adds no eighth job", () => {
  it("the seven ids are unchanged", () => {
    expect(jobs.map((j) => j.id)).toEqual([...JOB_IDS]);
    expect(JOB_IDS).toHaveLength(7);
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

  it("a free delivery does not take the deep path — the free arm is still #24's and fails loudly rather than reporting a pass nobody ran", async () => {
    const { EngineNotBuilt } = await import("../../src/jobs/engine");
    await expect(
      scanRun.run({ data: { scanId: "scan-2", domain: "example.com", tier: "free" }, now: NOW })
    ).rejects.toBeInstanceOf(EngineNotBuilt);
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

  it("the five obligations whose engines have not shipped no longer take the tick down with them", async () => {
    // Every one of the other five throws `EngineNotBuilt` today. Before
    // this issue the first of them ended the run, so nothing behind it in
    // the list — including a purge — ever ran.
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
