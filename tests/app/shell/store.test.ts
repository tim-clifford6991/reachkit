// tests/app/shell/store.test.ts — BUILD §4.4, §9, issue #169
//
// The shell's facts for a real account, and the one pair the fixture could
// never produce: publishing switched off with a draft still carrying a
// `scheduled_for`.
//
// `publishingOf` gives a `next` precedence over every cause except
// ReachKit's own stop (REQ-092 c7 names that one and no other), so a store
// that reported the row's date would have the shell tell a customer whose
// publishing is paused that their next page goes live on Tuesday — while
// §9 holds it. "Pause is one click and instant"; the page is in
// `heldPages`, not on its way out.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const isPublishingOn = vi.fn();
const reachKitStopped = vi.fn();
const nextDueOn = vi.fn();
const measuredWeeksOf = vi.fn();
const rows = new Map<string, Record<string, unknown>[]>();

vi.mock("@/lib/publish/switch", () => ({
  isPublishingOn: (...a: unknown[]) => isPublishingOn(...a),
  reachKitStopped: (...a: unknown[]) => reachKitStopped(...a),
}));

vi.mock("@/lib/scan/weekly", () => ({
  nextDueOn: (...a: unknown[]) => nextDueOn(...a),
}));

vi.mock("@/app/(account)/app/_shell/week-rows", () => ({
  measuredWeeksOf: (...a: unknown[]) => measuredWeeksOf(...a),
}));

/** A PostgREST-shaped double that stores rows and applies the filters the
 *  module actually uses — a mock answering from a fixed list would pass
 *  whether or not the query said what it means to say. */
vi.mock("@/lib/db", () => {
  const builder = (table: string) => {
    const filters: { column: string; value: unknown; kind: "eq" | "in" | "not-null" }[] = [];
    const self: Record<string, unknown> = {
      select: () => self,
      order: () => self,
      limit: () => self,
      eq: (column: string, value: unknown) => {
        filters.push({ column, value, kind: "eq" });
        return self;
      },
      in: (column: string, value: unknown) => {
        filters.push({ column, value, kind: "in" });
        return self;
      },
      not: (column: string) => {
        filters.push({ column, value: null, kind: "not-null" });
        return self;
      },
      is: () => self,
      then: (resolve: (r: unknown) => unknown) => {
        const all = rows.get(table) ?? [];
        const kept = all.filter((row) =>
          filters.every((f) =>
            f.kind === "eq"
              ? row[f.column] === f.value
              : f.kind === "in"
                ? (f.value as unknown[]).includes(row[f.column])
                : row[f.column] !== null && row[f.column] !== undefined
          )
        );
        return Promise.resolve(resolve({ data: kept, error: null }));
      },
    };
    return self;
  };
  return { dbAdmin: () => ({ from: (table: string) => builder(table) }) };
});

const { readShellFacts } = await import("@/app/(account)/app/_shell/store");

const SITE = {
  siteId: "site-1",
  domain: "acme.test",
  timeZone: "America/New_York",
  mode: "autopilot" as const,
  createdAt: new Date("2026-08-24T06:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  rows.clear();
  isPublishingOn.mockResolvedValue(true);
  reachKitStopped.mockResolvedValue(false);
  nextDueOn.mockResolvedValue(new Date("2026-09-14T10:00:00.000Z"));
  measuredWeeksOf.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("§9's switch decides whether there is a next publish at all", () => {
  const scheduled = [
    { id: "d1", site_id: "site-1", state: "approved", scheduled_for: "2026-09-09" },
  ];

  it("publishing on: the scheduled page is the next publish", async () => {
    rows.set("drafts", scheduled);
    const facts = await readShellFacts(SITE);
    expect(facts.next).toEqual(new Date("2026-09-09"));
    expect(facts.noPublishCauses.publishing_paused).toBe(false);
  });

  it("publishing off: there is no next publish, and the pause is the cause", async () => {
    rows.set("drafts", scheduled);
    isPublishingOn.mockResolvedValue(false);
    const facts = await readShellFacts(SITE);
    expect(facts.next).toBeNull();
    expect(facts.noPublishCauses.publishing_paused).toBe(true);
  });

  it("the row is untouched by the switch — nothing is written to make this true", async () => {
    rows.set("drafts", scheduled);
    isPublishingOn.mockResolvedValue(false);
    await readShellFacts(SITE);
    expect(rows.get("drafts")).toEqual(scheduled);
  });
});

describe("the four causes are read as four facts", () => {
  it("a site with no page at all is `nothing_planned`", async () => {
    rows.set("drafts", []);
    const facts = await readShellFacts(SITE);
    expect(facts.noPublishCauses.nothing_planned).toBe(true);
    expect(facts.noPublishCauses.nothing_approved).toBe(false);
  });

  it("a site with pages but none scheduled is `nothing_approved`, not `nothing_planned`", async () => {
    rows.set("drafts", [
      { id: "d1", site_id: "site-1", state: "planned", scheduled_for: null },
    ]);
    const facts = await readShellFacts(SITE);
    expect(facts.noPublishCauses.nothing_planned).toBe(false);
    expect(facts.noPublishCauses.nothing_approved).toBe(true);
  });

  it("the kill switch is ReachKit's own stop, and it is stated as one", async () => {
    reachKitStopped.mockResolvedValue(true);
    const facts = await readShellFacts(SITE);
    expect(facts.stopped).not.toBeNull();
    expect(facts.noPublishCauses.reachkit_stopped).toBe(true);
    // REQ-092 c2/c4: both are stated rather than omitted.
    expect(facts.stopped?.needs).toEqual({ kind: "nothing" });
    expect(facts.stopped?.resumes).toEqual({ promised: false });
  });

  it("no stop, and nothing states one", async () => {
    const facts = await readShellFacts(SITE);
    expect(facts.stopped).toBeNull();
    expect(facts.noPublishCauses.reachkit_stopped).toBe(false);
  });
});

describe("what waits on the customer", () => {
  it("counts only the two states that wait on them", async () => {
    rows.set("drafts", [
      { id: "d1", site_id: "site-1", state: "in_review", scheduled_for: null },
      { id: "d2", site_id: "site-1", state: "needs_attention", scheduled_for: null },
      { id: "d3", site_id: "site-1", state: "planned", scheduled_for: null },
      { id: "d4", site_id: "site-1", state: "published", scheduled_for: null },
    ]);
    const facts = await readShellFacts(SITE);
    expect(facts.waiting).toBe(2);
  });

  it("another site's drafts are never counted", async () => {
    rows.set("drafts", [
      { id: "d1", site_id: "site-other", state: "in_review", scheduled_for: null },
    ]);
    const facts = await readShellFacts(SITE);
    expect(facts.waiting).toBe(0);
  });
});

describe("the site's own facts are carried through, never a fixture's", () => {
  it("domain, zone and mode are the account's", async () => {
    const facts = await readShellFacts(SITE);
    expect(facts.domain).toBe("acme.test");
    expect(facts.timeZone).toBe("America/New_York");
    expect(facts.mode).toBe("autopilot");
  });

  it("the weeks come from §11's own rows, asked for this site", async () => {
    await readShellFacts(SITE);
    expect(measuredWeeksOf).toHaveBeenCalledWith(expect.objectContaining({ site: SITE }));
  });
});
