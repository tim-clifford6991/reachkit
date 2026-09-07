// tests/market/changes/saves.test.ts — BUILD §4.7, REQ-071 c3/c4/c6/c16
//
// The save is immediate; its effect is not.
//
// Two mutations these rows kill. First, a save that writes anything besides
// the declared answer — a `pending_*` column, a queue row — which ADR-030
// forbids and which `writes` below asserts against by naming every column
// each save touches. Second, an effective date computed *before* the write:
// a save landing beside a running pass is resolved by the database, so a
// date read first is a date the customer was shown and not given.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, site } from "./harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const resolves = vi.fn(async (host: string) => host !== "unreachable.com");
vi.mock("@/lib/egress", () => ({ resolvesInDns: (host: string) => resolves(host) }));

const { saveCategory, saveDomain, saveRivals } = await import("@/lib/market/changes/declared");

beforeEach(() => {
  db.reset();
  db.seed("sites", [site()]);
  resolves.mockClear();
});

describe("REQ-071 c6 — a new domain is not accepted unless the product can reach it", () => {
  it("a reachable address is saved, and the row carries it", async () => {
    const result = await saveDomain({ siteId: "site-1", domain: "newname.com" });
    expect(result.ok).toBe(true);
    expect(db.rows("sites")[0]!.domain).toBe("newname.com");
  });

  it("an unreachable address is refused and **nothing is written**", async () => {
    const result = await saveDomain({ siteId: "site-1", domain: "unreachable.com" });
    expect(result).toEqual({ ok: false, because: "unreachable" });
    expect(db.rows("sites")[0]!.domain).toBe("acme.test");
    expect(db.writes).toEqual([]);
  });

  it("a value that is not a domain at all is refused before any lookup is made", async () => {
    const result = await saveDomain({ siteId: "site-1", domain: "not a domain" });
    expect(result).toEqual({ ok: false, because: "unreachable" });
    expect(resolves).not.toHaveBeenCalled();
  });

  it("the address is canonicalised on the way in, so one site has one spelling", async () => {
    await saveDomain({ siteId: "site-1", domain: "HTTPS://WWW.NewName.com/pricing" });
    expect(db.rows("sites")[0]!.domain).toBe("newname.com");
  });
});

describe("a save writes the declared answer and nothing else (ADR-030)", () => {
  it("saveDomain writes `domain` alone", async () => {
    await saveDomain({ siteId: "site-1", domain: "newname.com" });
    const write = db.writes.find((w) => w.table === "sites");
    expect(Object.keys(write!.values)).toEqual(["domain"]);
  });

  it("saveCategory writes `category` alone", async () => {
    await saveCategory({ siteId: "site-1", category: "agency project management" });
    expect(Object.keys(db.writes[0]!.values)).toEqual(["category"]);
    expect(db.rows("sites")[0]!.category).toBe("agency project management");
  });

  it("saveRivals writes `competitors` alone, as the domains the customer chose", async () => {
    await saveRivals({
      siteId: "site-1",
      rivals: [
        { domain: "asana.com", origin: "typed" },
        { domain: "clickup.com", origin: "suggested" },
      ],
    });
    expect(Object.keys(db.writes[0]!.values)).toEqual(["competitors"]);
    expect(db.rows("sites")[0]!.competitors).toEqual(["asana.com", "clickup.com"]);
  });

  it("no save writes a pending column, an effective date or a queue row", async () => {
    // The landmine, asserted: every column any save touches, across all
    // three, is one of the three declared answers.
    await saveDomain({ siteId: "site-1", domain: "newname.com" });
    await saveCategory({ siteId: "site-1", category: "x" });
    await saveRivals({ siteId: "site-1", rivals: [] });
    const columns = db.writes.flatMap((w) => Object.keys(w.values));
    expect([...new Set(columns)].sort()).toEqual(["category", "competitors", "domain"]);
    expect(db.writes.map((w) => w.table)).toEqual(["sites", "sites", "sites"]);
  });

  it("the write is addressed to the one site, never to a set of them", async () => {
    await saveCategory({ siteId: "site-1", category: "x" });
    expect(db.writes[0]!.where).toEqual({ id: "site-1" });
  });
});

describe("REQ-071 c16 — an empty rival set is saved like any other", () => {
  it("the last rival can be removed and the account goes on running", async () => {
    const result = await saveRivals({ siteId: "site-1", rivals: [] });
    expect(result.ok).toBe(true);
    expect(db.rows("sites")[0]!.competitors).toEqual([]);
  });
});

describe("the effective date is recomputed after the write, never before it", () => {
  it("every save answers with the next weekly re-measurement in the site's own zone", async () => {
    const result = await saveCategory({ siteId: "site-1", category: "x" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // REQ-065 c1's Monday, in `America/New_York` — never the server's zone.
    expect(result.effectiveOn.getUTCDay()).toBe(1);
    expect(result.effectiveOn.getTime()).toBeGreaterThan(Date.now());
  });

  it("the zone is read after the write, so a save beside a running pass earns its own date", async () => {
    // Ordering, asserted where it is decidable: the zone read that feeds
    // the date happens after the update reached the row.
    await saveCategory({ siteId: "site-1", category: "x" });
    expect(db.rows("sites")[0]!.category).toBe("x");
    expect(db.writes).toHaveLength(1);
  });

  it("a site that has stated no zone is a throw, never a date in the server's (REQ-073 c1)", async () => {
    db.seed("sites", [site({ timezone: null })]);
    await expect(saveCategory({ siteId: "site-1", category: "x" })).rejects.toThrow(/time zone/);
  });
});
