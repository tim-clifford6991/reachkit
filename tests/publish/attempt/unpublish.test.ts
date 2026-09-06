// tests/publish/attempt/unpublish.test.ts — one edge, five outcomes.
//
// Two rows here discriminate against implementations that pass everything
// else:
//
//  - **`unreachable`**, which is `ok: true` and must take the same edge as
//    the other four. An implementation that reads it as a failure and holds
//    the page in `published` passes every other row in this file and leaves
//    the customer's stop un-taken.
//  - **`named_for_removal`**, which no production adapter can return since
//    2026-09-01. It is the arm that would silently disappear if the union
//    were narrowed to today's reachable population, so it is driven from a
//    stub on purpose.
//
// The archived plan is WO-214.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { unpublish } from "@/lib/publish/attempt/unpublish";
import type { Actor, DestinationAdapter, UnpublishResult } from "@/lib/publish/types";

const CUSTOMER: Actor = { kind: "customer", userId: "u1" };
const AT = new Date(Date.UTC(2026, 8, 20, 12, 0, 0));
const SOURCE = path.resolve(import.meta.dirname, "../../../src/lib/publish/attempt/unpublish.ts");

function adapterReturning(result: UnpublishResult): DestinationAdapter {
  return {
    kind: "hosted",
    servesPublicly: true,
    hostedByUs: true,
    deliver: async () => ({ ok: true, madeLive: true }),
    unpublish: async () => result,
    health: async () => ({ health: "ok" as const, reason: null }),
  };
}

function seed(over: Row = {}, pubOver: Row = {}): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [{ id: "s1", mode: "autopilot", veto_hours: 24, publishing_enabled: true }]);
  // A hosted destination stores no credential — `connect` writes
  // `config: null` and nothing ever fills it — and the adapter is handed an
  // empty config for that reason (#54).
  db.seed("destinations", [
    { id: "dest-1", site_id: "s1", kind: "hosted", health: "ok", config: null },
  ]);
  db.seed("drafts", [
    {
      id: "d1",
      site_id: "s1",
      state: "published",
      transitions: [],
      hard_rules_passed: true,
      publishable_since: null,
      veto_deadline: null,
      approved_at: null,
      ...over,
    },
  ]);
  db.seed("publications", [
    {
      id: "pub-1",
      draft_id: "d1",
      site_id: "s1",
      destination: "hosted",
      delivery_state: "delivered",
      attempt_no: 1,
      claimed_at: "2026-09-15T12:00:00.000Z",
      published_at: "2026-09-15T12:00:00.000Z",
      unpublished_at: null,
      live_url: "https://c.example/a",
      remote_id: "post-7",
      failure_reason: null,
      mode: "autopilot",
      unpublish_outcome: null,
      made_live_by_us: true,
      verify_due_at: "2026-09-16T12:00:00.000Z",
      ...pubOver,
    },
  ]);
}

beforeEach(() => seed());

const FIVE = [
  { ok: true, outcome: "removed" },
  { ok: true, outcome: "returned_to_draft" },
  { ok: true, outcome: "named_for_removal" },
  { ok: true, outcome: "already_gone" },
  { ok: true, outcome: "unreachable", retryOffered: true },
] as const satisfies readonly UnpublishResult[];

describe("each of the five outcomes is returned unchanged and stored unchanged", () => {
  it.each(FIVE.map((r) => [r.outcome, r] as const))("%s", async (_name, result) => {
    seed();
    const answered = await unpublish({
      draftId: "d1",
      by: CUSTOMER,
      at: AT,
      adapterFor: () => adapterReturning(result),
    });
    expect(answered).toEqual(result);
    expect(db.rows("publications")[0]?.unpublish_outcome).toBe(result.outcome);
  });

  it("the state edge is identical in all five — published → unpublished, and unpublished_at set", async () => {
    for (const result of FIVE) {
      seed();
      await unpublish({ draftId: "d1", by: CUSTOMER, at: AT, adapterFor: () => adapterReturning(result) });
      expect(db.rows("drafts")[0]?.state, result.outcome).toBe("unpublished");
      expect(db.rows("publications")[0]?.unpublished_at, result.outcome).toBe(AT.toISOString());
    }
  });

  it("unreachable is ok: true and takes the edge — the customer's stop is taken either way", async () => {
    const answered = await unpublish({
      draftId: "d1",
      by: CUSTOMER,
      at: AT,
      adapterFor: () => adapterReturning({ ok: true, outcome: "unreachable", retryOffered: true }),
    });
    expect(answered).toMatchObject({ ok: true, retryOffered: true });
    expect(db.rows("drafts")[0]?.state).toBe("unpublished");
  });

  it("named_for_removal survives — the arm with no members in production", async () => {
    const answered = await unpublish({
      draftId: "d1",
      by: CUSTOMER,
      at: AT,
      adapterFor: () => adapterReturning({ ok: true, outcome: "named_for_removal" }),
    });
    expect(answered).toEqual({ ok: true, outcome: "named_for_removal" });
    expect(db.rows("publications")[0]?.unpublish_outcome).toBe("named_for_removal");
  });
});

