// SPEC §9, issue #690 — a ReachKit-fixable technical issue becomes a Fix
// opportunity for its page, outranks new writing for its cluster, is ready
// only where the destination can update that page, and drops once a week's
// scan shows it fixed.
import "./env";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fixCandidates } from "../../src/lib/opportunities/derive/fix";
import { assessFixPages, fixPageReadiness } from "../../src/lib/opportunities/fix-page";
import { placeFixPages } from "../../src/lib/opportunities/rank/open";
import { readOpportunity, setOpportunityStore } from "../../src/lib/opportunities/store";
import { persist } from "../../src/lib/opportunities/derive/persist";
import { evaluateAcceptance } from "../../src/lib/opportunities/verdicts/evaluate";
import type { Opportunity } from "../../src/lib/opportunities/types";
import type { SiteIssue, SiteIssuesSection } from "../../src/lib/site-issues/types";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { AT, SITE_ID, defaultReport } from "./fixtures";

const PRICING = "https://example.com/pricing";
const ABOUT = "https://example.com/about";
const HOSTED = "https://blog.example.com/guide";
const WORDPRESS = { kind: "wordpress", host: "example.com" } as const;

function ran(check: SiteIssue["check"], pages: string[]): SiteIssue {
  return { check, ran: true, count: pages.length, over: 3, unit: "pages", severity: "worth_fixing", doer: "reachkit_rewrites", pages };
}

function section(over: { titles?: string[]; descriptions?: string[]; checked?: string[] | null } = {}): SiteIssuesSection {
  return {
    pagesChecked: 3,
    checkedPages: over.checked === undefined ? [PRICING, ABOUT, HOSTED] : over.checked,
    stoppedBy: "complete",
    issues: [ran("page_titles", over.titles ?? []), ran("meta_descriptions", over.descriptions ?? [])],
  };
}

let state: MemoryState;
beforeEach(() => {
  state = newMemoryState();
  setOpportunityStore(memoryStore(state));
});
afterEach(() => setOpportunityStore(null));

describe("derivation — one Fix opportunity per affected page", () => {
  it("names every check the page failed, targets the page, and carries no search or band", () => {
    const report = defaultReport({ blockedAgents: [], siteIssues: section({ titles: [PRICING], descriptions: [PRICING, ABOUT] }) });
    const fixes = fixCandidates({ siteId: SITE_ID, scanId: "scan", report }).candidates.filter((c) => c.type === "fix_page");
    expect(fixes.map((c) => [c.targetRef, c.evidence])).toEqual([
      [PRICING, { family: "fix", issues: ["page_titles", "meta_descriptions"], pageUrl: PRICING }],
      [ABOUT, { family: "fix", issues: ["meta_descriptions"], pageUrl: ABOUT }],
    ]);
    expect(fixes[0]).toMatchObject({ family: "fix", targetQuery: null, fitBand: null });
    expect(fixes[0]?.acceptance).toEqual({ form: "issues_cleared", issues: ["page_titles", "meta_descriptions"], pageUrl: PRICING });
  });

  it("derives none for a page the site's hosted destination serves, and none from a report that kept no addresses", () => {
    const hosted = defaultReport({ blockedAgents: [], siteIssues: section({ titles: [HOSTED] }) });
    expect(fixCandidates({ siteId: SITE_ID, scanId: "s", report: hosted, hostedHost: "blog.example.com" }).candidates).toEqual([]);

    const old = section({ titles: [PRICING] });
    const unrecorded = { ...old, issues: old.issues.map((i) => (i.ran ? { ...i, pages: null } : i)) };
    expect(fixCandidates({ siteId: SITE_ID, scanId: "s", report: defaultReport({ blockedAgents: [], siteIssues: unrecorded }) }).candidates).toEqual([]);
  });
});

describe("readiness — only where the destination can make the update", () => {
  it("a title or description fix on the WordPress site's own host, at a page with a slug, is ready", () => {
    expect(fixPageReadiness({ pageUrl: PRICING, issues: ["page_titles", "meta_descriptions"] }, WORDPRESS)).toBeNull();
    expect(fixPageReadiness({ pageUrl: "https://www.example.com/pricing", issues: ["page_titles"] }, WORDPRESS)).toBeNull();
  });

  it("anything else is not ready, and says the destination cannot address it", () => {
    for (const [fix, delivery] of [
      [{ pageUrl: PRICING, issues: ["page_titles"] }, { kind: "none" }],
      [{ pageUrl: "https://shop.other.com/pricing", issues: ["page_titles"] }, WORDPRESS],
      [{ pageUrl: "https://example.com/", issues: ["page_titles"] }, WORDPRESS],
      [{ pageUrl: PRICING, issues: ["structured_data"] }, WORDPRESS],
    ] as const) {
      expect(fixPageReadiness(fix, delivery), fix.pageUrl).toBe("destination_cannot_address");
    }
  });
});

