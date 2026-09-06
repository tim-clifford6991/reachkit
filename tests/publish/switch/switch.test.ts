// tests/publish/switch/switch.test.ts — BUILD §9's publishing switch.
//
// Four promises, each with the assertion that would fail if it were lost:
// recording the switch moves no page; a held page keeps the state it holds;
// the resume order is the order they were held and drops none; and the held
// count is derived, not stored.
//
// The archived plan is WO-210.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb, installTransitionRpc, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { heldPages, isPublishingOn, reachKitStopped, resumeOrder, setPublishing } from "@/lib/publish/switch";
import { DEFAULT_GUARD_DEPS, transition } from "@/lib/publish/machine";
import type { Actor } from "@/lib/publish/types";

const CUSTOMER: Actor = { kind: "customer", userId: "u1" };
const AT = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));

function draft(id: string, state: string, publishableSince: string | null): Row {
  return {
    id,
    site_id: "s1",
    state,
    publishable_since: publishableSince,
    transitions: [],
    hard_rules_passed: true,
    veto_deadline: null,
    approved_at: null,
  };
}

beforeEach(() => {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [
    { id: "s1", mode: "autopilot", veto_hours: 24, publishing_enabled: true, timezone: "America/New_York" },
  ]);
});

describe("the switch is a stored fact, read where the decision is made", () => {
  it("a site that has never touched it is publishing", async () => {
    expect(await isPublishingOn("s1")).toBe(true);
  });

  it("recording it off is visible to the next read", async () => {
    await setPublishing("s1", false, CUSTOMER);
    expect(await isPublishingOn("s1")).toBe(false);
  });

  it("a site whose row cannot be read is not publishing — never a default that lets an attempt begin", async () => {
    expect(await isPublishingOn("no-such-site")).toBe(false);
  });

  it("recording it returns the moment §9's promise is stated against", async () => {
    const before = Date.now();
    const { recordedAt } = await setPublishing("s1", false, CUSTOMER);
    expect(recordedAt.getTime()).toBeGreaterThanOrEqual(before);
    const site = db.rows("sites")[0];
    expect(site?.publishing_changed_at).toBe(recordedAt.toISOString());
    expect(site?.publishing_changed_by).toBe("customer");
  });
});

describe("recording the switch changes no draft's state", () => {
  it("every held page keeps the state it holds — none is skipped, discarded or moved to needs_attention", async () => {
    db.seed("drafts", [
      draft("approved-1", "approved", "2026-09-10T00:00:00.000Z"),
      draft("veto-expired", "in_review", "2026-09-11T00:00:00.000Z"),
      draft("time-arrived", "approved", "2026-09-12T00:00:00.000Z"),
      draft("retry-due", "failed", "2026-09-13T00:00:00.000Z"),
    ]);
    const states = db.rows("drafts").map((row) => row.state);

    await setPublishing("s1", false, CUSTOMER);

    expect(db.rows("drafts").map((row) => row.state)).toEqual(states);
    expect(db.rpcCalls).toHaveLength(0);
    expect(db.rows("drafts").some((row) => row.state === "skipped")).toBe(false);
    expect(db.rows("drafts").some((row) => row.state === "needs_attention")).toBe(false);
  });
});

describe("the held set is derived, never stored", () => {
  beforeEach(() => {
    db.seed("drafts", [
      draft("approved-1", "approved", "2026-09-10T00:00:00.000Z"),
      draft("veto-expired", "in_review", "2026-09-11T00:00:00.000Z"),
      draft("time-arrived", "approved", "2026-09-12T00:00:00.000Z"),
      draft("retry-due", "failed", "2026-09-13T00:00:00.000Z"),
      // Not held: it never became publishable.
      draft("planned-1", "planned", null),
      // Not held: it has gone out.
      draft("published-1", "published", null),
      // Not held: another site's.
      { ...draft("other-site", "approved", "2026-09-09T00:00:00.000Z"), site_id: "s2" },
    ]);
  });

  it("counts the four kinds §9 names and nothing else", async () => {
    const held = await heldPages("s1");
    expect(held.count).toBe(4);
    expect(held.draftIds).toEqual([
      "approved-1",
      "veto-expired",
      "time-arrived",
      "retry-due",
    ]);
  });

  it("reads no column named held, and writes none", async () => {
    await heldPages("s1");
    const reads = db.queries.filter((q) => q.table === "drafts");
    expect(reads.every((q) => q.verb === "select")).toBe(true);
    expect(reads.some((q) => (q.columns ?? "").includes("held"))).toBe(false);
    expect(db.rows("drafts").some((row) => "held" in row)).toBe(false);
  });

  it("makes one query and reads no settings table", async () => {
    db.queries.length = 0;
    await heldPages("s1");
    expect(db.queries).toHaveLength(1);
    expect(db.queries[0]?.table).toBe("drafts");
  });
});

