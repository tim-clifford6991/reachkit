// tests/opportunities/supersede.test.ts — SPEC §6 (owner, 2026-09-19, issue
// 903): a re-measure must not leave the superseded opportunities open.
//
// The owner re-measured reachkit.app on 2026-09-19 and the site was left
// holding 24 open rows: the 12 the new pass derived, beside the 12 from
// 2026-09-17 — the outsized ones ("best seo software", 1 000/mo). None was
// dismissed. Three things were true of that state and all three are read
// here, through the real derivation over the in-memory store:
//
//   - the cluster collapse never saw the old rows as the same topic, because
//     the new pass's right-sized searches are not the old pass's head terms,
//     so they fell in different clusters and no cluster had two members;
//   - nothing else dismissed them: `rebandFor` (issue 884) corrects a stale
//     band and never a status, and the collapse was the only writer of
//     `dismissed` outside a founder's own veto;
//   - and where a topic *was* shared, the collapse read the old row's stored
//     band — which `assessReadiness` corrects in a step that runs after the
//     derivation — so 881's "a member that may fill a day outranks one that
//     may not" was decided on the number the old pass wrote.
//
// Doubled: the store (a Map) and the model (no typing call in this suite, so
// every candidate below is the deterministic derivation). No vendor call and
// no clock.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { measured } from "../../src/lib/measure/measured";
import { marketSetOf } from "../../src/lib/market/questions/market-set";
import { setOpportunityStore, type OpportunityRow } from "../../src/lib/opportunities/store";
import { deriveOpportunities } from "../../src/lib/opportunities/derive";
import { assessReadiness } from "../../src/lib/opportunities/readiness";
import { supplyDepth } from "../../src/lib/opportunities/supply/depth";
import { coveredTopics } from "../../src/lib/opportunities/cluster";
import { fakeCost } from "./cost";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { AT, PROFILE, SITE_ID, question, reportOf, search, serp, smallCounts } from "./fixtures";

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: () => Promise.reject(new Error("no model in this suite")) };
  },
}));

/** The pass that wrote the rows already on file, and the one measuring now. */
const OLD_SCAN = "33333333-3333-4333-8333-333333333333";
const NEW_SCAN = "44444444-4444-4444-8444-444444444444";

/** One open Write row as a pass leaves it. `fit_band` is the band the pass
 *  that wrote it gave it — which is the whole point: a row carries the band
 *  of its own pass until something corrects it. */
function stored(over: Partial<OpportunityRow> & { id: string; target_query: string }): OpportunityRow {
  const { target_query: query, ...rest } = over;
  const volume = rest.volume ?? 1000;
  return {
    site_id: SITE_ID,
    scan_id: OLD_SCAN,
    type: "answer_page",
    family: "write",
    target_query: query,
    target_ref: query.replace(/[^a-z0-9]+/g, "-"),
    proposed_slug: null,
    title: null,
    volume,
    evidence: {
      family: "write",
      query,
      volume: measured(volume, AT),
      rival: {
        domain: "zapier.com",
        url: measured("https://zapier.com/blog/seo", AT),
        position: measured(1, AT),
      },
    },
    acceptance: { form: "named_on", question: `What is the best ${query}?` },
    fit_band: "reach",
    effort: 0.5,
    status: "open",
    cluster_key: null,
    absorbed_queries: [],
    ready: true,
    unready_reason: null,
    created_at: AT.toISOString(),
    ...rest,
  } as OpportunityRow;
}

/** A report whose market names `covers` and whose twelve is `asks`. */
function passReport(a: { asks: string; volume: number; covers: readonly string[] }) {
  return reportOf(
    {
      questions: [question({ search: search({ keyword: a.asks, volume: a.volume }) })],
      serps: [serp()],
    },
    {
      market: measured(
        marketSetOf({
          profile: PROFILE,
          suggestions: [a.asks, ...a.covers].map((keyword) => ({ keyword, volume: 1000 })),
        }),
        AT
      ),
    }
  );
}

let state: MemoryState;

beforeEach(() => {
  state = newMemoryState({ profile: PROFILE });
  setOpportunityStore(memoryStore(state));
});

afterEach(() => {
  setOpportunityStore(null);
  vi.restoreAllMocks();
});

function statuses(): Record<string, string> {
  return Object.fromEntries(state.rows.map((row) => [row.id, row.status]));
}

