// The planners that run on a link back, a moved link and the hourly live
// re-check read the site's live pages only; Monday's `planRefreshes` alone
// reads the text pools too.
import "./env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  linkBackCandidates,
  movedLinkCandidates,
  planLinkBacks,
  planMovedLinks,
  planRefreshes,
  planStructureRefreshes,
  structureCandidates,
  type OwnLivePage,
  type RefreshInputs,
} from "../../src/lib/opportunities/refresh";
import { setOpportunityStore } from "../../src/lib/opportunities/store";
import type { Opportunity } from "../../src/lib/opportunities/types";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";

// The one direct read these planners make, the stopped refreshes: none.
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

const AT = new Date("2026-10-21T10:07:00.000Z");
const daysAgo = (days: number) => new Date(AT.getTime() - days * 86_400_000);
const OLD = "https://content.example.com/crm-setup";
const MOVED_TO = "https://content.example.com/crm-setup-guide";

function page(a: { url: string; search: string; age: number } & Partial<OwnLivePage>): OwnLivePage {
  const { search, age, ...over } = a;
  return {
    publishedAt: daysAgo(age),
    row: {
      id: `row-${a.url}`,
      siteId: "site",
      scanId: "scan",
      family: "write",
      type: "keyword_page",
      status: "open",
      targetQuery: search,
      volume: null,
      targetRef: a.url.split("/").pop(),
      evidence: { family: "write" },
      acceptance: { form: "top20", query: search },
    } as unknown as Opportunity,
    declined: false,
    facts: [],
    marketFacts: [],
    readings: [12, 12, 12],
    seen: true,
    ...over,
  };
}

const PAGES: OwnLivePage[] = [
  page({
    url: "https://content.example.com/crm-pricing",
    search: "crm pricing for small teams",
    title: "CRM pricing for small teams",
    markdown: `# CRM pricing\n\nSee [setting a CRM up](${OLD}).`,
    structure: ["h1"],
    age: 60,
  }),
  page({ url: "https://content.example.com/crm-pricing-compared", search: "crm pricing compared", title: "CRM pricing compared", age: 0 }),
];

let state: MemoryState;
let fullReads: number;

beforeEach(() => {
  state = newMemoryState({ livePages: PAGES });
  fullReads = 0;
  setOpportunityStore({
    ...memoryStore(state),
    async refreshInputs(): Promise<RefreshInputs> {
      fullReads += 1;
      return { pages: PAGES, pools: { siteText: [], market: [], searches: [], ranked: [] } };
    },
  });
});

const planned = () => state.rows.map((row) => `${row.type} ${row.target_ref}`).sort();
const expected = (candidates: readonly { type: string; targetRef: string }[]) =>
  candidates.map((candidate) => `${candidate.type} ${candidate.targetRef}`).sort();

describe("the live-page planners read pages, not text", () => {
  it("the hourly structure re-check plans from the pages alone", async () => {
    const want = expected(structureCandidates(PAGES, AT));
    expect(want).toHaveLength(1);
    await expect(planStructureRefreshes({ siteId: "site", at: AT })).resolves.toBe(1);
    expect(planned()).toEqual(want);
    expect(fullReads).toBe(0);
  });

  it("a moved link plans from the pages alone", async () => {
    const moved = { from: [OLD], to: MOVED_TO, title: "Setting a CRM up" };
    const want = expected(movedLinkCandidates(PAGES, moved, AT));
    expect(want).toHaveLength(1);
    await expect(planMovedLinks({ siteId: "site", ...moved, at: AT })).resolves.toBe(1);
    expect(planned()).toEqual(want);
    expect(fullReads).toBe(0);
  });

  it("a link back plans from the pages alone", async () => {
    const fresh = PAGES[1]!.url;
    const want = expected(linkBackCandidates(PAGES, fresh, AT));
    expect(want).toHaveLength(1);
    await expect(planLinkBacks({ siteId: "site", url: fresh, at: AT })).resolves.toBe(1);
    expect(planned()).toEqual(want);
    expect(fullReads).toBe(0);
  });

  it("Monday's planRefreshes still reads the full inputs, once", async () => {
    await planRefreshes({ siteId: "site", at: AT });
    expect(fullReads).toBe(1);
  });
});
