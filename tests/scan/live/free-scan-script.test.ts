// Issue #317 — §16 milestone 3's live check, and the two numbers it is
// stated in.
//
// `scripts/live/free-scan.sh` cannot be run here: it spends real money at
// real vendors against a real deployment, which is what makes it a live
// check rather than a test. What *can* be held honest before the owner
// runs it is everything that would make the run report a wrong number —
// and every one of those is in this file:
//
//  1. **The bounds are the product's own.** The script reads
//     `reportTargetS` and `FREE_C` out of `src/lib/config/constants.ts` at
//     run time rather than carrying its own copies (`ARCHITECTURE.md`: every pinned
//     number is in `constants.ts`).
//     A rename or a second definition must stop the script, not silently
//     measure against a number nobody pinned.
//  2. **A run that measured nothing says so.** The three ways a free scan
//     produces no measurement — a refusal, §6.4's rescan window serving
//     the stored report, a pass that failed — are reported as no
//     measurement, never as a very fast, very cheap scan.
//  3. **A run that missed a bound exits differently from one that met
//     it**, so "any stage over budget or over time" is mechanical rather
//     than a matter of reading the output.
//
// The deployment and its database are stubbed at `fetch`, which is the
// only thing the script reaches the world through.
import { afterEach, describe, expect, it, vi } from "vitest";

import { CAPS, FREE_RESCAN_WINDOW_D, TIMING } from "@/lib/config/constants";
import { EXIT, measure, pin } from "../../../scripts/live/free-scan.mjs";

const APP = "https://dev.example";
const DB = "https://db.example";

interface ScanRow {
  id: string;
  domain: string;
  tier: string;
  status: string;
  score: number | null;
  cost_cents: number;
  created_at: string;
  finished_at: string | null;
  stopped_reason: string;
  is_current: boolean;
}

interface FetchRow {
  source: string;
  cost_cents: number;
  reserved_cents: number;
  created_at: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A deployment that answers `POST /api/scan` with `start`, and a PostgREST
 *  that answers with `scan` and `ledger`. */
function deployment(a: {
  start: unknown;
  startStatus?: number;
  scan: ScanRow | null;
  ledger: FetchRow[];
  /** How long the deployment takes to answer the start — the wait this
   *  script exists to measure. */
  startsInMs?: number;
}) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.pathname === "/api/scan") {
      if (a.startsInMs !== undefined) await new Promise((resolve) => setTimeout(resolve, a.startsInMs));
      return json(a.start, a.startStatus ?? 200);
    }
    if (url.pathname === "/rest/v1/scans") return json(a.scan === null ? [] : [a.scan]);
    if (url.pathname === "/rest/v1/fetches") return json(a.ledger);
    throw new Error(`the script reached an address the stub does not serve: ${url.href}`);
  });
}

function scanRow(over: Partial<ScanRow> = {}): ScanRow {
  const claimed = new Date();
  return {
    id: "5f1d9a5e-0000-4000-8000-000000000001",
    domain: "example.com",
    tier: "free",
    status: "done",
    score: 41,
    cost_cents: 6,
    created_at: claimed.toISOString(),
    finished_at: new Date(claimed.getTime() + 38_400).toISOString(),
    stopped_reason: "complete",
    is_current: true,
    ...over,
  };
}

const LEDGER: FetchRow[] = [
  { source: "own/home", cost_cents: 0, reserved_cents: 0, created_at: new Date().toISOString() },
  { source: "dataforseo/labs/ranked_keywords", cost_cents: 2, reserved_cents: 2, created_at: new Date().toISOString() },
  { source: "dataforseo/serp/organic", cost_cents: 0, reserved_cents: 1, created_at: new Date().toISOString() },
];

/** Runs one measurement against a stubbed world and hands back its exit
 *  code and everything it printed. */
async function run(a: Parameters<typeof deployment>[0], bounds: { targetS?: number; capC?: number } = {}) {
  const lines: string[] = [];
  vi.stubGlobal("fetch", deployment(a));
  const { code } = await measure({
    app: APP,
    supabaseUrl: DB,
    serviceKey: "service-role-stub",
    domain: "example.com",
    targetS: bounds.targetS ?? TIMING.reportTargetS,
    capC: bounds.capC ?? CAPS.FREE_C,
    ceilingS: TIMING.reportCeilingS,
    windowD: FREE_RESCAN_WINDOW_D,
    log: (line: string) => lines.push(line),
  });
  return { code, out: lines.join("\n") };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scripts/live/free-scan — the bounds it measures against", () => {
  it("reads the target and the twelve-cent cap out of constants.ts, and never a figure of its own", () => {
    expect(pin("reportTargetS")).toBe(TIMING.reportTargetS);
    expect(pin("reportCeilingS")).toBe(TIMING.reportCeilingS);
    expect(pin("FREE_C")).toBe(CAPS.FREE_C);
    expect(pin("FREE_RESCAN_WINDOW_D")).toBe(FREE_RESCAN_WINDOW_D);
  });

  it("stops rather than guessing when a pinned name no longer resolves exactly once", () => {
    expect(() => pin("reportTargetS", "export const TIMING = { reportTargetS: 60, reportTargetS: 60 };")).toThrow(
      /exactly one/
    );
    expect(() => pin("reportTargetS", "export const TIMING = {};")).toThrow(/found 0/);
  });
});

