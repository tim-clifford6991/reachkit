// tests/app/session/stores.test.ts — BUILD §4.5, §4.6, issue #169
//
// The two stores whose whole job is to read one account's rows and never
// another's: the draft view's, where ownership is a filter on the query,
// and Overview's, where what has not been measured is said rather than
// guessed at.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const rows = new Map<string, Record<string, unknown>[]>();

vi.mock("@/lib/db", () => {
  const builder = (table: string) => {
    const eq: { column: string; value: unknown }[] = [];
    const notNull: string[] = [];
    const isNull: string[] = [];
    const inList: { column: string; value: unknown[] }[] = [];
    const self: Record<string, unknown> = {
      select: () => self,
      order: () => self,
      limit: () => self,
      eq: (column: string, value: unknown) => {
        eq.push({ column, value });
        return self;
      },
      in: (column: string, value: unknown[]) => {
        inList.push({ column, value });
        return self;
      },
      not: (column: string) => {
        notNull.push(column);
        return self;
      },
      is: (column: string) => {
        isNull.push(column);
        return self;
      },
      then: (resolve: (r: unknown) => unknown) => {
        const kept = (rows.get(table) ?? []).filter(
          (row) =>
            eq.every((f) => row[f.column] === f.value) &&
            inList.every((f) => f.value.includes(row[f.column])) &&
            notNull.every((c) => row[c] !== null && row[c] !== undefined) &&
            isNull.every((c) => row[c] === null || row[c] === undefined)
        );
        return Promise.resolve(resolve({ data: kept, error: null }));
      },
    };
    return self;
  };
  return { dbAdmin: () => ({ from: (table: string) => builder(table) }) };
});

vi.mock("@/lib/scan/weekly", () => ({
  nextDueOn: async () => new Date("2026-09-14T10:00:00.000Z"),
  // Issue #213 — the store reads the trailing window of stored weeks. This
  // suite is about the *other* four facts, so the weekly reader answers
  // "no week has a row", which is the arm every case here was written
  // against: a site with nothing measured.
  weekStartFor: () => "2026-09-07",
  previousWeekStart: (weekStart: string) => {
    const midday = Date.parse(`${weekStart}T12:00:00.000Z`) - 7 * 86_400_000;
    return new Date(midday).toISOString().slice(0, 10);
  },
  readWeekScans: async () => new Map(),
}));

vi.mock("@/lib/opportunities", () => ({
  supplyDepth: async () => ({ unused: 0, exhaustedSince: null }),
}));

const { readDraftRow } = await import("@/app/(account)/app/draft/[draftId]/store");
const { readOverviewFacts } = await import("@/app/(account)/app/_overview/store");
const { siteOwnsDraft } = await import("@/app/(account)/app/_session/store");

const SITE = { siteId: "site-1", timeZone: "America/New_York", mode: "autopilot" as const };

