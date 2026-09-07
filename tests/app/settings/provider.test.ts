// tests/app/settings/provider.test.ts — BUILD §4.7's one read, and the
// destinations half of it (#48).
//
// The screen's destinations list is not assembled here and never was: it
// comes from the publishing registry, which is where a destination's
// state, its written line and its action are decided. This suite asserts
// that the provider actually reaches it — and that the fixture path,
// which is every render there is until identity lands (#35), reaches no
// database at all.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

vi.mock("@/lib/publish/destinations/registry", () => ({
  adapterFor: () => ({
    kind: "wordpress",
    servesPublicly: true,
    hostedByUs: false,
    deliver: async () => ({ ok: false, madeLive: false, reason: "destination_unavailable" }),
    unpublish: async () => ({ ok: false, reason: "destination_unavailable" }),
    health: async () => ({ health: "expired", reason: "credentials_expired" }),
  }),
}));

import { currentSiteId, readDestinations, readSettings } from "@/app/(account)/app/settings/provider";
import { FIXTURE_SETTINGS_FACTS } from "@/app/(account)/app/settings/fixture";

function seed(over: Row = {}): void {
  db.seed("sites", [
    { id: "site-1", user_id: "user-1", domain: "example.com", publishing_enabled: true },
  ]);
  db.seed("destinations", [
    {
      id: "dest-1",
      site_id: "site-1",
      kind: "wordpress",
      config: null,
      health: "error",
      health_reason: "cannot_publish",
      health_changed_at: "2026-09-01T00:00:00.000Z",
      broken_mail_sent_at: null,
      last_checked_at: new Date().toISOString(),
      created_at: "2026-09-01T00:00:00.000Z",
      deleted_at: null,
      publish_capable: false,
      ...over,
    },
  ]);
}

beforeEach(() => {
  db.reset();
});

describe("the destinations half is wired to the registry", () => {
  it("a known site is read through `listDestinations`, action and copy keys included", async () => {
    seed();
    const [view] = await readDestinations("site-1");
    expect(view).toMatchObject({
      id: "dest-1",
      health: "error",
      reason: "cannot_publish",
      action: "reconnect_other_account",
    });
    expect(view!.copy.line).toBe("publish.destination.line.cannot-publish");
  });

  it("a disconnected destination is not in the list the screen renders", async () => {
    seed({ deleted_at: "2026-09-05T00:00:00.000Z" });
    expect(await readDestinations("site-1")).toEqual([]);
  });
});

describe("the site is the signed-in account's, and the fixture path says so", () => {
  it("`currentSiteId()` is the account's own site (#42)", () => {
    expect(currentSiteId({ siteId: "site-1" })).toBe("site-1");
  });

  it("and `null` where no session names one — never a fabricated id", () => {
    // A made-up id would send a real query to a row that does not exist and
    // draw an empty destinations list for every customer.
    expect(currentSiteId(null)).toBeNull();
  });

  it("with no site id, the fixture's own destinations stand in", async () => {
    expect(await readDestinations(null)).toBe(FIXTURE_SETTINGS_FACTS.destinations);
  });

  it("and no query is made: a screen that asks the database nothing must not reach it", async () => {
    await readDestinations(null);
    expect(db.queries).toHaveLength(0);
  });
});

describe("readSettings assembles the model around whatever the destinations read returned", () => {
  it("it carries the registry's view, not a shape of the screen's own", async () => {
    const model = await readSettings();
    for (const destination of model.destinations) {
      expect(destination).toHaveProperty("action");
      expect(destination).toHaveProperty("copy");
      expect(destination).toHaveProperty("lastCheckedAt");
    }
  });

  it("the fixture holds exactly one destination — one live destination per site", async () => {
    const model = await readSettings();
    expect(model.destinations).toHaveLength(1);
  });
});

describe("the one read on this screen is bounded, so a database that will not answer costs the card and not the screen (#133)", () => {
  it("a billing read that never settles falls back to the fixture's facts", async () => {
    // #133 made every `(account)` route render per request, so this read
    // is now on the path of every settings render. A `catch` alone does
    // not cover a hang: a request that never settles never rejects, and
    // the layout conformance sweep renders this screen against a database
    // that is not there.
    vi.doMock("@/lib/account/billing", () => ({
      billingSummary: () => new Promise<never>(() => {}),
    }));
    vi.resetModules();
    const { readBillingFacts } = await import("@/app/(account)/app/settings/provider");

    const started = Date.now();
    await expect(readBillingFacts("user-1")).resolves.toEqual(FIXTURE_SETTINGS_FACTS.billing);
    expect(Date.now() - started).toBeLessThan(3_000);

    vi.doUnmock("@/lib/account/billing");
    vi.resetModules();
  });
});
