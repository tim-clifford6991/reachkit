// tests/publish/daily/sites.test.ts — BUILD §11, §9 (issue #173)
//
// `draft/generate`'s site list. Three predicates, and each test is written
// so that dropping one fails it: a site with no zone, a site whose customer
// pressed stop, a site whose destination cannot take a page, and a site
// with no destination at all are none of them candidates.
//
// The hour is not asserted here and is not this module's: ADR-060's gate
// is `isDraftDue(now, zone)`, applied by the job to every row this returns.
//
// **The access gate is registered per test, never assumed.** ADR-050 puts
// the rule in `hasActiveAccess()` and `access.ts` throws while nothing is
// registered, on purpose — so a suite that forgot to register one would
// otherwise assert the hold arm by accident and call it the happy path.
// Each test below says which of the three it is: paying, lapsed, or a gate
// that cannot be read.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fakeDb, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { sitesForDailyTick } from "@/lib/publish/daily";
import { registerActiveAccessGate } from "@/lib/scan/weekly/access";

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

/** The gate answering for a paying customer — the ordinary case. */
function paysForEverything(): void {
  registerActiveAccessGate(async (siteIds) => new Set(siteIds));
}

beforeEach(() => {
  db.reset();
  paysForEverything();
});

afterEach(() => {
  // Cleared, so a suite that forgets to register one gets `access.ts`'s
  // own throw rather than this file's leftover answer.
  registerActiveAccessGate(null);
});

describe("the list is every site a page could actually reach tonight", () => {
  it("returns a working site with the zone its own evening is decided in", async () => {
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1")]);
    expect(await sitesForDailyTick()).toEqual({ sites: [{ siteId: "s1", timeZone: ZONE }], held: null });
  });

  it("returns every such site, not just the first", async () => {
    db.seed("sites", [site("s1"), site("s2", { timezone: "Europe/Berlin" })]);
    db.seed("destinations", [destination("s1"), destination("s2")]);
    expect((await sitesForDailyTick()).sites.map((s) => s.siteId).sort()).toEqual(["s1", "s2"]);
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
    expect(await sitesForDailyTick()).toEqual({ sites: [], held: null });
  });

  it("publishing switched off — the customer pressed stop, and §8's cap is real money", async () => {
    db.seed("sites", [site("s1", { publishing_enabled: false })]);
    db.seed("destinations", [destination("s1")]);
    expect(await sitesForDailyTick()).toEqual({ sites: [], held: null });
  });

  it("no destination at all — there is nowhere for the page to go", async () => {
    db.seed("sites", [site("s1")]);
    db.seed("destinations", []);
    expect(await sitesForDailyTick()).toEqual({ sites: [], held: null });
  });

  it("a destination that is not working — the guard's own test, `health = 'ok'`", async () => {
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1", { health: "expired" })]);
    expect(await sitesForDailyTick()).toEqual({ sites: [], held: null });
  });

  it("a disconnected destination is not one — its credential was destroyed", async () => {
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1", { deleted_at: "2026-09-01T00:00:00.000Z" })]);
    expect(await sitesForDailyTick()).toEqual({ sites: [], held: null });
  });

  it("cannot_publish outranks a health that has not been re-read since (ADR-086)", async () => {
    // The discriminating case: the probe found the credential cannot
    // publish and the row still reads `ok`. Dropping the `publish_capable`
    // filter passes every other test in this file and fails this one.
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1", { health: "ok", publish_capable: false })]);
    expect(await sitesForDailyTick()).toEqual({ sites: [], held: null });
  });

  it("a destination nobody has probed is not refused — null is 'not asked', never 'no'", async () => {
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1", { publish_capable: null })]);
    expect((await sitesForDailyTick()).sites).toHaveLength(1);
  });

  it("one site's broken destination never takes another site's page down with it", async () => {
    db.seed("sites", [site("s1"), site("s2")]);
    db.seed("destinations", [destination("s1", { health: "error" }), destination("s2")]);
    expect((await sitesForDailyTick()).sites.map((s) => s.siteId)).toEqual(["s2"]);
  });
});

