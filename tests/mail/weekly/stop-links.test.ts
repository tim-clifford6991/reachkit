// Issue 1674 — the Monday mail tells the committed week, its first pages
// written out each with its own signed stop link, and that link stops the
// planned page before it is written: the row leaves the week and the day
// falls to a spare. Board MondayMail counts the rest and leads to Plan.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { fakeDb, type Row } from "../../publish/harness";

applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const sent: { blocks: readonly { block: string }[] }[] = [];
vi.mock("@/lib/mail/send", () => ({
  sendEmail: async (m: { blocks: readonly { block: string }[] }) => {
    sent.push(m);
    return { sent: true, id: "vendor-1" };
  },
}));
vi.mock("@/lib/scan/weekly", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/weekly")>()),
  accountForWeek: async () => ({ kind: "complete", measuredAt: NOW }),
}));
vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
  weeklyDigest: async () => ({ standings: [], weekMeasuredAt: NOW }),
}));

const { sendWeeklyDigest } = await import("@/lib/mail/weekly");
const { COPY } = await import("@/lib/presentation/copy");
const { committedWeek } = await import("@/lib/opportunities/plan");
const { previewPlannedStop, stopPlannedPage, plannedStopToken } = await import("@/lib/opportunities/stop");

const NOW = new Date(Date.UTC(2026, 9, 19, 7, 0, 0));
const WEEK = "2026-10-19";
const day = (n: number) => `2026-10-${String(19 + n).padStart(2, "0")}`;

function opportunity(id: string, place: number, plannedFor: string | null, over: Row = {}): Row {
  return {
    id,
    site_id: "site-1",
    scan_id: "scan-week",
    type: "new_page",
    family: "new",
    target_query: `search ${id}`,
    target_ref: `search ${id}`,
    title: null,
    volume: 90,
    evidence: { family: "new", volume: 90 },
    acceptance: {},
    effort: 1,
    status: "open",
    ready: true,
    plan_place: place,
    planned_for: plannedFor,
    created_at: NOW.toISOString(),
    ...over,
  };
}

function seed(days: readonly number[]): void {
  db.reset();
  db.seed("users", [{ id: "user-1", email: "founder@example.com" }]);
  db.seed("sites", [{ id: "site-1", user_id: "user-1", domain: "harbor-plumbing.example", timezone: "America/Chicago", publish_time: "16:00:00" }]);
  db.seed("scans", [{ id: "scan-week", site_id: "site-1", tier: "weekly", week_start: WEEK, status: "done", digest_sent_at: null }]);
  db.seed("opportunities", [
    ...days.map((n, place) =>
      opportunity(`o${n}`, place + 1, day(n), n === 0 ? { plan_reason: { points: 9, parts: [{ part: "ai_gap", n: 3 }], rule: null } } : {})
    ),
    opportunity("spare-1", 8, null),
  ]);
}

type WeekRow = {
  label: string;
  vars: Record<string, string>;
  detail?: { text: string; vars?: Record<string, string> }[];
  links?: { label: string; href: string; vars?: Record<string, string> }[];
};
type WeekList = { items: { value: WeekRow[] } };
type Block = { block: string; label?: string; text?: string; vars?: Record<string, string>; items?: unknown };

async function mondayMail(): Promise<{ week: WeekList; blocks: readonly Block[] }> {
  sent.length = 0;
  await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
  const blocks = sent[0]!.blocks as unknown as Block[];
  const week = blocks.find((b) => b.block === "list" && b.label === undefined) as unknown as WeekList;
  return { week, blocks };
}

const stopOf = (row: WeekRow) => row.links!.find((link) => link.label === "mail.weekly.next.stop")!.href;
const strip = (blocks: readonly Block[]) =>
  (blocks.find((b) => b.block === "facts") as unknown as { items: { labelVars: { day: string }; value: string }[] }).items.map((item) => item.value);