beforeEach(() => {
  rows.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("§4.6 — ownership is a filter, not a check made afterwards", () => {
  beforeEach(() => {
    rows.set("drafts", [
      {
        id: "mine",
        site_id: "site-1",
        state: "in_review",
        title: "My page",
        body_md: "Body.",
        meta: null,
        veto_deadline: "2026-09-09T13:00:00.000Z",
      },
      {
        id: "theirs",
        site_id: "site-other",
        state: "in_review",
        title: "Their page",
        body_md: "Body.",
        meta: null,
        veto_deadline: null,
      },
    ]);
  });

  it("this account's draft comes back", async () => {
    const facts = await readDraftRow({ draftId: "mine", site: SITE });
    expect(facts?.title).toBe("My page");
  });

  it("another account's draft does not come back at all", async () => {
    // Not "comes back and is rejected": there is no row in hand for a
    // later `if` to forget.
    await expect(readDraftRow({ draftId: "theirs", site: SITE })).resolves.toBeNull();
  });

  it("an id that does not exist takes the same arm, so the address tells a stranger nothing", async () => {
    await expect(readDraftRow({ draftId: "no-such-id", site: SITE })).resolves.toBeNull();
  });

  // Issue #268 — the epoch-zero half of the same rule the file opens with:
  // what has not been measured is *said* rather than guessed at, and a
  // guessed date is the worst kind of guess because it formats like a real
  // one. `Dec 31, 1969` reached a customer's draft view this way.
  it("a draft with no recorded grounding carries no read date, and no record with no scan carries a measurement date", async () => {
    const facts = await readDraftRow({ draftId: "mine", site: SITE });
    expect(facts?.groundedFact.readAt).toBeNull();
    // No opportunity row is seeded, so the record has no scan to take a
    // date from — the arm the finding was raised against.
    expect(facts?.record?.measuredAt ?? null).toBeNull();
    // Neither is epoch zero wearing a different name.
    expect(facts?.groundedFact.readAt as Date | null).not.toEqual(new Date(0));
  });

  it("a row in a state this build does not know is not drawn", async () => {
    rows.set("drafts", [
      { id: "mine", site_id: "site-1", state: "wat", title: "t", body_md: "", meta: null, veto_deadline: null },
    ]);
    await expect(readDraftRow({ draftId: "mine", site: SITE })).resolves.toBeNull();
  });

  it("the veto deadline is carried only while a review is running", async () => {
    const inReview = await readDraftRow({ draftId: "mine", site: SITE });
    expect(inReview?.autoApprovesAt).toEqual(new Date("2026-09-09T13:00:00.000Z"));

    rows.set("drafts", [
      {
        id: "mine",
        site_id: "site-1",
        state: "published",
        title: "My page",
        body_md: "",
        meta: null,
        veto_deadline: "2026-09-09T13:00:00.000Z",
      },
    ]);
    const published = await readDraftRow({ draftId: "mine", site: SITE });
    // A page that is not awaiting review has no time at which doing
    // nothing publishes it.
    expect(published?.autoApprovesAt).toBeNull();
  });

  it("a draft with no recorded check is outstanding, never a pass it did not earn", async () => {
    const facts = await readDraftRow({ draftId: "mine", site: SITE });
    expect(facts?.claim).toEqual({ state: "outstanding" });
  });

  it("`siteOwnsDraft` answers the same pair the read filters on", async () => {
    await expect(siteOwnsDraft("site-1", "mine")).resolves.toBe(true);
    await expect(siteOwnsDraft("site-1", "theirs")).resolves.toBe(false);
    await expect(siteOwnsDraft("site-other", "mine")).resolves.toBe(false);
  });
});

describe("§4.5 — what has not been measured is said, not guessed", () => {
  it("a site with no live page counts its pages, and the count is a measurement", async () => {
    rows.set("publications", [
      { id: "p1", site_id: "site-1", published_at: "2026-09-01", unpublished_at: null },
      { id: "p2", site_id: "site-1", published_at: "2026-09-02", unpublished_at: "2026-09-03" },
      { id: "p3", site_id: "site-other", published_at: "2026-09-02", unpublished_at: null },
    ]);
    const facts = await readOverviewFacts({ siteId: "site-1", timeZone: "America/New_York" });
    // One live page: the taken-down one and the other site's are both out,
    // by the same predicate the hosted sitemap reads.
    expect(facts.pagesPublished).toMatchObject({ kind: "measured", value: 1 });
  });

  it("a site with no measured week reads an empty series and an unmeasured rival set", async () => {
    // Issue #213: the series is read now, and this is the arm where the
    // read comes back with nothing — a customer who has not been measured
    // yet. `tests/app/overview/store.test.ts` drives the other arms from
    // rows; what matters here is that an empty read stays empty rather
    // than becoming a line at zero.
    const facts = await readOverviewFacts({ siteId: "site-1", timeZone: "America/New_York" });
    expect(facts.points).toEqual([]);
    expect(facts.aiPresence).toEqual([]);
    expect(facts.rivals.own.kind).toBe("unmeasured");
    // A `zero` would be a claim that this customer ranks for nothing
    // (REQ-004); `unmeasured` says only that nobody has looked.
    expect(facts.rivals.own.kind).not.toBe("zero");
  });

  it("what waits on the customer is their own drafts, in the two states that wait", async () => {
    rows.set("drafts", [
      { id: "d1", site_id: "site-1", state: "needs_attention", title: "Needs you", created_at: "2026-09-01" },
      { id: "d2", site_id: "site-1", state: "in_review", title: "In review", created_at: "2026-09-02" },
      { id: "d3", site_id: "site-1", state: "planned", title: "Planned", created_at: "2026-09-03" },
      { id: "d4", site_id: "site-other", state: "in_review", title: "Theirs", created_at: "2026-09-02" },
    ]);
    const facts = await readOverviewFacts({ siteId: "site-1", timeZone: "America/New_York" });
    expect(facts.waiting.map((item) => item.kind)).toEqual(["needs_you", "pending_veto"]);
    expect(facts.waiting.map((item) => item.title)).toEqual(["Needs you", "In review"]);
    expect(facts.waiting.map((item) => item.href)).toEqual(["/app/draft/d1", "/app/draft/d2"]);
  });

  it("the zone it states is the account's own", async () => {
    const facts = await readOverviewFacts({ siteId: "site-1", timeZone: "Europe/Dublin" });
    expect(facts.timeZone).toBe("Europe/Dublin");
  });
});
