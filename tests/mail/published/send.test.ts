// tests/mail/published/send.test.ts — the occasion of the `published` mail.
//
// The row that carries REQ-062 criterion 5 is the four-fixture one: the
// mail goes out under `found` with nothing failed, under `found` with
// everything failed, under `page_not_found` and under `could_not_confirm`,
// and the payload handed to the seam is the only thing that differs. An
// implementation that suppressed on a failed check — or on either of the
// two arms that assert nothing — fails it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

interface SentMail {
  kind: string;
  to: string;
  userId?: string;
  subject: string;
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

const { sendPublishedMail } = await import("@/lib/mail/published");

const LIVE_URL = "https://example.com/how-long-does-a-roof-last";
const AT = new Date(Date.UTC(2026, 8, 2, 14, 30, 0));

function measuredCheck(value: boolean): Row {
  return { kind: "measured", value, at: AT.toISOString() };
}

function found(allPassed: boolean): Row {
  return {
    outcome: "found",
    checkedAt: AT.toISOString(),
    siteCondition: null,
    checks: {
      reachable: measuredCheck(true),
      indexable: measuredCheck(allPassed),
      sitemap: measuredCheck(allPassed),
      aiReadable: measuredCheck(allPassed),
    },
  };
}

const NOT_FOUND: Row = {
  outcome: "page_not_found",
  status: 404,
  checkedAt: AT.toISOString(),
  siteCondition: null,
};

const NOT_CONFIRMED: Row = {
  outcome: "could_not_confirm",
  why: "unreachable",
  checkedAt: AT.toISOString(),
  siteCondition: null,
};

function seed(verify: Row | null, over: { site?: Row; user?: Row | null } = {}): void {
  db.reset();
  db.seed("publications", [{ id: "p1", site_id: "s1", live_url: LIVE_URL, verify }]);
  db.seed("sites", [
    { id: "s1", user_id: "u1", timezone: "America/New_York", ...over.site },
  ]);
  if (over.user !== null) {
    db.seed("users", [{ id: "u1", email: "founder@example.com", ...over.user }]);
  }
}

beforeEach(() => {
  sent = [];
  sendAnswer = { sent: true, id: "vendor-1" };
  db.reset();
});

describe("sendPublishedMail — one occasion, all three outcomes (REQ-062 c5)", () => {
  it("sends whether every check passed or any failed, and under both criterion-4 arms", async () => {
    for (const verify of [found(true), found(false), NOT_FOUND, NOT_CONFIRMED]) {
      sent = [];
      seed(verify);
      const outcome = await sendPublishedMail("p1");
      expect(outcome, String(verify.outcome)).toEqual({ sent: true, id: "vendor-1" });
      expect(sent).toHaveLength(1);
      expect(sent[0]!.kind).toBe("published");
      expect(sent[0]!.to).toBe("founder@example.com");
      expect(sent[0]!.userId).toBe("u1");
    }
  });

  it("carries the live address as the mail's action block in every arm", async () => {
    for (const verify of [found(false), NOT_FOUND, NOT_CONFIRMED]) {
      sent = [];
      seed(verify);
      await sendPublishedMail("p1");
      const action = sent[0]!.blocks.find((b) => b.block === "action") as
        | { block: string; href: string }
        | undefined;
      expect(action?.href, String(verify.outcome)).toBe(LIVE_URL);
    }
  });

  it("carries the four verdict rows under found, and no verdicts block under the other two", async () => {
    seed(found(false));
    await sendPublishedMail("p1");
    expect(sent[0]!.blocks.some((b) => b.block === "verdicts")).toBe(true);

    for (const verify of [NOT_FOUND, NOT_CONFIRMED]) {
      sent = [];
      seed(verify);
      await sendPublishedMail("p1");
      expect(sent[0]!.blocks.some((b) => b.block === "verdicts")).toBe(false);
    }
  });

  it("sends nothing where no check has been recorded — the absence of the occasion, not a suppression", async () => {
    seed(null);
    expect(await sendPublishedMail("p1")).toEqual({ sent: false, reason: "no-check-recorded" });
    expect(sent).toEqual([]);
  });

  it("reports a vendor failure rather than swallowing it", async () => {
    seed(found(true));
    sendAnswer = { sent: false, reason: "vendor" };
    expect(await sendPublishedMail("p1")).toEqual({ sent: false, reason: "mail" });
  });

  it("reports no account rather than sending to nobody", async () => {
    seed(found(true), { user: null });
    expect(await sendPublishedMail("p1")).toEqual({ sent: false, reason: "no-account" });
    expect(sent).toEqual([]);
  });

  it("a founder who has not set a zone still gets the mail", async () => {
    // Withholding the whole mail over an unset setting would make a field
    // the customer never filled in a reason to send nothing.
    seed(found(true), { site: { id: "s1", user_id: "u1", timezone: null } });
    expect(await sendPublishedMail("p1")).toEqual({ sent: true, id: "vendor-1" });
  });

  it("the recorded outcome never enters the decision to send", async () => {
    // Four fixtures, four sends, one code path: the only difference in the
    // payload is which line the arm selected.
    const lines: string[] = [];
    for (const verify of [found(true), found(false), NOT_FOUND, NOT_CONFIRMED]) {
      sent = [];
      seed(verify);
      await sendPublishedMail("p1");
      const paragraph = sent[0]!.blocks[0] as { block: string; text: string };
      lines.push(paragraph.text);
    }
    expect(lines).toEqual([
      "mail.published.verified",
      "mail.published.verified",
      "mail.published.not_found",
      "mail.published.not_confirmed",
    ]);
  });
});
