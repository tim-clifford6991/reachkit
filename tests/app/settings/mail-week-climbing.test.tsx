/** @vitest-environment jsdom */
// One site's stored readings give one climbing count: Settings › Mail's week
// line, the ladder the Monday mail builds and Overview's "{n} climbing" badge,
// read at the same instant through the real pages, for a SaaS site and a local one.
import "../../generate/env";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb, type FakeDb } from "../../publish/harness";
import { LOCAL, SAAS, stored, weekWith } from "../../measure/reading-fixture";
import { assembleReading, type PageReading } from "@/lib/measure/page-reading";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { LIVE_ACCOUNT, resetAccount, signedInAs } = await import("../account-door");
const { default: OverviewPage } = await import("@/app/(account)/app/(tabs)/page");
const { default: SettingsMailTab } = await import("@/app/(account)/app/settings/mail/page");
const { readPublishedPages } = await import("@/lib/measure/published-store");
const { contentOf } = await import("@/lib/measure/published");
const { pageLadderOf } = await import("@/lib/measure/page-ladder");

const ACCOUNT = { ...LIVE_ACCOUNT, timeZone: "UTC" };
const SITE_ID = ACCOUNT.siteId;
const NOW = new Date(Date.UTC(2026, 9, 12, 7));
const PASSES = [new Date(Date.UTC(2026, 8, 28, 6)), new Date(Date.UTC(2026, 9, 5, 6))] as const;

type Site = typeof SAAS;
/** A page's place for its own search on each pass; `null` absent, `read: false` never read. */
interface Page {
  places: readonly [number | null, number | null];
  read?: boolean;
}

const url = (site: Site, i: number): string => `${site.page}-${i}`;

function readingOf(site: Site, pages: readonly Page[], i: number): PageReading {
  let before: PageReading | null = null;
  for (const [week, at] of PASSES.entries()) {
    const report = weekWith({
      domain: site.domain,
      asked: pages.map((p, n) => ({ publicationId: `p${n}`, liveUrl: url(site, n), search: `${site.search} ${n}`, place: p.places[week] ?? null })),
    });
    before = assembleReading({
      before,
      report,
      now: at,
      page: { id: `p${i}`, liveUrl: url(site, i), search: `${site.search} ${i}`, crawled: true, aiReads: 0, aiVisits: 0, google: null, bing: null },
    });
  }
  return before!;
}

function seed(site: Site, pages: readonly Page[]): void {
  db.seed("users", [{ id: ACCOUNT.userId, name: "Dana", email: "owner@example.com", notify: {}, pending_email: null, pending_email_sent_at: null, created_at: "2026-09-01T00:00:00.000Z", paid_through: "2026-11-01T00:00:00.000Z", cancelled_at: null, plan_status: "active" }]);
  db.seed("sites", [{ id: SITE_ID, user_id: ACCOUNT.userId, domain: site.domain, timezone: "UTC", competitors: [], veto_hours: 24, publish_time: "16:00:00", publishing_enabled: true }]);
  db.seed("destinations", [{ id: "dest-hosted", site_id: SITE_ID, kind: "hosted", hostname: `guides.${site.domain}`, hostname_state: "live", deleted_at: null }]);
  db.seed(
    "publications",
    pages.map((page, i) => ({
      id: `p${i}`,
      site_id: SITE_ID,
      draft_id: `d${i}`,
      destination: "hosted",
      live_url: url(site, i),
      published_at: new Date(Date.UTC(2026, 8, 20 + i)).toISOString(),
      unpublished_at: null,
      search_reading: page.read === false ? null : stored(readingOf(site, pages, i) as never),
    }))
  );
  db.seed("drafts", pages.map((_, i) => ({ id: `d${i}`, site_id: SITE_ID, state: "published", title: `Page ${i}`, created_at: "2026-09-01T00:00:00.000Z" })));
}

const dom = async (page: Promise<React.JSX.Element>): Promise<Document> => new DOMParser().parseFromString(renderToStaticMarkup(await page), "text/html");
const text = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/gu, " ").trim();
const weekLine = async (): Promise<string> => text((await dom(SettingsMailTab())).querySelector('[data-testid="notification-weekly-preview"] .wrap-anywhere'));
/** The ladder the Monday mail builds: its own read of the site's pages, at its own instant. */
const mailClimbing = async (): Promise<number | undefined> => {
  const content = contentOf({ pages: await readPublishedPages(SITE_ID), now: NOW });
  return content === null ? undefined : pageLadderOf(content.pages, NOW)?.climbing;
};
const overviewClimbing = async (): Promise<string> => text((await dom(OverviewPage())).querySelector('li[data-step="draft.ladder.showing"] .badge'));

/** Climbs 40→24 and 52→30 (climbing), 30→25 (too early), 12→15 (working), and one page never read. */
const THREE: readonly Page[] = [{ places: [40, 24] }, { places: [52, 30] }, { places: [30, 25] }, { places: [12, 15] }, { places: [60, 35] }, { places: [null, null], read: false }];

beforeAll(async () => {
  await Promise.all([import("@/app/(account)/app/_overview/store"), import("@/lib/measure/published-store"), import("@/app/(account)/app/_shell/store")]);
}, 60_000);

beforeEach(() => {
  db.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  signedInAs(ACCOUNT);
});

afterEach(() => {
  vi.useRealTimers();
  resetAccount();
});

describe.each([
  ["a SaaS site", SAAS],
  ["a local business", LOCAL],
])("Settings › Mail's climbing count is the Monday mail's and Overview's, on %s", (_, site) => {
  it("one site's stored readings give one n on all three", async () => {
    seed(site, THREE);
    const n = await mailClimbing();
    expect(n).toBe(3);
    expect(await overviewClimbing()).toBe(`${n} climbing`);
    expect(await weekLine()).toBe(`Your week: 7 pages planned, ${n} pages climbing`);
  });

  it("pages live and never read: no count, and never a 0", async () => {
    seed(site, [{ places: [null, null], read: false }, { places: [null, null], read: false }]);
    expect(await mailClimbing()).toBe(0);
    expect(await weekLine()).toBe("Your week: 7 pages planned");
  });
});
