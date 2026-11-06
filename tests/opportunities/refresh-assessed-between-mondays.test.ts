// A row a refresh planner creates between Mondays is assessed at once, on
// its own ids, so the week it is planned in sees a real answer
// (decision 2026-11-05-2390).
import "./env";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planLinkBacks, planMovedLinks, planStructureRefreshes, type OwnLivePage } from "../../src/lib/opportunities/refresh";
import { setOpportunityStore, type OpportunityRow } from "../../src/lib/opportunities/store";
import type { Opportunity } from "../../src/lib/opportunities/types";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";

// The planners' one direct read, the stopped refreshes: none.
vi.mock("@/lib/db", () => {
  const empty = {
    select: () => empty,
    eq: () => empty,
    not: () => empty,
    is: () => empty,
    then: (resolve: (r: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null }),
  };
  const client = { from: () => empty };
  return { dbAdmin: () => client, db: () => client };
});

// A Wednesday between Mondays.
const AT = new Date("2026-11-04T08:00:00.000Z");
const daysAgo = (days: number) => new Date(AT.getTime() - days * 86_400_000);

// One local service and one SaaS from the customer panel.
const PANEL = (JSON.parse(readFileSync("docs/walk/panel/sites.json", "utf8")) as { sites: { domain: string; kinds: string[] }[] }).sites;
const SEARCHES: Record<string, [string, string]> = {
  "local-service": ["water heater repair austin", "water heater replacement austin"],
  software: ["scheduling links for teams", "scheduling links compared"],
};
const SITES = ["local-service", "software"].map((kind) => ({ kind, domain: PANEL.find((site) => site.kinds.includes(kind))!.domain }));

function page(siteId: string, url: string, search: string, age: number, over: Partial<OwnLivePage> = {}): OwnLivePage {
  return {
    url,
    publishedAt: daysAgo(age),
    row: {
      id: `row-${url}`, siteId, scanId: "scan", family: "write", type: "keyword_page", status: "open",
      targetQuery: search, volume: null, targetRef: url.split("/").pop(),
      evidence: { family: "write" }, acceptance: { form: "top20", query: search },
    } as unknown as Opportunity,
    declined: false, facts: [], marketFacts: [], readings: [12, 12, 12], seen: true, title: search,
    ...over,
  };
}

let state: MemoryState;
let assessed: number;
let written: string[];
let fetches: ReturnType<typeof vi.spyOn>;

function site(domain: string, kind: string, grounding: () => Promise<boolean> = async () => true) {
  const [older, newer] = SEARCHES[kind]!;
  const base = `https://content.${domain}`;
  const moved = { from: [`${base}/old-guide`], to: `${base}/guide`, title: "The guide" };
  const pages = [
    page(domain, `${base}/older`, older, 40, { structure: ["h1"], markdown: `# ${older}\n\nSee [the guide](${moved.from[0]}).` }),
    page(domain, `${base}/newer`, newer, 0),
  ];
  // An open row planned before this tick: assessing the new rows leaves it alone.
  const earlier = { id: "earlier", site_id: domain, status: "open", family: "write", ready: false, unready_reason: "not_assessed" } as OpportunityRow;
  state = newMemoryState({ livePages: pages, rows: [earlier], now: AT });
  const store = memoryStore(state);
  setOpportunityStore({
    ...store,
    hasGroundingFact: grounding,
    async openRankable(siteId) {
      assessed += 1;
      return store.openRankable(siteId);
    },
    async setReadiness(id, reason) {
      written.push(id);
      return store.setReadiness(id, reason);
    },
  });
  return {
    structure: () => planStructureRefreshes({ siteId: domain, at: AT }),
    "link back": () => planLinkBacks({ siteId: domain, url: pages[1]!.url, at: AT }),
    "moved link": () => planMovedLinks({ siteId: domain, ...moved, at: AT }),
  };
}

const created = () => state.rows.filter((row) => row.id !== "earlier");
const earlier = () => state.rows.find((row) => row.id === "earlier")!;

beforeEach(() => {
  assessed = 0;
  written = [];
  fetches = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network in this suite"));
});
afterEach(() => vi.restoreAllMocks());

const CASES = SITES.flatMap(({ kind, domain }) => (["structure", "link back", "moved link"] as const).map((planner) => ({ kind, domain, planner })));

describe("a row planned between Mondays is assessed at once", () => {
  it.each(CASES)("$planner, Wednesday, $kind ($domain): ready or a real reason, never not_assessed", async ({ kind, domain, planner }) => {
    await expect(site(domain, kind)[planner]()).resolves.toBe(1);
    const [row] = created();
    expect(row?.unready_reason).not.toBe("not_assessed");
    expect(row?.ready).toBe(row?.unready_reason === null);
    expect(assessed).toBe(1);
    expect(written).toEqual([row!.id]);
    expect(earlier().unready_reason).toBe("not_assessed");
    expect(fetches).not.toHaveBeenCalled();
  });

  it.each(SITES)("nothing created, nothing assessed: a duplicate, or an hourly tick with nothing new ($kind)", async ({ kind, domain }) => {
    const plan = site(domain, kind);
    await plan.structure();
    assessed = 0;
    await expect(plan.structure()).resolves.toBe(0);
    state.livePages = state.livePages!.map((live) => ({ ...live, structure: [] }));
    state.rows = [earlier()];
    await expect(plan.structure()).resolves.toBe(0);
    expect(created()).toEqual([]);
    expect(assessed).toBe(0);
  });

  it.each(CASES)("a failed assessment still counts the $planner row, logs it and leaves it not_assessed ($kind)", async ({ kind, domain, planner }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const plan = site(domain, kind, async () => {
      throw new Error("grounding read failed");
    });
    await expect(plan[planner]()).resolves.toBe(1);
    expect(created()[0]?.unready_reason).toBe("not_assessed");
    const events = logged.mock.calls.flatMap(([line]) => (typeof line === "string" && line.startsWith("{") ? [JSON.parse(line) as { event: string; siteId?: string }] : []));
    expect(events).toEqual([expect.objectContaining({ event: "refresh_assess_failed", siteId: domain })]);
  });
});
