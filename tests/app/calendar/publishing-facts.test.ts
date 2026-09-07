// tests/app/calendar/publishing-facts.test.ts — BUILD §4.6, §9, issue #175
//
// The four facts `store.ts` used to leave empty, now read: the page on a
// date, its state, the held set and the saved change that holds pages
// back. Every case below is driven from **rows** — the storing PostgREST
// double the §9 suites share — rather than from a fixture, because the
// thing under test is the read, and a fixture would assert the shape of
// the answer without ever asking the question.
//
// The empty-date arms are the point: DECISIONS 2026-09-06 fixes seven, in
// one order, with `page_held` fifth. `empty.test.ts` proves the resolver
// over facts; this file proves the facts over rows, so the two together
// say a real customer's calendar resolves the arm their data earns.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb, type Row } from "../../publish/harness";
import { measured } from "@/lib/measure/measured";
import type { Choice } from "@/lib/opportunities";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

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

const { readPublishingFacts } = await import("@/app/(account)/app/calendar/drafts-read");
const { readCalendarFacts } = await import("@/app/(account)/app/calendar/store");
const { assembleMonth, cellFor } = await import("@/app/(account)/app/calendar/month");

const SITE_ID = "site-1";
const ZONE = "America/New_York";
const SITE = { siteId: SITE_ID, timeZone: ZONE };
const MONTH = "2026-09";
/** 10:00 on 2026-09-15 in the site's own zone. */
const NOW = new Date(Date.UTC(2026, 8, 15, 14, 0, 0));
const TODAY = "2026-09-15";
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

/** One `drafts` row, as §9 stores it. */
function draft(over: Row & { id: string; state: string; scheduled_for: string }): Row {
  return {
    site_id: SITE_ID,
    opportunity_id: "opp-0",
    title: "A written title nobody has a gate for",
    transitions: [],
    veto_deadline: null,
    approved_at: null,
    publishable_since: null,
    hard_rules_passed: true,
    ...over,
  };
}

function seed(a: {
  drafts?: Row[];
  publications?: Row[];
  publishingEnabled?: boolean;
  destinationHealth?: string;
}): void {
  db.reset();
  db.seed("sites", [
    {
      id: SITE_ID,
      user_id: "u1",
      mode: "autopilot",
      veto_hours: 24,
      publish_time: "09:00",
      timezone: ZONE,
      publishing_enabled: a.publishingEnabled ?? true,
    },
  ]);
  db.seed("destinations", [
    { id: "dest-1", site_id: SITE_ID, kind: "hosted", health: a.destinationHealth ?? "ok", config: null },
  ]);
  db.seed("drafts", a.drafts ?? []);
  db.seed("publications", a.publications ?? []);
}

/** No supply at all, so every empty date is decided by §9's facts and by
 *  the proven-zero arm — never by a depth nobody read. */
function withNoSupply(): void {
  supplyDepth.mockResolvedValue({ unused: 0 });
  nextForDay.mockResolvedValue(null);
  rankOpen.mockResolvedValue([]);
  explainChoice.mockImplementation(async (id: string) =>
    choiceFor(Number(String(id).replace("opp-", "")) || 0)
  );
}

function withSupply(count: number): void {
  const ids = Array.from({ length: count }, (_, n) => `opp-${n}`);
  supplyDepth.mockResolvedValue({ unused: count });
  nextForDay.mockResolvedValue(count === 0 ? null : { id: ids[0] });
  rankOpen.mockResolvedValue(ids.map((id) => ({ opportunityId: id, score: 1 })));
  explainChoice.mockImplementation(async (id: string) =>
    choiceFor(Number(String(id).replace("opp-", "")) || 0)
  );
}

beforeEach(() => {
  supplyDepth.mockReset();
  nextForDay.mockReset();
  rankOpen.mockReset();
  explainChoice.mockReset();
  withNoSupply();
  seed({});
});