function opportunity(id: string, family: Opportunity["family"], clusterKey: string | null, createdAt = AT): Opportunity {
  return { id, family, clusterKey, createdAt } as Opportunity;
}

describe("ranking — a ready fix outranks new writing for its cluster", () => {
  it("goes ahead of the first Write row, and leaves a higher-scored Improve where it was", () => {
    const scored = [
      { opportunity: opportunity("improve", "improve", null), score: 0.9 },
      { opportunity: opportunity("write-a", "write", null), score: 0.8 },
      { opportunity: opportunity("write-b", "write", null), score: 0.5 },
    ];
    const order = placeFixPages(scored, [opportunity("fix", "fix", null)]).map((r) => r.opportunityId);
    expect(order).toEqual(["improve", "fix", "write-a", "write-b"]);
  });

  it("once clusters exist, only ahead of Write rows in its own cluster; with none to precede it goes last", () => {
    const scored = [
      { opportunity: opportunity("write-other", "write", "pricing"), score: 0.8 },
      { opportunity: opportunity("write-own", "write", "onboarding"), score: 0.5 },
    ];
    expect(placeFixPages(scored, [opportunity("fix", "fix", "onboarding")]).map((r) => r.opportunityId)).toEqual([
      "write-other",
      "fix",
      "write-own",
    ]);
    expect(placeFixPages(scored.slice(0, 1), [opportunity("fix", "fix", "onboarding")]).map((r) => r.opportunityId)).toEqual([
      "write-other",
      "fix",
    ]);
  });
});

describe("assessment — readiness recorded, and a fixed page drops", () => {
  async function derived(report: ReturnType<typeof defaultReport>): Promise<void> {
    const { candidates } = fixCandidates({ siteId: SITE_ID, scanId: "scan", report });
    await persist({ candidates: candidates.filter((c) => c.type === "fix_page") });
  }

  it("records ready or not ready on each open fix", async () => {
    await derived(defaultReport({ blockedAgents: [], siteIssues: section({ titles: [PRICING, HOSTED] }) }));
    await assessFixPages(SITE_ID, { report: null, delivery: WORDPRESS });
    const rows = state.rows.map(readOpportunity).map((o) => [o.targetRef, o.ready, o.unreadyReason]);
    expect(rows).toEqual([
      [PRICING, true, null],
      [HOSTED, false, "destination_cannot_address"],
    ]);
  });

  it("a week that checked the page and found it passing marks the fix done; a page it did not check stays open", async () => {
    await derived(defaultReport({ blockedAgents: [], siteIssues: section({ titles: [PRICING, ABOUT] }) }));
    const nextWeek = defaultReport({ blockedAgents: [], siteIssues: section({ titles: [], checked: [PRICING] }) });
    const { done } = await assessFixPages(SITE_ID, { report: nextWeek, delivery: WORDPRESS });
    expect(done).toBe(1);
    expect(state.rows.map((r) => [r.target_ref, r.status])).toEqual([
      [PRICING, "done"],
      [ABOUT, "open"],
    ]);
  });
});

describe("the recorded test — issues_cleared", () => {
  const acceptance = { form: "issues_cleared", issues: ["page_titles"], pageUrl: PRICING } as const;
  const week = (siteIssues: SiteIssuesSection | null) => ({
    week: "2026-09-14",
    measuredAt: AT,
    domain: "example.com",
    positions: new Map(),
    namesCustomer: new Map(),
    gatesCleared: new Map(),
    siteIssues,
  });

  it("passes when the page was checked and is no longer affected, fails while it still is", () => {
    expect(evaluateAcceptance({ acceptance, week: week(section({ titles: [] })) })).toMatchObject({ decided: true, passes: true });
    expect(evaluateAcceptance({ acceptance, week: week(section({ titles: [PRICING] })) })).toMatchObject({ decided: true, passes: false });
  });

  it("is this week's miss — never a pass — where the page was not checked or no checks were recorded", () => {
    expect(evaluateAcceptance({ acceptance, week: week(section({ checked: [ABOUT] })) })).toEqual({ decided: false, because: "not_measured" });
    expect(evaluateAcceptance({ acceptance, week: week(null) })).toEqual({ decided: false, because: "not_measured" });
  });
});