describe("resume order is the order they were held, oldest first, and drops none", () => {
  it("a backlog of thirty returns thirty ids in publishable_since order", async () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      draft(`d${String(29 - i).padStart(2, "0")}`, "approved", `2026-09-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`)
    );
    db.seed("drafts", rows);

    const order = await resumeOrder("s1");
    expect(order).toHaveLength(30);
    expect(order[0]).toBe("d29");
    expect(order[29]).toBe("d00");
  });

  it("switching off and on again returns the same set in the same order", async () => {
    db.seed("drafts", [
      draft("b", "approved", "2026-09-11T00:00:00.000Z"),
      draft("a", "failed", "2026-09-10T00:00:00.000Z"),
      draft("c", "in_review", "2026-09-12T00:00:00.000Z"),
    ]);
    const before = await resumeOrder("s1");
    await setPublishing("s1", false, CUSTOMER);
    await setPublishing("s1", true, CUSTOMER);
    expect(await resumeOrder("s1")).toEqual(before);
    expect(before).toEqual(["a", "b", "c"]);
  });

  it("two pages held in the same instant still resume in a stable order", async () => {
    db.seed("drafts", [
      draft("z", "approved", "2026-09-10T00:00:00.000Z"),
      draft("a", "approved", "2026-09-10T00:00:00.000Z"),
    ]);
    expect(await resumeOrder("s1")).toEqual(["a", "z"]);
  });
});

describe("REQ-092 c5 — a ReachKit stop is a second reason to hold, not a second mechanism", () => {
  const KILL_SWITCH = process.env.KILL_SWITCH;
  afterEach(() => {
    if (KILL_SWITCH === undefined) delete process.env.KILL_SWITCH;
    else process.env.KILL_SWITCH = KILL_SWITCH;
    vi.resetModules();
  });

  async function stopped(engaged: boolean): Promise<boolean> {
    // `env` parses `process.env` once per module instance, so the binding
    // is set and the module graph reset before the dep reads it.
    applyEnvFixture();
    process.env.KILL_SWITCH = engaged ? "true" : "false";
    vi.resetModules();
    const { reachKitStopped: read } = await import("@/lib/publish/switch");
    return read();
  }

  it("reads §11's halt, the one stop shape that reaches a delivery", async () => {
    expect(await stopped(true)).toBe(true);
    expect(await stopped(false)).toBe(false);
  });

  it("is the function the machine's default deps carry", () => {
    // Statically imported on both sides: the dynamic import above hands
    // back a fresh module instance, which is not the one the machine holds.
    expect(DEFAULT_GUARD_DEPS.reachKitStopped).toBe(reachKitStopped);
  });

  it("the held set does not ask why a page is held, so a stop and a pause return the same pages", async () => {
    db.seed("drafts", [
      draft("approved-1", "approved", "2026-09-10T00:00:00.000Z"),
      draft("in-review-1", "in_review", "2026-09-11T00:00:00.000Z"),
      draft("retry-due", "failed", "2026-09-12T00:00:00.000Z"),
    ]);
    const whileRunning = await heldPages("s1");

    // A stop begins. It writes nothing — there is nothing for it to write —
    // so the same three pages are held, in the same order.
    await setPublishing("s1", false, CUSTOMER);
    const underAStop = await heldPages("s1");

    expect(underAStop).toEqual(whileRunning);
    expect(underAStop.draftIds).toEqual(["approved-1", "in-review-1", "retry-due"]);
    expect(db.rows("drafts").map((row) => row.state)).toEqual([
      "approved",
      "in_review",
      "failed",
    ]);
  });

  it("a draft in review or approved when a stop begins resumes in delivery order once it lifts", async () => {
    db.seed("drafts", [
      draft("third", "approved", "2026-09-12T00:00:00.000Z"),
      draft("first", "in_review", "2026-09-10T00:00:00.000Z"),
      draft("second", "approved", "2026-09-11T00:00:00.000Z"),
    ]);
    const before = await resumeOrder("s1");
    expect(before).toEqual(["first", "second", "third"]);

    // The stop runs and lifts. No page was skipped, none was marked
    // published, and the backlog drains in the order it accrued.
    expect(await resumeOrder("s1")).toEqual(before);
    expect(db.rows("drafts").some((row) => row.state === "skipped")).toBe(false);
    expect(db.rows("drafts").some((row) => row.state === "published")).toBe(false);
  });
});

describe("a page held while the switch is off keeps its place in the order", () => {
  it("a failed page that is retried and fails again keeps its original publishable_since", async () => {
    db.seed("drafts", [draft("d1", "failed", "2026-09-10T00:00:00.000Z")]);
    await transition("d1", "publishing", CUSTOMER, {
      at: AT,
      deps: {
        reachKitStopped: async () => false,
        isPublishingOn: async () => true,
        hasCeilingRoom: async () => true,
        destinationWorking: async () => true,
        rule: { becomesPublishable: () => true, toldCurrentPair: () => true },
      },
    });
    await transition("d1", "failed", CUSTOMER, { at: AT });
    expect(db.rows("drafts")[0]?.publishable_since).toBe("2026-09-10T00:00:00.000Z");
  });
});
