// Owner O7: a week whose daily re-check set pages aside says so once, plainly, after the published count, asking
// nothing. The rows are the dogfood's stored pages, set aside as the re-check records it; the week's arm is read from its
// stored days and the drafts that filled them, never from supply.
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { fakeDb, type Row } from "../../publish/harness";
import { COPY } from "@/lib/presentation/copy";
import { violations } from "../../../scripts/lib/plain-words.mjs";
import stored from "../../generate/fixtures/dogfood-drafts-2026-10.min.json";

applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

type Block = { block: string; text?: string; vars?: Record<string, string>; href?: string };
const sent: { blocks: readonly Block[] }[] = [];
vi.mock("@/lib/mail/send", () => ({
  sendEmail: async (m: { blocks: readonly Block[] }) => {
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

const NOW = new Date(Date.UTC(2026, 10, 2, 7, 0, 0));
const WEEK = "2026-11-02";
const ONE = "mail.weekly.setAside.one";
const MANY = "mail.weekly.setAside.many";
const UNREPLACED = ["mail.weekly.setAside.one.unreplaced", "mail.weekly.setAside.many.unreplaced"] as const;
const UPDATED = ["mail.weekly.setAside.one.updated", "mail.weekly.setAside.many.updated"] as const;
const SLOT = [ONE, MANY, ...UNREPLACED, ...UPDATED] as const;
/** The seven days before the Monday, which the set-aside count reads too. */
const LAST_WEEK = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"];
const drafted = (gap?: string): Row[] => LAST_WEEK.map((day) => ({ site_id: "site-1", publish_date: day, outcome: day === gap ? "no_page" : "drafted", reason: day === gap ? "generate:no_opportunity" : null }));
/** A day the day's fallback filled with an update of a live page: written from stored research, or mended in code. */
const updates = (days: readonly string[]): Row[] =>
  days.map((day, i) => ({ id: `upd-${day}`, site_id: "site-1", state: "published", title: "Water heater repair in Austin", scheduled_for: day, transitions: [], created_at: `${day}T21:00:00.000Z`, meta: { fallbackFor: "generate:no_opportunity", ...(i % 2 === 0 ? { research: "stored" } : { mendOf: "live-1" }) } }));

const ROWS: Row[] = stored.drafts.map((draft) => ({ id: draft.id, site_id: "site-1", state: draft.state, title: draft.title, transitions: draft.transitions, created_at: draft.created_at }));

/** The stored rows with those named set aside by the re-check at `at`, as its `needs_attention → skipped` move writes it. */
const retired = (prefixes: readonly string[], at = "2026-10-31T09:00:00.000Z"): Row[] =>
  ROWS.map((row) => (prefixes.some((prefix) => String(row.id).startsWith(prefix)) ? { ...row, state: "skipped", transitions: [...(row.transitions as unknown[]), { at, from: "needs_attention", to: "skipped", actor: { kind: "system", job: "draft/recheck" }, reason: "retired:plain_prose" }] } : row));

async function mailFor(drafts: readonly Row[], days: readonly Row[] = drafted()): Promise<readonly Block[]> {
  db.reset();
  db.seed("users", [{ id: "user-1", email: "founder@example.com" }]);
  db.seed("sites", [{ id: "site-1", user_id: "user-1", domain: "harbor-plumbing.example", timezone: "America/Chicago", publish_time: "16:00:00" }]);
  db.seed("scans", [{ id: "scan-week", site_id: "site-1", tier: "weekly", week_start: WEEK, status: "done", digest_sent_at: null }]);
  db.seed("drafts", [...drafts]);
  db.seed("draft_days", [...days]);
  sent.length = 0;
  await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
  return sent[0]!.blocks;
}

describe("the Monday mail's set-aside line", () => {
  it("one page set aside last week is the singular line, once, right after the published count, with no link or button", async () => {
    const blocks = await mailFor(retired(["d98284cc"]));
    const at = blocks.findIndex((block) => block.text === ONE);
    expect(blocks.filter((block) => SLOT.some((key) => key === block.text))).toHaveLength(1);
    expect(blocks[at - 1]?.block).toBe("stats");
    expect(blocks[at]).toEqual({ block: "paragraph", text: ONE });
    expect(blocks[at + 1]?.block).not.toBe("action");
  });

  const three = ["d98284cc", "5dcc61c2", "f1ec6a58"];
  it.each([
    ["three set aside, every day drafted and none an update, are the plural, n = 3", three, [], drafted(), MANY],
    ["one set aside, every day drafted and one an update, improved a live page", ["d98284cc"], updates(["2026-10-28"]), drafted(), UPDATED[0]],
    ["three set aside, every day drafted and three updates, improved live pages", three, updates(["2026-10-27", "2026-10-28", "2026-10-30"]), drafted(), UPDATED[1]],
    ["three set aside with one update, a mixed week, claim neither", three, updates(["2026-10-28"]), drafted(), UNREPLACED[1]],
    ["one set aside and a day with no page claims no next page", ["d98284cc"], [], drafted("2026-10-29"), UNREPLACED[0]],
    ["one set aside, an update, and a day with no page claims no next page", ["d98284cc"], updates(["2026-10-28"]), drafted("2026-10-29"), UNREPLACED[0]],
    ["one set aside and no stored days claims no next page", ["d98284cc"], [], [], UNREPLACED[0]],
    ["one set aside whose update the customer stopped claims neither", ["d98284cc"], updates(["2026-10-28"]).map((row) => ({ ...row, state: "skipped" })), drafted(), UNREPLACED[0]],
  ] as const)("%s, once", async (_case, ids, filled, days, key) => {
    const lines = (await mailFor([...retired(ids), ...filled], days)).filter((block) => SLOT.some((each) => each === block.text));
    expect(lines).toEqual([{ block: "paragraph", text: key, ...(ids.length > 1 ? { vars: { n: "3" } } : {}) }]);
  });

  it.each([
    ["none was set aside", ROWS],
    ["the only one was set aside before last week, so an earlier Monday told it", retired(["d98284cc"], "2026-10-24T09:00:00.000Z")],
  ])("says nothing where %s", async (_case, drafts) => {
    const blocks = await mailFor(drafts);
    expect(blocks.some((block) => SLOT.some((key) => key === block.text))).toBe(false);
  });

  it("every new line is plain words, links nothing and names no planning word", () => {
    const keys = [...SLOT, "calendar.day.set-aside", "calendar.empty.page-set-aside", "calendar.empty.short.page-set-aside"] as const;
    for (const key of keys) {
      const text = COPY[key];
      expect(violations(text, { key }), key).toEqual([]);
      expect(text, key).not.toMatch(/\b(supply|spares?|ceiling|veto|drafts?|recheck|rules?)\b|https?:|\/app/i);
    }
  });
});
