// tests/app/scan-address/scan-running-wait.test.ts — issue #510.
//
// The in-flight refusal ("a scan is already running from your network")
// names a wait. It must be an upper bound the visitor can trust: a pass the
// platform froze leaves its row `running` until the sweep clears it, and
// the sweep keys on `TIMING.platformCeilingS + TIMING.sweepMarginS` from the
// row's `created_at`. So the wait is the time left until that bound, from
// the running scan's own age — never the pass's design ceiling, which would
// send the visitor back to be refused a second time. At or past the bound the
// row waits on the next maintenance sweep, so the wait is the tick interval,
// never 0 (master review on PR #520).
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../scan/run/harness";
import { MAINTENANCE_TICK_MINUTES, TIMING } from "@/lib/config/constants";
import type { Admission } from "@/lib/scan/admission";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { StoredReport } from "@/lib/scan/report";

const admitFreeScan = vi.fn<() => Promise<Admission>>();
const readCurrentReport = vi.fn<() => Promise<StoredReport | null>>();

vi.mock("@/lib/scan/removal", () => ({ isDomainRemoved: async () => false }));
vi.mock("@/lib/scan/admission", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/admission")>()),
  admitFreeScan: () => admitFreeScan(),
}));
vi.mock("@/lib/scan/report", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/report")>()),
  readCurrentReport: () => readCurrentReport(),
}));
// The unit word around the figure is `TODO(copy)` and renders as itself, so
// the registry is echoed with its slots: what is asserted is the figure the
// line carries, not a sentence.
vi.mock("@/lib/presentation/copy", () => ({
  copy: (key: string, slots?: Record<string, string>) => `${key}${slots ? JSON.stringify(slots) : ""}`,
}));

const { resolveAddress } = await import("@/app/(public)/scan/[domain]/_address/resolve");
const { refusalLine } = await import("@/app/(public)/scan/[domain]/_address/refusal");

const NETWORK = "network-key-fixture" as never;
const DOMAIN = "acme.com" as CanonicalDomain;
const NOW = new Date("2026-09-06T12:00:00.000Z");
const BOUND_S = TIMING.platformCeilingS + TIMING.sweepMarginS;
const TICK_S = MAINTENANCE_TICK_MINUTES * 60;

function secondsAgo(s: number): Date {
  return new Date(NOW.getTime() - s * 1000);
}

function inFlightElsewhere(runningSince?: Date): Admission {
  return runningSince === undefined
    ? { refuse: "in_flight", sameDomain: false }
    : { refuse: "in_flight", sameDomain: false, runningSince };
}

async function refusalFor(admission: Admission) {
  admitFreeScan.mockResolvedValue(admission);
  const state = await resolveAddress({ rawSegment: DOMAIN, network: NETWORK, now: NOW });
  if (state.kind !== "refused") throw new Error(`expected refused, got ${state.kind}`);
  if (state.refusal.reason !== "scan-running") throw new Error(`expected scan-running, got ${state.refusal.reason}`);
  return state.refusal;
}

beforeEach(() => {
  admitFreeScan.mockReset();
  readCurrentReport.mockReset();
  readCurrentReport.mockResolvedValue(null);
});

describe("#510 — the in-flight refusal's wait is the platform bound plus the sweep margin, from the scan's age", () => {
  it("reads the bound from the pins: 60 + 30 s", () => {
    expect(BOUND_S).toBe(90);
  });

  it("a scan 10 s old leaves 80 s", async () => {
    expect((await refusalFor(inFlightElsewhere(secondsAgo(10)))).retryAfterSeconds).toBe(BOUND_S - 10);
    expect(BOUND_S - 10).toBe(80);
  });

  it("a scan just started leaves the whole bound, and never the design ceiling", async () => {
    const r = await refusalFor(inFlightElsewhere(NOW));
    expect(r.retryAfterSeconds).toBe(BOUND_S);
    expect(r.retryAfterSeconds).toBeGreaterThan(TIMING.reportCeilingS);
  });

  it("a part-second of age rounds the wait up, never down", async () => {
    const since = new Date(NOW.getTime() - 10_500);
    expect((await refusalFor(inFlightElsewhere(since))).retryAfterSeconds).toBe(80);
  });

  it("a scan exactly at the bound waits for the next sweep: the tick interval, never 0", async () => {
    expect((await refusalFor(inFlightElsewhere(secondsAgo(BOUND_S)))).retryAfterSeconds).toBe(TICK_S);
  });

  it("a row 95 s old is past the bound: it reads the tick interval, never 0 — the row is the sweep's", async () => {
    const r = await refusalFor(inFlightElsewhere(secondsAgo(95)));
    expect(r.retryAfterSeconds).toBe(TICK_S);
    expect(r.retryAfterSeconds).not.toBe(0);
    expect(TICK_S).toBe(900);
  });

  it("one second inside the bound still reads the time left, not the tick", async () => {
    expect((await refusalFor(inFlightElsewhere(secondsAgo(BOUND_S - 1)))).retryAfterSeconds).toBe(1);
  });

  it("a refusal with no running row to read a clock from waits the whole bound", async () => {
    expect((await refusalFor(inFlightElsewhere())).retryAfterSeconds).toBe(BOUND_S);
  });

  it("the same wait travels as the notice beside a stored report", async () => {
    const measuredAt = new Date("2026-09-05T12:00:00.000Z");
    readCurrentReport.mockResolvedValue({
      scanId: "scan-1",
      complete: true,
      stoppedReason: "complete",
      fromIncompleteRescan: false,
      market: { kind: "measured", at: measuredAt, value: { profile: { category: "product analytics" } } },
      correctionState: "none",
      verdict: { measuredAt, missing: [] },
    } as unknown as StoredReport);
    admitFreeScan.mockResolvedValue(inFlightElsewhere(secondsAgo(10)));
    const state = await resolveAddress({ rawSegment: DOMAIN, network: NETWORK, now: NOW });
    expect(state.kind).toBe("report");
    if (state.kind !== "report") throw new Error("unreachable");
    expect(state.notice).toEqual({ kind: "refused", refusal: { reason: "scan-running", retryAfterSeconds: 80 } });
  });
});

describe("#510 — the wait the refusal carries and the {wait} the line shows are one figure", () => {
  it.each([
    ["young", 10, 80, "2"],
    ["just started", 0, 90, "2"],
    ["old", 45, 45, "1"],
    ["past the bound", 95, 900, "15"],
  ] as const)("%s scan (%i s): retryAfterSeconds %i, the slot says %s minute(s)", async (_label, age, wait, minutes) => {
    const refusal = await refusalFor(inFlightElsewhere(secondsAgo(age)));
    expect(refusal.retryAfterSeconds).toBe(wait);
    const line = refusalLine(refusal);
    expect(line).toContain("notice.refused.scan-running");
    const slot = JSON.parse(line.slice("notice.refused.scan-running".length)) as { wait: string };
    expect(slot.wait).toBe(`report.wait.minutes${JSON.stringify({ minutes: String(Math.ceil(refusal.retryAfterSeconds / 60)) })}`);
    expect(slot.wait).toBe(`report.wait.minutes${JSON.stringify({ minutes })}`);
  });
});
