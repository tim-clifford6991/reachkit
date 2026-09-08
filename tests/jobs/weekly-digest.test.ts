// tests/jobs/weekly-digest.test.ts — the occasion of §12's Monday digest
// (#181), and the two rows that carry its promises.
//
// The discriminating pair:
//
//  · **once per `(site_id, week_start)`** — a second run of the tick sends
//    nothing, and it is the stamp on the week's own row that says so, not
//    a check on whether a mail happens to be in an outbox;
//  · **a refused send is not a sent one** — an owner-owed line leaves the
//    week unstamped, so the moment the owner writes it the next tick sends
//    the digest. An implementation that stamped before sending, or that
//    treated `not-composable` as done, passes every happy-path row here
//    and quietly costs the customer the week.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

interface SentMail {
  kind: string;
  to: string;
  userId?: string;
  subject: string;
  measurement?: { state: string; unmeasured?: readonly string[] };
  blocks: readonly { block: string }[];
}

let sent: SentMail[] = [];
let sendAnswer: { sent: true; id: string } | { sent: false; reason: string } = {
  sent: true,
  id: "vendor-1",
};

vi.mock("@/lib/mail/send", () => ({
  sendEmail: async (m: SentMail) => {
    sent.push(m);
    return sendAnswer;
  },
}));

const account = vi.hoisted(() => ({
  answer: { kind: "complete", measuredAt: new Date(Date.UTC(2026, 8, 7, 6, 0, 0)) } as unknown,
}));
vi.mock("@/lib/scan/weekly", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scan/weekly")>();
  return { ...actual, accountForWeek: async () => account.answer };
});

const engine = vi.hoisted(() => ({
  standings: [] as unknown[],
  measuredAt: new Date(Date.UTC(2026, 8, 7, 6, 0, 0)) as Date | null,
  ranked: [] as { opportunityId: string }[],
}));
vi.mock("@/lib/opportunities", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/opportunities")>();
  return {
    ...actual,
    weeklyDigest: async () => ({ standings: engine.standings, weekMeasuredAt: engine.measuredAt }),
    rankOpen: async () => engine.ranked,
  };
});
vi.mock("@/lib/opportunities/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/opportunities/store")>();
  return {
    ...actual,
    opportunityStore: () => ({
      byId: async (id: string) => ({ id, target_query: `search ${id}`, evidence: {} }),
    }),
    readOpportunity: (row: { id: string }) => ({ targetQuery: `search ${row.id}` }),
  };
});

const { sendWeeklyDigest } = await import("@/lib/mail/weekly");

const NOW = new Date(Date.UTC(2026, 8, 7, 7, 0, 0));
const WEEK = "2026-09-07";

function seed(over: { scan?: Row } = {}): void {
  db.reset();
  db.seed("users", [{ id: "user-1", email: "founder@example.com" }]);
  db.seed("sites", [{ id: "site-1", user_id: "user-1", timezone: "America/New_York" }]);
  db.seed("scans", [
    {
      id: "scan-week",
      site_id: "site-1",
      tier: "weekly",
      week_start: WEEK,
      status: "done",
      digest_sent_at: null,
      ...over.scan,
    },
  ]);
}

const theScan = (): Row => db.rows("scans")[0] as Row;

beforeEach(() => {
  sent = [];
  sendAnswer = { sent: true, id: "vendor-1" };
  account.answer = { kind: "complete", measuredAt: new Date(Date.UTC(2026, 8, 7, 6, 0, 0)) };
  engine.standings = [];
  engine.measuredAt = new Date(Date.UTC(2026, 8, 7, 6, 0, 0));
  engine.ranked = [{ opportunityId: "o1" }, { opportunityId: "o2" }, { opportunityId: "o3" }];
  seed();
});

