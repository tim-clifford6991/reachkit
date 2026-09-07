// tests/publish/destinations/health/cannot-publish.test.ts — ADR-086: a
// credential that can create posts and cannot publish them is its own
// occasion, and it costs no fourth state.
//
// Three prohibitions have an assertion each, and **none of them would fail
// on the ordinary expired-credential path**, which is why they are written
// separately:
//
//  1. the view never carries the held-pages line in this state — the
//     credential is valid and the page has already failed rather than been
//     held;
//  2. the action is never `reconnect` — re-entering the same, perfectly
//     valid credential is the one action guaranteed to change nothing;
//  3. the line is not written from `heldPages` — the same fixture at 0 and
//     at 7 returns the identical key.
//
// The archived plans are WO-265, WO-266.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const probe = vi.hoisted(() => ({
  answer: { health: "ok" as "ok" | "expired" | "error", reason: null as string | null },
  capable: true as boolean | "throws",
  probes: 0,
  writes: 0,
}));

vi.mock("@/lib/egress", () => ({ resolvesInDns: async () => true }));

vi.mock("@/lib/publish/destinations/registry", () => ({
  adapterFor: (kind: string) =>
    kind === "unknown"
      ? null
      : {
          kind,
          servesPublicly: true,
          hostedByUs: kind === "hosted",
          deliver: async () => {
            probe.writes += 1;
            return { ok: true, madeLive: true };
          },
          unpublish: async () => {
            probe.writes += 1;
            return { ok: true, outcome: "removed" };
          },
          health: async () => probe.answer,
          // A destination ReachKit runs draws no such distinction, so
          // `hosted` declares no probe — the absence is the fact.
          ...(kind === "hosted"
            ? {}
            : {
                canPublish: async () => {
                  probe.probes += 1;
                  if (probe.capable === "throws") throw new Error("could not ask");
                  return probe.capable;
                },
              }),
        },
}));

import { checkHealth, ensureFreshHealth, publishCapability, __resetHealthDebounceForTesting } from "@/lib/publish/destinations/health";
import { destinationView } from "@/lib/publish/destinations/view";
import { seal } from "@/lib/publish/destinations/config";
import type { DestinationHealth } from "@/lib/publish/types";

const CREDENTIAL = { baseUrl: "https://blog.example.com", username: "u", applicationPassword: "p" };

function seedSite(over: Row = {}): void {
  db.seed("sites", [
    { id: "site-1", user_id: "user-1", domain: "example.com", publishing_enabled: true, ...over },
  ]);
}

function seedDestination(over: Row = {}): void {
  db.seed("destinations", [
    {
      id: "dest-1",
      site_id: "site-1",
      kind: "wordpress",
      config: seal(CREDENTIAL),
      health: "ok",
      health_reason: null,
      health_changed_at: "2026-09-01T00:00:00.000Z",
      broken_mail_sent_at: null,
      last_checked_at: new Date().toISOString(),
      created_at: "2026-09-01T00:00:00.000Z",
      deleted_at: null,
      publish_capable: null,
      ...over,
    },
  ]);
}

beforeEach(() => {
  db.reset();
  probe.answer = { health: "ok", reason: null };
  probe.capable = true;
  probe.probes = 0;
  probe.writes = 0;
  __resetHealthDebounceForTesting();
});

