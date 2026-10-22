// tests/scan/weekly/rivals-monthly.test.ts — the weekly pass re-checks the
// competitors once a month, keeps a re-check the cap refused or that failed
// due on every Monday until one concludes, skips the model call where the
// report's own derived competitors are the ones in force, and a change
// starts no second deep pass (ruling B5, #1560).
//
// Two panel sites from stored rows: savvycal.com (SaaS) and
// austinplumbery.com (local). The model's answer is served by the cost
// context, so nothing here is bought.
import dns from "node:dns";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DB, captureLog } from "./harness";
import { cachedCostContext, type FakeContext } from "../../vendors/harness";
import type { MarketSerp } from "@/lib/market/views";
import type { ReachProfile } from "@/lib/market/rivals/reach";

const runScan = vi.fn();
vi.mock("@/lib/scan/run", () => ({ runScan: (a: unknown) => runScan(a) }));

const { runWeekly, registerActiveAccessGate } = await import("@/lib/scan/weekly");
const { assembleReport } = await import("@/lib/scan/store");
const { fullSections } = await import("../report/fixtures");
const { deriveRivals } = await import("@/lib/market/rivals/derive");
const { readsLocal } = await import("@/lib/market/rivals/reach");

interface StoredScan {
  id: string;
  domain: string;
  local: boolean;
  profile?: ReachProfile | null;
  schemaTypes?: string[];
  serps: MarketSerp[];
}

const STORED = (
  JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../market/rivals/fixtures/local-rivals-1449.json"), "utf8")) as {
    scans: StoredScan[];
  }
).scans;

/** The competitors each panel site's stored searches derive at 0¢ (§6.6). */
function panelSite(domain: string): { domain: string; derived: string[] } {
  const scan = STORED.find((s) => s.domain === domain && !s.local) ?? STORED.find((s) => s.domain === domain)!;
  const local = readsLocal({ measuredInTown: scan.local, profile: scan.profile ?? null, schemaTypes: scan.schemaTypes ?? [], serps: scan.serps });
  const derived = deriveRivals({ serps: scan.serps, ownDomain: scan.domain, local }).rivals.map((r) => r.domain);
  return { domain, derived };
}

const SITES = [panelSite("savvycal.com"), panelSite("austinplumbery.com")];

// October 2026's four Mondays, then November's first.
const OCTOBER = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"];
const NOVEMBER_FIRST = "2026-11-02";
const at = (day: string): Date => new Date(`${day}T06:00:00Z`);

let log: { lines: Record<string, unknown>[]; restore: () => void };

beforeEach(() => {
  DB.reset();
  runScan.mockReset();
  registerActiveAccessGate(async (ids) => new Set(ids));
  process.env.KILL_SWITCH = "false";
  // A competitor's home page is never fetched: its address resolves private, and it is kept unread.
  vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "10.0.0.1", family: 4 } as never);
  log = captureLog();
});

afterEach(() => {
  registerActiveAccessGate(null);
  log.restore();
  vi.restoreAllMocks();
});

/** How the pass's cost context meets the rivals' model call. */
type RivalCall = "answered" | "refused" | "thrown";

/**
 * One site whose competitors in force are `inForce`, and whose weekly
 * report derived `derived`. The model, when asked, names every derived
 * competitor; `waiting` is the one a pass before held back, so it enters.
 * The site row keeps what each pass writes, as the column does.
 */
function site(a: { domain: string; inForce: string[]; derived: string[]; waiting?: string; overridden?: boolean }): {
  ctx: FakeContext;
  rivalCalls: () => number;
  rivalCall: (how: RivalCall) => void;
} {
  const report = JSON.parse(
    JSON.stringify({
      ...assembleReport({ ...fullSections(), tier: "weekly" }),
      rivals: { kind: "measured", value: a.derived.map((domain) => ({ domain, top10Appearances: 2, aiCitations: 1, score: 4 })), at: new Date() },
    })
  ) as unknown;
  const market = {
    current: {
      category: "the market",
      buyer: "a buyer",
      job: "a job",
      rivals: a.inForce.map((domain) => ({ domain, name: domain, basis: "ranks", reason: "It holds the first page." })),
    },
    ...(a.waiting === undefined ? {} : { rivalsWaiting: [a.waiting] }),
    ...(a.overridden === true ? { rivalsOverridden: true } : {}),
  };
  const row: Record<string, unknown> = { id: "site-1", domain: a.domain, zone: "UTC", category: "the market", competitors: a.inForce, market };
  DB.rows.set("sites", [row]);
  DB.answer = (statement) => {
    if (statement.table === "sites" && statement.verb === "update") return (Object.assign(row, statement.values), []);
    return statement.table === "scans" && statement.verb === "select" ? [{ id: "x", status: "done", report }] : null;
  };

  const candidates = a.derived.map((domain) => ({
    domain,
    name: domain.split(".")[0]!,
    kind: "product",
    inMarket: true,
    basis: "ranks",
    closeness: "direct",
    reason: `${domain} sells the same thing.`,
  }));
  const fake = cachedCostContext(
    (source) =>
      source === "rival-inference"
        ? { parseOutcome: "success", value: { candidates }, tokensIn: 100, tokensOut: 50, durationMs: 1 }
        : { billed: false, endpoint: source, vendorFailure: "not in tests" },
    new Date(),
    "WEEKLY"
  );
  // The cap's refusal and a ledger that throws, as `withCostContext` gives them.
  let how: RivalCall = "answered";
  const answer = fake.ctx.recordFetch;
  fake.ctx.recordFetch = (async (call: Parameters<typeof answer>[0]) => {
    if (call.source !== "rival-inference" || how === "answered") return answer(call);
    if (how === "refused") return { skipped: "cap" as const };
    throw new Error("the ledger is unavailable");
  }) as typeof answer;
  // As the pipeline does: a hook that throws past the competitors' check does not take the report down.
  runScan.mockImplementation(async (call: { scanId: string; afterReport: (x: unknown) => Promise<void> }) => {
    await call.afterReport({ report, cost: fake.ctx }).catch(() => undefined);
    return { scanId: call.scanId, status: "done" };
  });
  return {
    ctx: fake,
    rivalCalls: () => fake.calls.filter((c) => c.source === "rival-inference").length,
    rivalCall: (next) => {
      how = next;
    },
  };
}

