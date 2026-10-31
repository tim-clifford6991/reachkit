// Owner O7: the Monday mail tells a page that needs the customer only when its cause is critical for them. The
// dogfood's ten stored pages the writing rules stopped are the system's to rescue or set aside, so they say nothing.
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { fakeDb, type Row } from "../../publish/harness";
import stored from "../../generate/fixtures/dogfood-drafts-2026-10.min.json";

applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const sent: { blocks: readonly { block: string; text?: string }[] }[] = [];
vi.mock("@/lib/mail/send", () => ({
  sendEmail: async (m: { blocks: readonly { block: string; text?: string }[] }) => {
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

/** The ten stored rows with a body, each resting on the `rules:` reason its stop wrote. */
const RULES_ROWS: Row[] = stored.drafts
  .filter((draft) => draft.body_md !== null && draft.body_md !== undefined)
  .map((draft) => ({ id: draft.id, site_id: "site-1", state: draft.state, title: draft.title, transitions: draft.transitions, created_at: draft.created_at }));

const rested = { from: "failed", to: "needs_attention", at: "2026-10-30T16:00:01.000Z", reason: "reason_needs_customer" };
const credentialsExpired: Row = { id: "d-credentials", site_id: "site-1", state: "needs_attention", title: "Emergency plumber near you", created_at: "2026-10-30T07:00:00.000Z", transitions: [rested] };
const edited = (rows: Row[], reason?: string): Row[] =>
  rows.map((row, n) => (n === 0 ? { ...row, meta: { first_edited_at: "2026-10-30T09:00:00.000Z" }, ...(reason === undefined ? {} : { transitions: [{ from: "generating", to: "needs_attention", reason }] }) } : row));

function seed(drafts: readonly Row[]): void {
  db.reset();
  db.seed("users", [{ id: "user-1", email: "founder@example.com" }]);
  db.seed("sites", [{ id: "site-1", user_id: "user-1", domain: "harbor-plumbing.example", timezone: "America/Chicago", publish_time: "16:00:00" }]);
  db.seed("scans", [{ id: "scan-week", site_id: "site-1", tier: "weekly", week_start: WEEK, status: "done", digest_sent_at: null }]);
  db.seed("drafts", [...drafts]);
}

describe("the Monday mail's needs-you line", () => {
  it.each([
    ["absent for the ten stored pages the writing rules stopped", RULES_ROWS, 0],
    ["told once when the customer edited one of those ten: the words are theirs to fix", edited(RULES_ROWS), 1],
    ["told once for an edited page a short pack stopped, too", edited(RULES_ROWS, "step_failed:pack:buyer_questions"), 1],
    ["told exactly once for an expired credential, beside those ten", [...RULES_ROWS, credentialsExpired], 1],
  ])("is %s", async (_case, drafts, lines) => {
    expect(RULES_ROWS).toHaveLength(10);
    seed(drafts);
    sent.length = 0;
    await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
    expect(sent[0]!.blocks.filter((block) => block.text === "mail.weekly.needsYou")).toHaveLength(lines);
  });
});
