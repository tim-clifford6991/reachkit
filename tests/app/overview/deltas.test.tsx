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
vi.mock("@/lib/opportunities", () => ({
  supplyDepth: async () => ({ unused: 9, total: 12 }),
  supplyMeasured: async () => true,
  readWeek: async () => [],
}));

const { LIVE_ACCOUNT, resetAccount, signedInAs } = await import("../account-door");
const { default: OverviewPage } = await import("@/app/(account)/app/page");
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
});

afterEach(() => {
  vi.useRealTimers();
  resetAccount();
});

const up = (n: number): string => `<span class="num">${copy("overview.delta.up")}</span><span class="num">${n}</span>`;

describe("the searches-appeared delta is drawn on the growth card", () => {
  it("two weekly readings: the change between them sits beside the title", async () => {
    db.seed("scans", [DEEP, WEEK_1, WEEK_2]);
    const growth = section(await page(), "overview-growth");
    expect(growth).toContain('data-testid="overview-growth-delta"');
    expect(growth).toContain(up(6));
  });

  it("on the first Monday the delta is taken against week 0, the deep pass", async () => {
    db.seed("scans", [DEEP, WEEK_1]);
    const growth = section(await page(), "overview-growth");
    expect(growth).toContain(up(5));
  });

  it("before the first Monday there is no movement to draw", async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 8, 4, 10, 0, 0)));
    db.seed("scans", [DEEP]);
    expect(await page()).not.toContain('data-testid="overview-growth-delta"');
  });
});

describe("the pages delta is loaded from the publications and drawn on the tile", () => {
  it("pages live now against pages live a week ago, with a take-down counted out", async () => {
    db.seed("scans", [DEEP, WEEK_1, WEEK_2]);
    db.seed("publications", [
      publication("p1", "2026-09-05T07:00:00.000Z"),
      publication("p2", "2026-09-08T07:00:00.000Z", "2026-09-12T07:00:00.000Z"),
      publication("p3", "2026-09-10T07:00:00.000Z"),
      publication("p4", "2026-09-12T07:00:00.000Z"),
      publication("p5", "2026-09-15T07:00:00.000Z"),
    ]);
    // A week ago (9 Sep 10:00) p1 and p2 were live; now p1, p3, p4, p5.
    const tile = section(await page(), "overview-tile-pages");
    expect(tile).toContain('<div class="stat-value num">4</div>');
    expect(tile).toContain(up(2));
    expect(tile).not.toContain("TODO(copy)");
  });

  it("before the first Monday the tile states the count and no delta", async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 8, 4, 10, 0, 0)));
    db.seed("scans", [DEEP]);
    db.seed("publications", [publication("p1", "2026-09-03T07:00:00.000Z")]);
    const tile = section(await page(), "overview-tile-pages");
    expect(tile).toContain('<div class="stat-value num">1</div>');
    expect(tile).not.toContain(copy("overview.delta.up"));
  });
});

describe("the veto countdown is the draft's stored veto_deadline", () => {
  it("a 4-hour window stamped on the draft counts down to that deadline, not a default day from created_at", async () => {
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
    const alerts = section(await page(), "overview-needs-you");
    const left = copy("overview.alert.pending-veto.left", { hours: "2", minutes: "30" });
    expect(alerts).toContain(copy("overview.alert.pending-veto.due", { left }));
  });

  it("a page in review with no window running states no countdown", async () => {
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
    const alerts = section(await page(), "overview-needs-you");
    expect(alerts).toContain(copy("overview.alert.pending-veto.no-window"));
    expect(alerts).not.toContain("publishes in");
    expect(alerts).not.toContain("TODO(copy)");
  });
});
