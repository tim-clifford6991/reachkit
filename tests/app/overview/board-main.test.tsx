/** @vitest-environment jsdom */
// SPEC §4 (board Main): Overview's head, this week's pages, the site-fix line,
// and the states drawn in place of the today card. Driven through the real
// `/app` page — for the reserved fixture account the layout sweep reads, and
// for a live account over stored rows — and through Plan's own week assembly.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb, type FakeDb, type Row } from "../../publish/harness";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";
import { unmeasured } from "@/lib/measure/measured";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/opportunities", () => ({
  supplyDepth: async () => ({ unused: 9, total: 12 }),
  supplyMeasured: async () => true,
  supplyState: async () => "measured",
  readWeek: async () => [],
  committedWeek: async () => ({ days: [], spares: [] }),
  // Plan draws a scheduled page only with its choice; this one stands for any.
  explainChoice: async (opportunityId: string) => ({
    opportunityId,
    type: "answer_page",
    family: "write",
    fitBand: "winnable",
    acceptance: { form: "top20", query: "emergency plumber austin" },
    evidence: {
      family: "write",
      query: "emergency plumber austin",
      volume: unmeasured("not_attempted", new Date(0)),
      rival: { domain: "rival.example", url: unmeasured("not_attempted", new Date(0)), position: unmeasured("not_attempted", new Date(0)) },
    },
  }),
}));

const { LIVE_ACCOUNT, resetAccount, signedInAs } = await import("../account-door");
const { default: OverviewPage } = await import("@/app/(account)/app/(tabs)/page");
const { ThisWeek } = await import("@/app/(account)/app/_overview/ThisWeek");
const { weekListOf } = await import("@/app/(account)/app/_overview/this-week");
const { copy } = await import("@/lib/presentation/copy");
const { readShell } = await import("@/app/(account)/app/_shell/provider");
const { readOverview } = await import("@/app/(account)/app/_overview/provider");
const { planToday, readWeek } = await import("@/app/(account)/app/calendar/provider");
const { assembleMonth, dayStateOf, weekOf } = await import("@/app/(account)/app/calendar/month");
const { FIXTURE_CALENDAR_FACTS } = await import("@/app/(account)/app/calendar/fixture");
const { addDays, cardDate } = await import("@/app/(account)/app/calendar/dates");
const { DAY_STATE_COPY_KEY } = await import("@/app/(account)/app/calendar/stages");
const { formatDay, formatTime } = await import("@/app/(account)/app/_shell/format");

const text = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/gu, " ").trim();

async function render(): Promise<{ html: string; dom: Document }> {
  const html = renderToStaticMarkup(await OverviewPage());
  return { html, dom: new DOMParser().parseFromString(html, "text/html") };
}

afterEach(() => resetAccount());

beforeAll(async () => {
  await Promise.all([
    import("@/app/(account)/app/_overview/store"),
    import("@/app/(account)/app/_overview/search-provider"),
    import("@/lib/measure/published-store"),
    import("@/app/(account)/app/_shell/store"),
    import("@/app/(account)/app/calendar/store"),
    import("@/lib/publish/reads/facts"),
  ]);
}, 60_000);