describe("the Monday digest goes out for a week that was measured", () => {
  it("one weekly mail, to the account that owns the site, with §12's four sections", async () => {
    const outcome = await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });

    expect(outcome).toEqual({ sent: true, id: "vendor-1" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.kind).toBe("weekly");
    expect(sent[0]!.to).toBe("founder@example.com");
    expect(sent[0]!.subject).toBe("mail.weekly.subject");
    expect(sent[0]!.blocks.map((b) => b.block)).toEqual([
      "heading",
      "paragraph",
      "stat",
      "stat",
      "verdicts",
      "list",
      "action",
    ]);
  });

  it("a complete week says so, and carries no missed-section line", async () => {
    await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
    expect(sent[0]!.measurement).toEqual({ state: "complete" });
  });

  it("**a partial week still sends, and names the sections it missed**", async () => {
    account.answer = {
      kind: "partial",
      measuredAt: new Date(Date.UTC(2026, 8, 7, 6, 0, 0)),
      unmeasured: ["ai_answers", "rivals"],
    };
    const outcome = await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });

    expect(outcome.sent).toBe(true);
    expect(sent[0]!.measurement).toEqual({
      state: "partial",
      unmeasured: ["mail.section.ai_answers", "mail.section.rivals"],
    });
  });

  it("the next three come from the ranking, and no more than three", async () => {
    engine.ranked = [
      { opportunityId: "o1" },
      { opportunityId: "o2" },
      { opportunityId: "o3" },
      { opportunityId: "o4" },
    ];
    await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
    const list = sent[0]!.blocks.find((b) => b.block === "list") as unknown as {
      items: { kind: string; value: { label: string; vars: { search: string } }[] };
    };
    expect(list.items.value.map((row) => row.vars.search)).toEqual([
      "search o1",
      "search o2",
      "search o3",
    ]);
  });
});

describe("once per site-week", () => {
  it("**a second run sends nothing** — the stamp on the week's own row says so", async () => {
    await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
    expect(theScan().digest_sent_at).toBe(NOW.toISOString());

    const again = await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
    expect(again).toEqual({ sent: false, reason: "already-sent" });
    expect(sent).toHaveLength(1);
  });

  it("the stamp is written after the seam accepted it, and never before", async () => {
    sendAnswer = { sent: false, reason: "vendor" };
    await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
    expect(theScan().digest_sent_at).toBeNull();
  });

  it("and the next week is its own telling", async () => {
    await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
    db.seed("scans", [
      ...db.rows("scans"),
      {
        id: "scan-next",
        site_id: "site-1",
        tier: "weekly",
        week_start: "2026-09-14",
        status: "done",
        digest_sent_at: null,
      },
    ]);
    const next = await sendWeeklyDigest({ siteId: "site-1", weekStart: "2026-09-14", now: NOW });
    expect(next.sent).toBe(true);
    expect(sent).toHaveLength(2);
  });
});

describe("an owed line is reported as itself, and the week stays open", () => {
  it("**not-composable is its own outcome and stamps nothing**", async () => {
    sendAnswer = { sent: false, reason: "not-composable" };
    const outcome = await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });

    expect(outcome).toEqual({ sent: false, reason: "not-composable" });
    expect(theScan().digest_sent_at).toBeNull();
  });

  it("so the digest goes the moment the owner writes the line", async () => {
    sendAnswer = { sent: false, reason: "not-composable" };
    await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });

    sendAnswer = { sent: true, id: "vendor-2" };
    const later = await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
    expect(later).toEqual({ sent: true, id: "vendor-2" });
    expect(theScan().digest_sent_at).toBe(NOW.toISOString());
  });

  it.each(["preference-off", "suppressed", "vendor", "suppression-unreadable"])(
    "a send refused for %s leaves the week unstamped too",
    async (reason) => {
      sendAnswer = { sent: false, reason };
      const outcome = await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
      expect(outcome).toEqual({ sent: false, reason: "mail" });
      expect(theScan().digest_sent_at).toBeNull();
    }
  );
});

describe("ADR-071 — no row, no state", () => {
  it("a week the site did not measure sends no mail", async () => {
    db.seed("scans", []);
    const outcome = await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
    expect(outcome).toEqual({ sent: false, reason: "not-measured" });
    expect(sent).toEqual([]);
  });

  it("and neither does a week whose account says it was not measured", async () => {
    account.answer = { kind: "not_measured", nextDueOn: new Date(Date.UTC(2026, 8, 14, 6, 0, 0)) };
    const outcome = await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
    expect(outcome).toEqual({ sent: false, reason: "not-measured" });
    expect(sent).toEqual([]);
  });

  it("a site whose access has ended is owed no week and is told nothing", async () => {
    account.answer = { kind: "not_owed" };
    const outcome = await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
    expect(outcome).toEqual({ sent: false, reason: "not-measured" });
    expect(sent).toEqual([]);
  });

  it("no account to write to is reported rather than mailed into the void", async () => {
    db.seed("users", []);
    const outcome = await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
    expect(outcome).toEqual({ sent: false, reason: "no-account" });
    expect(sent).toEqual([]);
  });
});
