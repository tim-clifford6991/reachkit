// SPEC §6 (owner, D60, issue 1288) — a page's intent, the verdict that
// checks both halves of it, and the refresh eight unmet weeks queue.
import "./env";
import { afterEach, describe, expect, it } from "vitest";
import { measured, unmeasured } from "../../src/lib/measure/measured";
import { closestPrompt, hasGoal, intentFor } from "../../src/lib/opportunities/intent";
import { opportunityReady, type ReadinessContext } from "../../src/lib/opportunities/readiness";
import { refreshCandidates, unmetAfter, type OwnLivePage } from "../../src/lib/opportunities/refresh";
import { isRetarget, type Opportunity } from "../../src/lib/opportunities/types";
import { judgeWeek } from "../../src/lib/opportunities/verdicts/judge";
import type { PageIntent } from "../../src/lib/opportunities/intent";
import type { StoredReport } from "../../src/lib/scan/report";
import { AT, SITE_ID } from "./fixtures";
import { WEEK, fakeStore, pageOf, releaseStore, reportWithOwnPlace } from "./verdicts/harness";

// Five of the prompts reachkit.app tracked on 2026-10-06.
const PROMPTS = [
  { id: "91dd7b50", text: "Which answer engine optimization platforms do people actually recommend this year?" },
  { id: "38a0b9bb", text: "Which AI search visibility platforms do people actually recommend this year?" },
  { id: "8fe53783", text: "Which tools help me understand where AI and search send buyers on a small budget?" },
  { id: "03d62c3e", text: "How does AEO Engine compare with MaxAEO for generative engine optimization?" },
  { id: "a1f5ca3c", text: "Is ReachKit a good alternative to AEO Engine for generative engine optimization?" },
];

describe("D60 — the intent recorded when a topic is decided", () => {
  it("names the search with its volume and the closest tracked prompt", () => {
    expect(intentFor({ query: "best answer engine optimization services for ai visibility", volume: 20 }, PROMPTS)).toEqual({
      search: { query: "best answer engine optimization services for ai visibility", volume: 20 },
      prompt: PROMPTS[0],
    });
    // The prompt that names both products, not the one that names one.
    expect(closestPrompt("reachkit vs aeo engine", PROMPTS)?.id).toBe("a1f5ca3c");
    // The 7 Oct page: no measured volume, and a prompt that asks the same thing.
    const unmeasuredSearch = intentFor(
      { query: "tools to track where ai sends potential customers", volume: unmeasured<number>("not_attempted", AT) },
      PROMPTS
    );
    expect(unmeasuredSearch).toMatchObject({ search: { volume: null }, prompt: { id: "8fe53783" } });
    expect(hasGoal(unmeasuredSearch)).toBe(true);
  });

  it("matches no prompt to a search about something else, and such a topic has no goal without volume", () => {
    const intent = intentFor({ query: "invoice templates for freelancers", volume: null }, PROMPTS);
    expect(intent?.prompt).toBeNull();
    expect(hasGoal(intent)).toBe(false);
    expect(hasGoal(intentFor({ query: "invoice templates for freelancers", volume: measured(90, AT) }, PROMPTS))).toBe(true);
  });

  const topic = (over: Partial<Opportunity>): Opportunity =>
    ({
      id: "o",
      type: "answer_page",
      family: "write",
      targetQuery: "invoice templates for freelancers",
      targetRef: "",
      volume: null,
      evidence: { family: "write" },
      fitBand: "winnable",
      ...over,
    }) as unknown as Opportunity;
  const ctx: ReadinessContext = {
    grounded: true,
    earnGrounding: { comparison_table: true, integration_page: true, original_data_page: true },
    suppression: { clusters: new Set(), retiredUrls: new Set() },
    profile: null,
    ownRanks: () => false,
    canUpdate: () => true,
    coveredBy: () => null,
    prompts: PROMPTS,
  };

  it("a topic with no measured volume and no matching prompt is not ready, so the day goes to the next one", () => {
    expect(opportunityReady(topic({}), ctx)).toBe("no_intent");
    expect(opportunityReady(topic({ volume: measured(90, AT) }), ctx)).toBeNull();
    expect(opportunityReady(topic({ targetQuery: "tools to track where ai sends potential customers" }), ctx)).toBeNull();
    // A site whose first weekly pass has not built its prompts holds nothing back.
    expect(opportunityReady(topic({}), { ...ctx, prompts: [] })).toBeNull();
  });
});

