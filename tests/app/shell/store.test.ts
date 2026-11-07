/** @vitest-environment jsdom */
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
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
    const filters: { column: string; value: unknown; kind: "eq" | "in" | "gte" | "not-null" }[] = [];
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
      gte: (column: string, value: unknown) => {
        filters.push({ column, value, kind: "gte" });
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
                : f.kind === "gte"
                  ? typeof row[f.column] === "string" && (row[f.column] as string) >= (f.value as string)
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
const { PublishingCard, publishingStatement } = await import("@/app/(account)/app/_shell/PublishingCard");

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
    { id: "d1", site_id: "site-1", state: "approved", scheduled_for: "2026-09-09", title: "Bike service cost" },
  ];

  it("publishing on: the scheduled page is the next publish", async () => {
    rows.set("drafts", scheduled);
    const facts = await readShellFacts(SITE);
    expect(facts.next).toEqual({ at: new Date("2026-09-09"), title: "Bike service cost" });
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
    title: "What a boiler service costs",
    scheduled_for: "2026-10-09",
    veto_deadline: "2026-10-09T16:00:00.000Z",
  };

  it("it goes live on its own when its window ends, and no cause is stated", async () => {
    rows.set("drafts", [inReview]);
    const facts = await readShellFacts(SITE);
    expect(facts.next?.at).toEqual(new Date("2026-10-09T16:00:00.000Z"));
  });

  it("the moment is the one the customer was told, where they were told one", async () => {
    rows.set("drafts", [{ ...inReview, told: { publishesAt: "2026-10-09T17:00:00.000Z" } }]);
    expect((await readShellFacts(SITE)).next?.at).toEqual(new Date("2026-10-09T17:00:00.000Z"));
  });

  it("a page in review with no window running is not a scheduled publish", async () => {
    rows.set("drafts", [{ ...inReview, veto_deadline: null }]);
    expect((await readShellFacts(SITE)).next).toBeNull();
  });
});

