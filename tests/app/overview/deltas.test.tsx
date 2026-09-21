// tests/app/overview/deltas.test.tsx — SPEC §4, issue 794: the Overview
// shows the week-over-week changes it computes, and the veto countdown is
// the draft's own stored window.
//
// The searches delta was assembled and never drawn; the pages delta was
// never loaded; and the veto countdown counted `VETO.defaultHours` from
// `created_at`, whatever the site's `veto_hours` stamped on the draft.
// Every case is a database state driven through the real `/app` page — the
// provider, the store, the model and the modules it renders.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb, type FakeDb, type Row } from "../../publish/harness";
import { REPORT_VERSION } from "@/lib/scan/report";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
/** REQ-063's stored standings for the week, per test. The searches tile's
 *  line counts the pages standing `working` out of the pages live, so a test
 *  about that line seeds them and every other test leaves them empty. */
const standings = vi.hoisted(() => ({ working: 0 }));
vi.mock("@/lib/opportunities", () => ({
  supplyDepth: async () => ({ unused: 9, total: 12 }),
  supplyMeasured: async () => true,
  supplyState: async () => "measured",
  readWeek: async () =>
    Array.from({ length: standings.working }, (_unused, i) => ({
      opportunityId: `o${i}`,
      standing: { kind: "verdict", verdict: "working" },
    })),
}));

const { LIVE_ACCOUNT, resetAccount, signedInAs } = await import("../account-door");
const { default: OverviewPage } = await import("@/app/(account)/app/(tabs)/page");
const { copy } = await import("@/lib/presentation/copy");

const ZONE = "UTC";
const ACCOUNT = { ...LIVE_ACCOUNT, timeZone: ZONE };
const SITE_ID = ACCOUNT.siteId;

/** Wednesday 16 September 2026, 10:00 UTC. */
const NOW = new Date(Date.UTC(2026, 8, 16, 10, 0, 0));

function report(at: string, ownRanked: number): Row {
  return {
    version: REPORT_VERSION,
    verdict: {
      measuredAt: at,
      scoreAndBand: { kind: "measured", value: { score: 40, band: "hard-to-find" }, at },
    },
    ownRanked: { kind: "measured", value: ownRanked, at },
    aiAnswers: { customerCitations: 0 },
    rivalSizes: { kind: "measured", value: [], at },
    siteIssues: [],
  };
}

function scan(tier: "deep" | "weekly", at: string, ownRanked: number, weekStart: string | null): Row {
  return {
    id: `scan-${tier}-${at}`,
    site_id: SITE_ID,
    domain: ACCOUNT.domain,
    tier,
    status: "done",
    week_start: weekStart,
    created_at: at,
    report: report(at, ownRanked),
  };
}

const DEEP = scan("deep", "2026-09-02T15:00:00.000Z", 4, null);
const WEEK_1 = scan("weekly", "2026-09-07T09:00:00.000Z", 9, "2026-09-07");
const WEEK_2 = scan("weekly", "2026-09-14T09:00:00.000Z", 15, "2026-09-14");

function publication(id: string, published: string, unpublished: string | null = null): Row {
  return { id, site_id: SITE_ID, published_at: published, unpublished_at: unpublished };
}

async function page(): Promise<string> {
  return renderToStaticMarkup(await OverviewPage());
}

/** The inner markup of the element carrying `data-testid`. */
function section(markup: string, testId: string): string {
  const at = markup.indexOf(`data-testid="${testId}"`);
  expect(at).toBeGreaterThan(-1);
  return markup.slice(at, at + 4000);
}

beforeEach(() => {
  db.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  signedInAs(ACCOUNT);
  db.seed("sites", [
    { id: SITE_ID, user_id: ACCOUNT.userId, domain: ACCOUNT.domain, timezone: ZONE, competitors: [], veto_hours: 4 },
  ]);
  db.seed("publications", []);
  db.seed("drafts", []);
  db.seed("scans", []);
  standings.working = 0;
});

afterEach(() => {
  vi.useRealTimers();
  resetAccount();
});

const up = (n: number): string => `<span class="num">${copy("overview.delta.up")}</span><span class="num">${n}</span>`;

// SPEC §4 (2026-09-20): the searches reading is the Overview tab's first
// tile now, not the growth card — the card itself is the Search tab's (#916).
// The change it carries is the same one, read from the same two weeks.
describe("the searches-appeared change is drawn on the tile that opens Search", () => {
  it("two weekly readings: the change between them sits beside the number", async () => {
    db.seed("scans", [DEEP, WEEK_1, WEEK_2]);
    const tile = section(await page(), "overview-tile-searches");
    expect(tile).toContain(up(6));
  });

  it("on the first Monday the change is taken against week 0, the deep pass", async () => {
    db.seed("scans", [DEEP, WEEK_1]);
    expect(section(await page(), "overview-tile-searches")).toContain(up(5));
  });

  it("before the first Monday there is no movement to draw", async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 8, 4, 10, 0, 0)));
    db.seed("scans", [DEEP]);
    expect(section(await page(), "overview-tile-searches")).not.toContain(
      copy("overview.delta.up")
    );
  });
});

