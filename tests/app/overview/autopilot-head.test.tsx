// tests/app/overview/autopilot-head.test.tsx — SPEC §4 (2026-10-09, issue
// 1362): the Overview's head states what autopilot is doing.
//
// Owner: "when opening the overview, i currently see "No page is ready
// yet." which gives the wrong impression. this should rather give the user
// confidence of the actual current app status."
//
// One case per state of the head line, each a database state driven through
// the real `/app` page for a live account — the shell's store, the
// Overview's store and the screen — and the reserved fixture account's own.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb, type FakeDb, type Row } from "../../publish/harness";

const db: FakeDb = fakeDb();
const supply = vi.hoisted(() => ({ unused: 9, state: "measured" }));
const killSwitch = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/opportunities", () => ({
  supplyDepth: async () => ({ unused: supply.unused, total: 12 }),
  supplyMeasured: async () => true,
  supplyState: async () => supply.state,
  readWeek: async () => [],
}));
vi.mock("@/lib/publish/switch", async (original) => ({
  ...(await original<typeof import("@/lib/publish/switch")>()),
  reachKitStopped: async () => killSwitch.on,
}));

const { LIVE_ACCOUNT, RESERVED_ACCOUNT, resetAccount, signedInAs } = await import("../account-door");
const { default: OverviewPage } = await import("@/app/(account)/app/(tabs)/page");
const { copy } = await import("@/lib/presentation/copy");

const ZONE = "UTC";
const ACCOUNT = { ...LIVE_ACCOUNT, timeZone: ZONE };
const SITE_ID = ACCOUNT.siteId;

/** Friday 9 October 2026, 10:00 UTC — the morning the owner opened it. */
const NOW = new Date(Date.UTC(2026, 9, 9, 10, 0, 0));

/** The page seen on reachkit.app that morning: in review, its window ending
 *  at 16:00 UTC the same day. */
const IN_REVIEW: Row = {
  id: "d1",
  site_id: SITE_ID,
  state: "in_review",
  title: "How to pick a CRM",
  scheduled_for: "2026-10-09",
  created_at: "2026-10-08T16:00:00.000Z",
  veto_deadline: "2026-10-09T16:00:00.000Z",
};

function site(over: Row = {}): void {
  db.seed("sites", [
    {
      id: SITE_ID,
      user_id: ACCOUNT.userId,
      domain: ACCOUNT.domain,
      timezone: ZONE,
      competitors: [],
      veto_hours: 24,
      publishing_enabled: true,
      ...over,
    },
  ]);
}

/** The screen's `h1`, the quiet lines under it, and the whole screen's text. */
async function head(): Promise<{ line: string; notes: string[]; text: string; html: string }> {
  const html = renderToStaticMarkup(await OverviewPage());
  const line = /<h1[^>]*>(.*?)<\/h1>/u.exec(html)?.[1] ?? "";
  const notes = [...html.matchAll(/data-testid="overview-head-note">(.*?)<\/p>/gu)].map((m) => m[1] ?? "");
  return { line, notes, html, text: html.replace(/<[^>]+>/gu, " ") };
}

beforeEach(() => {
  db.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  signedInAs(ACCOUNT);
  supply.unused = 9;
  supply.state = "measured";
  killSwitch.on = false;
  site();
  db.seed("publications", []);
  db.seed("drafts", []);
  db.seed("scans", []);
});

afterEach(() => {
  vi.useRealTimers();
  resetAccount();
});

beforeAll(async () => {
  await Promise.all([
    import("@/app/(account)/app/_overview/store"),
    import("@/app/(account)/app/_overview/search-provider"),
    import("@/app/(account)/app/_overview/search-store"),
    import("@/app/(account)/app/_shell/store"),
    import("@/lib/publish/reads/facts"),
  ]);
}, 60_000);

describe("the head states what autopilot is doing, for a live account", () => {
  it("a page due today: it goes live at its time, and nothing says no page is ready", async () => {
    db.seed("drafts", [IN_REVIEW]);
    const { line, text, html } = await head();
    expect(line).toBe(copy("overview.head.due.today", { time: "4:00 PM" }));
    // The page is today's content, with its title, a countdown and the two
    // things the customer can do.
    expect(text).toContain("How to pick a CRM");
    expect(html).toContain('data-testid="overview-waiting-read"');
    expect(html).toContain('data-testid="overview-stop-action"');
    expect(text).not.toMatch(/no page is ready|ready to read|approv|your review|waiting for you/iu);
  });

  it("a page due tomorrow is tomorrow's page", async () => {
    db.seed("drafts", [{ ...IN_REVIEW, scheduled_for: "2026-10-10", veto_deadline: "2026-10-10T07:00:00.000Z" }]);
    expect((await head()).line).toBe(copy("overview.head.due.tomorrow", { time: "7:00 AM" }));
  });

  it("a page planned and not written yet is being written", async () => {
    db.seed("drafts", [
      { id: "d2", site_id: SITE_ID, state: "planned", title: "Planned", scheduled_for: "2026-10-10", created_at: NOW.toISOString() },
    ]);
    const { line, html } = await head();
    expect(line).toBe(copy("overview.head.writing.tomorrow"));
    // Nothing is in review, so no card and no control stands beside it.
    expect(html).not.toContain('data-testid="overview-waiting"');
  });

  it("publishing off is stated, and the page in review counts down to nothing", async () => {
    site({ publishing_enabled: false });
    db.seed("drafts", [IN_REVIEW]);
    const { line, text } = await head();
    expect(line).toBe(copy("next-publish.paused"));
    expect(text).not.toMatch(/Goes live in/u);
  });

  it("ReachKit's own stop is stated, whatever else is true", async () => {
    killSwitch.on = true;
    db.seed("drafts", [IN_REVIEW]);
    expect((await head()).line).toBe(copy("next-publish.stopped"));
  });

  it("nothing planned says so, and why — the one supply statement, said once", async () => {
    supply.unused = 0;
    supply.state = "measured";
    const { line, html } = await head();
    expect(line).toBe(copy("next-publish.none-planned"));
    const stated = [...html.matchAll(/data-testid="overview-supply">(.*?)<\/p>/gu)].map((m) => m[1]);
    expect(stated).toEqual([copy("overview.supply.exhausted")]);
    // Under the head, not down in *This week*.
    expect(html.indexOf('data-testid="overview-supply"')).toBeLessThan(html.indexOf('data-testid="overview-tiles"'));
  });

  it("what went live last, and when, stands under the head", async () => {
    db.seed("drafts", [
      IN_REVIEW,
      { id: "d0", site_id: SITE_ID, state: "published", title: "CRM pricing, compared", scheduled_for: "2026-10-08", created_at: "2026-10-07T16:00:00.000Z" },
    ]);
    db.seed("publications", [
      { id: "p0", site_id: SITE_ID, draft_id: "d0", published_at: "2026-10-08T16:00:00.000Z", unpublished_at: null },
    ]);
    expect((await head()).notes).toEqual([
      copy("overview.head.last-live", { title: "CRM pricing, compared", on: "Oct 8, 2026" }),
    ]);
  });
});

describe("the head states what autopilot is doing, for the fixture account", () => {
  it("its next page and when it goes live, and the last one that did", async () => {
    signedInAs(RESERVED_ACCOUNT);
    const { line, notes, text } = await head();
    expect(line).toBe(copy("next-publish.scheduled", { at: "Sep 8, 2026, 9:00 AM EDT" }));
    expect(notes).toHaveLength(1);
    expect(text).not.toMatch(/no page is ready|ready to read/iu);
  });
});
