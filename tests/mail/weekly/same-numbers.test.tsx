/** @vitest-environment jsdom */
// The simple model (owner, 2026-10-19: "Per site, weekly (app and Monday
// email, same numbers)"): one site's stored rows, sent as the Monday mail and
// rendered as Overview at the same instant, give the same figures. Driven
// through `sendWeeklyDigest` and the real `/app` page, for a SaaS site and a
// local one.
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb, type FakeDb, type Row } from "../../publish/harness";
import { LOCAL, SAAS, stored, weekWith } from "../../measure/reading-fixture";
import { assembleReading, type PageReading } from "@/lib/measure/page-reading";
import { REPORT_VERSION } from "@/lib/scan/report";
import type { MailBlock, StatRow } from "@/lib/mail/blocks/types";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const sent: { blocks: readonly MailBlock[] }[] = [];
vi.mock("@/lib/mail/send", () => ({
  sendEmail: async (mail: { blocks: readonly MailBlock[] }) => {
    sent.push(mail);
    return { sent: true, id: "vendor-1" };
  },
}));
vi.mock("@/lib/scan/weekly", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/weekly")>()),
  accountForWeek: async () => ({ kind: "complete", measuredAt: new Date(Date.UTC(2026, 9, 12, 6)) }),
}));
vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
  supplyDepth: async () => ({ unused: 9, total: 12 }),
  supplyMeasured: async () => true,
  supplyState: async () => "measured",
  weeklyDigest: async () => ({ standings: [], weekMeasuredAt: new Date(Date.UTC(2026, 9, 12, 6)) }),
}));

const { LIVE_ACCOUNT, resetAccount, signedInAs } = await import("../../app/account-door");
const { default: OverviewPage } = await import("@/app/(account)/app/(tabs)/page");
const { sendWeeklyDigest } = await import("@/lib/mail/weekly");
const { copy } = await import("@/lib/presentation/copy");
const { readGoogleVisitWeeks } = await import("@/app/(account)/app/_overview/blog-reads-provider");
const { SearchTiles } = await import("@/app/(account)/app/_overview/SearchTiles");

const ACCOUNT = { ...LIVE_ACCOUNT, timeZone: "UTC" };
const SITE_ID = ACCOUNT.siteId;
/** Monday 12 October 2026, after that week's pass; the mail and Overview read at this instant. */
const NOW = new Date(Date.UTC(2026, 9, 12, 7));
const WEEK = "2026-10-12";
/** The month's first Monday. */
const FIRST = "2026-10-05";
const PASSES = [new Date(Date.UTC(2026, 8, 28, 6)), new Date(Date.UTC(2026, 9, 5, 6))] as const;

type Site = typeof SAAS;
interface Page {
  places: readonly [number | null, number | null];
  linked?: boolean;
  read?: boolean;
}

const url = (site: Site, i: number): string => `${site.page}-${i}`;

function readingOf(site: Site, pages: readonly Page[], i: number): PageReading {
  let before: PageReading | null = null;
  for (const [week, at] of PASSES.entries()) {
    const report = weekWith({
      domain: site.domain,
      asked: pages.map((p, n) => ({
        publicationId: `p${n}`,
        liveUrl: url(site, n),
        search: `${site.search} ${n}`,
        place: p.places[week] ?? null,
        linked: week === 1 && p.linked === true,
      })),
    });
    before = assembleReading({
      before,
      report,
      now: at,
      page: { id: `p${i}`, liveUrl: url(site, i), search: `${site.search} ${i}`, crawled: true, aiReads: 1, aiVisits: 0, google: null, bing: null },
    });
  }
  return before!;
}