describe("the causes are read as separate facts", () => {
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
  it("counts only a page that needs the customer: a page in review is on its way (SPEC §4 2026-10-17, #1477)", async () => {
    rows.set("drafts", [
      { id: "d1", site_id: "site-1", state: "in_review", scheduled_for: null },
      { id: "d2", site_id: "site-1", state: "needs_attention", scheduled_for: null },
      { id: "d3", site_id: "site-1", state: "planned", scheduled_for: null },
      { id: "d4", site_id: "site-1", state: "published", scheduled_for: null },
    ]);
    const facts = await readShellFacts(SITE);
    expect(facts.waiting).toBe(1);
    // The side panel's card still names the page in review.
    expect(facts.review?.draftId).toBe("d1");
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

  it("a stopped page the customer edited holds their words, so it waits on them (owner O7)", async () => {
    const rested = [{ from: "generating", to: "needs_attention", reason: "rules:honest_row" }];
    rows.set("drafts", [
      { id: "d1", site_id: "site-1", state: "needs_attention", scheduled_for: null, transitions: rested, meta: { first_edited_at: "2026-10-30T09:00:00.000Z" } },
      { id: "d2", site_id: "site-1", state: "needs_attention", scheduled_for: null, transitions: rested, meta: {} },
    ]);
    expect((await readShellFacts(SITE)).waiting).toBe(1);
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

  it("the site's mark is its logo only where its own stored profile keeps one", async () => {
    expect((await readShellFacts(SITE)).hasLogo).toBe(false);
    rows.set("site_profiles", [{ domain: "other.test", logo_type: "image/png" }]);
    expect((await readShellFacts(SITE)).hasLogo).toBe(false);
    rows.set("site_profiles", [{ domain: "acme.test", logo_type: null }]);
    expect((await readShellFacts(SITE)).hasLogo).toBe(false);
    rows.set("site_profiles", [{ domain: "acme.test", logo_type: "image/png" }]);
    expect((await readShellFacts(SITE)).hasLogo).toBe(true);
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
    expect(facts.next?.at).toEqual(new Date(inReview.veto_deadline));
    expect(facts.noPublishCauses.address_waiting).toBe(false);
  });

  it("a WordPress never given its login: no time, no next publish, the same line as a host waiting on DNS", async () => {
    rows.set("drafts", [inReview]);
    rows.set("destinations", [{ id: "dest-1", site_id: "site-1", kind: "wordpress", health: "expired", health_reason: "never_connected" }]);
    const facts = await readShellFacts(SITE);
    expect(facts.review).toEqual({ draftId: "d1", title: inReview.title, goesLiveAt: null });
    expect(facts.next).toBeNull();
    expect(publishingStatement(assembleShell(facts)).line).toBe("Waiting for your website");
  });

  it("a site with no hosted address is not waiting for one", async () => {
    rows.set("drafts", [inReview]);
    const facts = await readShellFacts(SITE);
    expect(facts.next?.at).toEqual(new Date(inReview.veto_deadline));
    expect(facts.noPublishCauses.address_waiting).toBe(false);
  });
});

describe("the Autopilot card always names what happens next", () => {
  // A Saturday afternoon in the site's zone: today is 2026-11-07, and the Monday check is due on the 9th.
  const NOW = new Date("2026-11-07T20:00:00.000Z");
  const MONDAY_CHECK = new Date("2026-11-09T11:00:00.000Z");
  const topic = (id: string, planned_for: string, target_query: string) => ({
    id,
    site_id: "site-1",
    scan_id: "scan-1",
    type: "new_page",
    family: "write",
    target_query,
    target_ref: "",
    title: target_query,
    evidence: { family: "write", volume: 40, rival: null },
    acceptance: {},
    fit_band: null,
    effort: 1,
    status: "open",
    cluster_key: target_query,
    absorbed_queries: [],
    ready: true,
    unready_reason: null,
    rest_until: null,
    created_at: "2026-11-02T06:00:00.000Z",
    plan_place: 1,
    planned_for,
  });

  /** The card's line, rendered from the store's facts with the registry's own sentences. */
  async function cardLine(): Promise<string> {
    const html = renderToStaticMarkup(createElement(PublishingCard, { shell: assembleShell(await readShellFacts(SITE)) }));
    const card = document.createElement("div");
    card.innerHTML = html;
    return card.querySelector("[data-testid='shell-publishing-line']")?.textContent ?? "";
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    nextDueOn.mockResolvedValue(MONDAY_CHECK);
  });
  afterEach(() => vi.useRealTimers());

  it("a page in review for tomorrow: the card names its time and its title", async () => {
    rows.set("drafts", [
      { id: "d1", site_id: "site-1", state: "in_review", title: "Emergency plumber in Austin", scheduled_for: "2026-11-08", veto_deadline: "2026-11-08T21:00:00.000Z" },
    ]);
    rows.set("opportunities", [topic("o1", "2026-11-08", "boiler service cost")]);
    expect(await cardLine()).toBe("Next page goes live Nov 8, 2026, 4:00 PM EST: Emergency plumber in Austin");
  });

  it("a topic planned for tomorrow with no draft yet: the card names the topic and its day", async () => {
    rows.set("opportunities", [topic("o1", "2026-11-08", "boiler service cost"), topic("o2", "2026-11-06", "past topic")]);
    expect(await cardLine()).toBe("Next page planned for Sun 8 Nov: boiler service cost");
  });

  it("tomorrow decided no page while its topic is still planned: the card names the Monday check and its date", async () => {
    // reachkit.app on 2026-11-07: 11-08 ended `no_page` (`generate:no_own_facts`) and its row stayed open.
    rows.set("draft_days", [{ site_id: "site-1", publish_date: "2026-11-08", outcome: "no_page", reason: "generate:no_own_facts" }]);
    rows.set("opportunities", [topic("o1", "2026-11-08", "boiler service cost")]);
    expect(await cardLine()).toBe("The Monday check on Mon 9 Nov plans the next pages.");
  });

  it("a decided day or a date that already holds a page is passed over for the next planned topic", async () => {
    rows.set("draft_days", [{ site_id: "site-1", publish_date: "2026-11-08", outcome: "no_page", reason: "generate:no_own_facts" }]);
    rows.set("drafts", [{ id: "d1", site_id: "site-1", state: "skipped", title: "Stopped page", scheduled_for: "2026-11-09" }]);
    rows.set("opportunities", [
      topic("o1", "2026-11-08", "boiler service cost"),
      topic("o2", "2026-11-09", "stopped topic"),
      topic("o3", "2026-11-10", "drain cleaning"),
    ]);
    expect(await cardLine()).toBe("Next page planned for Tue 10 Nov: drain cleaning");
  });

  it("nothing planned at all: the card names the Monday check, and publishing off still says so", async () => {
    expect(await cardLine()).toBe("The Monday check on Mon 9 Nov plans the next pages.");
    isPublishingOn.mockResolvedValue(false);
    expect(await cardLine()).toBe("Publishing is off.");
  });
});
