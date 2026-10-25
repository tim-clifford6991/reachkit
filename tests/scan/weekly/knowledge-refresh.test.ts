// tests/scan/weekly/knowledge-refresh.test.ts — the weekly pass keeps the
// business context fresh: a page whose text changed since the last pass is
// read into the knowledge base again, an unchanged page costs nothing, and
// the read stays inside the week's own cap (SPEC §5, 2026-10-25).
//
// A SaaS site and a local business, each with a home page and a page of
// prices. Every Monday the pass's crawl ledgers that week's read of both
// pages, as `fetches` keeps them; the model's answer is served by the cost
// context, so nothing here is bought.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DB, captureLog } from "./harness";
import { cachedCostContext, type FakeContext } from "../../vendors/harness";
import { OWN_FETCH_SOURCE } from "@/lib/measure/own-fetch";

const runScan = vi.fn();
const spendOnStoredReport = vi.fn();
vi.mock("@/lib/scan/run", () => ({
  runScan: (a: unknown) => runScan(a),
  spendOnStoredReport: (a: unknown, body: unknown) => spendOnStoredReport(a, body),
}));

const { refreshWeeklyKnowledge, runWeekly, registerActiveAccessGate } = await import("@/lib/scan/weekly");
const { assembleReport } = await import("@/lib/scan/store");
const { fullSections } = await import("../report/fixtures");

interface Site {
  kind: string;
  domain: string;
  home: { url: string; text: string };
  prices: { url: string; before: string; after: string };
  /** Every price either version states: the model is offered all of them,
   *  and the reading keeps only those the page carries. */
  offered: string[];
}

const SITES: Site[] = [
  {
    kind: "SaaS",
    domain: "savvycal.com",
    home: {
      url: "https://savvycal.com/",
      text: "SavvyCal is a scheduling tool that lets the people you meet overlay their own calendar on your availability, so finding a time takes one look instead of five emails back and forth. Teams use it to book sales calls, interviews and onboarding sessions.",
    },
    prices: {
      url: "https://savvycal.com/pricing",
      before: "The Basic plan is $12 a month per user and includes unlimited scheduling links, calendar overlay and reminders for every meeting you book with a client or a candidate. Every plan starts with a free two-week trial.",
      after: "The Basic plan is $14 a month per user and includes unlimited scheduling links, calendar overlay and reminders for every meeting you book with a client or a candidate. Every plan starts with a free two-week trial.",
    },
    offered: ["$12 a month per user", "$14 a month per user"],
  },
  {
    kind: "local",
    domain: "austinplumbery.com",
    home: {
      url: "https://www.austinplumbery.com/",
      text: "Austin Plumbery is a family-owned plumber serving Austin and Round Rock, repairing leaks, clearing drains and installing water heaters for homes and small businesses across Travis County. Call us any day of the week for same-day service.",
    },
    prices: {
      url: "https://www.austinplumbery.com/water-heaters",
      before: "A water heater flush is $149 for a tank up to fifty gallons, and a licensed plumber checks the anode rod, the pressure valve and the burner on the same visit to your home. We clean up after every job and leave the room as we found it.",
      after: "A water heater flush is $169 for a tank up to fifty gallons, and a licensed plumber checks the anode rod, the pressure valve and the burner on the same visit to your home. We clean up after every job and leave the room as we found it.",
    },
    offered: ["$149 for a tank", "$169 for a tank"],
  },
];

const MONDAYS = ["2026-10-05", "2026-10-12"];
const at = (day: string): Date => new Date(`${day}T06:00:00Z`);

let log: { lines: Record<string, unknown>[]; restore: () => void };

beforeEach(() => {
  DB.reset();
  runScan.mockReset();
  spendOnStoredReport.mockReset();
  registerActiveAccessGate(async (ids) => new Set(ids));
  process.env.KILL_SWITCH = "false";
  log = captureLog();
});

afterEach(() => {
  registerActiveAccessGate(null);
  log.restore();
  vi.restoreAllMocks();
});

const html = (text: string): string => `<!doctype html><html><head><title>Page</title></head><body><main><p>${text}</p></main></body></html>`;

interface StoredReading {
  pages: { url: string; hash: string; reading: { offerings: { prices: string[] }[] } }[];
}

/** One site whose crawl reads `pricesText` on the coming Monday, with a
 *  stored profile row the knowledge base is kept in. */
