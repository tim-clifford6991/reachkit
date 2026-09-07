// tests/publish/destinations/adapters.test.ts — the registry, and the
// hosted adapter's honest refusal.
//
// §9's hosted CMS edge route landed with issue #49, and the refusal rows
// that stood here went with it — the adapter now delivers, and its own
// suite is `tests/publish/destinations/hosted/hosted.test.ts`. The two
// booleans did not change, which is what that split was for: they are
// facts about the destination, not about how far the build had got.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { adapterFor, destinationOf, destinationWorking } from "@/lib/publish/destinations";
import { HOSTED_ADAPTER } from "@/lib/publish/destinations/hosted";
import { WORDPRESS_ADAPTER } from "@/lib/publish/destinations/wordpress/adapter";
import type { DestinationKind } from "@/lib/publish/types";

beforeEach(() => {
  db.reset();
});

describe("the registry is closed, and a missing adapter is null rather than a guess", () => {
  it("hosted resolves to the hosted adapter", () => {
    expect(adapterFor("hosted")).toBe(HOSTED_ADAPTER);
  });

  it("wordpress resolves to its adapter (#54)", () => {
    expect(adapterFor("wordpress")).toBe(WORDPRESS_ADAPTER);
  });

  it("the map is closed over §10's two kinds and answers null for anything else", () => {
    expect(adapterFor("ftp" as DestinationKind)).toBeNull();
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

// The hosted adapter's own behaviour — delivery, unpublish, health, the
// address composer and §9's page record — is
// `tests/publish/destinations/hosted/hosted.test.ts`'s (issue #49). What
// stays here is the registry: which kinds resolve, and to what.

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
