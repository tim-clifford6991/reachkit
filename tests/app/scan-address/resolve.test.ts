// tests/app/scan-address/resolve.test.ts — issue #104.
//
// The eight-row order that turns a written domain into one arm of
// `AddressState`, over the store. What this suite decides is the *order*:
// every row is exercised with the rows above it also true, because a
// first-match table is only a promise if the earlier row wins.
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../scan/run/harness";
import type { Admission } from "@/lib/scan/admission";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { StoredReport } from "@/lib/scan/report";

const admitFreeScan = vi.fn<() => Promise<Admission>>();
const readCurrentReport = vi.fn<() => Promise<StoredReport | null>>();

vi.mock("@/lib/scan/admission", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/admission")>()),
  admitFreeScan: () => admitFreeScan(),
}));
vi.mock("@/lib/scan/report", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/report")>()),
  readCurrentReport: () => readCurrentReport(),
}));

const { resolveAddress } = await import(
  "@/app/(public)/scan/[domain]/_address/resolve"
);

const NETWORK = "network-key-fixture" as never;
const DOMAIN = "acme.com" as CanonicalDomain;
const NOW = new Date("2026-09-06T12:00:00.000Z");

function resolve(rawSegment = DOMAIN as string) {
  return resolveAddress({ rawSegment, network: NETWORK, now: NOW });
}

/** Only the members `resolveAddress` reads. The blob's own shape is
 *  `tests/scan/report/**`'s to decide; this suite is about the order. */
function storedReport(over: Partial<{
  complete: boolean;
  fromIncompleteRescan: boolean;
  measuredAt: Date;
  correctionState: StoredReport["correctionState"];
  missing: StoredReport["verdict"]["missing"];
}> = {}): StoredReport {
  const measuredAt = over.measuredAt ?? new Date("2026-09-05T12:00:00.000Z");
  return {
    scanId: "scan-1",
    complete: over.complete ?? true,
    fromIncompleteRescan: over.fromIncompleteRescan ?? false,
    category: "product analytics",
    correctionState: over.correctionState ?? "none",
    verdict: { measuredAt, missing: over.missing ?? [] },
  } as unknown as StoredReport;
}

beforeEach(() => {
  vi.clearAllMocks();
  admitFreeScan.mockResolvedValue({ admit: true });
  readCurrentReport.mockResolvedValue(null);
});

describe("row 1 — a segment that does not parse", () => {
  it("is the malformed arm, carrying the value as written, and asks the store nothing", async () => {
    const state = await resolve("not a domain at all");
    expect(state).toEqual({ kind: "malformed", problem: "not_a_hostname", value: "not a domain at all" });
    expect(admitFreeScan).not.toHaveBeenCalled();
    expect(readCurrentReport).not.toHaveBeenCalled();
  });
});

describe("row 2 — a removed report outranks everything below it", () => {
  beforeEach(() => admitFreeScan.mockResolvedValue({ refuse: "removed" }));

  it("is the removed arm", async () => {
    expect(await resolve()).toEqual({ kind: "removed", domain: DOMAIN });
  });

  it("is still the removed arm when a current report exists — REQ-002 c3's whole point", async () => {
    readCurrentReport.mockResolvedValue(storedReport());
    const state = await resolve();
    expect(state.kind).toBe("removed");
    // The withdrawn report is not read out to anybody, including the
    // visitor whose scan would otherwise have started.
    expect(JSON.stringify(state)).not.toContain("scan-1");
  });
});

