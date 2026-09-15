// tests/mail/ops/incident.test.ts — the owner's incident alert (issue 330).
//
// Owner ruling 2026-09-15: no error-tracking vendor; the existing mail seam
// tells `OWNER_EMAILS` when a job fails, is dead-lettered, or a deployment
// refuses to boot — with no PII in the mail. So the values it carries are
// closed names, and nothing on the path throws.
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

const sent = vi.hoisted(() => ({ calls: [] as { kind: string; to: string; blocks: unknown }[], fail: false }));
vi.mock("@/lib/mail/send", () => ({
  sendEmail: async (m: { kind: string; to: string; blocks: unknown }) => {
    if (sent.fail) throw new Error("vendor down");
    sent.calls.push(m);
    return { sent: true, id: "vendor-1" };
  },
}));

const { buildIncidentAlert, closedName } = await import("../../../src/lib/mail/templates/ops");
const { reportIncident } = await import("../../../src/lib/mail/ops");
const { reportDeadLettered } = await import("../../../src/jobs/run");
const { env } = await import("../../../src/lib/config/env");

afterEach(() => {
  sent.calls = [];
  sent.fail = false;
});

describe("the template — three occasions, closed names only", () => {
  it("each occasion speaks its own line", () => {
    const lines = [
      buildIncidentAlert({ occasion: "job-failed", jobId: "scan/run", attempt: 0, errorName: "TypeError" }),
      buildIncidentAlert({ occasion: "dead-lettered", jobId: "scan/run", errorName: "TypeError" }),
      buildIncidentAlert({ occasion: "boot-refused", check: "jobs", errorName: "MissingJobsBindings" }),
    ].map((mail) => (mail.blocks.find((b) => b.block === "paragraph") as { text: string }).text);
    expect(new Set(lines).size).toBe(3);
  });

  it("states the job, the attempt as a person counts it, and the error's class", () => {
    const mail = buildIncidentAlert({ occasion: "job-failed", jobId: "publish/execute", attempt: 2, errorName: "PostgrestError" });
    expect(mail.blocks.find((b) => b.block === "facts")).toEqual({
      block: "facts",
      items: [
        { label: "mail.ops.incident.fact.job", value: "publish/execute" },
        { label: "mail.ops.incident.fact.attempt", value: "3" },
        { label: "mail.ops.incident.fact.error", value: "PostgrestError" },
      ],
    });
  });

  it("a value that is not a name — a message, an address — is written as Error", () => {
    expect(closedName("TypeError")).toBe("TypeError");
    expect(closedName("could not reach owner@example.com")).toBe("Error");
    expect(closedName("")).toBe("Error");
  });
});

describe("the send — one per owner address, and nothing throws", () => {
  it("mails every OWNER_EMAILS address with the ops kind", async () => {
    await reportIncident({ occasion: "boot-refused", check: "clock", errorName: "FixedClockRefused" });
    expect(sent.calls.map((c) => [c.kind, c.to])).toEqual(env.OWNER_EMAILS.map((to) => ["ops", to]));
  });

  it("a vendor that throws is logged, never raised", async () => {
    sent.fail = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(reportIncident({ occasion: "dead-lettered", jobId: "scan/run", errorName: "Error" })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("a dead-lettered job tells the owner its id and the error's class, and not the error's message", async () => {
    await reportDeadLettered("weekly/refresh", new RangeError("site example.com had 3 rows"));
    const facts = JSON.stringify(sent.calls[0]?.blocks);
    expect(facts).toContain("weekly/refresh");
    expect(facts).toContain("RangeError");
    expect(facts).not.toContain("example.com");
  });
});