function seed(site: Site, pages: readonly Page[]): void {
  db.seed("users", [{ id: ACCOUNT.userId, email: "owner@example.com" }]);
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

/** A weekly pass with a score, the market's first page and the tracked prompts' answers. */
function pass(week: string, a: { score: number; top10: number; named: number; answers: number }): Row {
  const measuredAt = `${week}T06:00:00.000Z`;
  return {
    id: `scan-${week}`,
    site_id: SITE_ID,
    tier: "weekly",
    status: "done",
    week_start: week,
    created_at: measuredAt,
    digest_sent_at: null,
    report: {
      version: REPORT_VERSION,
      ownRanked: { kind: "measured", value: 40, at: measuredAt },
      aiAnswers: null,
      rivalSizes: { kind: "measured", value: [], at: measuredAt },
      verdict: { measuredAt, scoreAndBand: { kind: "measured", value: { score: a.score, band: "hard-to-find" }, at: measuredAt } },
      presence: { measuredSearches: 12, you: { domain: "example.com", top10Count: a.top10 }, rivals: [], absentFrom: [], framing: "shown" },
      prompts: {
        siteName: "Example",
        asked: [{ id: "u1", kind: "category", text: "Which one is best?" }],
        asks: a.answers,
        answers: Array.from({ length: a.answers }, (_, run) => ({ promptId: "u1", engine: "ai_mode", run, named: run < a.named, linked: false, ownUrls: [], rivals: [] })),
      },
    },
  };
}

/** The week this Monday committed: Monday's page already written and in review, a row for each day after it, and a spare. */
function seedWeek(): void {
  const row = (id: string, planned: string | null, place: number): Row => ({
    id,
    site_id: SITE_ID,
    scan_id: `scan-${WEEK}`,
    type: "new_page",
    family: "new",
    target_query: `search ${id}`,
    target_ref: `search ${id}`,
    title: null,
    volume: 90,
    evidence: { family: "new", query: `search ${id}`, volume: 90 },
    acceptance: {},
    effort: 1,
    status: "open",
    ready: true,
    plan_place: place,
    planned_for: planned,
    created_at: NOW.toISOString(),
  });
  db.seed("opportunities", [
    { ...row("o0", "2026-10-12", 0), status: "drafted" },
    ...["13", "14", "15", "16", "17", "18"].map((day, i) => row(`o${i + 1}`, `2026-10-${day}`, i + 1)),
    row("spare", null, 7),
  ]);
  db.seed("drafts", [
    ...db.rows("drafts"),
    { id: "d-week", site_id: SITE_ID, state: "in_review", opportunity_id: "o0", title: "Monday's page", scheduled_for: WEEK, created_at: "2026-10-11T16:00:00.000Z", veto_deadline: "2026-10-12T16:00:00.000Z" },
  ]);
}

/** The customer's own scan, which the month's figures are compared with. */
function deepScan(score: number, top10: number): Row {
  const scan = pass("2026-09-14", { score, top10, named: 0, answers: 0 });
  return { ...scan, id: "scan-deep", tier: "deep", week_start: null, created_at: "2026-09-14T09:00:00.000Z" };
}

const FIVE: readonly Page[] = [
  { places: [40, 24] },
  { places: [30, 25] },
  { places: [null, null], linked: true },
  { places: [12, 15] },
  { places: [null, null], read: false },
];

async function overview(): Promise<Document> {
  return new DOMParser().parseFromString(renderToStaticMarkup(await OverviewPage()), "text/html");
}

async function mail(weekStart: string, now: Date): Promise<readonly StatRow[]> {
  sent.length = 0;
  db.rows("scans").forEach((row) => (row.digest_sent_at = null));
  // The mail is composed on the server: its stop links are signed with a server-only key.
  vi.stubGlobal("window", undefined);
  const outcome = await sendWeeklyDigest({ siteId: SITE_ID, weekStart, now }).finally(() => vi.unstubAllGlobals());
  expect(outcome.sent).toBe(true);
  return sent[0]!.blocks.flatMap((block) => (block.block === "stats" ? block.items : []));
}

const text = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/gu, " ").trim();
/** A row's figure, or what it says in its place. Showing is labelled with its climbing count where one climbs. */
const figure = (rows: readonly StatRow[], label: string): number | string | undefined => {
  const row = rows.find((r) => r.label === label || (label === "draft.ladder.showing" && r.label === "mail.weekly.google.showing.climbing"));
  return row === undefined ? undefined : row.value.kind === "unmeasured" ? (row.unmeasuredLine ?? "") : row.value.value;
};
/** The slots of the sentence the mail states under `key`, where it states it. */
const said = (key: string): Record<string, string> | undefined =>
  (sent[0]!.blocks.find((block) => block.block === "paragraph" && block.text === key) as { vars?: Record<string, string> } | undefined)?.vars;
