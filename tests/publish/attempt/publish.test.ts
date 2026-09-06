// tests/publish/attempt/publish.test.ts — the delivery after the claim, and
// the outcome written exactly as it happened.
//
// The discriminating pair is the `made_live_by_us` one: a stub returning
// `madeLive: true` with **no** address must still store `true`, and one
// returning `madeLive: false` **with** an address must still store `false`.
// The fixtures are contradictory on purpose — they are the only rows that
// fail against an implementation deriving the column from `live_url != null`
// or from the destination kind, and every other row here passes against the
// wrong ones too.
//
// The archived plan is WO-213.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { PUBLISH_VERIFY_DELAY_H } from "@/lib/config/constants";
import { RETRYABLE, publish } from "@/lib/publish/attempt";
import type { GuardDeps } from "@/lib/publish/machine";
import type {
  Actor,
  DeliveryResult,
  DestinationAdapter,
  DestinationKind,
  UnpublishResult,
} from "@/lib/publish/types";

const SYSTEM: Actor = { kind: "system", job: "publish/execute" };
const AT = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));

function openDeps(over: Partial<GuardDeps> = {}): GuardDeps {
  return {
    isPublishingOn: async () => true,
    hasCeilingRoom: async () => true,
    destinationWorking: async () => true,
    rule: { becomesPublishable: () => true, toldCurrentPair: () => true },
    ...over,
  };
}

/** A stub adapter that declares what it did. `servesPublicly` and
 *  `hostedByUs` are set independently of the delivery, so a test can prove
 *  the outcome is read from `madeLive` and not from either of them. */
function stubAdapter(
  result: DeliveryResult,
  over: Partial<DestinationAdapter> = {}
): DestinationAdapter {
  return {
    kind: "hosted",
    servesPublicly: true,
    hostedByUs: true,
    deliver: async () => result,
    unpublish: async (): Promise<UnpublishResult> => ({ ok: true, outcome: "removed" }),
    health: async () => "ok",
    ...over,
  };
}

function seed(over: Row = {}): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [
    { id: "s1", mode: "autopilot", veto_hours: 24, publishing_enabled: true, timezone: "America/New_York" },
  ]);
  db.seed("destinations", [{ id: "dest-1", site_id: "s1", kind: "hosted", health: "ok", config: {} }]);
  db.seed("opportunities", [{ id: "o1", proposed_slug: "best-widgets" }]);
  db.seed("drafts", [
    {
      id: "d1",
      site_id: "s1",
      opportunity_id: "o1",
      state: "approved",
      title: "Best widgets",
      body_md: "# Best widgets",
      meta: {},
      transitions: [],
      hard_rules_passed: true,
      publishable_since: null,
      veto_deadline: null,
      approved_at: null,
      ...over,
    },
  ]);
  db.seed("publications", []);
}

function pub(): Row {
  const row = db.rows("publications")[0];
  if (row === undefined) throw new Error("no publication row");
  return row;
}

beforeEach(() => seed());

describe("RETRYABLE is the four reasons a repeated attempt could clear", () => {
  it("names them and no other", () => {
    expect([...RETRYABLE]).toEqual(["network", "timeout", "destination_unavailable", "rate_limited"]);
  });
});

