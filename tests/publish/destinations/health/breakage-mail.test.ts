// tests/publish/destinations/health/breakage-mail.test.ts — BUILD §9: one
// mail per breakage, for the customer who has not signed in since it
// broke.
//
// **Each of the four conjuncts is falsified alone**, so the suite
// discriminates the guard rather than agreeing with the happy path. The
// one that matters most is the last — an implementation that re-evaluates
// daily without reading `broken_mail_sent_at` passes every other
// assertion here and writes to the customer every morning.
//
// The archived plan is WO-227.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const mail = vi.hoisted(() => ({
  sent: [] as { kind: string; to: string; subject: string; blocks: unknown[] }[],
  result: { sent: true as boolean, id: "mail-1" },
}));

vi.mock("@/lib/mail/send", () => ({
  sendEmail: async (m: { kind: string; to: string; subject: string; blocks: unknown[] }) => {
    mail.sent.push(m);
    return mail.result.sent ? { sent: true, id: mail.result.id } : { sent: false, reason: "vendor" };
  },
}));

import { DESTINATION_BREAKAGE_MAIL_DELAY_H } from "@/lib/config/constants";
import { breakageMailDue, sendBreakageMail } from "@/lib/publish/destinations/health";

const HOUR_MS = 3_600_000;
/** The moment every case below is evaluated at. */
const NOW = new Date("2026-09-06T12:00:00.000Z");
/** Exactly 24 hours before `NOW`. */
const BROKE_AT = new Date(NOW.getTime() - DESTINATION_BREAKAGE_MAIL_DELAY_H * HOUR_MS);

function seed(destination: Row = {}, user: Row = {}, links: Row[] = []): void {
  db.seed("sites", [{ id: "site-1", user_id: "user-1", domain: "example.com", publishing_enabled: true }]);
  db.seed("users", [
    { id: "user-1", email: "dana@example.com", first_signed_in_at: null, ...user },
  ]);
  db.seed("destinations", [
    {
      id: "dest-1",
      site_id: "site-1",
      kind: "wordpress",
      config: null,
      health: "expired",
      health_reason: "credentials_expired",
      health_changed_at: BROKE_AT.toISOString(),
      broken_mail_sent_at: null,
      last_checked_at: NOW.toISOString(),
      created_at: "2026-09-01T00:00:00.000Z",
      deleted_at: null,
      publish_capable: null,
      ...destination,
    },
  ]);
  db.seed("auth_links", links);
  db.seed("drafts", [
    { id: "d1", site_id: "site-1", state: "approved", publishable_since: "2026-09-02T00:00:00.000Z" },
    { id: "d2", site_id: "site-1", state: "approved", publishable_since: "2026-09-03T00:00:00.000Z" },
    { id: "d3", site_id: "site-1", state: "failed", publishable_since: "2026-09-04T00:00:00.000Z" },
  ]);
}

beforeEach(() => {
  db.reset();
  mail.sent.length = 0;
  mail.result = { sent: true, id: "mail-1" };
});

describe("at 24 hours with no sign-in since it broke, one mail is due", () => {
  it("it is due at exactly 24 hours — the boundary is inclusive, as the criterion states it", async () => {
    seed();
    expect(await breakageMailDue("site-1", NOW)).toEqual({
      due: true,
      destinationId: "dest-1",
      held: 3,
      to: "dana@example.com",
      copy: "mail.account.destinationBroken.subject",
    });
  });

  it("its payload is a copy key and a count — never a sentence", async () => {
    seed();
    const due = await breakageMailDue("site-1", NOW);
    expect(due.due && due.copy).toBe("mail.account.destinationBroken.subject");
    expect(due.due && typeof due.held).toBe("number");
    expect(JSON.stringify(due)).not.toMatch(/[a-z]{4}\s[a-z]{4}\s[a-z]{4}/);
  });

  it("the count is how many pages are waiting, derived and never stored", async () => {
    seed();
    db.seed("drafts", []);
    const due = await breakageMailDue("site-1", NOW);
    expect(due.due && due.held).toBe(0);
  });
});

describe("each of the four conjuncts, falsified alone, makes it not due", () => {
  it("a destination that is working — health = 'ok'", async () => {
    seed({ health: "ok", health_reason: null });
    expect(await breakageMailDue("site-1", NOW)).toEqual({ due: false });
  });

  it("a breakage one minute short of 24 hours", async () => {
    seed({ health_changed_at: new Date(BROKE_AT.getTime() + 60_000).toISOString() });
    expect(await breakageMailDue("site-1", NOW)).toEqual({ due: false });
  });

  it("a breakage already written about — broken_mail_sent_at is set", async () => {
    seed({ broken_mail_sent_at: "2026-09-06T06:00:00.000Z" });
    expect(await breakageMailDue("site-1", NOW)).toEqual({ due: false });
  });

  it("a customer who signed in since it broke", async () => {
    seed({}, { first_signed_in_at: new Date(BROKE_AT.getTime() + HOUR_MS).toISOString() });
    expect(await breakageMailDue("site-1", NOW)).toEqual({ due: false });
  });
});