describe("a failed unpublish changes nothing", () => {
  it("the page stays published and no outcome is recorded", async () => {
    const answered = await unpublish({
      draftId: "d1",
      by: CUSTOMER,
      at: AT,
      adapterFor: () => adapterReturning({ ok: false, reason: "credentials_expired" }),
    });
    expect(answered).toEqual({ ok: false, reason: "credentials_expired" });
    expect(db.rows("drafts")[0]?.state).toBe("published");
    expect(db.rows("publications")[0]?.unpublish_outcome).toBeNull();
    expect(db.rows("publications")[0]?.unpublished_at).toBeNull();
  });

  it("a destination with no adapter is no_destination, and nothing is written", async () => {
    const answered = await unpublish({ draftId: "d1", by: CUSTOMER, at: AT, adapterFor: () => null });
    expect(answered).toEqual({ ok: false, reason: "no_destination" });
    expect(db.rows("drafts")[0]?.state).toBe("published");
  });
});

describe("no publication row is ever deleted", () => {
  it("the row survives, carrying the address the page was published at", async () => {
    await unpublish({
      draftId: "d1",
      by: CUSTOMER,
      at: AT,
      adapterFor: () => adapterReturning({ ok: true, outcome: "removed" }),
    });
    expect(db.rows("publications")).toHaveLength(1);
    expect(db.rows("publications")[0]?.live_url).toBe("https://c.example/a");
    expect(db.queries.some((q) => q.verb !== "select" && q.verb !== "update" && q.verb !== "insert")).toBe(false);
  });

  it("a page taken down gains no post from a later attempt — unpublished is the source of no edge", async () => {
    await unpublish({
      draftId: "d1",
      by: CUSTOMER,
      at: AT,
      adapterFor: () => adapterReturning({ ok: true, outcome: "removed" }),
    });
    expect(db.rows("drafts")[0]?.state).toBe("unpublished");
    expect(db.rows("publications")).toHaveLength(1);
  });
});

describe("unpublish is available for as long as the page is published", () => {
  it("at the moment it published, and a year later", async () => {
    for (const at of [new Date("2026-09-15T12:00:01.000Z"), new Date("2027-09-15T12:00:00.000Z")]) {
      seed();
      const answered = await unpublish({
        draftId: "d1",
        by: CUSTOMER,
        at,
        adapterFor: () => adapterReturning({ ok: true, outcome: "removed" }),
      });
      expect(answered.ok, at.toISOString()).toBe(true);
      expect(db.rows("drafts")[0]?.state).toBe("unpublished");
    }
  });

  it("and the transition it takes is published → unpublished and nothing else", async () => {
    await unpublish({
      draftId: "d1",
      by: CUSTOMER,
      at: AT,
      adapterFor: () => adapterReturning({ ok: true, outcome: "removed" }),
    });
    const records = db.rows("drafts")[0]?.transitions as { from: string; to: string }[];
    expect(records.map((r) => `${r.from}→${r.to}`)).toEqual(["published→unpublished"]);
  });
});

describe("ADR-084 Decision 2 — the liveness branch is the adapter's, and not this function's", () => {
  const source = readFileSync(SOURCE, "utf8");
  const code = source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

  it("this file never names hostedByUs or servesPublicly", () => {
    expect(code).not.toContain("hostedByUs");
    expect(code).not.toContain("servesPublicly");
  });

  it("made_live_by_us is carried across once, in the row mapping, and compared with nothing", () => {
    expect(code.split("made_live_by_us")).toHaveLength(3); // the row shape and the mapping
    expect(code).not.toMatch(/if\s*\([^)]*made_live_by_us/);
    expect(code).not.toMatch(/if\s*\([^)]*madeLiveByUs/);
  });

  it("no outcome is switched on, mapped to a boolean, or given a different edge", () => {
    expect(code).not.toMatch(/switch\s*\(\s*result/);
    expect(code).not.toContain('"returned_to_draft"');
    expect(code).not.toContain('"named_for_removal"');
    expect(code).not.toContain('"already_gone"');
    expect(code).not.toContain('"unreachable"');
  });
});