describe("the adapter is called after the claim has written the row, never before", () => {
  it("the publication row exists at the moment deliver runs", async () => {
    let rowsAtDelivery = -1;
    const adapter = stubAdapter({ ok: true, madeLive: true, liveUrl: "https://c.example/a" });
    const watching: DestinationAdapter = {
      ...adapter,
      deliver: async () => {
        rowsAtDelivery = db.rows("publications").length;
        return { ok: true, madeLive: true, liveUrl: "https://c.example/a" };
      },
    };
    await publish({
      draftId: "d1",
      destination: "hosted",
      by: SYSTEM,
      at: AT,
      deps: openDeps(),
      adapterFor: () => watching,
    });
    expect(rowsAtDelivery).toBe(1);
  });

  it("a held claim never reaches the adapter at all", async () => {
    const deliver = vi.fn();
    await publish({
      draftId: "d1",
      destination: "hosted",
      by: SYSTEM,
      at: AT,
      deps: openDeps({ isPublishingOn: async () => false }),
      adapterFor: () => stubAdapter({ ok: true, madeLive: true }, { deliver }),
    });
    expect(deliver).not.toHaveBeenCalled();
  });

  it("a claim that found a delivered row never reaches the adapter either", async () => {
    db.rows("publications").push({
      id: "pub-1",
      draft_id: "d1",
      site_id: "s1",
      destination: "hosted",
      delivery_state: "delivered",
      attempt_no: 1,
      mode: "autopilot",
      live_url: "https://c.example/a",
      made_live_by_us: true,
    });
    const deliver = vi.fn();
    const result = await publish({
      draftId: "d1",
      destination: "hosted",
      by: SYSTEM,
      at: AT,
      deps: openDeps(),
      adapterFor: () => stubAdapter({ ok: true, madeLive: true }, { deliver }),
    });
    expect(deliver).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, alreadyPublished: true, liveUrl: "https://c.example/a" });
    expect(db.rows("drafts")[0]?.state).toBe("published");
  });
});

describe("ADR-084 Decision 4 — made_live_by_us is the adapter's own statement", () => {
  it("madeLive true with an address stores true", async () => {
    await publish({
      draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(),
      adapterFor: () => stubAdapter({ ok: true, madeLive: true, liveUrl: "https://c.example/a" }),
    });
    expect(pub().made_live_by_us).toBe(true);
  });

  it("madeLive false with no address stores false", async () => {
    await publish({
      draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(),
      adapterFor: () => stubAdapter({ ok: true, madeLive: false }),
    });
    expect(pub().made_live_by_us).toBe(false);
  });

  it("madeLive true with NO address still stores true — not live_url != null", async () => {
    await publish({
      draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(),
      adapterFor: () => stubAdapter({ ok: true, madeLive: true, liveUrl: undefined }),
    });
    expect(pub().made_live_by_us).toBe(true);
    expect(pub().live_url).toBeNull();
  });

  it("madeLive false WITH an address still stores false — not live_url != null", async () => {
    await publish({
      draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(),
      adapterFor: () => stubAdapter({ ok: true, madeLive: false, liveUrl: "https://c.example/a" }),
    });
    expect(pub().made_live_by_us).toBe(false);
    expect(pub().live_url).toBe("https://c.example/a");
  });

  it("it is not servesPublicly and not hostedByUs either", async () => {
    await publish({
      draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(),
      adapterFor: () =>
        stubAdapter(
          { ok: true, madeLive: false, liveUrl: "https://c.example/a" },
          { servesPublicly: true, hostedByUs: true }
        ),
    });
    expect(pub().made_live_by_us).toBe(false);
  });
});

describe("verify_due_at reads the address, never the kind", () => {
  it.each(["hosted", "wordpress", "ghost"] as const)(
    "a %s delivery that returned an address is due at published_at + 24h",
    async (kind) => {
      seed();
      await publish({
        draftId: "d1",
        destination: kind as DestinationKind,
        by: SYSTEM,
        at: AT,
        deps: openDeps(),
        adapterFor: () =>
          stubAdapter(
            { ok: true, madeLive: true, liveUrl: "https://c.example/a" },
            { kind: kind as DestinationKind }
          ),
      });
      expect(pub().verify_due_at).toBe(
        new Date(AT.getTime() + PUBLISH_VERIFY_DELAY_H * 3600_000).toISOString()
      );
    }
  );

  it.each(["hosted", "wordpress", "ghost"] as const)(
    "a %s delivery that returned no address is due for no check",
    async (kind) => {
      seed();
      await publish({
        draftId: "d1",
        destination: kind as DestinationKind,
        by: SYSTEM,
        at: AT,
        deps: openDeps(),
        adapterFor: () =>
          stubAdapter({ ok: true, madeLive: true }, { kind: kind as DestinationKind }),
      });
      expect(pub().verify_due_at).toBeNull();
    }
  );
});