describe("row 3 — a current report is a thing to read", () => {
  it("renders it, with no notice and no control when nothing else is true", async () => {
    readCurrentReport.mockResolvedValue(storedReport());
    const state = await resolve();
    expect(state.kind).toBe("report");
    if (state.kind !== "report") throw new Error("unreachable");
    expect(state.report.scanId).toBe("scan-1");
    expect(state.notice).toBeNull();
    expect(state.control).toEqual({ kind: "none" });
  });

  it("outranks a refusal, which becomes the one notice beside it rather than a screen that hides it", async () => {
    admitFreeScan.mockResolvedValue({ refuse: "hourly", retryAfterSeconds: 2220 });
    readCurrentReport.mockResolvedValue(storedReport());
    const state = await resolve();
    expect(state.kind).toBe("report");
    if (state.kind !== "report") throw new Error("unreachable");
    expect(state.notice).toEqual({
      kind: "refused",
      refusal: { reason: "network-limit", retryAfterSeconds: 2220 },
    });
    // A control that cannot spend is worse than no control.
    expect(state.control).toEqual({ kind: "none" });
  });

  it("outranks a cooldown and an in-flight scan alike", async () => {
    readCurrentReport.mockResolvedValue(storedReport());
    for (const admission of [
      { refuse: "cooldown", retryAfterSeconds: 900 },
      { refuse: "in_flight", sameDomain: true, runningScanId: "running-1" },
    ] as Admission[]) {
      admitFreeScan.mockResolvedValue(admission);
      expect((await resolve()).kind).toBe("report");
    }
  });

  it("an incomplete report offers to measure what is missing, and says which factors those were", async () => {
    readCurrentReport.mockResolvedValue(
      storedReport({ complete: false, missing: [{ factor: "presence", reason: "not_attempted" }] })
    );
    const state = await resolve();
    if (state.kind !== "report") throw new Error("unreachable");
    expect(state.notice).toEqual({ kind: "incomplete", unmeasured: ["presence"] });
    expect(state.control).toEqual({ kind: "rescan", because: "incomplete" });
  });

  it("that offer is made once and does not chain — a report that is itself the product of one offers no control", async () => {
    readCurrentReport.mockResolvedValue(storedReport({ complete: false, fromIncompleteRescan: true }));
    const state = await resolve();
    if (state.kind !== "report") throw new Error("unreachable");
    expect(state.control).toEqual({ kind: "none" });
    // The line still renders: the report is still incomplete and says so.
    expect(state.notice?.kind).toBe("incomplete");
  });

  it("a report older than the free re-scan window offers to measure again", async () => {
    readCurrentReport.mockResolvedValue(
      storedReport({ measuredAt: new Date("2026-08-20T12:00:00.000Z") })
    );
    const state = await resolve();
    if (state.kind !== "report") throw new Error("unreachable");
    expect(state.control).toEqual({ kind: "rescan", because: "age" });
    expect(state.notice).toBeNull();
  });

  it("a correction that produced no report offers its one retry and says what happened", async () => {
    readCurrentReport.mockResolvedValue(storedReport({ correctionState: "failed_once" }));
    const state = await resolve();
    if (state.kind !== "report") throw new Error("unreachable");
    expect(state.notice).toEqual({ kind: "correction_failed" });
    expect(state.control).toEqual({ kind: "correction_retry" });
  });

  it("a correction with both attempts gone says what happened and offers nothing", async () => {
    readCurrentReport.mockResolvedValue(storedReport({ correctionState: "exhausted" }));
    const state = await resolve();
    if (state.kind !== "report") throw new Error("unreachable");
    expect(state.notice).toEqual({ kind: "correction_failed" });
    expect(state.control).toEqual({ kind: "none" });
  });

  it("exactly one control and at most one notice, whatever else is true", async () => {
    admitFreeScan.mockResolvedValue({ refuse: "hourly", retryAfterSeconds: 60 });
    readCurrentReport.mockResolvedValue(
      storedReport({ complete: false, correctionState: "failed_once", measuredAt: new Date("2026-01-01T00:00:00.000Z") })
    );
    const state = await resolve();
    if (state.kind !== "report") throw new Error("unreachable");
    // Four things are true at once; the visitor is told the one that just
    // happened to them and offered nothing that cannot spend.
    expect(state.notice?.kind).toBe("refused");
    expect(state.control).toEqual({ kind: "none" });
  });
});

describe("rows 4 to 7 — no stored report", () => {
  it("joins the scan already running for this domain rather than starting a second", async () => {
    admitFreeScan.mockResolvedValue({ refuse: "in_flight", sameDomain: true, runningScanId: "running-1" });
    expect(await resolve()).toEqual({ kind: "scanning", domain: DOMAIN, scanId: "running-1" });
  });

  it("falls back to starting when the running scan for this domain carries no id", async () => {
    admitFreeScan.mockResolvedValue({ refuse: "in_flight", sameDomain: true });
    expect(await resolve()).toEqual({ kind: "starting", domain: DOMAIN });
  });

  it("a scan running for another domain on this network is a refusal, not a join", async () => {
    admitFreeScan.mockResolvedValue({ refuse: "in_flight", sameDomain: false });
    const state = await resolve();
    expect(state.kind).toBe("refused");
    if (state.kind !== "refused") throw new Error("unreachable");
    expect(state.refusal.reason).toBe("scan-running");
  });

  it("a failed scan inside the cooldown window is its own arm, with one manual retry", async () => {
    admitFreeScan.mockResolvedValue({ refuse: "cooldown", retryAfterSeconds: 3600 });
    expect(await resolve()).toEqual({ kind: "cooldown", domain: DOMAIN });
  });

  it("the network counters refuse in writing, with the wait admission measured", async () => {
    for (const refuse of ["hourly", "daily"] as const) {
      admitFreeScan.mockResolvedValue({ refuse, retryAfterSeconds: 1800 });
      const state = await resolve();
      expect(state).toEqual({
        kind: "refused",
        domain: DOMAIN,
        refusal: { reason: "network-limit", retryAfterSeconds: 1800 },
      });
    }
  });

  it("ReachKit's own stop is its own reason and names no wait — never dressed as a network limit", async () => {
    admitFreeScan.mockResolvedValue({ refuse: "switched_off" });
    const state = await resolve();
    expect(state).toEqual({ kind: "refused", domain: DOMAIN, refusal: { reason: "stopped" } });
    expect(JSON.stringify(state)).not.toContain("retryAfterSeconds");
  });

  it("nothing here yet and nothing in the way is the starting arm", async () => {
    expect(await resolve()).toEqual({ kind: "starting", domain: DOMAIN });
  });
});

describe("what resolving does not do", () => {
  it("starts no scan and consumes no allowance — admission checks, it never claims", async () => {
    const admission = await import("@/lib/scan/admission");
    const claim = vi.spyOn(admission, "claimFreeScanSlot");
    await resolve();
    expect(claim).not.toHaveBeenCalled();
  });

  it("canonicalises through the one parser — every written form reaches the same domain", async () => {
    admitFreeScan.mockResolvedValue({ refuse: "removed" });
    for (const written of ["acme.com", "WWW.Acme.Com", "https://acme.com/pricing"]) {
      const state = await resolveAddress({ rawSegment: written, network: NETWORK, now: NOW });
      expect(state).toEqual({ kind: "removed", domain: DOMAIN });
    }
  });
});