describe("the page on a date, and its state", () => {
  it("a draft §9 scheduled is drawn on its own date, in the state the row holds", async () => {
    seed({
      drafts: [
        draft({ id: "d1", state: "in_review", scheduled_for: "2026-09-16", veto_deadline: "2026-09-16T13:00:00.000Z" }),
      ],
    });

    const facts = await readCalendarFacts({ site: SITE, month: MONTH, now: NOW });
    const page = facts.drafts.find((row) => row.scheduledFor === "2026-09-16");
    expect(page?.draftId).toBe("d1");
    expect(page?.state).toBe("in_review");
    expect(page?.vetoDeadline?.toISOString()).toBe("2026-09-16T13:00:00.000Z");
    // The stage the grid draws follows from the state and from nothing
    // else.
    const model = assembleMonth(facts, MONTH);
    expect(cellFor(model, "2026-09-16")?.page?.stage).toBe("your_review");
    expect(model.counts.your_review).toBe(1);
  });

  it("the title is the search it targets, never the draft's own written title", async () => {
    seed({ drafts: [draft({ id: "d1", state: "approved", scheduled_for: "2026-09-16" })] });

    const facts = await readCalendarFacts({ site: SITE, month: MONTH, now: NOW });
    const page = facts.drafts.find((row) => row.scheduledFor === "2026-09-16");
    // ADR-012: model text reaches a customer only through `GeneratedText`,
    // and this screen has no gate for one.
    expect(page?.title).toBe("search 0");
    expect(page?.title).not.toContain("nobody has a gate for");
  });

  it("a page on its way out carries the next publish time from the site's own clock", async () => {
    seed({
      drafts: [
        draft({
          id: "d1",
          state: "approved",
          scheduled_for: "2026-09-16",
          approved_at: "2026-09-16T02:00:00.000Z",
        }),
      ],
    });

    const facts = await readCalendarFacts({ site: SITE, month: MONTH, now: NOW });
    const page = facts.drafts.find((row) => row.draftId === "d1");
    expect(page?.publishAt).not.toBeNull();
    // 09:00 in New York, the site's own stored publish time — never the
    // server's hour.
    expect(page?.publishAt?.toISOString()).toBe("2026-09-16T13:00:00.000Z");
  });

  it("a published page carries the address, and one ReachKit never made live carries none", async () => {
    seed({
      drafts: [
        draft({ id: "d1", state: "published", scheduled_for: "2026-09-10" }),
        draft({ id: "d2", state: "published", scheduled_for: "2026-09-11" }),
      ],
      publications: [
        { id: "p1", draft_id: "d1", live_url: "https://content.example.com/a", made_live_by_us: true },
        { id: "p2", draft_id: "d2", live_url: "https://blog.example.com/b", made_live_by_us: false },
      ],
    });

    const facts = await readCalendarFacts({ site: SITE, month: MONTH, now: NOW });
    expect(facts.drafts.find((row) => row.draftId === "d1")?.liveUrl).toBe(
      "https://content.example.com/a"
    );
    expect(facts.drafts.find((row) => row.draftId === "d2")?.liveUrl).toBeNull();
  });

  it("a date §9 has spoken for is not planned over, and supply keeps its own order", async () => {
    withSupply(3);
    seed({ drafts: [draft({ id: "d1", state: "approved", scheduled_for: "2026-09-16" })] });

    const facts = await readCalendarFacts({ site: SITE, month: MONTH, now: NOW });
    const on16 = facts.drafts.filter((row) => row.scheduledFor === "2026-09-16");
    expect(on16).toHaveLength(1);
    expect(on16[0]?.draftId).toBe("d1");
    // And the model does not raise: one page per date (REQ-043 c1).
    expect(() => assembleMonth(facts, MONTH)).not.toThrow();
  });

  it("whether the page ever reached review is read off the transitions and nowhere else", async () => {
    seed({
      drafts: [
        draft({ id: "d1", state: "needs_attention", scheduled_for: "2026-09-16" }),
        draft({
          id: "d2",
          state: "needs_attention",
          scheduled_for: "2026-09-17",
          transitions: [{ from: "generating", to: "in_review", at: AT.toISOString() }],
        }),
      ],
    });

    const facts = await readCalendarFacts({ site: SITE, month: MONTH, now: NOW });
    expect(facts.drafts.find((row) => row.draftId === "d1")?.enteredReview).toBe(false);
    expect(facts.drafts.find((row) => row.draftId === "d2")?.enteredReview).toBe(true);
  });
});

