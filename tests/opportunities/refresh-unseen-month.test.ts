// Issue 1538 — Monday's planRefreshes gives a page not found yet at most one
// link in a month, whatever became of the last one.
import "./env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { planRefreshes, type OwnLivePage, type RefreshInputs } from "../../src/lib/opportunities/refresh";
import { setOpportunityStore } from "../../src/lib/opportunities/store";
import { setGenerateStore, type GenerateStore } from "../../src/lib/generate/store";
import type { Opportunity } from "../../src/lib/opportunities/types";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";

const held: { state: MemoryState | null } = { state: null };

// The direct reads planRefreshes makes go to the memory store's own rows,
// with their `eq` and `gte` filters applied.
vi.mock("@/lib/db", () => {
  const query = (table: string) => {
    const eq: Record<string, unknown> = {};
    const gte: Record<string, string> = {};
    const self = {
      select: () => self,
      eq: (column: string, value: unknown) => ((eq[column] = value), self),
      gte: (column: string, value: string) => ((gte[column] = value), self),
      then: (resolve: (r: { data: unknown[]; error: null }) => void) => {
        const rows = table !== "opportunities" ? [] : (held.state?.rows ?? []);
        const data = rows.filter(
          (row) =>
            Object.entries(eq).every(([column, value]) => (row as unknown as Record<string, unknown>)[column] === value) &&
            Object.entries(gte).every(([column, value]) => String((row as unknown as Record<string, unknown>)[column]) >= value)
        );
        resolve({ data, error: null });
      },
    };
    return self;
  };
  const client = { from: query };
  return { dbAdmin: () => client, db: () => client };
});

const MONDAY = new Date("2026-10-19T06:00:00.000Z");
const days = (n: number) => n * 86_400_000;

function page(slug: string, age: number, over: Partial<OwnLivePage>): OwnLivePage {
  return {
    url: `https://pages.example.com/${slug}`,
    publishedAt: new Date(MONDAY.getTime() - days(age)),
    row: {
      id: slug,
      siteId: "site",
      scanId: "scan",
      family: "write",
      type: "keyword_page",
      status: "done",
      clusterKey: "boilers",
      targetQuery: slug.replace(/-/g, " "),
      targetRef: null,
      absorbedQueries: [],
      volume: null,
      fitBand: "winnable",
      acceptance: { form: "top20", query: slug.replace(/-/g, " ") },
      evidence: { family: "write" },
      createdAt: MONDAY,
    } as unknown as Opportunity,
    declined: false,
    facts: [],
    marketFacts: [],
    title: slug,
    markdown: "",
    ...over,
  };
}

const UNFOUND = page("boiler-repair-cost", 28, { found: false, title: "Boiler repair cost" });
const STRONG = page("boiler-service", 45, { found: true, readPlace: 6 });
const NEXT = page("combi-boiler-guide", 35, { found: true, readPlace: 9 });

let state: MemoryState;

beforeEach(() => {
  state = newMemoryState({});
  held.state = state;
  setOpportunityStore({
    ...memoryStore(state),
    async refreshInputs(): Promise<RefreshInputs> {
      return { pages: [UNFOUND, STRONG, NEXT], pools: { siteText: [], market: [], searches: [], ranked: [] } };
    },
  });
  setGenerateStore({ pagesElsewhere: async () => [] } as unknown as GenerateStore);
});

const linksInto = () =>
  state.rows.filter((row) => (row.evidence as { shortfall?: { link?: { url?: string } } }).shortfall?.link?.url === UNFOUND.url);

async function monday(at: Date): Promise<void> {
  state.now = at;
  await planRefreshes({ siteId: "site", at });
}

describe("one link a month into a page not found yet", () => {
  it("the first Monday links it from the strongest sibling", async () => {
    await monday(MONDAY);
    expect(linksInto().map((row) => row.target_ref)).toEqual([STRONG.url]);
  });

  it("a week later, with that refresh done and the page still unlinked, nothing is planned again", async () => {
    await monday(MONDAY);
    for (const row of state.rows) row.status = "done";
    await monday(new Date(MONDAY.getTime() + days(7)));
    expect(linksInto()).toHaveLength(1);
  });

  it("five Mondays on, still not found and still unlinked, it is linked again", async () => {
    await monday(MONDAY);
    for (const row of state.rows) row.status = "done";
    await monday(new Date(MONDAY.getTime() + days(35)));
    expect(linksInto()).toHaveLength(2);
  });
});
