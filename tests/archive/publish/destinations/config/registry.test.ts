// tests/publish/destinations/config/registry.test.ts — BUILD §9: the
// destination registry, and connect / disconnect / reconnect.
//
// **The adapter is doubled, and that is the point.** Neither adapter this
// build ships can be healthy — the hosted edge route is #49 and the
// WordPress adapter is #54 — so a suite that used them could only ever
// exercise the broken arms. What is under test here is the lifecycle: what
// a connect writes, what a disconnect destroys and keeps, and what a
// reconnect does and does not do. So `registry.ts` is doubled with a probe
// whose answer the test sets, and every assertion below is about the
// registry's behaviour around that answer.
//
// The archived plan is WO-225.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const probe = vi.hoisted(() => ({
  answer: { health: "ok" as "ok" | "expired" | "error", reason: null as string | null },
  unpublished: 0,
  delivered: 0,
}));

vi.mock("@/lib/publish/destinations/registry", () => ({
  adapterFor: () => ({
    kind: "wordpress",
    servesPublicly: true,
    hostedByUs: false,
    deliver: async () => {
      probe.delivered += 1;
      return { ok: true, madeLive: true };
    },
    unpublish: async () => {
      probe.unpublished += 1;
      return { ok: true, outcome: "returned_to_draft" };
    },
    health: async () => probe.answer,
  }),
}));

vi.mock("@/lib/egress", () => ({ resolvesInDns: async () => true }));

import {
  AlreadyConnectedError,
  connect,
  destinationWorking,
  disconnect,
  listDestinations,
  reconnect,
} from "@/lib/publish/destinations";
import { destinationView } from "@/lib/publish/destinations/view";
import { seal } from "@/lib/publish/destinations/config";
import { __resetHealthDebounceForTesting } from "@/lib/publish/destinations/health";
import type { Actor } from "@/lib/publish/types";

const CUSTOMER: Actor = { kind: "customer", userId: "user-1" };
const CREDENTIAL = { user: "reachkit", password: "hunter2" };
const NOW = "2026-09-06T12:00:00.000Z";

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
      health: "expired",
      health_reason: "credentials_expired",
      health_changed_at: "2026-09-01T00:00:00.000Z",
      broken_mail_sent_at: "2026-09-02T00:00:00.000Z",
      last_checked_at: NOW,
      created_at: "2026-09-01T00:00:00.000Z",
      deleted_at: null,
      publish_capable: null,
      ...over,
    },
  ]);
}

/** Three pages waiting: two approved, one that failed. `publishable_since`
 *  is what makes them held (`switch/`), never a `held` column. */
function seedHeld(count: number): void {
  db.seed(
    "drafts",
    Array.from({ length: count }, (_, i) => ({
      id: `draft-${i}`,
      site_id: "site-1",
      state: "approved",
      publishable_since: `2026-09-0${i + 1}T00:00:00.000Z`,
    }))
  );
}

beforeEach(() => {
  db.reset();
  probe.answer = { health: "ok", reason: null };
  probe.unpublished = 0;
  probe.delivered = 0;
  __resetHealthDebounceForTesting();
});

describe("a deferred connection makes no network call and lands expired / never_connected", () => {
  it("`config: null` is an ordinary `ok`, not a failure", async () => {
    seedSite();
    const result = await connect({ siteId: "site-1", kind: "hosted", config: null, by: CUSTOMER });
    expect(result).toMatchObject({ ok: true, health: "expired" });
  });

  it("the row is created expired / never_connected with a last-checked date already set", async () => {
    seedSite();
    await connect({ siteId: "site-1", kind: "hosted", config: null, by: CUSTOMER });
    const [row] = db.rows("destinations");
    expect(row).toMatchObject({ health: "expired", health_reason: "never_connected", config: null });
    expect(row!.last_checked_at).toEqual(expect.any(String));
  });

  it("no probe is run: nothing was given to probe with", async () => {
    seedSite();
    await connect({ siteId: "site-1", kind: "hosted", config: null, by: CUSTOMER });
    expect(probe.delivered).toBe(0);
  });
});