describe("board Main, on the account the layout sweep reads", () => {
  beforeEach(() => signedInAs());

  it("the head names the week and the day, says nothing needs the customer, and how this week's pages came", async () => {
    const [{ dom }, shell, overview, week] = await Promise.all([render(), readShell(), readOverview(), planToday().then(readWeek)]);
    const head = dom.querySelector('[data-testid="overview-head"]');
    expect(shell.weeks.kind).toBe("counted");
    const n = shell.weeks.kind === "counted" ? String(shell.weeks.weeks) : "";
    expect(text(head?.querySelector('[data-testid="overview-head-eyebrow"]'))).toBe(
      copy("overview.head.eyebrow", { n, day: formatDay(overview.today, shell.timeZone) })
    );
    expect(text(head?.querySelector("h1"))).toBe(copy("overview.head.title"));
    const pages = String(week.cells.filter((cell) => cell.page !== null).length);
    // The sweep's week was not chosen today, so the lead names the day it was.
    expect(week.today).not.toBe(week.cells[0]?.day);
    expect(text(head?.querySelector('[data-testid="overview-head-lead"]'))).toContain(
      copy("overview.head.lead.chosen-on", { n: pages, weekday: "Monday" })
    );
  });

  it("this week's pages are Plan's week: one row per day with a page, its title and its state, then the next Monday", async () => {
    const [{ dom }, week] = await Promise.all([render(), planToday().then(readWeek)]);
    const card = dom.querySelector('[data-testid="overview-week"]');
    const withPage = week.cells.filter((cell) => cell.page !== null);
    expect(text(card?.querySelector("h2"))).toBe(copy("overview.week.pages", { n: String(withPage.length) }));
    expect(text(card)).toContain(copy("how.week.auto"));
    const why = [...(card?.querySelectorAll("a") ?? [])].find((a) => text(a) === copy("overview.week.calendar-link"));
    expect(why?.getAttribute("href")).toBe("/app/calendar");
    const rows = [...(card?.querySelectorAll('[data-testid="overview-week-row"]') ?? [])];
    expect(rows.map((row) => row.getAttribute("data-day"))).toEqual(withPage.map((cell) => cell.day));
    expect(rows.map((row) => text(row.querySelector('[data-testid="overview-week-title"]')))).toEqual(
      withPage.map((cell) => cell.page!.title)
    );
    expect(text(card?.querySelector('[data-testid="overview-week-next"]'))).toBe(
      copy("overview.week.next", { date: cardDate(addDays(week.cells[0]!.day, 7)), n: String(week.cells.length) })
    );
  });

  it("the site-fix line counts every check worth fixing, says it is optional, and opens the account's issues", async () => {
    const [{ dom }, overview] = await Promise.all([render(), readOverview()]);
    const fixes = overview.alerts.filter((alert) => alert.kind === "site_issue").length + (overview.issuesOverflow?.remaining ?? 0);
    expect(fixes).toBeGreaterThan(1);
    const line = dom.querySelector('[data-testid="overview-fixes"]');
    expect(text(line)).toContain(copy("overview.fixes.line", { n: String(fixes) }));
    expect(text(line)).toContain(copy("overview.fixes.optional"));
    expect(line?.querySelector("a")?.getAttribute("href")).toBe("/app/issues");
    expect(text(line?.querySelector("a"))).toBe(copy("overview.fixes.see"));
  });

  it("every board string of the head, this week's pages and the site-fix line is on the screen, but for sample data and rulings", async () => {
    const { html } = await render();
    const board = readFileSync(boardFile("Main"), "utf8");
    const { missing } = compare(board, segments(html), readAllow("Main"));
    const all: string[] = compare(board, [], []).missing;
    const span = (from: (s: string) => boolean, to: (s: string) => boolean): string[] => {
      const start = all.findIndex(from);
      const end = all.findIndex((s, i) => i > start && to(s));
      expect(start).toBeGreaterThan(-1);
      return all.slice(start, end === -1 ? undefined : end + 1);
    };
    const mine = new Set([
      ...span((s) => s.startsWith("Week "), (s) => s.includes("chosen")),
      ...span((s) => s.startsWith("This week"), (s) => s.startsWith("Next Monday")),
      ...span((s) => s.includes("worth fixing"), () => true),
    ]);
    expect(mine.size).toBeGreaterThan(15);
    expect(missing.filter((s: string) => mine.has(s))).toEqual([]);
  });
});

