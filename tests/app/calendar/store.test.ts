// tests/app/calendar/store.test.ts — BUILD §4.6, §7 (issue #126)
//
// The calendar's live facts: real supply fills real dates, and nothing
// else does. The two mutations this suite exists to kill are the two that
// would break §4.6's one promise — filling a date the ranked list did not
// reach ("the calendar is never padded"), and reading a depth that could
// not be read as a zero (ADR-061 point 1's proven arm).
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { measured, unmeasured } from "@/lib/measure/measured";
import type { Choice } from "@/lib/opportunities";
import type { Opportunity } from "@/lib/opportunities";

const supplyDepth = vi.fn();
const nextForDay = vi.fn();
const rankOpen = vi.fn();
const explainChoice = vi.fn();

vi.mock("@/lib/opportunities", () => ({
  supplyDepth: (...a: unknown[]) => supplyDepth(...a),
  nextForDay: (...a: unknown[]) => nextForDay(...a),
  rankOpen: (...a: unknown[]) => rankOpen(...a),
  explainChoice: (...a: unknown[]) => explainChoice(...a),
}));

/** §9's own answers are a different read and have their own suite
 *  (`publishing-facts.test.ts`, issue #175). This one is about supply: what
 *  the ranked list fills and what it refuses to fill. A month with no page
 *  scheduled on any date is the state that leaves supply the only thing
 *  deciding, which is what every case below is about. */
const publishingFacts = vi.fn();
vi.mock("@/app/(account)/app/calendar/drafts-read", () => ({
  readPublishingFacts: (...a: unknown[]) => publishingFacts(...a),
}));

/** §11's stop is a third read with its own home and its own suite
 *  (`law-lines.test.ts`, issue #113). This one is about supply. */
const workStop = vi.fn();
vi.mock("@/app/(account)/app/_shell/stop", () => ({
  readStop: (...a: unknown[]) => workStop(...a),
}));

const { readCalendarFacts, fillableDates, offsetForMonth } = await import(
  "@/app/(account)/app/calendar/store"
);

const SITE = { siteId: "site-1", timeZone: "America/New_York" };
/** 10:00 in the site's zone on 2026-09-15, a Tuesday. */
const NOW = new Date(Date.UTC(2026, 8, 15, 14, 0, 0));
const AT = new Date(Date.UTC(2026, 8, 14, 6, 0, 0));

function choiceFor(n: number): Choice {
  return {
    opportunityId: `opp-${n}`,
    type: "answer_page",
    family: "write",
    fitBand: "winnable",
    acceptance: { form: "top20", query: `search ${n}` },
    evidence: {
      family: "write",
      query: `search ${n}`,
      volume: measured(1900, AT),
      rival: {
        domain: "rival.example",
        url: measured("https://rival.example/a", AT),
        position: measured(1, AT),
      },
    },
  };
}

function withSupply(count: number): void {
  const ids = Array.from({ length: count }, (_, n) => `opp-${n}`);
  nextForDay.mockResolvedValue(count === 0 ? null : ({ id: ids[0] } as Opportunity));
  rankOpen.mockResolvedValue(ids.map((id) => ({ opportunityId: id, score: 1 })));
  explainChoice.mockImplementation(async (id: string) =>
    choiceFor(Number(id.replace("opp-", "")))
  );
  supplyDepth.mockResolvedValue({ unused: count, exhaustedSince: null });
}

