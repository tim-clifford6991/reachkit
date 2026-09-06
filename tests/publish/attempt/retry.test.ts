// tests/publish/attempt/retry.test.ts — §9's "retry ×3", and the one
// legitimate rest.
//
// The property that carries the promise is the third one below: **no page
// rests in `failed` with neither a retry scheduled nor the move to
// `needs_attention` made** — driven over every reason × attempt-count pair,
// so an implementation that only ever retries fails it.
//
// The archived plan is WO-214.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { PUBLISH_RETRY_BACKOFF_MIN } from "@/lib/config/constants";
import { RETRYABLE } from "@/lib/publish/attempt";
import { MAX_RETRIES, decideRetry, scheduleRetry } from "@/lib/publish/attempt/retry";
import type { Actor, FailureReason } from "@/lib/publish/types";

const SYSTEM: Actor = { kind: "system", job: "publish/execute" };
const AT = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));

const ALL_REASONS: FailureReason[] = [
  "network",
  "timeout",
  "destination_unavailable",
  "rate_limited",
  "credentials_expired",
  "credentials_invalid",
  "dns_not_pointed",
  "destination_rejected",
  "no_destination",
];

function seed(state = "failed", over: Row = {}): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [{ id: "s1", mode: "autopilot", veto_hours: 24, publishing_enabled: true }]);
  db.seed("drafts", [
    {
      id: "d1",
      site_id: "s1",
      state,
      transitions: [],
      hard_rules_passed: true,
      publishable_since: "2026-09-10T00:00:00.000Z",
      veto_deadline: null,
      approved_at: null,
      ...over,
    },
  ]);
}

beforeEach(() => seed());

describe("the count comes from the backoff schedule, never a second number", () => {
  it("§9's three retries are the three entries of PUBLISH_RETRY_BACKOFF_MIN", () => {
    expect(MAX_RETRIES).toBe(PUBLISH_RETRY_BACKOFF_MIN.length);
    expect([...PUBLISH_RETRY_BACKOFF_MIN]).toEqual([5, 30, 180]);
  });
});

describe("retried only while the reason is one a repeated attempt could clear", () => {
  it.each(ALL_REASONS)("%s", (reason) => {
    const decision = decideRetry({ reason, attemptNo: 1, switchOn: true }, AT);
    if (RETRYABLE.includes(reason)) {
      expect(decision.kind).toBe("retry");
    } else {
      expect(decision).toEqual({ kind: "needs_attention", because: "reason_needs_customer" });
    }
  });

  it("a reason that needs the customer goes to needs_attention even while publishing is off", () => {
    expect(decideRetry({ reason: "credentials_expired", attemptNo: 1, switchOn: false }, AT)).toEqual({
      kind: "needs_attention",
      because: "reason_needs_customer",
    });
  });
});

describe("and at most three times, backed off from the pin", () => {
  it.each([
    [1, 5],
    [2, 30],
    [3, 180],
  ])("attempt %i schedules the next in %i minutes", (attemptNo, minutes) => {
    const decision = decideRetry({ reason: "network", attemptNo, switchOn: true }, AT);
    if (decision.kind !== "retry") throw new Error("expected a retry");
    expect(decision.dueAt.getTime()).toBe(AT.getTime() + minutes * 60_000);
    expect(decision.retryNo).toBe(attemptNo);
  });

  it("the fourth attempt is not retried — the third retry has failed", () => {
    expect(decideRetry({ reason: "network", attemptNo: 4, switchOn: true }, AT)).toEqual({
      kind: "needs_attention",
      because: "retries_exhausted",
    });
  });
});

