// Owner O7: the Monday mail tells a page that needs the customer only when its cause is critical for them. The
// dogfood's ten stored pages the writing rules stopped are the system's to rescue or set aside, so they say nothing.
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const credentialsExpired: Row = {
  id: "d-credentials",
  site_id: "site-1",
  state: "needs_attention",
  title: "Emergency plumber near you",
  created_at: "2026-10-30T07:00:00.000Z",
  transitions: [
    { from: "publishing", to: "failed", at: "2026-10-30T16:00:00.000Z", reason: "credentials_expired" },
    { from: "failed", to: "needs_attention", at: "2026-10-30T16:00:01.000Z", reason: "reason_needs_customer" },
  ],
};

function seed(drafts: readonly Row[]): void {
  db.reset();
  db.seed("users", [{ id: "user-1", email: "founder@example.com" }]);
  db.seed("sites", [{ id: "site-1", user_id: "user-1", domain: "harbor-plumbing.example", timezone: "America/Chicago", publish_time: "16:00:00" }]);
  db.seed("scans", [{ id: "scan-week", site_id: "site-1", tier: "weekly", week_start: WEEK, status: "done", digest_sent_at: null }]);
  db.seed("drafts", [...drafts]);
}

async function needsYouLines(): Promise<number> {
  sent.length = 0;
  await sendWeeklyDigest({ siteId: "site-1", weekStart: WEEK, now: NOW });
  return sent[0]!.blocks.filter((block) => block.text === "mail.weekly.needsYou").length;
}

describe("the Monday mail's needs-you line", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("is absent for a site whose only stopped pages are the ten the writing rules stopped", async () => {
    expect(RULES_ROWS).toHaveLength(10);
    seed(RULES_ROWS);
    expect(await needsYouLines()).toBe(0);
  });

  it("is told exactly once for an expired credential, beside those ten", async () => {
    seed([...RULES_ROWS, credentialsExpired]);
    expect(await needsYouLines()).toBe(1);
  });
});