/** The month's figures as the mail writes them, by label. */
const monthFacts = (): Record<string, string> =>
  Object.fromEntries(
    sent[0]!.blocks.flatMap((block) => (block.block === "facts" ? (block as unknown as { items: { label: string; value: string }[] }).items : [])).filter((item) => item.label.startsWith("mail.weekly.month.")).map((item) => [item.label, item.value])
  );
const step = (dom: Document, name: string): string => text(dom.querySelector(`li[data-step="${name}"] a`));

beforeAll(async () => {
  await Promise.all([
    import("@/app/(account)/app/_overview/store"),
    import("@/lib/measure/published-store"),
    import("@/app/(account)/app/_shell/store"),
    import("@/lib/publish/reads/facts"),
  ]);
}, 60_000);

beforeEach(() => {
  db.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  signedInAs(ACCOUNT);
  db.seed("scans", [pass(FIRST, { score: 31, top10: 1, named: 11, answers: 46 }), pass(WEEK, { score: 33, top10: 2, named: 20, answers: 46 })]);
  db.seed("publication_reads", [
    { site_id: SITE_ID, publication_id: "p0", day: "2026-10-08", engine: "chatgpt", kind: "answer_fetch", hits: 3 },
    { site_id: SITE_ID, publication_id: "p1", day: "2026-10-09", engine: "claude", kind: "answer_fetch", hits: 4 },
    { site_id: SITE_ID, publication_id: "p0", day: "2026-10-08", engine: "google", kind: "referral", hits: 5 },
    { site_id: SITE_ID, publication_id: "p1", day: "2026-10-01", engine: "google", kind: "referral", hits: 30 },
  ]);
});

afterEach(() => {
  vi.useRealTimers();
  resetAccount();
});