async function monday(domain: string, day: string): Promise<void> {
  await runWeekly({ siteId: "site-1", domain, zone: "UTC", now: at(day) });
}

describe.each(SITES)("$domain: competitors re-checked monthly from stored rows", ({ domain, derived }) => {
  it("derives competitors from its stored searches", () => {
    expect(derived.length).toBeGreaterThanOrEqual(2);
  });

  it("re-checks on the month's first Monday only: four Mondays make one model call, the next month's first makes one more", async () => {
    const { rivalCalls } = site({ domain, inForce: derived.slice(0, 1), derived });
    for (const day of OCTOBER) await monday(domain, day);
    expect(runScan).toHaveBeenCalledTimes(4);
    expect(rivalCalls()).toBe(1);
    await monday(domain, NOVEMBER_FIRST);
    expect(rivalCalls()).toBe(2);
  });

  it("makes no model call when the derived competitors are the ones in force", async () => {
    const { ctx } = site({ domain, inForce: [...derived].reverse(), derived });
    for (const day of [...OCTOBER, NOVEMBER_FIRST]) await monday(domain, day);
    expect(ctx.calls).toHaveLength(0);
    expect(log.lines.filter((l) => l.event === "rival_conclusion_skipped" && l.because === "unchanged")).toHaveLength(2);
  });

  it("a re-check the cap refused stays due until one runs: four Mondays make [refused, 1, 0, 0] model calls", async () => {
    const { rivalCalls, rivalCall } = site({ domain, inForce: derived.slice(0, 1), derived });
    const perMonday: (number | "refused")[] = [];
    for (const [n, day] of OCTOBER.entries()) {
      rivalCall(n === 0 ? "refused" : "answered");
      const before = rivalCalls();
      const unmeasured = log.lines.filter((l) => l.event === "rival_conclusion_unmeasured").length;
      await monday(domain, day);
      const refused = log.lines.filter((l) => l.event === "rival_conclusion_unmeasured").length > unmeasured;
      perMonday.push(refused ? "refused" : rivalCalls() - before);
    }
    expect(perMonday).toEqual(["refused", 1, 0, 0]);
  });

  it("a re-check that threw stays due: the next Monday makes the model call", async () => {
    const { rivalCalls, rivalCall } = site({ domain, inForce: derived.slice(0, 1), derived });
    rivalCall("thrown");
    await monday(domain, OCTOBER[0]!);
    expect(log.lines.filter((l) => l.event === "rival_conclusion_failed")).toHaveLength(1);
    rivalCall("answered");
    await monday(domain, OCTOBER[1]!);
    expect(rivalCalls()).toBe(1);
  });

  it("no model call when the derived competitors are the ones in force keeps it not due for the rest of the month", async () => {
    const { rivalCalls } = site({ domain, inForce: [...derived].reverse(), derived });
    await monday(domain, OCTOBER[0]!);
    // Were the skip not the month's re-check, these Mondays would ask the model.
    DB.rows.get("sites")!.forEach((row) => Object.assign(row as object, { competitors: derived.slice(0, 1) }));
    for (const day of OCTOBER.slice(1)) await monday(domain, day);
    expect(rivalCalls()).toBe(0);
    await monday(domain, NOVEMBER_FIRST);
    expect(rivalCalls()).toBe(1);
  });

  it("a founder's own competitors, re-weighed, are the month's re-check", async () => {
    const { rivalCalls } = site({ domain, inForce: derived.slice(0, 1), derived, overridden: true });
    await monday(domain, OCTOBER[0]!);
    const row = DB.rows.get("sites")![0] as { market: { rivalsOverridden: boolean } };
    row.market = { ...row.market, rivalsOverridden: false };
    for (const day of OCTOBER.slice(1)) await monday(domain, day);
    expect(rivalCalls()).toBe(0);
  });

  it("makes one model call when they differ", async () => {
    const { rivalCalls } = site({ domain, inForce: derived.slice(0, -1), derived });
    await monday(domain, OCTOBER[0]!);
    expect(rivalCalls()).toBe(1);
  });

  it("starts no second deep pass when the check changes the competitors", async () => {
    const entering = derived[1]!;
    const { rivalCalls } = site({ domain, inForce: derived.slice(0, 1), derived, waiting: entering });
    await monday(domain, OCTOBER[0]!);
    expect(rivalCalls()).toBe(1);
    expect(log.lines.find((l) => l.event === "rival_conclusion")).toMatchObject({ changed: true });
    const competitors = DB.statements.find((s) => s.table === "sites" && s.verb === "update" && s.values?.competitors !== undefined);
    expect(competitors?.values?.competitors).toContain(entering);
    // One scans row, the week's own claim: no deep pass is claimed or sent.
    expect(DB.statements.filter((s) => s.table === "scans" && s.verb === "insert").map((s) => s.values?.tier)).toEqual(["weekly"]);
    expect(log.lines.filter((l) => String(l.event).startsWith("rivals_remeasure"))).toEqual([]);
  });
});
