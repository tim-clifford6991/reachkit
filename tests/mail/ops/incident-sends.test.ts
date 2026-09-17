// tests/mail/ops/incident-sends.test.ts — issue 330's alert, through the real seam (#759).
//
// `incident.test.ts` mocks `sendEmail`, so it passed while the seam refused
// every incident mail: each of its nine lines held the `TODO(copy)` marker,
// and `sendEmail` sends nothing that carries it. The owner was told nothing
// when a job died. Here the only double is the vendor's transport, so an
// unwritten line anywhere in the alert shows up as a mail that never left.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

const { reportIncident } = await import("../../../src/lib/mail/ops");
const { __setVendorTransportForTesting } = await import("../../../src/lib/mail/vendor/resend");
const { AWAITING_COPY, TODO_COPY_MARKER } = await import("../../../src/lib/presentation/copy");
type OpsIncident = import("../../../src/lib/mail/templates/ops").OpsIncident;

let requests: Record<string, unknown>[] = [];

beforeEach(() => {
  requests = [];
  __setVendorTransportForTesting(async (payload) => {
    requests.push(JSON.parse(payload) as Record<string, unknown>);
    return { status: 200, headers: {}, body: JSON.stringify({ id: "vendor-1" }) };
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  __setVendorTransportForTesting(null);
  vi.restoreAllMocks();
});

const INCIDENT_KEYS = [
  "mail.ops.incident.subject",
  "mail.ops.incident.heading",
  "mail.ops.incident.job-failed",
  "mail.ops.incident.dead-lettered",
  "mail.ops.incident.boot-refused",
  "mail.ops.incident.fact.job",
  "mail.ops.incident.fact.attempt",
  "mail.ops.incident.fact.error",
  "mail.ops.incident.fact.check",
  "mail.ops.incident.job-stale",
  "mail.ops.incident.fact.last-run",
  "mail.ops.incident.fact.interval",
] as const;

describe("#759 — the incident alert leaves, on every occasion", () => {
  it("none of its lines is awaiting copy", () => {
    for (const key of INCIDENT_KEYS) expect(AWAITING_COPY, key).not.toContain(key);
  });

  it.each<OpsIncident>([
    { occasion: "job-failed", jobId: "scan/run", attempt: 0, errorName: "TypeError" },
    { occasion: "dead-lettered", jobId: "scan/run", errorName: "TypeError" },
    { occasion: "boot-refused", check: "jobs", errorName: "MissingJobsBindings" },
    { occasion: "job-stale", jobId: "account/maintenance", lastRunAt: "2026-09-16T11:00:00.000Z", intervalMinutes: 15 },
  ])("$occasion reaches the vendor, with no marker in it", async (incident) => {
    await reportIncident(incident);

    expect(requests).toHaveLength(1);
    const mail = requests[0]!;
    for (const part of [mail.subject, mail.html, mail.text]) {
      expect(typeof part).toBe("string");
      expect(part).not.toContain(TODO_COPY_MARKER);
    }
  });
});