describe("D60 — the Monday verdict checks the ranking and the AI citation", () => {
  afterEach(releaseStore);

  const PROMPT = { id: "p1", text: "Which user onboarding software do people recommend?" };
  const INTENT: PageIntent = { search: { query: "best user onboarding software", volume: 400 }, prompt: PROMPT };
  const page = pageOf({ publishedAt: new Date("2026-08-20T00:00:00.000Z"), draftId: "draft-1", volume: 400 });

  function week(position: number | null, cited: readonly string[] | null): StoredReport {
    const answers =
      cited === null ? [] : [{ promptId: PROMPT.id, engine: "chatgpt" as const, run: 1, named: true, linked: cited.length > 0, ownUrls: cited, rivals: [] }];
    return {
      ...reportWithOwnPlace(position),
      prompts: { siteName: "Example", asked: [{ ...PROMPT, kind: "category" }], asks: 4, answers },
    };
  }

  async function judge(a: { report: StoredReport; intent?: PageIntent | null }) {
    const recorded: { draftId: string; intent: PageIntent }[] = [];
    const store = fakeStore({ pages: [{ ...page, intent: a.intent ?? null }], report: a.report });
    Object.assign(store, {
      trackedPrompts: async () => [PROMPT],
      recordIntent: async (row: { draftId: string; intent: PageIntent }) => void recorded.push(row),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    return { standing: standings[0]?.standing, row: store.rows[0], recorded };
  }

  it("a page outside the top 20 that its prompt's answers cite is working, and both readings are recorded", async () => {
    const { standing, row } = await judge({ report: week(null, [`${page.liveUrl}?utm_source=chatgpt.com`]), intent: INTENT });
    expect(standing).toMatchObject({ kind: "verdict", verdict: "working" });
    expect(row?.measured).toMatchObject({ kind: "zero", value: 0, ai: { promptId: "p1", cited: { kind: "measured", value: true } } });
  });

  it("answers that cite another of the site's pages are not this page's result", async () => {
    const { standing, row } = await judge({ report: week(null, ["https://content.example.com/another-page"]), intent: INTENT });
    expect(standing).toMatchObject({ kind: "verdict", verdict: "too_early" });
    expect(row?.measured).toMatchObject({ ai: { cited: { kind: "zero", value: false } } });
  });

  it("a week whose asks of the prompt did not answer says so, and the ranking still decides", async () => {
    const { standing, row } = await judge({ report: week(3, null), intent: INTENT });
    expect(standing).toMatchObject({ kind: "verdict", verdict: "working" });
    expect(row?.measured).toMatchObject({ kind: "measured", value: 3, ai: { cited: { kind: "unmeasured" } } });
  });

  it("a page published before intent was recorded has it filled from its opportunity", async () => {
    const { recorded } = await judge({ report: week(3, []) });
    expect(recorded).toEqual([{ draftId: "draft-1", intent: INTENT }]);
  });
});

describe("D60 — eight weeks without either queues a refresh", () => {
  const live = (over: Partial<Opportunity>, unmet = true): OwnLivePage => ({
    url: "https://content.example.com/a",
    publishedAt: new Date("2026-06-01T00:00:00.000Z"),
    row: {
      siteId: SITE_ID,
      scanId: "scan-1",
      type: "keyword_page",
      family: "write",
      targetQuery: "tools to track where ai sends potential customers",
      volume: null,
      evidence: { family: "write" },
      acceptance: { form: "top20", query: "tools to track where ai sends potential customers" },
      fitBand: "winnable",
      ...over,
    } as unknown as Opportunity,
    declined: false,
    unmet,
    facts: [],
    marketFacts: [],
  });
  const pools = { siteText: [], market: [] };

  it("counts eight judged weeks with none working", () => {
    expect(unmetAfter({ weeks: 8, worked: false })).toBe(true);
    expect(unmetAfter({ weeks: 7, worked: false })).toBe(false);
    expect(unmetAfter({ weeks: 12, worked: true })).toBe(false);
    expect(unmetAfter(undefined)).toBe(false);
  });

  it("refreshes the page for its own search where that search has measured volume", () => {
    const [candidate] = refreshCandidates([live({ volume: measured(140, AT) })], pools, AT);
    expect(candidate).toMatchObject({ type: "refresh_page", evidence: { shortfall: { kind: "due", cause: "unmet" } } });
    expect(refreshCandidates([live({ volume: measured(140, AT) }, false)], pools, new Date("2026-07-15T00:00:00.000Z"))).toEqual([]);
  });

  it("retargets a page whose search has no measured volume to the closest measured search", () => {
    const searches = [
      { keyword: "invoice templates", volume: 900 },
      { keyword: "ai tools to track potential customers", volume: 210 },
    ];
    const [candidate] = refreshCandidates([live({})], { ...pools, searches }, AT);
    expect(candidate).toBeDefined();
    expect(isRetarget(candidate as Opportunity)).toBe(true);
    expect(candidate).toMatchObject({ targetQuery: "ai tools to track potential customers", targetRef: "https://content.example.com/a" });
    expect(candidate?.volume).toMatchObject({ kind: "measured", value: 210 });
    // No measured search is close: the page is refreshed for the search it has.
    const [kept] = refreshCandidates([live({})], { ...pools, searches: searches.slice(0, 1) }, AT);
    expect(kept).toMatchObject({ evidence: { shortfall: { kind: "due", cause: "unmet" } } });
  });
});
