// tests/publish/destinations/health/stamp-capable.test.ts — issue #160 and
// ADR-083 Decision 4: the check records what the stamp probe found and
// **does not** let it change the destination's health.
//
// The load-bearing row is the negative one. `publish_capable === false`
// outranks every other answer and puts the destination in `error` /
// `cannot_publish` (ADR-086); the obvious next edit is to give the sibling
// column the same treatment, and it would be wrong in a way no customer
// would report as a bug — a WordPress that publishes every page perfectly
// would read as broken because it will not take a tag. So:
//
//  · `stamp_capable === false` leaves the state exactly as the site's own
//    end reported it, and leaves the queue running;
//  · the two columns are written by two writes, and a probe that answered
//    only one of them does not touch the other;
//  · a probe that could not be read writes nothing, so the last real
//    answer stands.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const probe = vi.hoisted(() => ({
  answer: { health: "ok" as "ok" | "expired" | "error", reason: null as string | null },
  capable: true as boolean | "throws",
  stamps: true as boolean | "throws",
  declaresStamp: true,
  stampProbes: 0,
}));

vi.mock("@/lib/egress", () => ({ resolvesInDns: async () => true }));

vi.mock("@/lib/publish/destinations/registry", () => ({
  adapterFor: (kind: string) => ({
    kind,
    servesPublicly: true,
    hostedByUs: kind === "hosted",
    deliver: async () => ({ ok: true, madeLive: true }),
    unpublish: async () => ({ ok: true, outcome: "removed" }),
    health: async () => probe.answer,
    // A destination ReachKit runs declares neither probe: there is no
    // account there whose permission to make a term could differ from its
    // permission to post.
    ...(kind === "hosted"
      ? {}
      : {
          canPublish: async () => {
            if (probe.capable === "throws") throw new Error("could not ask");
            return probe.capable;
          },
          ...(probe.declaresStamp
            ? {
                canStamp: async () => {
                  probe.stampProbes += 1;
                  if (probe.stamps === "throws") throw new Error("could not ask");
                  return probe.stamps;
                },
              }
            : {}),
        }),
  }),
}));

import { checkHealth, __resetHealthDebounceForTesting } from "@/lib/publish/destinations/health";
import { seal } from "@/lib/publish/destinations/config";

const CREDENTIAL = { baseUrl: "https://blog.example.com", username: "u", applicationPassword: "p" };

function seedSite(): void {
  db.seed("sites", [
    { id: "site-1", user_id: "user-1", domain: "example.com", publishing_enabled: true },
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
      stamp_capable: null,
      ...over,
    },
  ]);
}

const row = (): Row => db.rows("destinations")[0] as Row;

beforeEach(() => {
  db.reset();
  probe.answer = { health: "ok", reason: null };
  probe.capable = true;
  probe.stamps = true;
  probe.declaresStamp = true;
  probe.stampProbes = 0;
  __resetHealthDebounceForTesting();
});

describe("the stamp probe runs beside the state read and what it found is recorded", () => {
  it("a site that will carry the term records true", async () => {
    seedSite();
    seedDestination();
    await checkHealth("dest-1");
    expect(probe.stampProbes).toBe(1);
    expect(row().stamp_capable).toBe(true);
  });

  it("one that will not records false", async () => {
    seedSite();
    seedDestination();
    probe.stamps = false;
    await checkHealth("dest-1");
    expect(row().stamp_capable).toBe(false);
  });

  it("a hosted destination is never asked, and the column stays null", async () => {
    seedSite();
    seedDestination({ kind: "hosted", config: null });
    await checkHealth("dest-1");
    expect(probe.stampProbes).toBe(0);
    expect(row().stamp_capable).toBeNull();
  });

  it("an adapter that declares no stamp probe leaves the column alone", async () => {
    seedSite();
    seedDestination({ stamp_capable: true });
    probe.declaresStamp = false;
    await checkHealth("dest-1");
    expect(row().stamp_capable).toBe(true);
  });
});

describe("**it is not a health input** — a site that refuses the term is working", () => {
  it("stamp_capable false leaves the destination exactly as its own end reported", async () => {
    seedSite();
    seedDestination();
    probe.stamps = false;
    probe.answer = { health: "ok", reason: null };
    expect(await checkHealth("dest-1")).toMatchObject({ health: "ok", reason: null });
    expect(row().health).toBe("ok");
    expect(row().health_reason).toBeNull();
  });

  it("it never produces `cannot_publish` — that occasion belongs to the other column", async () => {
    seedSite();
    seedDestination();
    probe.stamps = false;
    probe.capable = true;
    const checked = await checkHealth("dest-1");
    expect(checked.reason).not.toBe("cannot_publish");
  });

  it("a destination that cannot publish is still cannot_publish, whatever the stamp answered", async () => {
    seedSite();
    seedDestination();
    probe.capable = false;
    probe.stamps = true;
    expect(await checkHealth("dest-1")).toMatchObject({
      health: "error",
      reason: "cannot_publish",
    });
    // And the stamp answer is recorded all the same: the two columns are
    // two facts, and one being bad does not suppress the other.
    expect(row().stamp_capable).toBe(true);
  });
});

describe("**a probe that could not be read writes nothing**", () => {
  it("the last recorded answer stands", async () => {
    seedSite();
    seedDestination({ stamp_capable: true });
    probe.stamps = "throws";
    await checkHealth("dest-1");
    expect(row().stamp_capable).toBe(true);
  });

  it("and a column nothing has ever answered stays null rather than becoming false", async () => {
    seedSite();
    seedDestination();
    probe.stamps = "throws";
    await checkHealth("dest-1");
    expect(row().stamp_capable).toBeNull();
  });

  it("a stamp probe that could not be read does not take the destination down", async () => {
    seedSite();
    seedDestination();
    probe.stamps = "throws";
    expect(await checkHealth("dest-1")).toMatchObject({ health: "ok" });
  });
});