describe("no page rests in failed with neither a retry scheduled nor that move made", () => {
  it("holds over every reason × attempt-count pair", () => {
    for (const reason of ALL_REASONS) {
      for (let attemptNo = 1; attemptNo <= 6; attemptNo++) {
        const decision = decideRetry({ reason, attemptNo, switchOn: true }, AT);
        expect(["retry", "needs_attention"], `${reason}@${attemptNo}`).toContain(decision.kind);
      }
    }
  });

  it("the one exception is publishing being off, and only for a retry that was due", () => {
    for (const reason of ALL_REASONS) {
      for (let attemptNo = 1; attemptNo <= 6; attemptNo++) {
        const off = decideRetry({ reason, attemptNo, switchOn: false }, AT);
        const on = decideRetry({ reason, attemptNo, switchOn: true }, AT);
        if (on.kind === "retry") {
          expect(off, `${reason}@${attemptNo}`).toEqual({ kind: "withheld" });
        } else {
          expect(off, `${reason}@${attemptNo}`).toEqual(on);
        }
      }
    }
  });
});

describe("the move to needs_attention is taken in the same invocation", () => {
  it("a reason the customer must clear moves the page at once", async () => {
    const decision = await scheduleRetry({
      draftId: "d1",
      siteId: "s1",
      reason: "credentials_expired",
      attemptNo: 1,
      by: SYSTEM,
      at: AT,
      switchOn: true,
    });
    expect(decision).toEqual({ kind: "needs_attention", because: "reason_needs_customer" });
    expect(db.rows("drafts")[0]?.state).toBe("needs_attention");
  });

  it("an exhausted retry moves the page at once too", async () => {
    await scheduleRetry({
      draftId: "d1", siteId: "s1", reason: "network", attemptNo: 4, by: SYSTEM, at: AT, switchOn: true,
    });
    expect(db.rows("drafts")[0]?.state).toBe("needs_attention");
  });

  it("a scheduled retry takes no edge — the page waits in failed for its due moment", async () => {
    const decision = await scheduleRetry({
      draftId: "d1", siteId: "s1", reason: "network", attemptNo: 1, by: SYSTEM, at: AT, switchOn: true,
    });
    expect(decision.kind).toBe("retry");
    expect(db.rows("drafts")[0]?.state).toBe("failed");
    expect(db.rpcCalls).toHaveLength(0);
  });
});

describe("with publishing off a due retry is withheld, and the page is held in failed", () => {
  it("no edge is taken and the page keeps its state", async () => {
    const decision = await scheduleRetry({
      draftId: "d1", siteId: "s1", reason: "network", attemptNo: 1, by: SYSTEM, at: AT, switchOn: false,
    });
    expect(decision).toEqual({ kind: "withheld" });
    expect(db.rows("drafts")[0]?.state).toBe("failed");
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("it is not brought to rest as needing the customer — that is the mutation this row catches", async () => {
    await scheduleRetry({
      draftId: "d1", siteId: "s1", reason: "network", attemptNo: 1, by: SYSTEM, at: AT, switchOn: false,
    });
    expect(db.rows("drafts")[0]?.state).not.toBe("needs_attention");
  });

  it("and becomes due again the moment publishing resumes", async () => {
    await scheduleRetry({
      draftId: "d1", siteId: "s1", reason: "network", attemptNo: 1, by: SYSTEM, at: AT, switchOn: false,
    });
    const resumed = await scheduleRetry({
      draftId: "d1", siteId: "s1", reason: "network", attemptNo: 1, by: SYSTEM, at: AT, switchOn: true,
    });
    expect(resumed.kind).toBe("retry");
  });

  it("the switch is read from the site when the caller does not supply it", async () => {
    db.rows("sites")[0]!.publishing_enabled = false;
    const decision = await scheduleRetry({
      draftId: "d1", siteId: "s1", reason: "network", attemptNo: 1, by: SYSTEM, at: AT,
    });
    expect(decision).toEqual({ kind: "withheld" });
  });

  it("a page held by the switch keeps its place in the resume order", async () => {
    await scheduleRetry({
      draftId: "d1", siteId: "s1", reason: "network", attemptNo: 1, by: SYSTEM, at: AT, switchOn: false,
    });
    expect(db.rows("drafts")[0]?.publishable_since).toBe("2026-09-10T00:00:00.000Z");
  });
});
