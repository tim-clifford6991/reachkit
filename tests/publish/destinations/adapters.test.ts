// tests/publish/destinations/adapters.test.ts — the registry, and the
// hosted adapter's honest refusal.
//
// §9's hosted CMS is an edge route that does not exist yet (#49). The
// assertions below pin what that means in practice: the adapter's two
// booleans are facts and are set, and its delivery refuses rather than
// returning an address nothing answers at. When #49 lands, the refusal rows
// change and the two booleans do not.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { adapterFor, destinationOf, destinationWorking } from "@/lib/publish/destinations";
import { HOSTED_ADAPTER } from "@/lib/publish/destinations/hosted";

beforeEach(() => {
  db.reset();
});

describe("the registry is closed, and a missing adapter is null rather than a guess", () => {
  it("hosted resolves to the hosted adapter", () => {
    expect(adapterFor("hosted")).toBe(HOSTED_ADAPTER);
  });

  it("wordpress resolves to null — absent, not stubbed (#54)", () => {
    expect(adapterFor("wordpress")).toBeNull();
  });
});

describe("ADR-084 Decision 2 — the hosted adapter's two booleans are facts, not stubs", () => {
  it("it serves publicly, so its pages are verified and judged", () => {
    expect(HOSTED_ADAPTER.servesPublicly).toBe(true);
  });

  it("ReachKit runs it, so its unpublish is the removed arm", () => {
    expect(HOSTED_ADAPTER.hostedByUs).toBe(true);
  });
});

describe("the hosted adapter refuses honestly until the edge route exists", () => {
  it("it delivers nothing and returns no address", async () => {
    const result = await HOSTED_ADAPTER.deliver(
      { title: "t", slug: "s", bodyMd: "", meta: {} },
      {},
      "d1"
    );
    expect(result).toEqual({ ok: false, madeLive: false, reason: "destination_unavailable" });
    expect(result.liveUrl).toBeUndefined();
  });

  it("it never claims to have made a page live", async () => {
    const result = await HOSTED_ADAPTER.deliver(
      { title: "t", slug: "s", bodyMd: "", meta: {} },
      {},
      "d1"
    );
    expect(result.madeLive).toBe(false);
  });

  it("its health is error, and it says why: nothing answers at the address yet", async () => {
    // The reason travels with the state, so no caller ever has to map a
    // bare `error` back into what the check found. When #49 lands, this
    // call returns `ok` or `expired`/`dns_elsewhere` and nothing that
    // reads it changes.
    expect(await HOSTED_ADAPTER.health({})).toEqual({ health: "error", reason: "unreachable" });
  });

  it("its unpublish is not `removed` — it has never served a page to remove", async () => {
    const result = await HOSTED_ADAPTER.unpublish(
      {
        id: "p1",
        draftId: "d1",
        siteId: "s1",
        destination: "hosted",
        deliveryState: "delivered",
        attemptNo: 1,
        claimedAt: new Date(),
        publishedAt: null,
        unpublishedAt: null,
        liveUrl: null,
        remoteId: null,
        failureReason: null,
        mode: "autopilot",
        unpublishOutcome: null,
        madeLiveByUs: false,
        verifyDueAt: null,
      },
      {}
    );
    expect(result).toEqual({ ok: false, reason: "destination_unavailable" });
  });
});

describe("the destination the machine reads is the recorded row, read fresh", () => {
  it("destinationWorking is health = 'ok' and nothing else", async () => {
    db.seed("destinations", [{ id: "dest-1", site_id: "s1", kind: "hosted", health: "ok" }]);
    expect(await destinationWorking("s1")).toBe(true);
  });

  it("an expired credential is not working — the queue holds", async () => {
    db.seed("destinations", [{ id: "dest-1", site_id: "s1", kind: "hosted", health: "expired" }]);
    expect(await destinationWorking("s1")).toBe(false);
  });

  it("a site with no destination at all is not working", async () => {
    db.seed("destinations", []);
    expect(await destinationWorking("s1")).toBe(false);
  });

  it("destinationOf finds the site's row of that kind, and nothing of another site's", async () => {
    db.seed("destinations", [
      { id: "dest-1", site_id: "s1", kind: "hosted", health: "ok", config: { a: 1 } },
      { id: "dest-2", site_id: "s2", kind: "hosted", health: "ok", config: {} },
    ]);
    expect(await destinationOf("s1", "hosted")).toMatchObject({ id: "dest-1" });
    expect(await destinationOf("s1", "wordpress")).toBeNull();
  });
});