describe.each([
  ["a SaaS site", SAAS],
  ["a local business", LOCAL],
])("the Monday mail's numbers are Overview's, on %s", (_, site) => {
  it("Pages, Google and AI read the same figures as Overview at the same instant", async () => {
    seed(site, FIVE);
    seedWeek();
    const rows = await mail(WEEK, NOW);
    const dom = await overview();

    expect(rows.slice(0, 2).map((row) => row.label)).toEqual(["mail.weekly.pages.live", "mail.weekly.pages.planned"]);
    // Plan's week, as Overview's head counts it: Monday's page in review and the six planned after it.
    expect(text(dom.querySelector('[data-testid="overview-head-lead"]'))).toContain(
      copy("overview.head.lead.chosen", { n: String(figure(rows, "mail.weekly.pages.planned")) })
    );
    expect(figure(rows, "mail.weekly.pages.planned")).toBe(7);
    expect(String(figure(rows, "mail.weekly.pages.live"))).toBe(step(dom, "draft.ladder.live"));
    for (const name of ["draft.ladder.found", "draft.ladder.showing", "draft.ladder.first-page"]) {
      expect(String(figure(rows, name)), name).toBe(step(dom, name));
    }
    // Each step counts over the pages read, as Overview's ladder does: four of the five live pages have a reading.
    expect(text(dom.querySelector('[data-testid="overview-ladder"]'))).toContain(copy("overview.ladder.unread", { k: "1" }));
    for (const row of rows.filter((r) => r.label.startsWith("draft.ladder.") || r.label === "mail.weekly.google.showing.climbing")) {
      expect(copy(row.note!.text, row.note!.vars), row.label).toBe("of 4 pages checked");
    }
    const climbing = rows.find((row) => row.label === "mail.weekly.google.showing.climbing")?.labelVars?.n;
    const badge = text(dom.querySelector('li[data-step="draft.ladder.showing"] .badge'));
    expect(climbing === undefined ? "" : copy("overview.ladder.climbing", { n: String(climbing) })).toBe(badge);
    expect(text(dom.querySelector('[data-testid="overview-ladder-visits"]'))).toBe(
      copy("overview.ladder.visits", { n: String(said("mail.weekly.google.visits.down")?.n) })
    );
    const linked = said("mail.weekly.ai.linked");
    expect(text(dom.querySelector('[data-testid="overview-tile-ai-linked"]'))).toBe(String(linked?.n));
    expect(text(dom.querySelector('[data-testid="overview-ai"]'))).toContain(copy("overview.ai.linked.of", { of: String(linked?.of) }));
    expect(text(dom.querySelector('[data-testid="overview-tile-ai-reads"]'))).toBe(copy("overview.ai.reads", { n: String(said("mail.weekly.ai.reads")?.n) }));

    const climb = sent[0]!.blocks.find((block) => block.block === "paragraph" && block.text.startsWith("mail.weekly.google.climb"));
    const mover = dom.querySelector('[data-testid="overview-mover"]');
    expect(climb).toMatchObject({ vars: { search: `${site.search} 0`, to: text(mover?.querySelector('[data-testid="overview-tile-mover"]')) } });
    expect(text(mover)).toContain(`${site.search} 0`);
  });

  it("the Google tab's visits chart and the mail's line read one count: this week is the last bar, last week the bar before", async () => {
    seed(site, FIVE);
    await mail(WEEK, NOW);
    const weeks = await readGoogleVisitWeeks();
    const tile = new DOMParser()
      .parseFromString(renderToStaticMarkup(<SearchTiles pages={null} visits={weeks} market={null} />), "text/html")
      .querySelector('[data-testid="search-tile-visits"]');
    const bars = [...(tile?.querySelectorAll(`figure[aria-label="${copy("overview.search.visits.chart")}"] li`) ?? [])].map((li) => text(li).split(" · ")[1]);
    const line = said("mail.weekly.google.visits.down");
    expect(line).toEqual({ n: "5", before: "30" });
    expect(text(tile?.querySelector('[data-testid="search-tile-visits-value"]'))).toBe(line?.n);
    expect(bars).toEqual([line?.before, line?.n]);
  });

  it("Reputation, the score and the market are in the first Monday mail of a month only, as Overview's months read them", async () => {
    seed(site, FIVE);
    db.seed("scans", [...db.rows("scans"), deepScan(27, 0)]);
    await mail(WEEK, NOW);
    expect(monthFacts()).toEqual({});

    await mail(FIRST, new Date(Date.UTC(2026, 9, 5, 7)));
    const month = monthFacts();
    expect(Object.keys(month)).toEqual(["mail.weekly.month.score", "mail.weekly.month.market", "mail.weekly.month.reputation"]);
    const dom = await overview();
    const of = (n: string) => copy("overview.months.of", { of: n });
    // Each change is taken against the customer's scan, as Overview's line states it: "33 up from 27".
    const read = (label: string) => {
      const found = /^(\d+)(?: of \d+)? up from (\d+)$/u.exec(month[label] ?? "");
      if (found === null) throw new Error(`${label} has no change: ${month[label]}`);
      return { now: found[1]!, was: found[2]! };
    };
    expect(text(dom.querySelector('[data-testid="overview-tile-score"]'))).toContain(copy("overview.months.score.up", { n: read("mail.weekly.month.score").was }));
    expect(text(dom.querySelector('[data-testid="overview-tile-market"]'))).toContain(copy("overview.months.market.up", { n: read("mail.weekly.month.market").was }));
    expect([read("mail.weekly.month.score").was, read("mail.weekly.month.market").was]).toEqual(["27", "0"]);
    expect(text(dom.querySelector('[data-testid="overview-tile-score"] .num')).replace(/ /gu, "")).toBe(`${read("mail.weekly.month.score").now}${of("100")}`.replace(/ /gu, ""));
    expect(text(dom.querySelector('[data-testid="overview-tile-market"]'))).toContain(`${read("mail.weekly.month.market").now} ${of("12")}`);
    expect(month["mail.weekly.month.reputation"]).toBe("11 of 46");
    expect(text(dom.querySelector('[data-testid="overview-tile-reputation"]'))).toContain(`11 ${of("46")}`);
  });
});

