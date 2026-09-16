// tests/app/correction/route.test.ts — BUILD §6.7
//
// The transport adapter over the one market correction. Everything the
// route delegates is mocked at its seam, so what is under test is exactly
// what the route decides on its own account — which is meant to be almost
// nothing: the order it asks in, the refusals it passes through
// unmerged, and what it never touches.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CorrectionState } from "../../../src/lib/market/coherence/state.ts";
import type { ReportFacts } from "../../../src/lib/market/coherence/offer.ts";

const SOURCE_PATH = path.resolve(
  import.meta.dirname,
  "../../../src/app/api/report/[domain]/correct/route.ts"
);
const SOURCE = readFileSync(SOURCE_PATH, "utf8");
/** The route's code with its prose stripped: these assertions are about what
 *  the adapter calls, not about what its header explains it never calls. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const envFixture = { KILL_SWITCH: false };
vi.mock("@/lib/config/env", () => ({ env: envFixture }));

const readCorrectionFacts = vi.fn<(domain: string) => Promise<ReportFacts | null>>();
const advanceCorrectionState = vi.fn<
  (a: { scanId: string; from: CorrectionState; to: CorrectionState }) => Promise<boolean>
>();
const runner = vi.fn(async () => ({ scanId: "scan-1", status: "done" as const }));
let registeredRunner: typeof runner | null = runner;

vi.mock("@/lib/scan/correction", () => ({
  readCorrectionFacts: (domain: string) => readCorrectionFacts(domain),
  advanceCorrectionState: (a: { scanId: string; from: CorrectionState; to: CorrectionState }) =>
    advanceCorrectionState(a),
  correctionRunner: () => registeredRunner,
  registerCorrectionRunner: () => {},
}));

const nextCorrectionState = vi.fn();
vi.mock("@/lib/market/coherence/state", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../src/lib/market/coherence/state.ts")>();
  return {
    ...original,
    nextCorrectionState: (a: { current: CorrectionState; event: string }) => {
      nextCorrectionState(a);
      return original.nextCorrectionState(a as Parameters<typeof original.nextCorrectionState>[0]);
    },
  };
});

const { POST } = await import("../../../src/app/api/report/[domain]/correct/route.ts");

const NOW = new Date();

function facts(over: Partial<ReportFacts> = {}): ReportFacts {
  return {
    scanId: "scan-1",
    measuredAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
    category: "user onboarding software",
    correctionState: "none",
    domainRemoved: false,
    ...over,
  };
}

function post(a: { domain?: string; body?: unknown; raw?: string } = {}): Promise<Response> {
  const request = new Request("https://app.example.com/api/report/customer.com/correct", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: a.raw ?? JSON.stringify(a.body ?? { category: "employee scheduling software" }),
  });
  return POST(request, { params: Promise.resolve({ domain: a.domain ?? "customer.com" }) });
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  readCorrectionFacts.mockReset();
  advanceCorrectionState.mockReset();
  nextCorrectionState.mockClear();
  runner.mockClear();
  registeredRunner = runner;
  envFixture.KILL_SWITCH = false;
  readCorrectionFacts.mockResolvedValue(facts());
  advanceCorrectionState.mockResolvedValue(true);
});

describe("The address segment and the one body field", () => {
  it("a segment that does not parse is refused before anything downstream is reached", async () => {
    const response = await post({ domain: "not a domain" });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ ok: false, problem: "not_a_hostname" });
    expect(readCorrectionFacts).not.toHaveBeenCalled();
    expect(nextCorrectionState).not.toHaveBeenCalled();
    expect(runner).not.toHaveBeenCalled();
  });

  it("a body that is not `{ category: string }` is a 400 with no problem handle and no downstream call", async () => {
    for (const body of [{}, { category: 3 }, { category: "   " }]) {
      const response = await post({ body });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "malformed request body" });
    }
    const unparseable = await post({ raw: "{" });
    expect(unparseable.status).toBe(400);
    expect(nextCorrectionState).not.toHaveBeenCalled();
    expect(runner).not.toHaveBeenCalled();
  });

  it("the corrected category is passed through as an opaque string — no vocabulary is checked here", () => {
    expect(CODE).not.toMatch(/CATEGORIES|categoryList|allowedCategories|normali[sz]eCategory/);
  });

  it("a domain with no current report is a 404 and starts nothing", async () => {
    readCorrectionFacts.mockResolvedValue(null);
    const response = await post();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, refused: "no_current_report" });
    expect(nextCorrectionState).not.toHaveBeenCalled();
  });
});

describe("REQ-094 c3 — an accepted correction is one re-measurement inside the scan it corrects", () => {
  it("correct-route/accepted · one runScan, correctionOf and the corrected category set, nothing else passed", async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, scanId: "scan-1" });

    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith({
      domain: "customer.com",
      tier: "free",
      correctionOf: "scan-1",
      category: "employee scheduling software",
    });
    expect(runner.mock.calls[0]).toHaveLength(1);
  });

  it("correct-route/accepted · the stored state is advanced exactly as the machine returned it", async () => {
    await post();
    expect(advanceCorrectionState).toHaveBeenCalledWith({ scanId: "scan-1", from: "none", to: "running" });
  });

  it("correct-route/accepted · a retry advances to running_retry, not to a second first attempt", async () => {
    readCorrectionFacts.mockResolvedValue(facts({ correctionState: "failed_once" }));
    await post();
    expect(advanceCorrectionState).toHaveBeenCalledWith({
      scanId: "scan-1",
      from: "failed_once",
      to: "running_retry",
    });
  });

  it("correct-route/accepted · no scan allowance is consumed — the route never calls admission", () => {
    expect(CODE).not.toMatch(/claimFreeScanSlot|admitFreeScan|networkKeyOf/);
    expect(SOURCE).not.toMatch(/from\s+["'][^"']*lib\/scan\/admission/);
  });

  it("correct-route/accepted · the route passes no ceiling, deadline or allowance flag", () => {
    expect(CODE).not.toMatch(/ceiling|deadline|allowance|budget/i);
  });
});

describe("REQ-094 c5 — running and used are two different refusals, and neither starts a scan", () => {
  const offerRefusals: [CorrectionState, string, number][] = [
    ["running", "in_progress", 409],
    ["running_retry", "in_progress", 409],
    ["used", "used", 409],
    ["exhausted", "exhausted", 409],
  ];

  it.each(offerRefusals)("state %s is refused as %s and starts nothing", async (state, refused, status) => {
    readCorrectionFacts.mockResolvedValue(facts({ correctionState: state }));
    const response = await post();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ ok: false, refused });
    expect(nextCorrectionState).not.toHaveBeenCalled();
    expect(advanceCorrectionState).not.toHaveBeenCalled();
    expect(runner).not.toHaveBeenCalled();
  });

  it("correct-route/refusal · a correction already under way and one already used are distinct keys", async () => {
    readCorrectionFacts.mockResolvedValue(facts({ correctionState: "running" }));
    const running = await (await post()).json();
    readCorrectionFacts.mockResolvedValue(facts({ correctionState: "used" }));
    const used = await (await post()).json();
    expect(running.refused).not.toBe(used.refused);
  });

  it("correct-route/refusal · two submissions racing for one report: the loser is told a correction is under way", async () => {
    advanceCorrectionState.mockResolvedValue(false);
    const response = await post();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, refused: "already_running" });
    expect(runner).not.toHaveBeenCalled();
  });

  it("the two refusal vocabularies are never collapsed into one key", () => {
    expect(SOURCE).toMatch(/already_running/);
    expect(SOURCE).toMatch(/already_used/);
    expect(SOURCE).toMatch(/in_progress/);
  });
});

describe("REQ-094 c1 and c7 — an expired offer, a removed domain, and a refusal before the run", () => {
  it("a report at or past the offer's age is refused as too old", async () => {
    readCorrectionFacts.mockResolvedValue(
      facts({ measuredAt: new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000) })
    );
    const response = await post();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, refused: "report_too_old" });
  });

  it("a removed domain is refused as removed", async () => {
    readCorrectionFacts.mockResolvedValue(facts({ domainRemoved: true }));
    const response = await post();
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ ok: false, refused: "domain_removed" });
  });

  it("correct-route/refused-before-run · nothing is spent when free scanning is switched off", async () => {
    envFixture.KILL_SWITCH = true;
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, refused: "scanning_unavailable" });

    expect(nextCorrectionState).toHaveBeenLastCalledWith({ current: "none", event: "refused_before_run" });
    expect(advanceCorrectionState).not.toHaveBeenCalled();
    expect(runner).not.toHaveBeenCalled();
  });

  it("correct-route/refused-before-run · nothing is spent when no pipeline is registered", async () => {
    registeredRunner = null;
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, refused: "scanning_unavailable" });
    expect(nextCorrectionState).toHaveBeenLastCalledWith({ current: "none", event: "refused_before_run" });
    expect(advanceCorrectionState).not.toHaveBeenCalled();
  });

  it("correct-route/refused-before-run · the control still stands after a refusal before the run", async () => {
    envFixture.KILL_SWITCH = true;
    await post();
    // `refused_before_run` returns the current state unchanged, and the route
    // writes nothing — the reader's two attempts are both still there.
    expect(advanceCorrectionState).not.toHaveBeenCalled();
  });

  it("the offer is asked before the state machine — a closed offer reaches neither", async () => {
    readCorrectionFacts.mockResolvedValue(facts({ correctionState: "used" }));
    await post();
    expect(nextCorrectionState).not.toHaveBeenCalled();
  });
});

describe("The adapter holds no engine logic of its own", () => {
  it("no SQL, no state table, no threshold and no clock arithmetic", () => {
    expect(CODE).not.toMatch(/\bselect\b\s|\bupdate\b\s+scans|from\s*\(\s*["']scans/i);
    expect(SOURCE).not.toMatch(/from\s+["'][^"']*lib\/db/);
    expect(CODE).not.toMatch(/CORRECTION\./);
    expect(CODE).not.toMatch(/COHERENCE\./);
    expect(CODE).not.toMatch(/offerMaxAgeDays/);
  });

  it("it speaks no sentence — every outcome on the wire is a handle", async () => {
    readCorrectionFacts.mockResolvedValue(facts({ correctionState: "exhausted" }));
    const body = await (await post()).json();
    expect(body.refused).toMatch(/^[a-z_]+$/);
  });

  it("the log line carries the scan id and the outcome, never the submitted category", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    spy.mockClear();
    await post({ body: { category: "a very specific corrected category" } });
    const lines = spy.mock.calls.map((c) => String(c[0]));
    const line = lines.find((l) => l.includes("report_correction"));
    expect(line).toBeDefined();
    expect(JSON.parse(line as string)).toEqual({
      event: "report_correction",
      outcome: "accepted",
      scanId: "scan-1",
      as: "first",
    });
    for (const l of lines) expect(l).not.toContain("a very specific corrected category");
  });
});

describe("BUILD §11's adapter convention — the route is wrapped like every other", () => {
  it("emits the one request line, with the route id and never the request's own URL", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    spy.mockClear();
    await post();
    const request = spy.mock.calls
      .map((c) => JSON.parse(String(c[0])))
      .find((line) => line.event === "request");
    expect(request).toMatchObject({ routeId: "POST /api/report/{domain}/correct", status: 200 });
    expect(JSON.stringify(request)).not.toContain("app.example.com");
  });

  it("a thrown read never reaches the response body", async () => {
    readCorrectionFacts.mockRejectedValue(new Error("connection string postgres://user:pw@host/db"));
    const response = await post();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "unavailable" });
  });
});
