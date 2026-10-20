// Issue 1559 — the weekly pass commits the next seven pages and three
// spares; the daily job takes its date's page, falls back to a spare, and
// ranks nothing again.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WEEK_PLAN } from "../../src/lib/config/constants";
import type { Profile } from "../../src/lib/market/questions/profile";
import { measured } from "../../src/lib/measure/measured";
import { deriveForPass } from "../../src/lib/opportunities/pass";
import { committedWeek, pageForDay, planFirstWeek, planWeek } from "../../src/lib/opportunities/plan";
import { restTopic } from "../../src/lib/opportunities/drafted";
import { setOpportunityStore } from "../../src/lib/opportunities/store";
import { fakeCost } from "./cost";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { AT, PROFILE, SITE_ID, question, reportOf, search, serp } from "./fixtures";

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: () => Promise.reject(new Error("no model in this suite")) };
  },
}));

let state: MemoryState;

beforeEach(() => {
  state = newMemoryState({ profile: PROFILE, now: AT });
  setOpportunityStore(memoryStore(state));
});

afterEach(() => {
  setOpportunityStore(null);
});

const DAY = (n: number) => new Date(AT.getTime() + n * 86_400_000).toISOString().slice(0, 10);

/** A stored weekly report of `keywords`, each a top ten held by `rivals`,
 *  which the pass sized small. */
function weekReport(keywords: readonly string[], rivals: readonly string[] = ["appcues.com", "userpilot.com"]) {
  const top = serp({
    organic: rivals.map((domain, n) => ({ position: n + 1, domain, url: `https://${domain}/${n}`, title: domain })),
  });
  return reportOf(
    {
      questions: keywords.map((keyword, n) => question({ id: `q${n}`, text: `${keyword}?`, search: search({ keyword, volume: 90 - n }) })),
      serps: keywords.map(() => top),
    },
    {
      rivalSizes: measured(
        rivals.map((domain) => ({ domain, state: "sized" as const, rankedCount: 40, band: "near" as const, at: AT, current: true })),
        AT
      ),
      rivals: measured(rivals.map((domain) => ({ domain, top10Appearances: 1, aiCitations: 1, score: 3 })), AT),
    }
  );
}

const TWELVE = Array.from({ length: 12 }, (_, n) => `user onboarding software plan ${n}`);

async function weeklyPass(report = weekReport(TWELVE)): Promise<void> {
  await deriveForPass(fakeCost().ctx, { tier: "weekly", siteId: SITE_ID, report, hasActiveAccess: true });
}

describe("the weekly pass ends with one commit", () => {
  it("a pass's commit is seven dated pages, one a day, and three spares", async () => {
    await weeklyPass();
    const entries = await planWeek(SITE_ID, { now: AT });

    expect(entries.map((entry) => entry.plannedFor)).toEqual([...[0, 1, 2, 3, 4, 5, 6].map(DAY), null, null, null]);
    const stored = state.rows.filter((row) => row.plan_place != null).sort((a, b) => a.plan_place! - b.plan_place!);
    expect(stored.map((row) => row.id)).toEqual(entries.map((entry) => entry.opportunityId));
    expect(new Set(stored.map((row) => row.id)).size).toBe(WEEK_PLAN.days + WEEK_PLAN.spares);
  });

  it("a new commit replaces the last one", async () => {
    await weeklyPass();
    await planWeek(SITE_ID, { now: AT });
    await planWeek(SITE_ID, { now: AT, from: DAY(7) });
    expect(state.rows.filter((row) => row.planned_for != null).map((row) => row.planned_for).sort()).toEqual(
      [7, 8, 9, 10, 11, 12, 13].map(DAY)
    );
  });
});

describe("the daily job takes its slot", () => {
  it("each day's page is the row committed for that date", async () => {
    await weeklyPass();
    const entries = await planWeek(SITE_ID, { now: AT });
    for (const [n, entry] of entries.slice(0, WEEK_PLAN.days).entries()) {
      expect((await pageForDay(SITE_ID, DAY(n), AT))?.id).toBe(entry.opportunityId);
    }
  });

  it("day 3's page cannot be written: the day takes the best spare", async () => {
    await weeklyPass();
    const entries = await planWeek(SITE_ID, { now: AT });
    // A stopped page rests its topic (D26), as the daily job does.
    await restTopic(entries[2]!.opportunityId, AT);
    const spares = entries.slice(WEEK_PLAN.days).map((entry) => entry.opportunityId);

    const day3 = await pageForDay(SITE_ID, DAY(2), AT);
    expect(spares).toContain(day3?.id);
  });

  it("the spare is the next one in committed order, not the one a ranking would put first", async () => {
    await weeklyPass();
    const entries = await planWeek(SITE_ID, { now: AT });
    const [best, , last] = entries.slice(WEEK_PLAN.days).map((entry) => state.rows.find((row) => row.id === entry.opportunityId)!);
    // The commit is reordered under the ranking: the lowest spare now comes first.
    [best!.plan_place, last!.plan_place] = [last!.plan_place, best!.plan_place];
    await restTopic(entries[2]!.opportunityId, AT);
    expect((await pageForDay(SITE_ID, DAY(2), AT))?.id).toBe(last!.id);

    // A spare that cannot be written is passed over for the one after it.
    await restTopic(last!.id, AT);
    expect((await pageForDay(SITE_ID, DAY(2), AT))?.id).toBe(entries[WEEK_PLAN.days + 1]!.opportunityId);
  });

  it("nothing is re-ranked: a better topic found mid-week waits for the next commit", async () => {
    await weeklyPass();
    const entries = await planWeek(SITE_ID, { now: AT });
    await weeklyPass(weekReport(["best user onboarding software", "user onboarding software for saas"]));
    const fresh = state.rows.filter((row) => row.plan_place == null && row.target_query?.startsWith("best"));
    expect(fresh).toHaveLength(1);

    expect((await pageForDay(SITE_ID, DAY(1), AT))?.id).toBe(entries[1]!.opportunityId);
    expect(state.rows.find((row) => row.id === fresh[0]!.id)?.plan_place ?? null).toBeNull();
  });

  it("a date no commit covers is committed on demand, once, and the evening writes no topic", async () => {
    await weeklyPass();
    state.asked = [{ term: TWELVE[0]!, peopleAlsoAsk: ["What is user onboarding software?", "How do product teams do user onboarding?"], related: [], at: AT }];
    const before = state.rows.length;

    const first = await pageForDay(SITE_ID, DAY(0), AT);
    const committed = state.rows.filter((row) => row.planned_for != null).map((row) => [row.id, row.planned_for]);
    expect(committed).toHaveLength(WEEK_PLAN.days);
    expect(committed[0]).toEqual([first?.id, DAY(0)]);

    // The next evening reads the same week rather than committing another.
    expect((await pageForDay(SITE_ID, DAY(1), AT))?.id).toBe(committed[1]![0]);
    expect(state.rows.filter((row) => row.planned_for != null).map((row) => [row.id, row.planned_for])).toEqual(committed);
    expect(state.rows).toHaveLength(before);
  });
});

