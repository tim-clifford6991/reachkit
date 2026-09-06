// tests/publish/destinations/health/health.test.ts — BUILD §9: health is a
// state, checked in line on the read path and never more than 24 hours
// old.
//
// The freshness test's fixture **makes no publish attempt at all**, which
// is the whole discrimination: §9's promise is "whether or not a publish
// was attempted in between", so an implementation that refreshed only on
// publish would pass a fixture that published and fail this one.
//
// The archived plan is WO-226.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const probe = vi.hoisted(() => ({
  answer: { health: "ok" as "ok" | "expired" | "error", reason: null as string | null },
  calls: 0,
  writes: 0,
  dns: true,
}));

vi.mock("@/lib/egress", () => ({ resolvesInDns: async () => probe.dns }));

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
          health: async () => {
            probe.calls += 1;
            return probe.answer;
          },
        },
}));

import { DESTINATION_HEALTH_MAX_AGE_H } from "@/lib/config/constants";
import { checkHealth, ensureFreshHealth, __resetHealthDebounceForTesting } from "@/lib/publish/destinations/health";
import { listDestinations } from "@/lib/publish/destinations";
import { seal } from "@/lib/publish/destinations/config";

const HOUR_MS = 3_600_000;
const CREDENTIAL = { user: "reachkit", password: "hunter2" };

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

function stale(): string {
  return new Date(Date.now() - (DESTINATION_HEALTH_MAX_AGE_H + 1) * HOUR_MS).toISOString();
}

beforeEach(() => {
  db.reset();
  probe.answer = { health: "ok", reason: null };
  probe.calls = 0;
  probe.writes = 0;
  probe.dns = true;
  __resetHealthDebounceForTesting();
});

describe("a hosted destination's state is a DNS question", () => {
  it("a record that was never pointed is expired / dns_unset", async () => {
    seedSite();
    seedDestination({ kind: "hosted", config: null });
    probe.dns = false;
    expect(await checkHealth("dest-1")).toMatchObject({ health: "expired", reason: "dns_unset" });
  });

  it("a site with no domain yet has nothing to point: expired / never_connected", async () => {
    seedSite({ domain: null });
    seedDestination({ kind: "hosted", config: null });
    expect(await checkHealth("dest-1")).toMatchObject({
      health: "expired",
      reason: "never_connected",
    });
  });

  it("a record that resolves raises the question resolution cannot answer, and the adapter is asked", async () => {
    seedSite();
    seedDestination({ kind: "hosted", config: null });
    probe.answer = { health: "expired", reason: "dns_elsewhere" };
    expect(await checkHealth("dest-1")).toMatchObject({
      health: "expired",
      reason: "dns_elsewhere",
    });
  });

  it("while it is not `ok`, the destination is not working, so no page is delivered there", async () => {
    seedSite();
    seedDestination({ kind: "hosted", config: null, health: "ok" });
    probe.dns = false;
    await checkHealth("dest-1");
    const { destinationWorking } = await import("@/lib/publish/destinations");
    expect(await destinationWorking("site-1")).toBe(false);
  });
});

describe("a credential-bearing destination's state comes from the adapter, through the seal", () => {
  it("an expired credential resolves to expired / credentials_expired", async () => {
    seedSite();
    seedDestination();
    probe.answer = { health: "expired", reason: "credentials_expired" };
    expect(await checkHealth("dest-1")).toMatchObject({
      health: "expired",
      reason: "credentials_expired",
    });
  });

  it("a destination holding no credential is expired / never_connected, and no probe is run", async () => {
    seedSite();
    seedDestination({ config: null });
    expect(await checkHealth("dest-1")).toMatchObject({
      health: "expired",
      reason: "never_connected",
    });
    expect(probe.calls).toBe(0);
  });

  it("a kind this build has no adapter for is error / destination_rejected, never a guess", async () => {
    seedSite();
    seedDestination({ kind: "unknown" });
    expect(await checkHealth("dest-1")).toMatchObject({
      health: "error",
      reason: "destination_rejected",
    });
  });

  it("a destination that is not there is error / destination_rejected, and writes nothing", async () => {
    seedSite();
    expect(await checkHealth("dest-missing")).toMatchObject({ health: "error" });
    expect(db.rows("destinations")).toHaveLength(0);
  });
});

describe("ADR-086 — publish_capable false is error / cannot_publish, and outranks the probe", () => {
  it("the state is decided by what the probe found, never by what the adapter says now", async () => {
    seedSite();
    seedDestination({ publish_capable: false });
    probe.answer = { health: "ok", reason: null };
    expect(await checkHealth("dest-1")).toMatchObject({
      health: "error",
      reason: "cannot_publish",
    });
  });

  it("`cannot_publish` is a reason and not a fourth state: `health` is still one of §10's three", async () => {
    seedSite();
    seedDestination({ publish_capable: false });
    const checked = await checkHealth("dest-1");
    expect(["ok", "expired", "error"]).toContain(checked.health);
  });
});