describe("a non-null config is validated by the check, never by the act of connecting", () => {
  it("a credential the probe accepts leaves the destination working", async () => {
    seedSite();
    const result = await connect({
      siteId: "site-1",
      kind: "wordpress",
      config: CREDENTIAL,
      by: CUSTOMER,
    });
    expect(result).toEqual({ ok: true, destinationId: expect.any(String), health: "ok" });
    expect(db.rows("destinations")[0]).toMatchObject({ health: "ok", health_reason: null });
  });

  it("a credential the probe refuses is reported with the reason the probe found", async () => {
    seedSite();
    probe.answer = { health: "expired", reason: "credentials_invalid" };
    const result = await connect({
      siteId: "site-1",
      kind: "wordpress",
      config: CREDENTIAL,
      by: CUSTOMER,
    });
    expect(result).toEqual({ ok: false, reason: "credentials_invalid" });
  });

  it("the credential is stored sealed — the plaintext is never written", async () => {
    seedSite();
    await connect({ siteId: "site-1", kind: "wordpress", config: CREDENTIAL, by: CUSTOMER });
    expect(String(db.rows("destinations")[0]!.config)).not.toContain("hunter2");
  });
});

describe("one live destination per site", () => {
  it("connecting a second live destination is refused", async () => {
    seedSite();
    seedDestination();
    await expect(
      connect({ siteId: "site-1", kind: "hosted", config: null, by: CUSTOMER })
    ).rejects.toBeInstanceOf(AlreadyConnectedError);
  });

  it("a disconnected destination does not block the connection that replaces it", async () => {
    seedSite();
    seedDestination({ deleted_at: "2026-09-05T00:00:00.000Z", config: null });
    const result = await connect({ siteId: "site-1", kind: "hosted", config: null, by: CUSTOMER });
    expect(result.ok).toBe(true);
  });

  it("the refusal is not a `reason`: 'this site already has one' is not a state of the customer's destination", async () => {
    seedSite();
    seedDestination();
    const error = await connect({ siteId: "site-1", kind: "hosted", config: null, by: CUSTOMER }).catch(
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(AlreadyConnectedError);
  });
});

describe("disconnect destroys credentials, keeps published pages live, and sends nothing further", () => {
  it("the credential is destroyed and the row kept", async () => {
    seedSite();
    seedDestination();
    const result = await disconnect("dest-1", CUSTOMER);
    expect(result).toEqual({ ok: true, credentialsDestroyed: true });
    expect(db.rows("destinations")).toHaveLength(1);
    expect(db.rows("destinations")[0]).toMatchObject({ config: null });
    expect(db.rows("destinations")[0]!.deleted_at).toEqual(expect.any(String));
  });

  it("no `unpublish` is called — pages already published stay live", async () => {
    seedSite();
    seedDestination();
    await disconnect("dest-1", CUSTOMER);
    expect(probe.unpublished).toBe(0);
  });

  it("no publication row is touched — deleting one is the tidy-up ADR-080 forbids", async () => {
    seedSite();
    seedDestination();
    db.seed("publications", [{ id: "pub-1", draft_id: "d1", destination: "wordpress" }]);
    await disconnect("dest-1", CUSTOMER);
    expect(db.rows("publications")).toHaveLength(1);
    expect(db.queries.filter((q) => q.table === "publications")).toHaveLength(0);
  });

  it("a disconnected destination is not read as the site's destination any more", async () => {
    seedSite();
    seedDestination();
    await disconnect("dest-1", CUSTOMER);
    expect(await listDestinations("site-1")).toEqual([]);
    expect(await destinationWorking("site-1")).toBe(false);
  });
});

describe("a successful reconnect reads as working and says how many pages are waiting", () => {
  it("it returns the held count and clears the once-per-breakage guard", async () => {
    seedSite();
    seedDestination();
    seedHeld(3);
    const result = await reconnect({ destinationId: "dest-1", config: CREDENTIAL, by: CUSTOMER });
    expect(result).toEqual({ ok: true, held: 3, releasing: true });
    expect(db.rows("destinations")[0]).toMatchObject({ health: "ok", broken_mail_sent_at: null });
  });

  it("with publishing off, none of them publishes: `releasing` is false and they stay held", async () => {
    seedSite({ publishing_enabled: false });
    seedDestination();
    seedHeld(3);
    const result = await reconnect({ destinationId: "dest-1", config: CREDENTIAL, by: CUSTOMER });
    expect(result).toEqual({ ok: true, held: 3, releasing: false });
    // Nothing was published, and nothing was moved: a reconnect clears a
    // guard, it never publishes anything itself.
    expect(probe.delivered).toBe(0);
    expect(db.rows("drafts").every((d) => d.state === "approved")).toBe(true);
  });

  it("it publishes nothing itself even where publishing is on", async () => {
    seedSite();
    seedDestination();
    seedHeld(2);
    await reconnect({ destinationId: "dest-1", config: CREDENTIAL, by: CUSTOMER });
    expect(probe.delivered).toBe(0);
    expect(db.rows("publications")).toHaveLength(0);
  });

  it("a disconnected destination is not reconnected: connecting it again is `connect`", async () => {
    seedSite();
    seedDestination({ deleted_at: "2026-09-05T00:00:00.000Z", config: null });
    const result = await reconnect({ destinationId: "dest-1", config: CREDENTIAL, by: CUSTOMER });
    expect(result).toEqual({ ok: false, reason: "never_connected" });
  });
});

describe("ADR-086 — re-entering the stored credential does not clear `cannot_publish`", () => {
  it("the byte-identical stored credential comes back cannot_publish, and the held count is unchanged", async () => {
    seedSite();
    seedDestination({ health: "error", health_reason: "cannot_publish", publish_capable: false });
    seedHeld(4);
    // The probe would say `ok` — a short-circuit that treated the
    // submitted credential as proof of capability would pass every other
    // assertion in this file and fail only this one.
    probe.answer = { health: "ok", reason: null };
    const result = await reconnect({ destinationId: "dest-1", config: CREDENTIAL, by: CUSTOMER });
    expect(result).toEqual({ ok: false, reason: "cannot_publish" });
    expect(db.rows("destinations")[0]).toMatchObject({ health: "error", publish_capable: false });
    expect(db.rows("drafts")).toHaveLength(4);
  });

  it("the destination goes on holding: `destination_working` stays false", async () => {
    seedSite();
    seedDestination({ health: "error", health_reason: "cannot_publish", publish_capable: false });
    await reconnect({ destinationId: "dest-1", config: CREDENTIAL, by: CUSTOMER });
    expect(await destinationWorking("site-1")).toBe(false);
  });
});

describe("with every destination disconnected or failing, nothing is published anywhere", () => {
  it("`destination_working` is false for a failing destination", async () => {
    seedSite();
    seedDestination({ health: "error", health_reason: "unreachable" });
    expect(await destinationWorking("site-1")).toBe(false);
  });

  it("`destination_working` is false for a site with no destination at all", async () => {
    seedSite();
    expect(await destinationWorking("site-1")).toBe(false);
  });

  it("there is no fallback destination: another site's healthy destination is never selected", async () => {
    seedSite();
    db.seed("destinations", [
      {
        id: "dest-other",
        site_id: "site-2",
        kind: "hosted",
        health: "ok",
        health_reason: null,
        deleted_at: null,
      },
    ]);
    expect(await destinationWorking("site-1")).toBe(false);
    expect(await listDestinations("site-1")).toEqual([]);
  });
});

describe("DestinationView can hold no credential and no vendor payload", () => {
  it("its fields are exactly the ten a surface may see", () => {
    const view = destinationView({
      id: "dest-1",
      kind: "wordpress",
      health: "expired",
      reason: "credentials_expired",
      lastCheckedAt: new Date(NOW),
      heldPages: 3,
    });
    // A closed list, and it stays closed: the point of this row is that a
    // field a vendor string could arrive in cannot be added without
    // failing here. The two added by SPEC §5's ruling of 2026-09-12 are
    // the customer's own host and which of §5's two words it is read as —
    // an address on their domain and a token, neither of them a message.
    expect(Object.keys(view).sort()).toEqual([
      "action",
      "copy",
      "health",
      "heldPages",
      "hostname",
      "hostnameState",
      "id",
      "kind",
      "lastCheckedAt",
      "reason",
    ]);
  });

  it("a seeded credential reaches no field of it", async () => {
    seedSite();
    seedDestination();
    const [view] = await listDestinations("site-1");
    expect(JSON.stringify(view)).not.toContain("hunter2");
    expect(JSON.stringify(view)).not.toContain("reachkit");
  });

  it("it carries copy keys, never sentences: both are keys the registry resolves", async () => {
    const { COPY } = await import("@/lib/presentation/copy");
    const view = destinationView({
      id: "dest-1",
      kind: "wordpress",
      health: "expired",
      reason: "credentials_expired",
      lastCheckedAt: new Date(NOW),
      heldPages: 0,
    });
    expect(view.copy.state in COPY).toBe(true);
    expect(view.copy.line! in COPY).toBe(true);
  });
});

describe("the reason selects the line and the action; the state selects the band", () => {
  const cases = [
    { kind: "hosted", health: "ok", reason: null, action: "none", line: null },
    { kind: "hosted", health: "expired", reason: "dns_unset", action: "set_dns" },
    { kind: "hosted", health: "expired", reason: "dns_elsewhere", action: "set_dns" },
    { kind: "hosted", health: "expired", reason: "never_connected", action: "set_dns" },
    // Issue #240: its own action, not `reconnect`. A destination setup
    // created and nobody has ever given a credential to is not a broken
    // one, and the control's word is the difference the customer reads.
    { kind: "wordpress", health: "expired", reason: "never_connected", action: "connect" },
    { kind: "wordpress", health: "expired", reason: "credentials_expired", action: "reconnect" },
    { kind: "wordpress", health: "error", reason: "credentials_invalid", action: "reconnect" },
    { kind: "wordpress", health: "error", reason: "unreachable", action: "reconnect" },
    { kind: "wordpress", health: "error", reason: "destination_rejected", action: "reconnect" },
    { kind: "wordpress", health: "error", reason: "cannot_publish", action: "reconnect_other_account" },
  ] as const;

  it.each(cases)("%o", (row) => {
    const view = destinationView({
      id: "d",
      kind: row.kind,
      health: row.health,
      reason: row.reason,
      lastCheckedAt: new Date(NOW),
      heldPages: 0,
    });
    expect(view.action).toBe(row.action);
    expect(view.copy.state).toBe(`settings.destination.health.${row.health}`);
    if (row.reason === null) expect(view.copy.line).toBeNull();
    else expect(view.copy.line).not.toBeNull();
  });

  it("`cannot_publish` never offers ordinary Reconnect — re-entering the same credential is the one action guaranteed to change nothing", () => {
    const view = destinationView({
      id: "d",
      kind: "wordpress",
      health: "error",
      reason: "cannot_publish",
      lastCheckedAt: new Date(NOW),
      heldPages: 2,
    });
    expect(view.action).not.toBe("reconnect");
  });

  it("`cannot_publish`'s line is its own, and is not the held-pages line any other broken state uses", () => {
    const cannotPublish = destinationView({
      id: "d", kind: "wordpress", health: "error", reason: "cannot_publish",
      lastCheckedAt: new Date(NOW), heldPages: 2,
    });
    const expired = destinationView({
      id: "d", kind: "wordpress", health: "expired", reason: "credentials_expired",
      lastCheckedAt: new Date(NOW), heldPages: 2,
    });
    expect(cannotPublish.copy.line).not.toBe(expired.copy.line);
  });
});