describe("the last sign-in is the newest redeemed sign-in link (#35)", () => {
  /** One redeemed link, `offsetH` hours from the moment it broke. */
  function link(offsetH: number, over: Row = {}): Row {
    return {
      token_hash: `hash-${offsetH}`,
      user_id: "user-1",
      purpose: "sign_in",
      spent_at: new Date(BROKE_AT.getTime() + offsetH * HOUR_MS).toISOString(),
      ...over,
    };
  }

  it("a link redeemed since the breakage is a sign-in since the breakage — even where the first sign-in was long before it", async () => {
    // The discriminating case: `first_signed_in_at` alone says "before",
    // and would write to a customer who has been here this morning.
    seed({}, { first_signed_in_at: "2026-08-01T00:00:00.000Z" }, [link(2)]);
    expect(await breakageMailDue("site-1", NOW)).toEqual({ due: false });
  });

  it("a link redeemed before the breakage leaves it due", async () => {
    seed({}, { first_signed_in_at: "2026-08-01T00:00:00.000Z" }, [link(-6)]);
    expect((await breakageMailDue("site-1", NOW)).due).toBe(true);
  });

  it("the newest of several is the one that counts", async () => {
    seed({}, { first_signed_in_at: "2026-08-01T00:00:00.000Z" }, [link(-10), link(3), link(-2)]);
    expect(await breakageMailDue("site-1", NOW)).toEqual({ due: false });
  });

  it("a link that was never redeemed is not a sign-in", async () => {
    seed({}, { first_signed_in_at: "2026-08-01T00:00:00.000Z" }, [
      { token_hash: "unspent", user_id: "user-1", purpose: "sign_in", spent_at: null },
    ]);
    expect((await breakageMailDue("site-1", NOW)).due).toBe(true);
  });

  it("an email-change link is not somebody arriving at the product", async () => {
    seed({}, { first_signed_in_at: "2026-08-01T00:00:00.000Z" }, [
      link(2, { purpose: "email_change", token_hash: "change" }),
    ]);
    expect((await breakageMailDue("site-1", NOW)).due).toBe(true);
  });

  it("another customer's link is not this one's sign-in", async () => {
    seed({}, { first_signed_in_at: "2026-08-01T00:00:00.000Z" }, [
      link(2, { user_id: "user-2", token_hash: "someone-else" }),
    ]);
    expect((await breakageMailDue("site-1", NOW)).due).toBe(true);
  });
});

describe("a customer who has never signed in is the strongest form of the condition, not an exception", () => {
  it("no recorded sign-in at all is due", async () => {
    seed({}, { first_signed_in_at: null });
    expect((await breakageMailDue("site-1", NOW)).due).toBe(true);
  });

  it("a sign-in before the breakage is due", async () => {
    seed({}, { first_signed_in_at: new Date(BROKE_AT.getTime() - HOUR_MS).toISOString() });
    expect((await breakageMailDue("site-1", NOW)).due).toBe(true);
  });

  it("a site whose owner cannot be read is not mailed — there is nobody to write to", async () => {
    seed();
    db.seed("users", []);
    expect(await breakageMailDue("site-1", NOW)).toEqual({ due: false });
  });
});

describe("a disconnected destination is not a broken one", () => {
  it("a soft-deleted row is out of the live set and raises no occasion", async () => {
    seed({ deleted_at: "2026-09-05T00:00:00.000Z" });
    expect(await breakageMailDue("site-1", NOW)).toEqual({ due: false });
  });
});

describe("no further mail until it is reconnected and breaks again", () => {
  it("a second evaluation on the following day is not due", async () => {
    seed();
    await sendBreakageMail("site-1", NOW);
    const tomorrow = new Date(NOW.getTime() + 24 * HOUR_MS);
    expect(await breakageMailDue("site-1", tomorrow)).toEqual({ due: false });
    expect(await sendBreakageMail("site-1", tomorrow)).toEqual({ sent: false, reason: "not-due" });
    expect(mail.sent).toHaveLength(1);
  });

  it("reconnecting and breaking again makes it due once more", async () => {
    seed();
    await sendBreakageMail("site-1", NOW);
    // What a reconnect does to the row: `ok` clears the guard (`writeHealth`).
    const row = db.rows("destinations")[0]!;
    row.health = "ok";
    row.broken_mail_sent_at = null;
    // And it breaks again a week later.
    const later = new Date(NOW.getTime() + 7 * 24 * HOUR_MS);
    row.health = "expired";
    row.health_changed_at = new Date(later.getTime() - 24 * HOUR_MS).toISOString();
    expect((await breakageMailDue("site-1", later)).due).toBe(true);
  });
});

describe("the send stamps the guard, and only after the mail has gone", () => {
  it("one `account` mail, to the site's owner, carrying the held count", async () => {
    seed();
    const outcome = await sendBreakageMail("site-1", NOW);
    expect(outcome).toEqual({ sent: true, destinationId: "dest-1", held: 3 });
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]).toMatchObject({ kind: "account", to: "dana@example.com" });
  });

  it("the mail is built from keys and blocks: a subject key, a body, the count, an action and a way to reach a person", async () => {
    seed();
    await sendBreakageMail("site-1", NOW);
    const sent = mail.sent[0]!;
    expect(sent.subject).toBe("mail.account.destinationBroken.subject");
    expect(sent.blocks.map((b) => (b as { block: string }).block)).toEqual([
      "paragraph",
      "stat",
      "action",
      "notice",
    ]);
  });

  it("the guard is stamped after a send that went", async () => {
    seed();
    await sendBreakageMail("site-1", NOW);
    expect(db.rows("destinations")[0]!.broken_mail_sent_at).toBe(NOW.toISOString());
  });

  it("a send that did not go leaves the guard clear, so the next tick asks again", async () => {
    seed();
    mail.result = { sent: false, id: "" };
    expect(await sendBreakageMail("site-1", NOW)).toEqual({ sent: false, reason: "mail" });
    expect(db.rows("destinations")[0]!.broken_mail_sent_at).toBeNull();
    // And it is still due, which is the point of not stamping.
    expect((await breakageMailDue("site-1", NOW)).due).toBe(true);
  });

  it("it never throws: the daily loop it rides must not lose tomorrow's page to a mail that failed", async () => {
    db.reset();
    await expect(sendBreakageMail("site-1", NOW)).resolves.toEqual({
      sent: false,
      reason: "not-due",
    });
  });
});