describe("scripts/live/free-scan — a measurement", () => {
  it("prints the elapsed seconds and the ledgered cents, and exits within", async () => {
    const { code, out } = await run({ start: { ok: true, location: "/scan/example.com", scanId: scanRow().id }, scan: scanRow(), ledger: LEDGER });
    expect(code).toBe(EXIT.WITHIN);
    expect(out).toMatch(new RegExp(`^elapsed +\\d+\\.\\d s +target ${TIMING.reportTargetS} s +ok$`, "m"));
    expect(out).toMatch(/^ledgered +6 c +cap 12 c +ok$/m);
  });

  it("names the roll-up as the answer and the fetches sum as a floor", async () => {
    const { out } = await run({ start: { ok: true, location: "/scan/example.com", scanId: scanRow().id }, scan: scanRow(), ledger: LEDGER });
    // BUILD §6.5's roll-up is 6¢; the three rows sum to 2¢ because
    // `fetches.cost_cents` is an integer column and sub-cent prices round
    // to nothing on the way in.
    expect(out).toContain("scans.cost_cents 6 c is the roll-up the cap was enforced against");
    expect(out).toContain("3 fetches rows sum to 2 c");
  });

  it("breaks the spend down by source, so a stage over budget is visible", async () => {
    const { out } = await run({ start: { ok: true, location: "/scan/example.com", scanId: scanRow().id }, scan: scanRow(), ledger: LEDGER });
    for (const row of LEDGER) expect(out).toContain(row.source);
  });
});

describe("scripts/live/free-scan — a bound that was missed", () => {
  it("exits over when the wait passed the target", async () => {
    // A deployment that takes 20 ms to start the scan, against a target of
    // 10 ms: a real elapsed measurement that misses a real bound, rather
    // than a bound set below anything a clock can return.
    const { code, out } = await run(
      { start: { ok: true, location: "/scan/example.com", scanId: scanRow().id }, scan: scanRow(), ledger: LEDGER, startsInMs: 20 },
      { targetS: 0.01 }
    );
    expect(code).toBe(EXIT.OVER);
    expect(out).toContain("OVER BUDGET      elapsed");
  });

  it("exits over when the pass ledgered past the cap", async () => {
    const { code, out } = await run({
      start: { ok: true, location: "/scan/example.com", scanId: scanRow().id },
      scan: scanRow({ cost_cents: 13, status: "degraded", stopped_reason: "spend_ceiling" }),
      ledger: LEDGER,
    });
    expect(code).toBe(EXIT.OVER);
    expect(out).toContain("OVER BUDGET      ledgered");
  });
});

describe("scripts/live/free-scan — a run that measured nothing", () => {
  it("reports a refusal rather than a fast scan", async () => {
    // REQ-003 criteria 6-8: the hourly allowance, the in-flight bound, the
    // day's ceiling and the kill switch all answer `ok` with no scan id.
    const { code, out } = await run({ start: { ok: true, location: "/scan/example.com" }, scan: null, ledger: [] });
    expect(code).toBe(EXIT.NO_MEASUREMENT);
    expect(out).toContain("no measurement");
    expect(out).toContain("refused");
  });

  it("reports a malformed domain rather than a failure to reach the deployment", async () => {
    const { code, out } = await run({ start: { ok: false, problem: "not_a_domain" }, startStatus: 422, scan: null, ledger: [] });
    expect(code).toBe(EXIT.NO_MEASUREMENT);
    expect(out).toContain("not_a_domain");
  });

  it("refuses to call §6.4's stored report a very fast, very cheap scan", async () => {
    const { code, out } = await run({
      start: { ok: true, location: "/scan/example.com", scanId: scanRow().id },
      scan: scanRow({ cost_cents: 0, stopped_reason: "complete" }),
      ledger: [],
    });
    expect(code).toBe(EXIT.NO_MEASUREMENT);
    expect(out).toContain(`${FREE_RESCAN_WINDOW_D}-day window served the stored report`);
  });

  it("reports a pass that failed, and does not report a score for it", async () => {
    const { code, out } = await run({
      start: { ok: true, location: "/scan/example.com", scanId: scanRow().id },
      scan: scanRow({ status: "failed", stopped_reason: "failed", score: null, cost_cents: 1 }),
      ledger: [LEDGER[0]!],
    });
    expect(code).toBe(EXIT.NO_MEASUREMENT);
    expect(out).toContain("the pass failed");
  });

  it("refuses to time a scan that was already running when the run started", async () => {
    // `POST /api/scan` hands back the *running* scan's id on an in-flight
    // refusal of the same domain, so the id alone cannot tell the two
    // apart — the row's own `created_at` is what does.
    const claimed = new Date(Date.now() - 30_000).toISOString();
    const { code, out } = await run({
      start: { ok: true, location: "/scan/example.com", scanId: scanRow().id },
      scan: scanRow({ created_at: claimed }),
      ledger: LEDGER,
    });
    expect(code).toBe(EXIT.NO_MEASUREMENT);
    expect(out).toContain("joined a scan already running");
  });
});