describe("a week row, from Plan's own week assembly", () => {
  const ZONE = FIXTURE_CALENDAR_FACTS.timeZone;
  // The fixture's page in review, its window closing at 4 PM the same day.
  const closes = new Date(Date.UTC(2026, 8, 15, 20, 0, 0));
  const facts = {
    ...FIXTURE_CALENDAR_FACTS,
    drafts: FIXTURE_CALENDAR_FACTS.drafts.map((d) => (d.scheduledFor === "2026-09-15" ? { ...d, vetoDeadline: closes } : d)),
  };
  const week = weekOf([assembleMonth(facts, "2026-09")], "2026-09-15");
  const dom = new DOMParser().parseFromString(renderToStaticMarkup(<ThisWeek week={weekListOf(week)!} scheduled={true} />), "text/html");
  const row = (day: string) => dom.querySelector(`[data-day="${day}"]`);

  it("today's written page goes live today at its time, with Edit and Stop on its own page", () => {
    const today = week.cells.find((cell) => cell.day === week.today)!;
    expect(today.page!.vetoDeadline).toEqual(closes);
    const state = text(row(today.day)?.querySelector('[data-testid="overview-week-state"]'));
    expect(state).toContain(copy("overview.week.goes-live"));
    expect(state).toContain(copy("overview.week.today-at", { time: formatTime(closes, ZONE) }));
    const links = [...(row(today.day)?.querySelectorAll("a") ?? [])];
    expect(links.map(text)).toEqual([copy("how.week.edit"), copy("calendar.week.stop")]);
    for (const link of links) expect(link.getAttribute("href")).toBe(`/app/draft/${today.page!.draftId}`);
  });

  it("every other day with a page says new or update and Plan's own state word; a day with none is not a row", () => {
    for (const cell of week.cells) {
      if (cell.page === null) {
        expect(row(cell.day)).toBeNull();
        continue;
      }
      expect(text(row(cell.day))).toContain(copy(cell.page.update ? "how.week.update" : "how.week.new"));
      if (cell.day === week.today) continue;
      expect(text(row(cell.day)?.querySelector('[data-testid="overview-week-state"]'))).toBe(copy(DAY_STATE_COPY_KEY[dayStateOf(cell)!]));
    }
  });

  it("a short week says its real count", () => {
    const pages = week.cells.filter((cell) => cell.page !== null).length;
    expect(pages).toBeLessThan(week.cells.length);
    expect(text(dom.querySelector("h2"))).toBe(copy("overview.week.pages", { n: String(pages) }));
  });
});

describe("a day with nothing worth writing", () => {
  it("is told in place of the today card, and only on that day", () => {
    // Sunday the 20th is a day the fixture's supply leaves empty.
    const on = (day: string, now: Date) => weekListOf(weekOf([assembleMonth({ ...FIXTURE_CALENDAR_FACTS, now }, "2026-09")], day))!;
    const sunday = on("2026-09-20", new Date(Date.UTC(2026, 8, 20, 14, 0, 0)));
    expect(sunday.skippedToday).toBe(true);
    expect(sunday.rows.some((row) => row.day === "2026-09-20")).toBe(false);
    expect(on("2026-09-15", FIXTURE_CALENDAR_FACTS.now).skippedToday).toBe(false);
  });
});

