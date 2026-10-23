// tests/publish/publishable/veto.test.ts — REQ-057 c1, c4, c7.
//
// One hashed, single-use, draft-bound token; one transition; no link at a
// zero window; and no token in any log line.
//
// The archived plan is WO-217.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { fakeDb, installTransitionRpc, type FakeDb, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { VETO_TOKEN_BYTES } from "@/lib/config/constants";
import {
  hashToken,
  issueVetoLink,
  previewVetoLink,
  redeemVeto,
  redeemVetoLink,
  sameHash,
  vetoLinkPath,
} from "@/lib/publish/publishable/veto";
import type { Actor } from "@/lib/publish/types";

const BY: Actor = { kind: "customer", userId: "u1" };
const AT = new Date("2026-09-02T08:00:00Z");
const DEADLINE = new Date("2026-09-02T10:00:00Z");

/** `redeem_veto_token`, as the migration writes it: read, expiry check and
 *  use-marking in one statement, so a double click races on the row. */
function installRedeemRpc(target: FakeDb): void {
  target.rpcs.set("redeem_veto_token", (args: Row) => {
    const now = String(args.p_now);
    const row = target
      .rows("drafts")
      .find(
        (draft) =>
          draft.veto_token_hash === args.p_token_hash &&
          (draft.veto_token_used_at ?? null) === null &&
          (draft.veto_token_expires_at === null ||
            String(draft.veto_token_expires_at) > now)
      );
    if (row === undefined) return [];
    row.veto_token_used_at = now;
    return [{ draft_id: row.id, state: row.state }];
  });
}

function seed(over: Row = {}): void {
  db.reset();
  installTransitionRpc(db);
  installRedeemRpc(db);
  // `user_id` is here for #144: a link redeemed with no session takes its
  // actor from the draft's site's owner, so the seed has to have one.
  db.seed("sites", [
    { id: "s1", user_id: "u1", mode: "autopilot", veto_hours: 24, publishing_enabled: true },
  ]);
  db.seed("drafts", [
    {
      id: "d1",
      site_id: "s1",
      state: "in_review",
      veto_deadline: DEADLINE.toISOString(),
      veto_token_hash: null,
      veto_token_expires_at: null,
      veto_token_used_at: null,
      transitions: [],
      ...over,
    },
  ]);
}

function draftRow(): Row {
  const row = db.rows("drafts")[0];
  if (row === undefined) throw new Error("no draft row");
  return row;
}

beforeEach(() => seed());

describe('REQ-057 c1 — "is given a single action to stop it"', () => {
  it("issues a token whose one use stops the page", async () => {
    const link = await issueVetoLink("d1", AT);
    expect(link.token.length).toBeGreaterThan(0);
    expect(link.expiresAt?.toISOString()).toBe(DEADLINE.toISOString());

    const redeemed = await redeemVeto(link.token, BY, AT);
    expect(redeemed).toEqual({ ok: true, draftId: "d1" });
    expect(draftRow().state).toBe("skipped");
  });

  it("using it twice stops nothing further", async () => {
    const link = await issueVetoLink("d1", AT);
    await redeemVeto(link.token, BY, AT);
    const second = await redeemVeto(link.token, BY, AT);
    expect(second.ok).toBe(false);
    expect(draftRow().state).toBe("skipped");
    // One move, not two.
    expect((draftRow().transitions as unknown[]).length).toBe(1);
  });

  it("the token is stored only as its SHA-256 hash — a database read yields no usable link", async () => {
    const link = await issueVetoLink("d1", AT);
    const stored = String(draftRow().veto_token_hash);
    expect(stored).not.toContain(link.token);
    expect(stored).toBe(createHash("sha256").update(link.token, "utf8").digest("hex"));
  });

  it("the token carries the pinned entropy and is URL-safe", async () => {
    const link = await issueVetoLink("d1", AT);
    expect(link.token).toMatch(/^[A-Za-z0-9_-]+$/);
    // base64url of N bytes is ceil(4N/3) characters, unpadded.
    expect(link.token.length).toBe(Math.ceil((VETO_TOKEN_BYTES * 4) / 3));
  });

  it("two drafts never share a token", async () => {
    const first = await issueVetoLink("d1", AT);
    seed();
    const second = await issueVetoLink("d1", AT);
    expect(first.token).not.toBe(second.token);
  });
});