describe("the Monday mail says which way visits from Google moved since last week", () => {
  /** Google visits on the hosted pages, oldest week first, the last being the week ending today. */
  function visits(...weeks: number[]): void {
    db.seed(
      "publication_reads",
      weeks.map((hits, i) => ({
        site_id: SITE_ID,
        publication_id: "p0",
        day: new Date(NOW.getTime() - (weeks.length - 1 - i) * 7 * 86_400_000).toISOString().slice(0, 10),
        engine: "google",
        kind: "referral",
        hits,
      }))
    );
  }
  const line = (): string[] =>
    sent[0]!.blocks.flatMap((block) =>
      block.block === "paragraph" && block.text.startsWith("mail.weekly.google.visits") ? [copy(block.text as never, block.vars as never)] : []
    );

  it.each([
    [[4, 9], "9 visits from Google this week, up from 4."],
    [[9, 4], "4 visits from Google this week, down from 9."],
    [[5, 5], "5 visits from Google this week, the same as last week."],
    [[9], "9 visits from Google this week."],
  ])("weeks %j: %s", async (weeks, sentence) => {
    seed(SAAS, FIVE);
    visits(...weeks);
    await mail(WEEK, NOW);
    expect(line()).toEqual([sentence]);
  });

  it("a week of none after a week with visits says down from it, and the Google tab's figure and bars read the same counts", async () => {
    seed(SAAS, FIVE);
    visits(5, 0);
    await mail(WEEK, NOW);
    const line = said("mail.weekly.google.visits.down");
    expect(line).toEqual({ n: "0", before: "5" });
    const tile = new DOMParser()
      .parseFromString(renderToStaticMarkup(<SearchTiles pages={null} visits={await readGoogleVisitWeeks()} market={null} />), "text/html")
      .querySelector('[data-testid="search-tile-visits"]');
    const bars = [...(tile?.querySelectorAll(`figure[aria-label="${copy("overview.search.visits.chart")}"] li`) ?? [])].map((li) => text(li).split(" · ")[1]);
    expect(text(tile?.querySelector('[data-testid="search-tile-visits-value"]'))).toBe(line?.n);
    expect(bars.slice(-2)).toEqual([line?.before, line?.n]);
  });

  it("a second week of none after visits writes no line, while the Google tab still shows 0 over three bars", async () => {
    seed(SAAS, FIVE);
    visits(5, 0, 0);
    await mail(WEEK, NOW);
    expect(line()).toEqual([]);
    const tile = new DOMParser()
      .parseFromString(renderToStaticMarkup(<SearchTiles pages={null} visits={await readGoogleVisitWeeks()} market={null} />), "text/html")
      .querySelector('[data-testid="search-tile-visits"]');
    expect(text(tile?.querySelector('[data-testid="search-tile-visits-value"]'))).toBe("0");
    expect(tile?.querySelectorAll(`figure[aria-label="${copy("overview.search.visits.chart")}"] li`).length).toBe(3);
  });

  it("a site with no visit in any kept week writes no line", async () => {
    seed(SAAS, FIVE);
    visits(0);
    await mail(WEEK, NOW);
    expect(line()).toEqual([]);
  });

  it("visits that could not be read write no line, never a 0", async () => {
    seed(SAAS, FIVE);
    db.unreadable.add("publication_reads");
    await mail(WEEK, NOW);
    expect(line()).toEqual([]);
  });
});

describe("week 1 reads honestly: too early and not measured, never a row of zeros", () => {
  it.each([
    ["a SaaS site", SAAS],
    ["a local business", LOCAL],
  ])("on %s, pages live and never read yet", async (_, site) => {
    seed(site, [{ places: [null, null], read: false }, { places: [null, null], read: false }]);
    db.seed("publication_reads", []);
    const rows = await mail(WEEK, NOW);
    expect(figure(rows, "mail.weekly.pages.live")).toBe(2);
    for (const name of ["draft.ladder.found", "draft.ladder.showing", "draft.ladder.first-page"]) {
      expect(figure(rows, name), name).toBe("mail.weekly.number.unmeasured");
    }
    expect(sent[0]!.blocks).toContainEqual({ block: "paragraph", text: "mail.weekly.ai.early" });
    expect(said("mail.weekly.ai.linked")).toBeUndefined();
    expect(said("mail.weekly.google.visits")).toBeUndefined();
  });

  it("read once, found by Google and showing nowhere yet: the steps past Found say it is too early", async () => {
    seed(SAAS, [{ places: [null, null] }, { places: [null, null] }]);
    const rows = await mail(WEEK, NOW);
    expect(figure(rows, "draft.ladder.found")).toBe(2);
    expect(rows.map((row) => row.label)).not.toContain("draft.ladder.showing");
    expect(rows.map((row) => row.label)).not.toContain("draft.ladder.first-page");
    expect(sent[0]!.blocks).toContainEqual({ block: "paragraph", text: "mail.weekly.google.early" });
  });
});