const tokenOf = (href: string) => decodeURIComponent(new URL(href).pathname.replace(/^\/veto\//, ""));

describe("the Monday mail tells the whole week with a stop link per page", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("a 7-page week writes out three, each with its day, why and its own signed link, and counts the other four", async () => {
    seed([0, 1, 2, 3, 4, 5, 6]);
    const { week, blocks } = await mondayMail();
    const rows = week.items.value;
    expect(rows.map((row) => row.label)).toEqual([
      "mail.weekly.next.day.new.today",
      "mail.weekly.next.day.new",
      "mail.weekly.next.day.new",
      "mail.weekly.next.more.span",
    ]);
    expect(rows[1]!.vars).toMatchObject({ day: "Tue", date: "Tue 20 Oct" });
    expect(rows[0]!.detail).toEqual([
      { text: "mail.weekly.next.item", vars: { search: "search o0" } },
      { text: "mail.weekly.next.why", vars: { reason: COPY["calendar.reason.ai-gap"] } },
    ]);
    expect(rows[1]!.detail).toEqual([{ text: "mail.weekly.next.item", vars: { search: "search o1" } }]);
    expect(new Set(rows.slice(0, 3).map(stopOf)).size).toBe(3);
    for (const [n, row] of rows.slice(0, 3).entries()) {
      const read = await previewPlannedStop(tokenOf(stopOf(row)), NOW);
      expect(read).toMatchObject({ ok: true, planned: { query: `search o${n}`, volume: 90, domain: "harbor-plumbing.example", day: day(n) } });
    }
    expect(rows[3]).toEqual({
      label: "mail.weekly.next.more.span",
      vars: { from: "Thu", to: "Sun", n: "4" },
      links: [{ label: "mail.weekly.next.all", vars: { n: "7" }, href: "https://reachkit.example/app/calendar" }],
    });
    expect(strip(blocks)).toEqual([COPY["mail.weekly.strip.today"], ...Array(6).fill(COPY["mail.weekly.strip.new"])]);
    expect(blocks.some((b) => b.text === "mail.weekly.next.skipped")).toBe(false);
  });

  it("a short week marks its empty day on the strip and says one day has no page", async () => {
    seed([0, 1, 2, 4, 5, 6]);
    const { week, blocks } = await mondayMail();
    expect(week.items.value.at(-1)).toMatchObject({ vars: { from: "Fri", to: "Sun", n: "3" } });
    expect(strip(blocks)[3]).toBe(COPY["mail.weekly.strip.none"]);
    expect(blocks.find((b) => b.text === "mail.weekly.next.skipped")?.vars).toEqual({ count: "1" });
  });

  it("the link stops the planned page: it leaves the week, the spare stays, and a second use says it is stopped", async () => {
    seed([0, 1, 2, 3, 4, 5, 6]);
    const { week } = await mondayMail();
    const token = tokenOf(stopOf(week.items.value[2]!));

    expect(await stopPlannedPage(token, NOW)).toMatchObject({ ok: true });
    expect(db.rows("opportunities").find((row) => row.id === "o2")!.status).toBe("dismissed");
    const after = await committedWeek("site-1");
    expect(after.days.map((d) => d.opportunity.id)).toEqual(["o0", "o1", "o3", "o4", "o5", "o6"]);
    expect(after.spares.map((s) => s.id)).toEqual(["spare-1"]);
    expect(await previewPlannedStop(token, NOW)).toEqual({ ok: false, reason: "used", domain: "harbor-plumbing.example" });
  });

  it("a written page, a past day, another site's page and a forged link stop nothing", async () => {
    seed([0, 1]);
    const written = db.rows("opportunities").find((row) => row.id === "o1")!;
    written.status = "queued";
    const sign = (opportunityId: string, siteId = "site-1", d = day(1)) => plannedStopToken({ siteId, opportunityId, day: d });

    expect(await stopPlannedPage(sign("o1"), NOW)).toEqual({ ok: false, reason: "written" });
    expect(await stopPlannedPage(sign("o0", "site-1", "2026-10-18"), NOW)).toEqual({ ok: false, reason: "expired" });
    expect(await stopPlannedPage(sign("o0", "site-2"), NOW)).toEqual({ ok: false, reason: "unknown" });
    const forged = `${sign("o0").split(".")[0]}.${Buffer.from("not the mac").toString("base64url")}`;
    expect(await stopPlannedPage(forged, NOW)).toEqual({ ok: false, reason: "unknown" });
    expect(db.rows("opportunities").map((row) => row.status)).toEqual(["open", "queued", "open"]);
  });
});