describe("nothing to do is an empty list, never a throw", () => {
  it("no sites at all asks the destinations nothing", async () => {
    db.seed("sites", []);
    db.seed("destinations", []);
    expect(await sitesForDailyTick()).toEqual({ sites: [], held: null });
    expect(db.queries.filter((q) => q.table === "destinations")).toHaveLength(0);
  });
});

describe("active access is asked of the gate that owns it (#201, ADR-050)", () => {
  it("a paying site is prepared a page", async () => {
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1")]);
    expect((await sitesForDailyTick()).sites).toEqual([{ siteId: "s1", timeZone: ZONE }]);
  });

  it("a lapsed site is not — a day's page is spend", async () => {
    registerActiveAccessGate(async () => new Set<string>());
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1")]);
    expect(await sitesForDailyTick()).toEqual({ sites: [], held: null });
  });

  it("one lapsed site never takes a paying one down with it", async () => {
    registerActiveAccessGate(async () => new Set(["s2"]));
    db.seed("sites", [site("s1"), site("s2")]);
    db.seed("destinations", [destination("s1"), destination("s2")]);
    expect((await sitesForDailyTick()).sites.map((s) => s.siteId)).toEqual(["s2"]);
  });

  it("the gate is asked once, about the candidates that survived the row predicates", async () => {
    // No point asking who pays for a site that has nowhere to publish.
    const asked: string[][] = [];
    registerActiveAccessGate(async (siteIds) => {
      asked.push([...siteIds]);
      return new Set(siteIds);
    });
    db.seed("sites", [site("s1"), site("s2"), site("s3", { publishing_enabled: false })]);
    db.seed("destinations", [destination("s1"), destination("s2", { health: "error" }), destination("s3")]);
    await sitesForDailyTick();
    expect(asked).toEqual([["s1"]]);
  });

  it("no candidate means no question — the gate is not asked at all", async () => {
    const gate = vi.fn(async (siteIds: readonly string[]) => new Set(siteIds));
    registerActiveAccessGate(gate);
    db.seed("sites", [site("s1")]);
    db.seed("destinations", []);
    expect(await sitesForDailyTick()).toEqual({ sites: [], held: null });
    expect(gate).not.toHaveBeenCalled();
  });

  it("§13's grace is billing's to express — this file holds no second clause about it", async () => {
    // The discriminating case, and it is about the *code*: the gate says a
    // site is active and the list takes that answer whole. A clause here
    // that re-derived "active" from a date or a status would leave every
    // other test in this file green and make the ruling false, so it is
    // asserted where it cannot be. Comments are stripped first — the
    // prose above explains the rule and is not a second copy of it.
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/lib/publish/daily/sites.ts"),
      "utf8"
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    expect(code).not.toMatch(/paid_through|plan_status/);
  });
});

describe("a gate that cannot be read holds the tick, and says so", () => {
  it("nothing registered — no site is prepared a page, and the hold is named", async () => {
    // `access.ts` throws while nothing is registered, on purpose: neither
    // "everyone" nor a silent "nobody" is an answer about who is paying.
    registerActiveAccessGate(null);
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1")]);
    expect(await sitesForDailyTick()).toEqual({ sites: [], held: "access-unreadable" });
  });

  it("a gate that throws is the same answer — fail closed on spend", async () => {
    registerActiveAccessGate(async () => {
      throw new Error("billing store unreadable");
    });
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1")]);
    expect(await sitesForDailyTick()).toEqual({ sites: [], held: "access-unreadable" });
  });

  it("the hold is not a quiet hour: it is distinguishable from nothing being due", async () => {
    // The two must never look alike in the run record — one of them needs
    // an operator.
    registerActiveAccessGate(null);
    db.seed("sites", [site("s1")]);
    db.seed("destinations", [destination("s1")]);
    const held = await sitesForDailyTick();

    paysForEverything();
    db.seed("destinations", []);
    const quiet = await sitesForDailyTick();

    expect(held.sites).toEqual(quiet.sites);
    expect(held.held).not.toEqual(quiet.held);
  });
});
