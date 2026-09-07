// tests/publish/daily/sites.test.ts — BUILD §11, §9 (issue #173)
//
// `draft/generate`'s site list. Three predicates, and each test is written
// so that dropping one fails it: a site with no zone, a site whose customer
// pressed stop, a site whose destination cannot take a page, and a site
// with no destination at all are none of them candidates.
//
// The hour is not asserted here and is not this module's: ADR-060's gate
// is `isDraftDue(now, zone)`, applied by the job to every row this returns.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { sitesForDailyTick } from "@/lib/publish/daily";

const ZONE = "America/New_York";

function site(id: string, over: Row = {}): Row {
  return { id, user_id: `user-${id}`, domain: `${id}.example`, publishing_enabled: true, timezone: ZONE, ...over };
}

function destination(siteId: string, over: Row = {}): Row {
  return {
    id: `dest-${siteId}`,
    site_id: siteId,
    kind: "wordpress",
    health: "ok",
    deleted_at: null,
    publish_capable: null,
    ...over,
  };
}

beforeEach(() => {
  db.reset();
});

describe("the list is every site a page could actually reach tonight", () => {
  it("returns a working site with the zone its own evening is decided in", async () => {
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1")]);
    expect(await sitesForDailyTick()).toEqual([{ siteId: "s1", timeZone: ZONE }]);
  });

  it("returns every such site, not just the first", async () => {
    db.seed("sites", [site("s1"), site("s2", { timezone: "Europe/Berlin" })]);
    db.seed("destinations", [destination("s1"), destination("s2")]);
    expect((await sitesForDailyTick()).map((s) => s.siteId).sort()).toEqual(["s1", "s2"]);
  });

  it("reads the sites and the destinations once each, whatever the number of sites", async () => {
    db.seed("sites", [site("s1"), site("s2"), site("s3")]);
    db.seed("destinations", [destination("s1"), destination("s2"), destination("s3")]);
    await sitesForDailyTick();
    expect(db.queries.filter((q) => q.table === "sites")).toHaveLength(1);
    expect(db.queries.filter((q) => q.table === "destinations")).toHaveLength(1);
  });
});

describe("a site the tick must not prepare a page for", () => {
  it("no zone — it cannot be told whether it is its own evening, and UTC is not invented for it", async () => {
    db.seed("sites", [site("s1", { timezone: null })]);
    db.seed("destinations", [destination("s1")]);
    expect(await sitesForDailyTick()).toEqual([]);
  });

  it("publishing switched off — the customer pressed stop, and §8's cap is real money", async () => {
    db.seed("sites", [site("s1", { publishing_enabled: false })]);
    db.seed("destinations", [destination("s1")]);
    expect(await sitesForDailyTick()).toEqual([]);
  });

  it("no destination at all — there is nowhere for the page to go", async () => {
    db.seed("sites", [site("s1")]);
    db.seed("destinations", []);
    expect(await sitesForDailyTick()).toEqual([]);
  });

  it("a destination that is not working — the guard's own test, `health = 'ok'`", async () => {
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1", { health: "expired" })]);
    expect(await sitesForDailyTick()).toEqual([]);
  });

  it("a disconnected destination is not one — its credential was destroyed", async () => {
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1", { deleted_at: "2026-09-01T00:00:00.000Z" })]);
    expect(await sitesForDailyTick()).toEqual([]);
  });

  it("cannot_publish outranks a health that has not been re-read since (ADR-086)", async () => {
    // The discriminating case: the probe found the credential cannot
    // publish and the row still reads `ok`. Dropping the `publish_capable`
    // filter passes every other test in this file and fails this one.
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1", { health: "ok", publish_capable: false })]);
    expect(await sitesForDailyTick()).toEqual([]);
  });

  it("a destination nobody has probed is not refused — null is 'not asked', never 'no'", async () => {
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1", { publish_capable: null })]);
    expect(await sitesForDailyTick()).toHaveLength(1);
  });

  it("one site's broken destination never takes another site's page down with it", async () => {
    db.seed("sites", [site("s1"), site("s2")]);
    db.seed("destinations", [destination("s1", { health: "error" }), destination("s2")]);
    expect((await sitesForDailyTick()).map((s) => s.siteId)).toEqual(["s2"]);
  });
});

describe("nothing to do is an empty list, never a throw", () => {
  it("no sites at all asks the destinations nothing", async () => {
    db.seed("sites", []);
    db.seed("destinations", []);
    expect(await sitesForDailyTick()).toEqual([]);
    expect(db.queries.filter((q) => q.table === "destinations")).toHaveLength(0);
  });
});