beforeEach(() => {
  workStop.mockResolvedValue(null);
  publishingFacts.mockResolvedValue({
    readable: true,
    pagesByDay: new Map(),
    publishAt: new Map(),
    heldDays: [],
    customerChangeHoldsPages: null,
  });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("supply is the cap — the calendar is never padded", () => {
  it("fills one date per opportunity and stops when the ranked list does", async () => {
    withSupply(3);
    const facts = await readCalendarFacts({ site: SITE, month: "2026-09", now: NOW });

    expect(facts.drafts.map((d) => d.scheduledFor)).toEqual([
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
    ]);
  });

  it("fills nothing at all where there is no supply, and every date is then empty", async () => {
    withSupply(0);
    const facts = await readCalendarFacts({ site: SITE, month: "2026-09", now: NOW });
    expect(facts.drafts).toHaveLength(0);
    expect(facts.unusedSupply).toBe(0);
  });

  it("weekends are dates like any other — §4.6 fills every day while supply lasts", async () => {
    withSupply(8);
    const facts = await readCalendarFacts({ site: SITE, month: "2026-09", now: NOW });
    // 2026-09-19 is a Saturday and 2026-09-20 a Sunday.
    expect(facts.drafts.map((d) => d.scheduledFor)).toContain("2026-09-19");
    expect(facts.drafts.map((d) => d.scheduledFor)).toContain("2026-09-20");
  });

  it("never back-fills a date that has already passed", async () => {
    withSupply(30);
    const facts = await readCalendarFacts({ site: SITE, month: "2026-09", now: NOW });
    expect(facts.drafts.every((d) => d.scheduledFor >= "2026-09-15")).toBe(true);
  });

  it("takes the head from nextForDay, which is the ranked list's own head", async () => {
    withSupply(2);
    await readCalendarFacts({ site: SITE, month: "2026-09", now: NOW });
    expect(nextForDay).toHaveBeenCalledWith("site-1");
    expect(explainChoice.mock.calls[0]![0]).toBe("opp-0");
  });
});

describe("the next month carries on from where this one stopped", () => {
  it("offsets into the ranked list by the days between today and the month's first", () => {
    // 2026-09-15 → 2026-10-01 is sixteen days of supply already spoken for.
    expect(offsetForMonth({ month: "2026-10", today: "2026-09-15" })).toBe(16);
    expect(offsetForMonth({ month: "2026-09", today: "2026-09-15" })).toBe(0);
    // A month already past takes no supply at all.
    expect(fillableDates({ month: "2026-08", today: "2026-09-15" })).toHaveLength(0);
  });

  it("a month beyond the supply that is left is entirely empty, not filled from rank 1 again", async () => {
    withSupply(3);
    const facts = await readCalendarFacts({ site: SITE, month: "2026-10", now: NOW });
    expect(facts.drafts).toHaveLength(0);
  });
});

describe("a planned date is planned, and claims nothing more", () => {
  it("carries no draft id, no live address, no veto clock and no publish time", async () => {
    withSupply(1);
    const facts = await readCalendarFacts({ site: SITE, month: "2026-09", now: NOW });
    const page = facts.drafts[0]!;
    expect(page.state).toBe("planned");
    expect(page.draftId).toBeNull();
    expect(page.liveUrl).toBeNull();
    expect(page.vetoDeadline).toBeNull();
    expect(page.publishAt).toBeNull();
  });

  it("its 'why' rows are the evidence stored at creation, with that evidence's own date", async () => {
    withSupply(1);
    const facts = await readCalendarFacts({ site: SITE, month: "2026-09", now: NOW });
    const page = facts.drafts[0]!;
    expect(page.why.search).toBe("search 0");
    expect(page.why.answeredTodayBy).toEqual(["rival.example"]);
    expect(page.why.winnability).toBe("winnable");
    expect(page.measuredAt).toEqual(AT);
  });

  it("a Write target's 'you' is undeterminable, never a zero — the evidence records the rival's position, not theirs", async () => {
    withSupply(1);
    const facts = await readCalendarFacts({ site: SITE, month: "2026-09", now: NOW });
    expect(facts.drafts[0]!.why.youStand.kind).toBe("unmeasured");
  });

  it("an Improve target's 'you' is the position the shortfall measured", async () => {
    nextForDay.mockResolvedValue({ id: "opp-9" } as Opportunity);
    rankOpen.mockResolvedValue([{ opportunityId: "opp-9", score: 1 }]);
    supplyDepth.mockResolvedValue({ unused: 1, exhaustedSince: null });
    explainChoice.mockResolvedValue({
      opportunityId: "opp-9",
      type: "expand_page",
      family: "improve",
      fitBand: "reach",
      acceptance: { form: "top20", query: "a search" },
      evidence: {
        family: "improve",
        query: "a search",
        volume: measured(500, AT),
        pageUrl: "https://example.com/p",
        shortfall: { kind: "position", position: measured(12, AT) },
      },
    } satisfies Choice);

    const facts = await readCalendarFacts({ site: SITE, month: "2026-09", now: NOW });
    expect(facts.drafts[0]!.why.youStand).toEqual(measured(12, AT));
    expect(facts.drafts[0]!.why.answeredTodayBy).toEqual([]);
  });

  it("names the search it targets and never the model's proposed title (ADR-012)", async () => {
    withSupply(1);
    const facts = await readCalendarFacts({ site: SITE, month: "2026-09", now: NOW });
    expect(facts.drafts[0]!.title).toBe("search 0");
  });
});

describe("what the calendar does not claim", () => {
  it("a depth that could not be read is null and never a zero (ADR-061 point 1)", async () => {
    withSupply(1);
    supplyDepth.mockRejectedValue(new Error("the database is down"));
    const facts = await readCalendarFacts({ site: SITE, month: "2026-09", now: NOW });
    expect(facts.unusedSupply).toBeNull();
  });

  it("claims no instruction, no stop and no held setting — those are other subsystems' rows", async () => {
    withSupply(1);
    const facts = await readCalendarFacts({ site: SITE, month: "2026-09", now: NOW });
    expect(facts.instructions).toEqual({});
    expect(facts.stoppedDays).toEqual([]);
    expect(facts.customerChangeHoldsPages).toBeNull();
  });

  it("a row that has gone since it was ranked empties its date rather than throwing", async () => {
    withSupply(2);
    explainChoice.mockImplementation(async (id: string) =>
      id === "opp-0" ? null : choiceFor(1)
    );
    const facts = await readCalendarFacts({ site: SITE, month: "2026-09", now: NOW });
    expect(facts.drafts.map((d) => d.scheduledFor)).toEqual(["2026-09-16"]);
  });
});

describe("the site's own zone decides its dates", () => {
  it("resolves today in the customer's zone and not in UTC", async () => {
    withSupply(1);
    // 00:30 UTC on the 16th is still the 15th in New York.
    const facts = await readCalendarFacts({
      site: SITE,
      month: "2026-09",
      now: new Date(Date.UTC(2026, 8, 16, 0, 30, 0)),
    });
    expect(facts.drafts[0]!.scheduledFor).toBe("2026-09-15");
    expect(facts.timeZone).toBe("America/New_York");
  });
});

describe("the unmeasured arms are still values", () => {
  it("a volume that could not be measured still dates the provenance line", async () => {
    nextForDay.mockResolvedValue({ id: "opp-0" } as Opportunity);
    rankOpen.mockResolvedValue([{ opportunityId: "opp-0", score: 1 }]);
    supplyDepth.mockResolvedValue({ unused: 1, exhaustedSince: null });
    explainChoice.mockResolvedValue({
      ...choiceFor(0),
      evidence: {
        family: "write",
        query: "search 0",
        volume: unmeasured("undeterminable", AT),
        rival: {
          domain: "rival.example",
          url: measured("https://rival.example/a", AT),
          position: measured(1, AT),
        },
      },
    } satisfies Choice);
    const facts = await readCalendarFacts({ site: SITE, month: "2026-09", now: NOW });
    expect(facts.drafts[0]!.measuredAt).toEqual(AT);
  });
});