describe("the redemption takes exactly one transition, through the machine", () => {
  it("`in_review → skipped`, with a customer actor and the veto reason", async () => {
    const link = await issueVetoLink("d1", AT);
    await redeemVeto(link.token, BY, AT);
    const [record] = draftRow().transitions as { from: string; to: string; actor: Actor; reason?: string }[];
    expect(record?.from).toBe("in_review");
    expect(record?.to).toBe("skipped");
    expect(record?.actor).toEqual(BY);
    expect(record?.reason).toBe("veto");
  });

  it("it takes no other action — no publication row is written and no other table is touched", async () => {
    const link = await issueVetoLink("d1", AT);
    db.queries.length = 0;
    await redeemVeto(link.token, BY, AT);
    const tables = new Set(db.queries.map((q) => q.table));
    expect([...tables]).toEqual(["drafts"]);
  });
});

describe("refusals disclose nothing", () => {
  it("an unknown token is refused without naming a draft", async () => {
    const result = await redeemVeto("not-a-token", BY, AT);
    expect(result).toEqual({ ok: false, reason: "unknown" });
  });

  it("an empty token is refused before any read", async () => {
    db.queries.length = 0;
    db.rpcCalls.length = 0;
    expect(await redeemVeto("", BY, AT)).toEqual({ ok: false, reason: "unknown" });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("an expired token is refused, and says so rather than pretending it never existed", async () => {
    const link = await issueVetoLink("d1", AT);
    const afterDeadline = new Date(DEADLINE.getTime() + 60_000);
    expect(await redeemVeto(link.token, BY, afterDeadline)).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(draftRow().state).toBe("in_review");
  });

  it("a token for a draft that already left review returns `not_in_review`, which is what the surface reads to offer the take-down", async () => {
    const link = await issueVetoLink("d1", AT);
    draftRow().state = "published";
    expect(await redeemVeto(link.token, BY, AT)).toEqual({ ok: false, reason: "not_in_review" });
  });

  it("a token already used says `used`, and it is the token's own holder who is told (#144)", async () => {
    const link = await issueVetoLink("d1", AT);
    await redeemVeto(link.token, BY, AT);
    expect(await redeemVeto(link.token, BY, AT)).toEqual({ ok: false, reason: "used" });
  });

  it("a token both used and past its expiry reads as used — using it is what happened", async () => {
    const link = await issueVetoLink("d1", AT);
    await redeemVeto(link.token, BY, AT);
    const afterDeadline = new Date(DEADLINE.getTime() + 60_000);
    expect(await redeemVeto(link.token, BY, afterDeadline)).toEqual({ ok: false, reason: "used" });
  });

  it("`used` is reachable only by presenting the token: a near-miss discloses nothing", async () => {
    const link = await issueVetoLink("d1", AT);
    await redeemVeto(link.token, BY, AT);
    expect(await redeemVeto(`${link.token}x`, BY, AT)).toEqual({ ok: false, reason: "unknown" });
  });
});

// ── #144: the same redemption, from a link, with nobody signed in ─────────

describe("the link a mail carries redeems with no session, against the page's own owner", () => {
  it("the path is the one `src/middleware.ts` declares public, with the token escaped", () => {
    expect(vetoLinkPath("abc123")).toBe("/veto/abc123");
    expect(vetoLinkPath("a/b?c")).toBe("/veto/a%2Fb%3Fc");
  });

  it("one use stops the page, and the move is recorded against the site's owner, never an empty name", async () => {
    const link = await issueVetoLink("d1", AT);
    expect(await redeemVetoLink(link.token, AT)).toEqual({ ok: true, draftId: "d1" });
    expect(draftRow().state).toBe("skipped");
    const [record] = draftRow().transitions as { actor: Actor; reason?: string }[];
    expect(record?.actor).toEqual({ kind: "customer", userId: "u1" });
    expect(record?.reason).toBe("veto");
  });

  it("a second click stops nothing further and is told the link was already used", async () => {
    const link = await issueVetoLink("d1", AT);
    await redeemVetoLink(link.token, AT);
    expect(await redeemVetoLink(link.token, AT)).toEqual({ ok: false, reason: "used" });
    expect((draftRow().transitions as unknown[]).length).toBe(1);
  });

  it("it refuses an unknown token, and an empty one before any read", async () => {
    expect(await redeemVetoLink("not-a-token", AT)).toEqual({ ok: false, reason: "unknown" });
    db.rpcCalls.length = 0;
    expect(await redeemVetoLink("", AT)).toEqual({ ok: false, reason: "unknown" });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("an expired link still says so, rather than pretending it never existed", async () => {
    const link = await issueVetoLink("d1", AT);
    const afterDeadline = new Date(DEADLINE.getTime() + 60_000);
    expect(await redeemVetoLink(link.token, afterDeadline)).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(draftRow().state).toBe("in_review");
  });

  it("an owner it cannot read moves nothing — the same database that hid the account could not record the move either", async () => {
    const link = await issueVetoLink("d1", AT);
    db.rows("sites").length = 0;
    expect(await redeemVetoLink(link.token, AT)).toEqual({ ok: false, reason: "unknown" });
    expect(draftRow().state).toBe("in_review");
    expect(draftRow().veto_token_used_at).toBeNull();
  });
});

describe('REQ-057 c7 — "no window to stop it exists because they set none"', () => {
  it("at a zero window no token is issued and `expiresAt` is null", async () => {
    // A zero window puts the deadline at the moment the draft entered
    // review, which is at or before now.
    seed({ veto_deadline: AT.toISOString() });
    const link = await issueVetoLink("d1", AT);
    expect(link).toEqual({ token: "", expiresAt: null });
    expect(draftRow().veto_token_hash).toBeNull();
  });

  it("a draft with no deadline at all issues nothing either", async () => {
    seed({ veto_deadline: null });
    expect(await issueVetoLink("d1", AT)).toEqual({ token: "", expiresAt: null });
    expect(draftRow().veto_token_hash).toBeNull();
  });
});

describe("no token, hashed or otherwise, reaches a log line", () => {
  it("nothing this module writes to the log carries the token or its hash", async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((first: unknown) => {
      if (typeof first === "string") lines.push(first);
    });
    const link = await issueVetoLink("d1", AT);
    await redeemVeto(link.token, BY, AT);
    spy.mockRestore();
    const hash = hashToken(link.token);
    for (const line of lines) {
      expect(line).not.toContain(link.token);
      expect(line).not.toContain(hash);
    }
  });
});

describe("the stop page's read: why it was chosen, when the mail left, and the week after a stop", () => {
  const REASON = { points: 5, parts: [{ part: "ai_gap", n: 2 }], rule: null };
  /** The columns the read selects that the module's other cases leave unset. */
  const PAGE = { title: null, body_md: null, told: null, scheduled_for: null, opportunity_id: null };

  it("an open link carries the stored reason and the told record's send time", async () => {
    seed({ ...PAGE, opportunity_id: "o1", told: { pair: {}, kind: "interval", publishesAt: null, sentAt: "2026-09-02T07:00:00.000Z", mailed: true } });
    db.seed("opportunities", [{ id: "o1", site_id: "s1", target_query: "q", volume: 10, plan_reason: REASON }]);
    const link = await issueVetoLink("d1", AT);
    const read = await previewVetoLink(link.token, AT);
    if (!read.ok) throw new Error(`expected an open link, got ${read.reason}`);
    expect(read.preview.reason).toEqual(REASON);
    expect(read.preview.mailedAt?.toISOString()).toBe("2026-09-02T07:00:00.000Z");
  });

  it("a page told with its mail off, or never told, names no send time; one chosen before reasons names no reason", async () => {
    for (const told of [null, { pair: {}, kind: "interval", publishesAt: null, sentAt: "2026-09-02T07:00:00.000Z", mailed: false }]) {
      seed({ ...PAGE, opportunity_id: "o1", told });
      db.seed("opportunities", [{ id: "o1", site_id: "s1", target_query: "q", volume: 10, plan_reason: null }]);
      const read = await previewVetoLink((await issueVetoLink("d1", AT)).token, AT);
      if (!read.ok) throw new Error(`expected an open link, got ${read.reason}`);
      expect(read.preview.mailedAt).toBeNull();
      expect(read.preview.reason).toBeNull();
    }
  });

  it("a hosted address still waiting for its record names no go-live moment; once live it names one", async () => {
    seed({ ...PAGE, approved_at: null, approved_by: null, hard_rules_passed: true, publishable_since: null });
    Object.assign(db.rows("sites")[0]!, { timezone: "Europe/Berlin", publish_time: "09:00" });
    db.seed("destinations", [
      { id: "dest-1", site_id: "s1", kind: "hosted", hostname: "pages.example.com", hostname_state: "pending_dns", deleted_at: null },
    ]);
    const token = (await issueVetoLink("d1", AT)).token;
    const waiting = await previewVetoLink(token, AT);
    if (!waiting.ok) throw new Error(`expected an open link, got ${waiting.reason}`);
    expect(waiting.preview.unconnected).toBe(true);
    expect(waiting.preview.publishes).toBeNull();

    db.rows("destinations")[0]!.hostname_state = "live";
    const live = await previewVetoLink(token, AT);
    if (!live.ok) throw new Error(`expected an open link, got ${live.reason}`);
    expect(live.preview.unconnected).toBe(false);
    expect(live.preview.publishes?.timeZone).toBe("Europe/Berlin");
  });

  it("a spent link reads its page's Monday-to-Sunday week: stopped, going ahead, or nothing claimed", async () => {
    // Wednesday 2 September 2026; its week runs Monday 31 August to Sunday 6 September.
    seed({ ...PAGE, scheduled_for: "2026-09-02" });
    db.rows("drafts").push(
      { id: "d0", site_id: "s1", state: "published", scheduled_for: "2026-08-31" },
      { id: "d9", site_id: "s1", state: "approved", scheduled_for: "2026-09-07" },
      { id: "dx", site_id: "other", state: "skipped", scheduled_for: "2026-09-03" }
    );
    db.seed("opportunities", [
      { id: "o2", site_id: "s1", status: "open", planned_for: "2026-09-04" },
      { id: "o3", site_id: "s1", status: "dismissed", stopped: true, planned_for: "2026-09-05" },
    ]);
    const link = await issueVetoLink("d1", AT);
    await redeemVetoLink(link.token, AT);
    const read = await previewVetoLink(link.token, AT);
    if (read.ok || read.reason !== "used") throw new Error("expected a spent link");
    expect(read.week).toEqual([
      { date: "2026-08-31", stopped: false },
      { date: "2026-09-01", stopped: null },
      { date: "2026-09-02", stopped: true },
      { date: "2026-09-03", stopped: null },
      { date: "2026-09-04", stopped: false },
      // A planned page stopped before writing: a spare may take the day, so it claims nothing.
      { date: "2026-09-05", stopped: null },
      { date: "2026-09-06", stopped: null },
    ]);
  });

  it("a week it cannot read is no week, never a guessed one", async () => {
    seed({ ...PAGE, scheduled_for: "2026-09-02" });
    const link = await issueVetoLink("d1", AT);
    await redeemVetoLink(link.token, AT);
    db.unreadable.add("opportunities");
    const read = await previewVetoLink(link.token, AT);
    if (read.ok || read.reason !== "used") throw new Error("expected a spent link");
    expect(read.week).toBeNull();
  });
});

describe("hashing", () => {
  it("the hash is deterministic and the comparison is length-safe", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(sameHash(hashToken("abc"), hashToken("abc"))).toBe(true);
    expect(sameHash(hashToken("abc"), hashToken("abd"))).toBe(false);
    expect(sameHash("short", hashToken("abc"))).toBe(false);
  });
});