describe("a re-measure ends the rows it superseded (issue 903)", () => {
  const report = () =>
    passReport({
      asks: "best user onboarding software",
      volume: 90,
      covers: ["best seo software", "seo software tool"],
    });

  const derive = async () => {
    const { ctx } = fakeCost();
    return deriveOpportunities(ctx, {
      siteId: SITE_ID,
      scanId: NEW_SCAN,
      report: report(),
      // The site's own footprint as this pass measured it: reachkit.app
      // ranked for 3.
      ownRanked: measured(3, AT),
      rankedCounts: smallCounts(),
    });
  };

  beforeEach(() => {
    state.rows = [
      // Two of the 2026-09-17 rows: head terms this pass's market names.
      stored({ id: "opp-old-1", target_query: "best seo software", volume: 1000 }),
      stored({ id: "opp-old-2", target_query: "seo software tool", volume: 880 }),
      // A row on a topic this pass never read.
      stored({ id: "opp-untouched", target_query: "hedgehog grooming schedule", volume: 40 }),
      // A row a draft is already being written from.
      stored({ id: "opp-queued", target_query: "best seo tools", volume: 720, status: "queued" }),
    ];
    state.report = report();
  });

  it("the superseded rows end dismissed and this pass's own row is open", async () => {
    const outcome = await derive();

    expect(outcome.created).toHaveLength(1);
    expect(outcome.created[0]!.targetQuery).toBe("best user onboarding software");
    expect(statuses()).toEqual({
      "opp-old-1": "dismissed",
      "opp-old-2": "dismissed",
      "opp-untouched": "open",
      "opp-queued": "queued",
      [outcome.created[0]!.id]: "open",
    });
  });

  it("a stored row on a topic the new pass did not cover stays open", async () => {
    await derive();
    const untouched = state.rows.find((row) => row.id === "opp-untouched");
    expect(untouched?.status).toBe("open");
    // And the reason is the honest one: this pass never read that search.
    expect([...coveredTopics(report(), PROFILE.brandTokens)]).not.toContain("groom hedgehog schedul");
  });

  it("the calendar counts this pass's row and the one it never covered — never the superseded ones", async () => {
    const outcome = await derive();
    await assessReadiness(SITE_ID, { at: AT });
    const { unused } = await supplyDepth(SITE_ID);
    const counted = state.rows
      .filter((row) => row.status === "open" && row.ready)
      .map((row) => row.id)
      .sort();
    // Four rows were on file and two of them are gone: the founder's plan is
    // what this pass measured, plus the one topic it did not read.
    expect(counted).toEqual([outcome.created[0]!.id, "opp-untouched"].sort());
    expect(unused).toBe(2);
  });

  it("a pass that could not read its market supersedes nothing", async () => {
    const { ctx } = fakeCost();
    // `reportOf`'s default sections leave the market `not_attempted`.
    const blind = reportOf(
      { questions: [question({ search: search({ keyword: "best user onboarding software", volume: 90 }) })], serps: [serp()] },
      { market: measured(marketSetOf({ profile: PROFILE, suggestions: [] }), AT) }
    );
    await deriveOpportunities(ctx, {
      siteId: SITE_ID,
      scanId: NEW_SCAN,
      report: blind,
      ownRanked: measured(3, AT),
      rankedCounts: smallCounts(),
    });
    expect(statuses()["opp-old-1"]).toBe("open");
    expect(statuses()["opp-old-2"]).toBe("open");
  });
});

describe("the collapse reads the band today's law gives a stored row, not the one its own pass wrote", () => {
  it("a right-sized candidate wins the topic from an outsized row still claiming to qualify", async () => {
    // Same parent topic, two evidences: 1 000/mo measured by the pass that
    // wrote the row, 90/mo measured now. At a footprint of 3 the first
    // cannot fill a day and the second can — but the row's stored band still
    // says `reach`, and until issue 903 that is the number the collapse read.
    state.rows = [stored({ id: "opp-old-1", target_query: "best onboarding softwares", volume: 1000 })];
    const report = passReport({ asks: "best onboarding software", volume: 90, covers: [] });
    state.report = report;

    const { ctx } = fakeCost();
    const outcome = await deriveOpportunities(ctx, {
      siteId: SITE_ID,
      scanId: NEW_SCAN,
      report,
      ownRanked: measured(3, AT),
      rankedCounts: smallCounts(),
    });

    expect(outcome.created).toHaveLength(1);
    expect(outcome.created[0]!.targetQuery).toBe("best onboarding software");
    expect(statuses()["opp-old-1"]).toBe("dismissed");
  });
});