describe("the probe runs beside the state read, and what it found is recorded", () => {
  it("a credential that can publish leaves the destination working, and the row says so", async () => {
    seedSite();
    seedDestination();
    expect(await checkHealth("dest-1")).toMatchObject({ health: "ok", reason: null });
    expect(probe.probes).toBe(1);
    expect(db.rows("destinations")[0]?.publish_capable).toBe(true);
    expect(await publishCapability("dest-1")).toBe(true);
  });

  it("a credential that cannot publish is error / cannot_publish, however healthy the site's own end reads", async () => {
    seedSite();
    seedDestination();
    probe.capable = false;
    probe.answer = { health: "ok", reason: null };
    expect(await checkHealth("dest-1")).toMatchObject({
      health: "error",
      reason: "cannot_publish",
    });
    expect(db.rows("destinations")[0]?.publish_capable).toBe(false);
  });

  it("it holds the queue: a destination in this state is not working, so no page is delivered there", async () => {
    seedSite();
    seedDestination();
    probe.capable = false;
    await checkHealth("dest-1");
    const { destinationWorking } = await import("@/lib/publish/destinations");
    expect(await destinationWorking("site-1")).toBe(false);
  });

  it("**re-entering the same credential does not clear it** — the probe decides, not the act of reconnecting", async () => {
    seedSite();
    seedDestination();
    probe.capable = false;
    await checkHealth("dest-1");
    const { reconnect } = await import("@/lib/publish/destinations");
    const result = await reconnect({
      destinationId: "dest-1",
      config: CREDENTIAL,
      by: { kind: "customer", userId: "user-1" },
    });
    expect(result).toEqual({ ok: false, reason: "cannot_publish" });
  });

  it("a probe that could not be asked writes nothing, and does not become `false`", async () => {
    seedSite();
    seedDestination();
    probe.capable = "throws";
    probe.answer = { health: "ok", reason: null };
    expect(await checkHealth("dest-1")).toMatchObject({ health: "ok" });
    expect(db.rows("destinations")[0]?.publish_capable).toBeNull();
  });

  it("a hosted destination is never asked, and its capability is null rather than false", async () => {
    seedSite();
    seedDestination({ kind: "hosted", config: null });
    await checkHealth("dest-1");
    expect(probe.probes).toBe(0);
    expect(await publishCapability("dest-1")).toBeNull();
  });

  it("the check still makes no write to the customer's site, on this arm as on every other", async () => {
    seedSite();
    seedDestination();
    probe.capable = false;
    await checkHealth("dest-1");
    expect(probe.writes).toBe(0);
  });
});

describe("what the customer is offered, and the three things it must not be", () => {
  const facts = (over: Partial<Parameters<typeof destinationView>[0]> = {}) =>
    destinationView({
      id: "dest-1",
      kind: "wordpress",
      health: "error",
      reason: "cannot_publish",
      lastCheckedAt: new Date("2026-09-06T09:00:00Z"),
      heldPages: 0,
      ...over,
    });

  it("the action leads to a different account", () => {
    expect(facts().action).toBe("reconnect_other_account");
  });

  it("**it is never `reconnect`** — the one remedy guaranteed to change nothing", () => {
    expect(facts().action).not.toBe("reconnect");
  });

  it("a surface that renders on `action === 'reconnect'` cannot reach this state", () => {
    const view = facts();
    if (view.action === "reconnect") {
      // @ts-expect-error — inside this branch the action is narrowed away
      // from `reconnect_other_account`, so a surface written for the
      // ordinary Reconnect control cannot be handed this occasion.
      const unreachable: "reconnect_other_account" = view.action;
      expect(unreachable).toBeUndefined();
    }
    expect(view.action).toBe("reconnect_other_account");
  });

  it("the line is this occasion's own, and not the expired-credential one", () => {
    expect(facts().copy.line).toBe("publish.destination.line.cannot-publish");
    expect(facts().copy.line).not.toBe(facts({ reason: "credentials_expired" }).copy.line);
  });

  it("**the line is not written from the held count**: 0 and 7 give the identical key", () => {
    expect(facts({ heldPages: 0 }).copy.line).toBe(facts({ heldPages: 7 }).copy.line);
    expect(facts({ heldPages: 0 }).action).toBe(facts({ heldPages: 7 }).action);
  });

  it("the count itself stays on the view — it is a true count, and this state simply does not speak it", () => {
    expect(facts({ heldPages: 7 }).heldPages).toBe(7);
  });
});

describe("this occasion added no state", () => {
  it("`health` is still exactly §10's three, and `cannot_publish` sits inside `error`", async () => {
    seedSite();
    seedDestination();
    probe.capable = false;
    const checked = await checkHealth("dest-1");
    const three: DestinationHealth[] = ["ok", "expired", "error"];
    expect(three).toContain(checked.health);
    expect(checked.health).toBe("error");
  });

  it("the destination a surface reads carries the state, the reason and the action together", async () => {
    seedSite();
    seedDestination({ last_checked_at: "2026-01-01T00:00:00.000Z" });
    probe.capable = false;
    const view = await ensureFreshHealth("dest-1");
    expect(view).toMatchObject({
      health: "error",
      reason: "cannot_publish",
      action: "reconnect_other_account",
    });
  });
});