describe("setup commits a new site's first week", () => {
  it("a site with no commit gets seven days and three spares", async () => {
    await weeklyPass();
    const entries = await planFirstWeek(SITE_ID, AT);
    expect(entries.map((entry) => entry.plannedFor)).toEqual([...[0, 1, 2, 3, 4, 5, 6].map(DAY), null, null, null]);
    expect((await committedWeek(SITE_ID)).days).toHaveLength(WEEK_PLAN.days);
  });

  it("the week the first draft committed from its own date is kept, and the evening reads it", async () => {
    await weeklyPass();
    const first = await pageForDay(SITE_ID, DAY(1), AT);
    const committed = state.rows.map((row) => [row.id, row.plan_place, row.planned_for]);

    expect(await planFirstWeek(SITE_ID, AT)).toEqual([]);
    expect(state.rows.map((row) => [row.id, row.plan_place, row.planned_for])).toEqual(committed);
    expect((await pageForDay(SITE_ID, DAY(1), AT))?.id).toBe(first?.id);
  });
});

describe("committedWeek is the one statement of the week", () => {
  it("absent a week it is the whole commit: the dated days by date, then the spares by place", async () => {
    await weeklyPass();
    const entries = await planWeek(SITE_ID, { now: AT });
    const week = await committedWeek(SITE_ID);
    expect(week.days.map((day) => [day.date, day.opportunity.id])).toEqual(
      entries.slice(0, WEEK_PLAN.days).map((entry) => [entry.plannedFor, entry.opportunityId])
    );
    expect(week.spares.map((spare) => spare.id)).toEqual(entries.slice(WEEK_PLAN.days).map((entry) => entry.opportunityId));
  });

  it("a week keeps the days from its Monday to the Sunday after, and the spares", async () => {
    await weeklyPass();
    // AT is a Saturday; a commit made on the Thursday after runs into the next week.
    await planWeek(SITE_ID, { now: AT, from: DAY(5) });
    const monday = DAY(2);
    expect(new Date(`${monday}T00:00:00Z`).getUTCDay()).toBe(1);
    const week = await committedWeek(SITE_ID, monday);
    expect(week.days.map((day) => day.date)).toEqual([5, 6, 7, 8].map(DAY));
    expect(week.spares).toHaveLength(WEEK_PLAN.spares);
    expect((await committedWeek(SITE_ID, DAY(9))).days.map((day) => day.date)).toEqual([9, 10, 11].map(DAY));
  });

  it("a row the commit marked as a Q&A reads as one", async () => {
    await weeklyPass();
    const entries = await planWeek(SITE_ID, { now: AT });
    state.rows.find((row) => row.id === entries[0]!.opportunityId)!.plan_write_as = "qa";
    const [first] = (await committedWeek(SITE_ID)).days;
    expect(first?.opportunity.writeAs).toBe("qa");
    expect((await pageForDay(SITE_ID, DAY(0), AT))?.writeAs).toBe("qa");
  });
});

/** A SaaS business's own searches, in English and German. A local
 *  service's and a shop's do not fill a week yet: their commercial searches
 *  stop at the keyword gate (the report's step 6, a follow-up of issue
 *  1559). */
const KINDS: readonly { kind: string; profile: Profile; rivals: string[]; searches: string[] }[] = [
  {
    kind: "SaaS (en)",
    profile: PROFILE,
    rivals: ["appcues.com", "userpilot.com"],
    searches: TWELVE,
  },
  {
    kind: "SaaS (de)",
    profile: { ...PROFILE, category: "Onboarding-Software", job: "neue Nutzer zum ersten Erfolg bringen", audienceTerms: ["Produktteams"], vocabulary: ["Onboarding", "Produkttour"] },
    rivals: ["appcues.com", "userpilot.de"],
    searches: Array.from({ length: 12 }, (_, n) => `onboarding software für produktteams ${n}`),
  },
];

describe("a SaaS site gets a full week from its own stored searches, in either language", () => {
  for (const { kind, profile, rivals, searches } of KINDS) {
    it(`${kind}: the commit fills seven days`, async () => {
      state.profile = profile;
      await weeklyPass(weekReport(searches, rivals));
      const entries = await planWeek(SITE_ID, { now: AT });
      expect(entries.filter((entry) => entry.plannedFor !== null)).toHaveLength(WEEK_PLAN.days);
    });
  }
});
