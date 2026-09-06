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
import { hashToken, issueVetoLink, redeemVeto, sameHash } from "@/lib/publish/publishable/veto";
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
  db.seed("sites", [{ id: "s1", mode: "autopilot", veto_hours: 24, publishing_enabled: true }]);
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

describe("hashing", () => {
  it("the hash is deterministic and the comparison is length-safe", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(sameHash(hashToken("abc"), hashToken("abc"))).toBe(true);
    expect(sameHash(hashToken("abc"), hashToken("abd"))).toBe(false);
    expect(sameHash("short", hashToken("abc"))).toBe(false);
  });
});
