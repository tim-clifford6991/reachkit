// tests/app/overview/connect-address.test.tsx — SPEC §5 (2026-09-20): Overview
// while the hosted address waits for its DNS record.
//
// The real `/app` page for a live account, driven from rows: the one setting
// to make, where, and the check; no ladder and no go-live time. The same page
// over a live host is the ordinary Overview, which is what makes each case
// fail on a screen that ignores the address.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb, type FakeDb, type Row } from "../../publish/harness";

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
const NOW = new Date(Date.UTC(2026, 9, 9, 10, 0, 0));

/** The first page, in review, its window ending at 16:00 the same day. */
const IN_REVIEW: Row = {
  id: "d1",
  site_id: SITE_ID,
  state: "in_review",
  title: "Emergency plumber in Austin: the first hour",
  scheduled_for: "2026-10-09",
  created_at: "2026-10-08T16:00:00.000Z",
  veto_deadline: "2026-10-09T16:00:00.000Z",
};

function hosted(hostname: string, state: "pending_dns" | "live"): void {
  db.seed("destinations", [
    { id: "dest-1", site_id: SITE_ID, kind: "hosted", hostname, hostname_state: state, health: "ok", deleted_at: null },
  ]);
}

async function screen(): Promise<{ h1: string; html: string; text: string }> {
  const html = renderToStaticMarkup(await OverviewPage());
  return { h1: /<h1[^>]*>(.*?)<\/h1>/u.exec(html)?.[1] ?? "", html, text: html.replace(/<[^>]+>/gu, " ") };
}

beforeEach(() => {
  db.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  signedInAs(ACCOUNT);
  db.seed("sites", [
    { id: SITE_ID, user_id: ACCOUNT.userId, domain: ACCOUNT.domain, timezone: ZONE, competitors: [], veto_hours: 24, publishing_enabled: true },
  ]);
  db.seed("publications", []);
  db.seed("drafts", [IN_REVIEW]);
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
    import("@/app/(account)/app/_shell/store"),
  ]);
}, 60_000);

describe("Overview for an address not connected yet", () => {
  // A SaaS help centre and a local plumber's guides.
  it.each(["help.acmecrm.com", "guides.harborplumbing.com"])(
    "%s: the one setting, where it is added, and the check",
    async (hostname) => {
      hosted(hostname, "pending_dns");
      const { h1, html, text } = await screen();
      expect(h1).toBe(copy("overview.connect.head"));
      expect(html).toContain('data-testid="overview-connect"');
      expect(html).toContain(`data-host="${hostname}"`);
      expect(text).toContain("content.example.com");
      expect(html).toContain('data-testid="dns-steps"');
      expect(html).toContain('data-testid="check-connection-press"');
    }
  );

  it("draws no ladder and names no go-live time", async () => {
    hosted("guides.harborplumbing.com", "pending_dns");
    const { html, text } = await screen();
    expect(html).not.toContain('data-testid="overview-tiles"');
    expect(html).toContain('data-testid="overview-progress-later"');
    expect(html).not.toContain('data-testid="overview-waiting-when"');
    expect(text).not.toContain("4:00 PM");
    // The page itself is still one press away, and can still be stopped.
    expect(html).toContain('data-testid="overview-waiting-read"');
    expect(html).toContain('data-testid="overview-stop-action"');
  });

  it("once the host is live, Overview is the ordinary one", async () => {
    hosted("guides.harborplumbing.com", "live");
    const { h1, html } = await screen();
    expect(h1).toBe(copy("overview.head.due.today", { time: "4:00 PM" }));
    expect(html).toContain('data-testid="overview-tiles"');
    expect(html).not.toContain('data-testid="overview-connect"');
  });
});
