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
/** What `fetches_spend_since` answers — the day's product-wide spend, in
 *  cents, or an error where the ledger cannot be read. */
const daySpend = vi.hoisted(() => ({ cents: 4.41 as number | null }));

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
  return {
    dbAdmin: () => ({
      from: (table: string) => builder(table),
      rpc: async (fn: string) =>
        fn === "fetches_spend_since" && daySpend.cents !== null
          ? { data: daySpend.cents, error: null }
          : { data: null, error: { message: "the ledger is unreadable" } },
    }),
  };
});

const { readShellFacts } = await import("@/app/(account)/app/_shell/store");
const { dayCeilingCents, registerPayingSiteCounter } = await import("@/lib/costs/daily");
const { assembleShell } = await import("@/app/(account)/app/_shell/model");
const { publishingStatement } = await import("@/app/(account)/app/_shell/PublishingCard");

/** Paying sites at the day's start; the day's ceiling is read off them. */
const PAYING_SITES = 3;

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
  daySpend.cents = 4.41;
  registerPayingSiteCounter(async () => PAYING_SITES);
});

afterEach(() => {
  vi.restoreAllMocks();
  registerPayingSiteCounter(null);
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

describe("a page in review is the next publish (issue 1362)", () => {
  // Seen on reachkit.app on 2026-10-09: one page `in_review`, its window
  // ending at 16:00 UTC, and the card reading that no page was ready.
  const inReview = {
    id: "d1",
    site_id: "site-1",
    state: "in_review",
    scheduled_for: "2026-10-09",
    veto_deadline: "2026-10-09T16:00:00.000Z",
  };

  it("it goes live on its own when its window ends, and no cause is stated", async () => {
    rows.set("drafts", [inReview]);
    const facts = await readShellFacts(SITE);
    expect(facts.next).toEqual(new Date("2026-10-09T16:00:00.000Z"));
    expect(facts.noPublishCauses.not_written).toBe(false);
    expect(facts.noPublishCauses.nothing_planned).toBe(false);
  });

  it("the moment is the one the customer was told, where they were told one", async () => {
    rows.set("drafts", [{ ...inReview, told: { publishesAt: "2026-10-09T17:00:00.000Z" } }]);
    expect((await readShellFacts(SITE)).next).toEqual(new Date("2026-10-09T17:00:00.000Z"));
  });

  it("a page in review with no window running is not a scheduled publish", async () => {
    rows.set("drafts", [{ ...inReview, veto_deadline: null }]);
    expect((await readShellFacts(SITE)).next).toBeNull();
  });
});

describe("the four causes are read as four facts", () => {
  it("a site with no page at all is `nothing_planned`", async () => {
    rows.set("drafts", []);
    const facts = await readShellFacts(SITE);
    expect(facts.noPublishCauses.nothing_planned).toBe(true);
    expect(facts.noPublishCauses.not_written).toBe(false);
  });

  it("a site with a page planned and not written is `not_written`, not `nothing_planned`", async () => {
    rows.set("drafts", [
      { id: "d1", site_id: "site-1", state: "planned", scheduled_for: null },
    ]);
    const facts = await readShellFacts(SITE);
    expect(facts.noPublishCauses.nothing_planned).toBe(false);
    expect(facts.noPublishCauses.not_written).toBe(true);
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

  it("issue 841: a pass stored degraded — a thin market — is not a stop", async () => {
    // The owner's walk: zero questions, so the pass's SERPs and rivals were
    // missing and the row was `degraded`; the switch was off and the day had
    // spent 4.41¢ of 5000¢. Nothing stopped.
    rows.set("scans", [
      { id: "s1", site_id: "site-1", status: "degraded", created_at: "2026-09-05T06:00:00.000Z" },
    ]);
    const facts = await readShellFacts(SITE);
    expect(facts.stopped).toBeNull();
    expect(facts.noPublishCauses.reachkit_stopped).toBe(false);
  });

  it("issue 841: a failed pass is not a stop either", async () => {
    rows.set("scans", [
      { id: "s1", site_id: "site-1", status: "failed", created_at: "2026-09-05T06:00:00.000Z" },
    ]);
    expect((await readShellFacts(SITE)).stopped).toBeNull();
  });

  it("the day's spend ceiling reached is ReachKit's own stop", async () => {
    daySpend.cents = dayCeilingCents(PAYING_SITES);
    const facts = await readShellFacts(SITE);
    expect(facts.stopped).not.toBeNull();
    expect(facts.noPublishCauses.reachkit_stopped).toBe(true);
    expect(facts.stopped?.needs).toEqual({ kind: "nothing" });
    expect(facts.stopped?.resumes).toEqual({ promised: false });
    expect(facts.stopped?.partial).toBe(false);
  });

  it("just under the ceiling is not a stop", async () => {
    daySpend.cents = dayCeilingCents(PAYING_SITES) - 0.01;
    expect((await readShellFacts(SITE)).stopped).toBeNull();
  });

  it("the ceiling is the day's paying-site figure, so spend past the base alone is not a stop", async () => {
    daySpend.cents = dayCeilingCents(0);
    expect((await readShellFacts(SITE)).stopped).toBeNull();
  });

  it("a ledger that cannot be read states no stop — nothing is known to be reached", async () => {
    daySpend.cents = null;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect((await readShellFacts(SITE)).stopped).toBeNull();
  });

  it("the kill switch has no recorded moment, so it accounts for no earlier day", async () => {
    // Flipping an environment binding writes nothing anywhere, so the only
    // honest `since` is the moment it was found — which under-attributes
    // rather than over-attributes.
    reachKitStopped.mockResolvedValue(true);
    rows.set("scans", [
      { id: "s1", site_id: "site-1", status: "ok", created_at: "2026-09-05T06:00:00.000Z" },
    ]);
    const before = Date.now();
    const facts = await readShellFacts(SITE);
    expect(facts.stopped?.since.getTime()).toBeGreaterThanOrEqual(before);
    expect(facts.stopped?.partial).toBe(false);
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

  it("issue 1477: a page the writing stopped waits on nobody; one that could not be delivered still does", async () => {
    const rested = (reason: string) => [{ from: "generating", to: "needs_attention", reason }];
    rows.set("drafts", [
      { id: "d1", site_id: "site-1", state: "needs_attention", scheduled_for: null, transitions: rested("step_failed:pack:buyer_questions,facts_on_topic") },
      { id: "d2", site_id: "site-1", state: "needs_attention", scheduled_for: null, transitions: rested("rules:honest_row") },
      { id: "d3", site_id: "site-1", state: "needs_attention", scheduled_for: null, transitions: rested("retries_exhausted") },
    ]);
    const facts = await readShellFacts(SITE);
    expect(facts.waiting).toBe(1);
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

describe("until the hosted address is live, the shell names no go-live time", () => {
  const inReview = {
    id: "d1",
    site_id: "site-1",
    state: "in_review",
    title: "What a boiler service costs",
    scheduled_for: "2026-10-21",
    veto_deadline: "2026-10-21T16:00:00.000Z",
  };
  const hosted = (hostname_state: string) => [
    { id: "dest-1", site_id: "site-1", kind: "hosted", hostname: "blog.acme.test", hostname_state, deleted_at: null },
  ];

  it("pending DNS: the waiting page has no time, there is no next publish, and the line says why", async () => {
    rows.set("drafts", [inReview]);
    rows.set("destinations", hosted("pending_dns"));
    const facts = await readShellFacts(SITE);
    expect(facts.review).toEqual({ draftId: "d1", title: inReview.title, goesLiveAt: null });
    expect(facts.next).toBeNull();
    const shell = assembleShell(facts);
    expect(shell.publishing).toEqual({ mode: "autopilot", next: null, because: "address_waiting" });
    expect(publishingStatement(shell).line).toBe("Waiting for your website");
  });

  it("live: the same page keeps its time and is the next publish", async () => {
    rows.set("drafts", [inReview]);
    rows.set("destinations", hosted("live"));
    const facts = await readShellFacts(SITE);
    expect(facts.review?.goesLiveAt).toEqual(new Date(inReview.veto_deadline));
    expect(facts.next).toEqual(new Date(inReview.veto_deadline));
    expect(facts.noPublishCauses.address_waiting).toBe(false);
  });

  it("a site with no hosted address is not waiting for one", async () => {
    rows.set("drafts", [inReview]);
    const facts = await readShellFacts(SITE);
    expect(facts.next).toEqual(new Date(inReview.veto_deadline));
    expect(facts.noPublishCauses.address_waiting).toBe(false);
  });
});