// The pages count is the denominator of that tile's line since the redesign
// ("3 of your 9 pages are already ranking"): the pages tile itself is gone
// from the Overview tab with the owner's 2026-09-20 enumeration. What is
// asserted here is that the count reaching the line is the live one.
describe("the pages live now are the denominator of the tile's line", () => {
  it("a take-down is counted out of the total the line is read against", async () => {
    db.seed("scans", [DEEP, WEEK_1, WEEK_2]);
    standings.working = 2;
    db.seed("publications", [
      publication("p1", "2026-09-05T07:00:00.000Z"),
      publication("p2", "2026-09-08T07:00:00.000Z", "2026-09-12T07:00:00.000Z"),
      publication("p3", "2026-09-10T07:00:00.000Z"),
      publication("p4", "2026-09-12T07:00:00.000Z"),
      publication("p5", "2026-09-15T07:00:00.000Z"),
    ]);
    // p2 was taken down, so four pages are live now.
    const tile = section(await page(), "overview-tile-searches");
    expect(tile).toContain(
      copy("overview.tile.searches.ranking", { ranked: "2", published: "4" })
    );
    expect(tile).not.toContain("TODO(copy)");
  });

  it("with no standings read, the line is absent rather than a 0 of 1", async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 8, 4, 10, 0, 0)));
    db.seed("scans", [DEEP]);
    db.seed("publications", [publication("p1", "2026-09-03T07:00:00.000Z")]);
    const tile = section(await page(), "overview-tile-searches");
    expect(tile).not.toContain("already ranking");
  });
});

// SPEC §4 (2026-09-20): the page in review leads the screen, and the card
// says when it goes live if the customer does nothing. The instant is the
// draft's own stored `veto_deadline` (issue 794) — never a default length
// counted from `created_at`, which is the defect that issue fixed.
describe("when the page goes live is the draft's stored veto_deadline", () => {
  it("a 4-hour window stamped on the draft is the time the card states", async () => {
    db.seed("scans", [DEEP, WEEK_1, WEEK_2]);
    db.seed("drafts", [
      {
        id: "d1",
        site_id: SITE_ID,
        state: "in_review",
        title: "How to pick a CRM",
        created_at: "2026-09-16T08:00:00.000Z",
        veto_deadline: "2026-09-16T12:30:00.000Z",
      },
    ]);
    const card = section(await page(), "overview-waiting");
    // 12:30 UTC, in the site's own zone — not 08:00 plus a default day.
    expect(card).toContain("12:30");
    expect(card).not.toContain("TODO(copy)");
  });

  it("a page in review with no window running states no time at all", async () => {
    db.seed("scans", [DEEP, WEEK_1, WEEK_2]);
    db.seed("drafts", [
      {
        id: "d2",
        site_id: SITE_ID,
        state: "in_review",
        title: "How to pick a CRM",
        created_at: "2026-09-16T08:00:00.000Z",
        veto_deadline: null,
      },
    ]);
    const card = section(await page(), "overview-waiting");
    expect(card).toContain(copy("overview.waiting.waits"));
    expect(card).not.toContain("TODO(copy)");
  });

  // The countdown itself belongs to a **second** page in review, which the
  // card does not lead with: one page leads, the rest wait in the list.
  it("a second page in review keeps its countdown in the needs-you list", async () => {
    db.seed("scans", [DEEP, WEEK_1, WEEK_2]);
    db.seed("drafts", [
      {
        id: "d1",
        site_id: SITE_ID,
        state: "in_review",
        title: "How to pick a CRM",
        created_at: "2026-09-16T07:00:00.000Z",
        veto_deadline: "2026-09-16T18:00:00.000Z",
      },
      {
        id: "d2",
        site_id: SITE_ID,
        state: "in_review",
        title: "How to pick a helpdesk",
        created_at: "2026-09-16T08:00:00.000Z",
        veto_deadline: "2026-09-16T12:30:00.000Z",
      },
    ]);
    const html = await page();
    const alerts = section(html, "overview-needs-you");
    const left = copy("overview.alert.pending-veto.left", { hours: "2", minutes: "30" });
    expect(alerts).toContain(copy("overview.alert.pending-veto.due", { left }));
    // …and the page the card leads with is not repeated in that list.
    expect(alerts).not.toContain("How to pick a CRM");
  });
});