function site(s: Site): {
  fake: FakeContext;
  monday: (day: string, pricesText: string) => Promise<void>;
  knowledgeCalls: () => number;
  stored: () => StoredReading;
  capSpent: () => void;
} {
  const report = JSON.parse(JSON.stringify(assembleReport({ ...fullSections(), tier: "weekly" }))) as unknown;
  const scan = { id: "scan-1", domain: s.domain, status: "done", tier: "weekly", report };
  const inventory = [s.home.url, s.prices.url].map((url) => ({ url, title: "Page", h1: "Page", purpose: "offering" }));
  const profile: Record<string, unknown> = {
    domain: s.domain,
    site_name: s.domain,
    products: [],
    claims: [],
    voice: null,
    inventory,
    pages_read: 2,
    refreshed_at: at(MONDAYS[0]!).toISOString(),
    knowledge: null,
  };
  const ledger: { scan_id: string; source: string; payload: unknown }[] = [];
  DB.rows.set("sites", [{ id: "site-1", domain: s.domain, zone: "UTC", category: "the market" }]);
  DB.answer = (statement) => {
    if (statement.table === "site_profiles") return statement.verb === "update" ? (Object.assign(profile, statement.values), []) : [profile];
    if (statement.table === "fetches" && statement.verb === "select") {
      const sources = statement.filters.find(([column]) => column === "source")?.[1];
      return Array.isArray(sources) && sources.includes(OWN_FETCH_SOURCE) ? ledger : [];
    }
    return statement.table === "scans" && statement.verb === "select" ? [scan] : null;
  };

  const reading = {
    offerings: [{ name: "The service", features: [], prices: s.offered, uses: [] }],
    audience: [],
    problems: [],
    differentiators: [],
    proof: [],
    questions: [],
    integrations: [],
    places: [],
  };
  const fake = cachedCostContext(
    (source) =>
      source === "site-knowledge"
        ? { parseOutcome: "success", value: reading, tokensIn: 400, tokensOut: 120, durationMs: 1 }
        : { billed: false, endpoint: source, vendorFailure: "not in tests" },
    new Date(),
    "WEEKLY"
  );
  runScan.mockImplementation(async (call: { scanId: string; afterReport: (x: unknown) => Promise<void> }) => {
    await call.afterReport({ report, cost: fake.ctx }).catch(() => undefined);
    return { scanId: call.scanId, status: "done" };
  });
  // The scan's own spend record opens the read's context under the tier's cap; here it is the served one.
  spendOnStoredReport.mockImplementation(async (_a: unknown, body: (x: unknown) => Promise<void>) => body({ report, cost: fake.ctx }));

  return {
    fake,
    monday: async (day, pricesText) => {
      // This week's crawl ledgers this week's read of each page.
      const readAt = at(day).toISOString();
      for (const [url, text] of [
        [s.home.url, s.home.text],
        [s.prices.url, pricesText],
      ] as const) {
        const page = html(text);
        ledger.push({ scan_id: scan.id, source: OWN_FETCH_SOURCE, payload: { url, status: 200, html: page, bytes: page.length, readAt } });
      }
      const outcome = await runWeekly({ siteId: "site-1", domain: s.domain, zone: "UTC", now: at(day) });
      if (outcome.ran) await refreshWeeklyKnowledge({ scanId: outcome.scanId, siteId: "site-1", domain: s.domain });
    },
    knowledgeCalls: () => fake.calls.filter((call) => call.source === "site-knowledge").length,
    stored: () => profile.knowledge as StoredReading,
    capSpent: () => {
      fake.ctx.capHit = () => true;
    },
  };
}

const pricesOf = (stored: StoredReading, url: string): string[] | undefined =>
  stored.pages.find((page) => page.url === url)?.reading.offerings.flatMap((offering) => offering.prices);

describe.each(SITES)("$domain ($kind): the weekly pass rebuilds the knowledge base for changed pages", (s) => {
  it("reads both pages into the knowledge base on its first Monday", async () => {
    const { monday, knowledgeCalls, stored } = site(s);
    await monday(MONDAYS[0]!, s.prices.before);
    expect(knowledgeCalls()).toBe(2);
    expect(pricesOf(stored(), s.prices.url)).toEqual([s.offered[0]]);
  });

  it("a changed price page updates the knowledge base the next Monday, and only that page is read again", async () => {
    const { monday, knowledgeCalls, stored } = site(s);
    await monday(MONDAYS[0]!, s.prices.before);
    const home = stored().pages.find((page) => page.url === s.home.url);

    await monday(MONDAYS[1]!, s.prices.after);
    expect(knowledgeCalls()).toBe(3);
    expect(pricesOf(stored(), s.prices.url)).toEqual([s.offered[1]]);
    expect(stored().pages.find((page) => page.url === s.home.url)).toEqual(home);
    expect(log.lines.filter((line) => line.event === "site_knowledge_read").at(-1)).toMatchObject({ asked: 1, reused: 1 });
  });

  it("an unchanged site costs the next Monday no model call and keeps its reading", async () => {
    const { monday, knowledgeCalls, stored } = site(s);
    await monday(MONDAYS[0]!, s.prices.before);
    const before = stored().pages;

    await monday(MONDAYS[1]!, s.prices.before);
    expect(knowledgeCalls()).toBe(2);
    expect(stored().pages).toEqual(before);
    expect(log.lines.filter((line) => line.event === "site_knowledge_read").at(-1)).toMatchObject({ asked: 0, reused: 2 });
  });

  it("stays inside the week's cap: a changed page is not read once the cap is spent", async () => {
    const { monday, knowledgeCalls, capSpent, fake } = site(s);
    await monday(MONDAYS[0]!, s.prices.before);
    capSpent();

    await monday(MONDAYS[1]!, s.prices.after);
    expect(fake.ctx.cap).toBe("WEEKLY");
    expect(spendOnStoredReport).toHaveBeenLastCalledWith({ scanId: expect.any(String), tier: "weekly" }, expect.any(Function));
    expect(knowledgeCalls()).toBe(2);
    expect(log.lines.filter((line) => line.event === "site_knowledge_read").at(-1)).toMatchObject({ asked: 0, stoppedBy: "cap" });
  });
});