describe("the head and the states, for a live account over stored rows", () => {
  const ZONE = "UTC";
  const ACCOUNT = { ...LIVE_ACCOUNT, timeZone: ZONE };
  const SITE_ID = ACCOUNT.siteId;
  /** Friday 9 October 2026, 10:00 UTC. */
  const NOW = new Date(Date.UTC(2026, 9, 9, 10, 0, 0));
  const IN_REVIEW: Row = {
    id: "d1",
    site_id: SITE_ID,
    state: "in_review",
    opportunity_id: "o1",
    title: "Emergency plumber in Austin: what to do in the first hour",
    scheduled_for: "2026-10-09",
    created_at: "2026-10-08T16:00:00.000Z",
    veto_deadline: "2026-10-09T16:00:00.000Z",
  };

  function site(over: Row = {}): void {
    db.seed("sites", [
      { id: SITE_ID, user_id: ACCOUNT.userId, domain: ACCOUNT.domain, timezone: ZONE, competitors: [], veto_hours: 24, publish_time: "09:00:00", publishing_enabled: true, ...over },
    ]);
  }

  beforeEach(() => {
    db.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    signedInAs(ACCOUNT);
    site();
    db.seed("publications", []);
    db.seed("drafts", []);
    db.seed("scans", []);
  });
  afterEach(() => vi.useRealTimers());

  it("nothing needs the customer: the board's title, and no card where no page is in review", async () => {
    const { dom } = await render();
    expect(text(dom.querySelector("h1"))).toBe(copy("overview.head.title"));
    expect(dom.querySelector('[data-testid="overview-waiting"]')).toBeNull();
    expect(dom.querySelector('[data-testid="overview-paused"]')).toBeNull();
  });

  it("a page that cannot go out without the customer is the title, with its one control", async () => {
    db.seed("drafts", [{ ...IN_REVIEW, id: "d9", state: "needs_attention", title: "Drain cleaning in Austin" }]);
    const { dom } = await render();
    expect(text(dom.querySelector("h1"))).toBe(copy("overview.alert.needs-you", { title: "Drain cleaning in Austin" }));
    expect(dom.querySelector('[data-testid="overview-head"] a')?.getAttribute("href")).toContain("d9");
  });

  it("publishing paused: the paused card in place of today's page, with one control that turns it back on", async () => {
    site({ publishing_enabled: false });
    db.seed("drafts", [IN_REVIEW]);
    const { dom } = await render();
    const card = dom.querySelector('[data-testid="overview-paused"]');
    expect(text(card)).toContain(copy("overview.paused.line"));
    expect(text(card?.querySelector("a"))).toBe(copy("overview.paused.action"));
    expect(card?.querySelector("a")?.getAttribute("href")).toBe("/app/settings/publishing");
    expect(dom.querySelector('[data-testid="overview-waiting"]')).toBeNull();
  });

  it("publishing paused: this week's page due today keeps Plan's state word and is not said to go live", async () => {
    site({ publishing_enabled: false });
    db.seed("drafts", [IN_REVIEW]);
    const { dom } = await render();
    const today = dom.querySelector('[data-testid="overview-week"] [data-day="2026-10-09"]');
    expect(today).not.toBeNull();
    expect(text(today)).not.toContain(copy("overview.week.goes-live"));
    expect(text(today)).not.toContain(copy("overview.week.today-at", { time: "4:00 PM" }));
    expect(text(today?.querySelector('[data-testid="overview-week-state"]'))).not.toBe("");
  });

  it("publishing on: the same page due today goes live today at its time", async () => {
    db.seed("drafts", [IN_REVIEW]);
    const { dom } = await render();
    const today = dom.querySelector('[data-testid="overview-week"] [data-day="2026-10-09"]');
    expect(text(today)).toContain(copy("overview.week.today-at", { time: "4:00 PM" }));
  });

  it("a page that went live this morning is the one quiet line, and live pages nothing has read are not said to show", async () => {
    db.seed("drafts", [{ id: "d0", site_id: SITE_ID, state: "published", title: "Toilet repair in Austin", scheduled_for: "2026-10-09", created_at: "2026-10-08T16:00:00.000Z" }]);
    db.seed("publications", [
      { id: "p0", site_id: SITE_ID, draft_id: "d0", destination: "hosted", live_url: "https://blog.example.com/toilet", published_at: "2026-10-09T07:00:00.000Z", unpublished_at: null, search_reading: null },
    ]);
    const { dom } = await render();
    expect(text(dom.querySelector('[data-testid="overview-today-line"]'))).toBe(copy("overview.today.live", { time: "7:00 AM" }));
    expect(text(dom.querySelector('[data-testid="overview-head-lead"]'))).toBe(
      `${copy("overview.head.lead.live-unread", { live: "1" })} ${copy("overview.head.lead.chosen-on", { n: "1", weekday: "Monday" })}`
    );
    expect(dom.querySelector('[data-testid="overview-fixes"]')).toBeNull();
  });
});