describe("the empty-date arms, from rows", () => {
  it("page_cannot_go_live: a vetoed page hands its date over, naming its state", async () => {
    seed({ drafts: [draft({ id: "d1", state: "skipped", scheduled_for: "2026-09-16" })] });

    const facts = await readCalendarFacts({ site: SITE, month: MONTH, now: NOW });
    const model = assembleMonth(facts, MONTH);
    const cell = cellFor(model, "2026-09-16");
    expect(cell?.page).toBeNull();
    expect(cell?.empty).toEqual({ cause: "page_cannot_go_live", state: "skipped" });
  });

  it("page_held: a held page's own missed date reads held, and the page is still there", async () => {
    seed({
      drafts: [
        draft({
          id: "d1",
          state: "approved",
          scheduled_for: "2026-09-14", // yesterday, in the site's own zone
          publishable_since: "2026-09-13T00:00:00.000Z",
        }),
      ],
      publishingEnabled: false,
    });

    const facts = await readCalendarFacts({ site: SITE, month: MONTH, now: NOW });
    expect(facts.heldDays).toEqual(["2026-09-14"]);
    // The page is not drawn on the date it missed.
    expect(facts.drafts.some((row) => row.scheduledFor === "2026-09-14")).toBe(false);

    // And the precedence: the customer's own saved change outranks it, so
    // the date that page vacated says what the customer can act on.
    const model = assembleMonth(facts, MONTH);
    expect(cellFor(model, "2026-09-14")?.empty).toEqual({
      cause: "customer_change_holds_pages",
      setting: "publishing_off",
    });
  });

  it("page_held stands on its own where no stronger cause is true", async () => {
    // A ReachKit stop holds the page; the customer changed nothing and the
    // destination is fine, so nothing above `page_held` fires.
    seed({
      drafts: [
        draft({
          id: "d1",
          state: "approved",
          scheduled_for: "2026-09-14",
          publishable_since: "2026-09-13T00:00:00.000Z",
        }),
      ],
    });
    const facts = await readCalendarFacts({ site: SITE, month: MONTH, now: NOW });
    expect(facts.heldDays).toEqual(["2026-09-14"]);
    expect(facts.customerChangeHoldsPages).toBeNull();

    const model = assembleMonth(facts, MONTH);
    expect(cellFor(model, "2026-09-14")?.empty).toEqual({ cause: "page_held" });
  });

  it("a held page whose date has not come round yet has missed nothing, and is drawn", async () => {
    seed({
      drafts: [
        draft({
          id: "d1",
          state: "approved",
          scheduled_for: "2026-09-20",
          publishable_since: "2026-09-13T00:00:00.000Z",
        }),
      ],
      publishingEnabled: false,
    });

    const facts = await readCalendarFacts({ site: SITE, month: MONTH, now: NOW });
    expect(facts.heldDays).toEqual([]);
    expect(facts.drafts.find((row) => row.scheduledFor === "2026-09-20")?.state).toBe("approved");
  });

  it("customer_change_holds_pages: a disconnected destination is named where the switch is on", async () => {
    seed({ destinationHealth: "error" });

    const facts = await readCalendarFacts({ site: SITE, month: MONTH, now: NOW });
    expect(facts.customerChangeHoldsPages).toBe("destination_disconnected");
    const model = assembleMonth(facts, MONTH);
    expect(cellFor(model, "2026-09-20")?.empty).toEqual({
      cause: "customer_change_holds_pages",
      setting: "destination_disconnected",
    });
  });

  it("supply_exhausted stands only on a proven zero, with nothing of §9's true of the date", async () => {
    seed({});
    const facts = await readCalendarFacts({ site: SITE, month: MONTH, now: NOW });
    expect(facts.unusedSupply).toBe(0);
    const model = assembleMonth(facts, MONTH);
    expect(cellFor(model, "2026-09-20")?.empty).toEqual({ cause: "supply_exhausted" });
  });

  it("unattributed: a month whose §9 facts could not be read plans nothing and claims nothing", async () => {
    withSupply(5);
    // No `sites` row: the settings read cannot answer, so §9's facts for
    // this month are unreadable.
    db.reset();
    db.seed("sites", []);

    const facts = await readCalendarFacts({ site: SITE, month: MONTH, now: NOW });
    // Not "a month with no pages": nothing is planned over pages nobody
    // could see, and the depth is not stated beside them.
    expect(facts.drafts).toEqual([]);
    expect(facts.unusedSupply).toBeNull();

    const model = assembleMonth(facts, MONTH);
    expect(cellFor(model, "2026-09-20")?.empty).toEqual({ cause: "unattributed" });
  });
});

describe("the read itself", () => {
  it("answers an unreadable month with one frozen value, and never a half-answer", async () => {
    db.reset();
    db.seed("sites", []);
    const facts = await readPublishingFacts({ siteId: SITE_ID, month: MONTH, today: TODAY });
    expect(facts.readable).toBe(false);
    expect(facts.pagesByDay.size).toBe(0);
    expect(facts.heldDays).toEqual([]);
    expect(facts.customerChangeHoldsPages).toBeNull();
    expect(Object.isFrozen(facts)).toBe(true);
  });

  it("reads only the month it was asked for", async () => {
    seed({
      drafts: [
        draft({ id: "d1", state: "approved", scheduled_for: "2026-09-16" }),
        draft({ id: "d2", state: "approved", scheduled_for: "2026-10-16" }),
      ],
    });
    const facts = await readPublishingFacts({ siteId: SITE_ID, month: MONTH, today: TODAY });
    expect([...facts.pagesByDay.keys()]).toEqual(["2026-09-16"]);
  });
});