describe("the outcome is written exactly as it happened", () => {
  it("a delivered page carries the mode, the address and the remote id", async () => {
    await publish({
      draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(),
      adapterFor: () =>
        stubAdapter({ ok: true, madeLive: true, liveUrl: "https://c.example/a", remoteId: "post-7" }),
    });
    expect(pub()).toMatchObject({
      delivery_state: "delivered",
      published_at: AT.toISOString(),
      live_url: "https://c.example/a",
      remote_id: "post-7",
      failure_reason: null,
      mode: "autopilot",
    });
    expect(db.rows("drafts")[0]?.state).toBe("published");
  });

  it("a copilot page is recorded as approved, not autopilot", async () => {
    seed();
    db.rows("sites")[0]!.mode = "copilot";
    await publish({
      draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(),
      adapterFor: () => stubAdapter({ ok: true, madeLive: true, liveUrl: "https://c.example/a" }),
    });
    expect(pub().mode).toBe("approved");
  });

  it("a failed delivery writes its reason and the page becomes failed", async () => {
    const result = await publish({
      draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(),
      adapterFor: () => stubAdapter({ ok: false, madeLive: false, reason: "rate_limited" }),
    });
    expect(result).toEqual({ ok: false, reason: "rate_limited", retryable: true, attemptNo: 1 });
    expect(pub()).toMatchObject({ delivery_state: "failed", failure_reason: "rate_limited" });
    expect(pub().published_at ?? null).toBeNull();
    expect(db.rows("drafts")[0]?.state).toBe("failed");
  });

  it("an adapter that threw is a retryable timeout, and no address is invented", async () => {
    const result = await publish({
      draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(),
      adapterFor: () =>
        stubAdapter(
          { ok: true, madeLive: true },
          {
            deliver: async () => {
              throw new Error("socket hang up");
            },
          }
        ),
    });
    expect(result).toEqual({ ok: false, reason: "timeout", retryable: true, attemptNo: 1 });
    expect(pub().live_url ?? null).toBeNull();
  });

  it("a destination with no adapter is no_destination, and is not retryable", async () => {
    const result = await publish({
      draftId: "d1", destination: "wordpress", by: SYSTEM, at: AT, deps: openDeps(),
      adapterFor: () => null,
    });
    expect(result).toEqual({ ok: false, reason: "no_destination", retryable: false, attemptNo: 1 });
    expect(db.rows("drafts")[0]?.state).toBe("failed");
  });

  it("an attempt under way when the switch is recorded runs to a known outcome, written as it happened", async () => {
    let switchedOff = false;
    const result = await publish({
      draftId: "d1",
      destination: "hosted",
      by: SYSTEM,
      at: AT,
      deps: openDeps({ isPublishingOn: async () => !switchedOff }),
      adapterFor: () =>
        stubAdapter(
          { ok: true, madeLive: true },
          {
            deliver: async () => {
              // The customer switches publishing off mid-delivery.
              switchedOff = true;
              db.rows("sites")[0]!.publishing_enabled = false;
              return { ok: true, madeLive: true, liveUrl: "https://c.example/a" };
            },
          }
        ),
    });
    expect(result).toMatchObject({ ok: true, liveUrl: "https://c.example/a" });
    expect(pub().delivery_state).toBe("delivered");
    expect(db.rows("drafts")[0]?.state).toBe("published");
  });
});

describe("the page handed to the adapter is the draft's own facts", () => {
  it("title, slug and body, and no sentence composed here", async () => {
    let handed: unknown = null;
    await publish({
      draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(),
      adapterFor: () =>
        stubAdapter(
          { ok: true, madeLive: true },
          {
            deliver: async (page) => {
              handed = page;
              return { ok: true, madeLive: true };
            },
          }
        ),
    });
    expect(handed).toEqual({
      title: "Best widgets",
      slug: "best-widgets",
      bodyMd: "# Best widgets",
      meta: {},
    });
  });

  it("the idempotency key is the draft id, so a re-delivery finds the same post", async () => {
    let key = "";
    await publish({
      draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(),
      adapterFor: () =>
        stubAdapter(
          { ok: true, madeLive: true },
          {
            deliver: async (_page, _cfg, idempotencyKey) => {
              key = idempotencyKey;
              return { ok: true, madeLive: true };
            },
          }
        ),
    });
    expect(key).toBe("d1");
  });
});