describe("a health check makes no write to the customer's site", () => {
  it("neither deliver nor unpublish is reached by a check, on any arm", async () => {
    seedSite();
    for (const over of [{}, { config: null }, { kind: "hosted", config: null }, { publish_capable: false }]) {
      db.seed("destinations", []);
      seedDestination(over);
      await checkHealth("dest-1");
    }
    expect(probe.writes).toBe(0);
  });
});

describe("health_changed_at moves only on an actual change", () => {
  it("a check that confirms an unchanged state stamps the date read, not the date it broke", async () => {
    seedSite();
    seedDestination({ health: "ok", health_changed_at: "2026-09-01T00:00:00.000Z" });
    await checkHealth("dest-1");
    const [row] = db.rows("destinations");
    expect(row!.health_changed_at).toBe("2026-09-01T00:00:00.000Z");
    expect(row!.last_checked_at).not.toBe("2026-09-01T00:00:00.000Z");
  });

  it("a check that finds a different state moves it", async () => {
    seedSite();
    seedDestination({ health: "ok", health_changed_at: "2026-09-01T00:00:00.000Z" });
    probe.answer = { health: "expired", reason: "credentials_expired" };
    await checkHealth("dest-1");
    expect(db.rows("destinations")[0]!.health_changed_at).not.toBe("2026-09-01T00:00:00.000Z");
  });

  it("reaching `ok` clears broken_mail_sent_at — that clearing is how 'until it breaks again' is expressed as data", async () => {
    seedSite();
    seedDestination({ health: "expired", broken_mail_sent_at: "2026-09-02T00:00:00.000Z" });
    await checkHealth("dest-1");
    expect(db.rows("destinations")[0]!.broken_mail_sent_at).toBeNull();
  });

  it("a check that stays broken leaves the guard standing — one mail per breakage, not one a day", async () => {
    seedSite();
    seedDestination({ health: "expired", broken_mail_sent_at: "2026-09-02T00:00:00.000Z" });
    probe.answer = { health: "expired", reason: "credentials_expired" };
    await checkHealth("dest-1");
    expect(db.rows("destinations")[0]!.broken_mail_sent_at).toBe("2026-09-02T00:00:00.000Z");
  });
});

describe("last checked is never more than 24 hours old, whether or not a publish was attempted", () => {
  it("a stale destination is re-checked in line, on a fixture where no publish was ever attempted", async () => {
    seedSite();
    seedDestination({ last_checked_at: stale() });
    // No `publications` row exists and nothing here publishes: an
    // implementation that refreshed only on publish fails here.
    expect(db.rows("publications")).toHaveLength(0);
    const [view] = await listDestinations("site-1");
    expect(Date.now() - view!.lastCheckedAt.getTime()).toBeLessThan(
      DESTINATION_HEALTH_MAX_AGE_H * HOUR_MS
    );
    expect(probe.calls).toBe(1);
  });

  it("a fresh destination is not re-checked", async () => {
    seedSite();
    seedDestination();
    await listDestinations("site-1");
    expect(probe.calls).toBe(0);
  });

  it("the debounce collapses a burst of ten reads into one check", async () => {
    seedSite();
    seedDestination({ last_checked_at: stale() });
    // The stored date is left stale on purpose: the answer stays `ok`, so
    // nothing about the row changes, and only the debounce can be what
    // stops the second through tenth checks.
    db.rows("destinations")[0]!.last_checked_at = stale();
    for (let i = 0; i < 10; i++) {
      db.rows("destinations")[0]!.last_checked_at = stale();
      await ensureFreshHealth("dest-1");
    }
    expect(probe.calls).toBe(1);
  });

  it("a destination that is not there returns null rather than a blank one", async () => {
    seedSite();
    expect(await ensureFreshHealth("dest-missing")).toBeNull();
  });

  it("the view carries the pages the destination is holding", async () => {
    seedSite();
    seedDestination({ health: "expired", health_reason: "credentials_expired" });
    db.seed("drafts", [
      { id: "d1", site_id: "site-1", state: "approved", publishable_since: "2026-09-01T00:00:00.000Z" },
      { id: "d2", site_id: "site-1", state: "failed", publishable_since: "2026-09-02T00:00:00.000Z" },
    ]);
    const [view] = await listDestinations("site-1");
    expect(view).toMatchObject({ heldPages: 2, action: "reconnect", health: "expired" });
  });
});
