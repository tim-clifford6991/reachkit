// tests/app/overview/deltas.test.tsx — SPEC §4, issue 794: the veto
// countdown on Overview is the draft's own stored window.
//
// The countdown once counted `VETO.defaultHours` from `created_at`, whatever
// the site's `veto_hours` stamped on the draft. Every case is a database
// state driven through the real `/app` page — the provider, the store, the
// model and the modules it renders. The searches tile this file also
// covered left Overview with issue 1319 (SPEC §4, 2026-10-07).
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb, type FakeDb, type Row } from "../../publish/harness";
import { REPORT_VERSION } from "@/lib/scan/report";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/opportunities", () => ({
  supplyDepth: async () => ({ unused: 9, total: 12 }),
  supplyMeasured: async () => true,
  supplyState: async () => "measured",
  readWeek: async () => [],
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
    { id: SITE_ID, user_id: ACCOUNT.userId, domain: ACCOUNT.domain, timezone: ZONE, competitors: [], veto_hours: 4, publishing_enabled: true },
  ]);
  db.seed("publications", []);
  db.seed("drafts", []);
  db.seed("scans", []);
});

afterEach(() => {
  vi.useRealTimers();
  resetAccount();
});

// The page reaches its stores at the call, so the first render pays their
// cold import. On a busy runner that alone passed the default timeout of
// whichever case ran first; loading them once here keeps the cases about
// the screen.
beforeAll(async () => {
  await Promise.all([
    import("@/app/(account)/app/_overview/store"),
    import("@/app/(account)/app/_overview/search-provider"),
    import("@/app/(account)/app/_overview/search-store"),
    import("@/lib/publish/reads/facts"),
  ]);
}, 60_000);

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
    // Owner E4: the board's eyebrow names today's time.
    expect(card).toContain(copy("overview.today.eyebrow", { time: "12:30 PM" }));
    expect(card).not.toContain("TODO(copy)");
  });

  // Owner, 2026-10-08 (issue 1337): autopilot asks for nothing. An untouched
  // page in review names the moment the customer was told, and no line on
  // the card asks them to approve it.
  it("an untouched page names the moment the customer was told and asks for no approval", async () => {
    db.seed("scans", [DEEP, WEEK_1, WEEK_2]);
    db.seed("drafts", [
      {
        id: "d1",
        site_id: SITE_ID,
        state: "in_review",
        title: "How to pick a CRM",
        created_at: "2026-09-15T13:00:00.000Z",
        veto_deadline: "2026-09-16T13:00:00.000Z",
        told: { publishesAt: "2026-09-16T13:30:00.000Z" },
      },
    ]);
    const html = await page();
    const card = section(html, "overview-waiting");
    // The told moment, not the window's end half an hour before it.
    expect(card).toContain("13:30");
    expect(card).toContain("Sep 16");
    // The head is the page's own go-live, as today's content of the daily
    // autopilot (issue 1362): 13:30 UTC on the 16th, which is today.
    expect(card).toContain(`<h1>${copy("overview.head.due.today", { time: "1:30 PM" })}</h1>`);
    expect(card.replace(/<[^>]+>/gu, " ")).not.toMatch(/ready to read/iu);
    expect(card.replace(/<[^>]+>/gu, " ")).not.toMatch(/approv|waiting for you|needs you|your review/iu);
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
