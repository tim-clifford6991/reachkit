// SPEC §2 2026-09-24 (#1069): a removed site leaves `/scans` at once, and a
// scan finished a minute ago is already there. The gallery's reads are
// cached so a crawler walking every filter costs one read per view per
// window; the cache is keyed by an uncached fingerprint of the removals and
// the newest scan, so neither promise waits on it.
//
// `unstable_cache` runs for real, against Next's own `IncrementalCache` over
// an in-memory store; only the database is a double, which counts its reads
// and answers the view as the migration defines it.
import "../../generate/env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheStore } from "../next-cache";

interface ListingRow {
  domain: string;
  company: string;
  score: number | null;
  category: string | null;
  scanned_at: string;
  has_logo: boolean;
}

const db = vi.hoisted(() => ({
  scans: [] as ListingRow[],
  blocks: [] as { domain: string; blocked_at: string }[],
  reads: new Map<string, number>(),
  rowsSent: 0,
  /** Each domain's current report's `market.because`, where it has one. */
  because: new Map<string, string>(),
  /** The stored plain read of a domain's home address. */
  homes: new Map<string, { status: number; html: string; readAt: string }>(),
}));

vi.mock("@/lib/db", () => {
  function query(table: string) {
    const eq = new Map<string, unknown>();
    let term = "";
    let among: readonly unknown[] | null = null;
    const asked = new Map<string, readonly unknown[]>();
    let columns = "";
    let head = false;
    let without: readonly string[] = [];
    const self = {
      select: (c: string, options?: { head?: boolean }) => ((columns = c), (head = options?.head === true), self),
      not: (column: string, operator: string, list: string) =>
        (column === "domain" && operator === "in" ? (without = list.slice(1, -1).split(",")) : null, self),
      or: (filter: string) => ((term = /\*(.*?)\*/.exec(filter)?.[1] ?? ""), self),
      order: () => self,
      in: (column: string, values: readonly unknown[]) => (column === "category" ? (among = values) : asked.set(column, values), self),
      range: () => self,
      limit: () => self,
      eq: (column: string, value: unknown) => (eq.set(column, value), self),
      then: (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        db.reads.set(table, (db.reads.get(table) ?? 0) + 1);
        const result = answer(table, eq, term, among, without, asked, columns);
        const sent = head ? { ...result, data: null } : result;
        db.rowsSent += sent.data?.length ?? 0;
        return Promise.resolve(sent).then(resolve, reject);
      },
    };
    return self;
  }
  function answer(table: string, eq: Map<string, unknown>, term: string, among: readonly unknown[] | null, without: readonly string[], asked: Map<string, readonly unknown[]>, columns: string) {
    if (table === "free_scan_listing") {
      const blocked = new Set(db.blocks.map((b) => b.domain));
      const rows = db.scans
        .filter((r) => !blocked.has(r.domain))
        .filter((r) => r.domain.includes(term))
        .filter((r) => (among === null ? true : among.includes(r.category)))
        .filter((r) => (eq.has("domain") ? r.domain === eq.get("domain") : true))
        .filter((r) => !without.includes(r.domain));
      return { data: rows, error: null, count: rows.length };
    }
    if (table === "domain_blocks") {
      const newest = [...db.blocks].sort((x, y) => y.blocked_at.localeCompare(x.blocked_at));
      return { data: newest.slice(0, 1), error: null, count: db.blocks.length };
    }
    if (table === "scans" && asked.has("report->market->>because")) {
      const withdrawn = [...db.because].filter(([, because]) => asked.get("report->market->>because")!.includes(because));
      return { data: eq.get("is_current") === true ? withdrawn.map(([domain]) => ({ domain })) : [], error: null };
    }
    if (table === "fetches") {
      const homes = [...db.homes].map(([domain, home]) => ({ id: domain, cache_key: `https://${domain}/`, created_at: home.readAt, ...home, bytes: home.html.length, headers: {} }));
      if (columns === "id, payload") return { data: homes.filter((h) => asked.get("id")?.includes(h.id)).map((h) => ({ id: h.id, payload: { url: h.cache_key, ...h } })), error: null };
      return { data: eq.get("source") === "egress.safeFetch" ? homes.filter((h) => asked.get("cache_key")?.includes(h.cache_key)) : [], error: null };
    }
    if (table === "scans") {
      const newest = db.scans.map((r) => r.scanned_at).sort().at(-1);
      return { data: newest === undefined ? [] : [{ finished_at: newest }], error: null };
    }
    return { data: [], error: null };
  }
  return { dbAdmin: () => ({ from: query }) };
});

function scan(domain: string, at: string, category = "Bike repair"): ListingRow {
  return { domain, company: domain, score: 47, category, scanned_at: at, has_logo: false };
}

const listingReads = () => db.reads.get("free_scan_listing") ?? 0;
const VIEW = { search: "", kind: null, sort: "newest", shown: 16 } as const;

beforeEach(() => {
  cacheStore.clear();
  db.reads.clear();
  db.rowsSent = 0;
  db.blocks = [];
  db.because.clear();
  db.homes.clear();
  db.scans = [scan("harbour.example", "2026-09-23T10:00:00.000Z"), scan("quay.example", "2026-09-22T10:00:00.000Z", "Plumbing")];
});

describe("the gallery's cache", () => {
  it("reads one view once inside the window, whichever card count or extra parameter asked for it", async () => {
    const { readGallery } = await import("@/lib/scan/gallery");
    const first = await readGallery(VIEW);
    const again = await readGallery({ ...VIEW, shown: 17 });
    expect(listingReads()).toBe(1);
    expect(again).toEqual(first);
    expect(again.entries[0]?.scannedAt).toBeInstanceOf(Date);
    await readGallery({ ...VIEW, sort: "az" });
    expect(listingReads()).toBe(2);
  });

  it("shows a removal at once: a new takedown row is a new key, and the site is gone", async () => {
    const { readGallery } = await import("@/lib/scan/gallery");
    await readGallery(VIEW);
    expect((await readGallery(VIEW)).entries.map((e) => e.domain)).toContain("harbour.example");
    expect(listingReads()).toBe(1);
    db.blocks = [{ domain: "harbour.example", blocked_at: "2026-10-22T13:00:00Z" }];
    const after = await readGallery(VIEW);
    expect(listingReads()).toBe(2);
    expect(after.entries.map((e) => e.domain)).toEqual(["quay.example"]);
    expect(after.total).toBe(1);
  });

  it("shows a lifted removal at once, though the newest takedown row is unchanged", async () => {
    const { readGallery } = await import("@/lib/scan/gallery");
    db.blocks = [
      { domain: "harbour.example", blocked_at: "2026-10-01T00:00:00Z" },
      { domain: "gone.example", blocked_at: "2026-10-02T00:00:00Z" },
    ];
    await readGallery(VIEW);
    expect((await readGallery(VIEW)).total).toBe(1);
    expect(listingReads()).toBe(1);
    db.blocks = db.blocks.filter((b) => b.domain !== "harbour.example");
    expect((await readGallery(VIEW)).total).toBe(2);
  });

  it("shows a scan finished a minute ago at once", async () => {
    const { readGallery } = await import("@/lib/scan/gallery");
    await readGallery(VIEW);
    await readGallery(VIEW);
    expect(listingReads()).toBe(1);
    db.scans = [scan("dock.example", "2026-10-22T13:59:00.000Z"), ...db.scans];
    expect((await readGallery(VIEW)).entries.map((e) => e.domain)).toContain("dock.example");
    expect(listingReads()).toBe(2);
  });

  it("never caches the one-domain check", async () => {
    const { isListed } = await import("@/lib/scan/gallery");
    expect(await isListed("harbour.example")).toBe(true);
    db.blocks = [{ domain: "harbour.example", blocked_at: "2026-10-22T13:00:00Z" }];
    expect(await isListed("harbour.example")).toBe(false);
    expect(listingReads()).toBe(2);
  });

  it("states a listed domain's score uncached, and none for an unscored, a removed or an unlisted one", async () => {
    const { listedScore } = await import("@/lib/scan/gallery");
    db.scans = [...db.scans, { ...scan("cut.example", "2026-09-21T10:00:00.000Z"), score: null }];
    expect(await listedScore("harbour.example")).toBe(47);
    expect(await listedScore("cut.example")).toBeNull();
    expect(await listedScore("nowhere.example")).toBeNull();
    db.blocks = [{ domain: "harbour.example", blocked_at: "2026-10-22T13:00:00Z" }];
    expect(await listedScore("harbour.example")).toBeNull();
  });

  it("states a listed domain's card: its score and whether its logo is stored", async () => {
    const { listedCard } = await import("@/lib/scan/gallery");
    db.scans = [...db.scans, { ...scan("logo.example", "2026-09-21T10:00:00.000Z"), has_logo: true }];
    expect(await listedCard("logo.example")).toEqual({ score: 47, hasLogo: true });
    expect(await listedCard("harbour.example")).toEqual({ score: 47, hasLogo: false });
    expect(await listedCard("nowhere.example")).toBeNull();
  });

  it("lists under a kind only the reports whose stored category names it, and a category that names none under none", async () => {
    const { readGallery } = await import("@/lib/scan/gallery");
    db.scans = [...db.scans, scan("ledger.example", "2026-09-21T10:00:00.000Z", "payroll software")];
    const domains = async (kind: "local-service" | "software" | "creator", search = "") =>
      (await readGallery({ ...VIEW, kind, search })).entries.map((e) => e.domain);
    expect(await domains("local-service")).toEqual(["quay.example"]);
    expect(await domains("software")).toEqual(["ledger.example"]);
    expect(await domains("creator")).toEqual([]);
    expect(await domains("local-service", "harbour")).toEqual([]);
    const all = await readGallery(VIEW);
    expect(all.entries.map((e) => [e.domain, e.kind])).toEqual([
      ["harbour.example", null],
      ["quay.example", "local-service"],
      ["ledger.example", "software"],
    ]);
  });

  it("counts each listed site but ReachKit's own and the panel's, from one head read an hour that sends no rows", async () => {
    const { scannedSites } = await import("@/lib/scan/gallery");
    const strangers = Array.from({ length: 99 }, (_, n) => scan(`site-${n}.example`, "2026-10-01T10:00:00.000Z"));
    db.scans = [...strangers, scan("reachkit.app", "2026-10-02T10:00:00.000Z"), scan("zunicafe.com", "2026-10-02T10:00:00.000Z")];
    expect(await scannedSites()).toBe(99);
    db.scans = [...db.scans, scan("site-99.example", "2026-10-03T10:00:00.000Z")];
    expect(await scannedSites()).toBe(99);
    expect(listingReads()).toBe(1);
    expect(db.rowsSent).toBe(0);
  });

  it("rounds a requested card count down to whole pages, within the bound", async () => {
    const { galleryShown } = await import("@/lib/scan/gallery");
    expect([Number.NaN, 0, 16, 17, 31, 32, 47, 320, 9999].map(galleryShown)).toEqual([16, 16, 16, 16, 16, 32, 32, 320, 320]);
  });
});

describe("the /scans page", () => {
  const render = async (searchParams: Record<string, string>) => {
    const { default: ScansPage } = await import("@/app/(public)/scans/page");
    const { renderToStaticMarkup } = await import("react-dom/server");
    return renderToStaticMarkup(await ScansPage({ searchParams: Promise.resolve(searchParams) }));
  };

  it("filters to the kind asked for, and reads an unknown kind as every report", async () => {
    expect(await render({ kind: "local-service" })).toContain("quay.example");
    expect(await render({ kind: "local-service" })).not.toContain("harbour.example");
    expect(await render({ kind: "zz" })).toContain("harbour.example");
  });

  it("reads the plain view once, whatever tracking parameters or card count the address carries", async () => {
    await render({});
    await render({ utm_source: "x", fbclid: "y" });
    await render({ shown: "17" });
    expect(listingReads()).toBe(1);
  });
});

describe("a card whose market was withdrawn, read off no words of the site's own", () => {
  const imperva = readFileSync(join(__dirname, "../../measure/domain/fixtures/challenge/imperva-challenge.bettys.co.uk.html"), "utf8");
  const withdrawn = (because: string): void => {
    // The withdrawn card's stored category is the one its invented market named.
    db.scans = [...db.scans, { ...scan("bettys.co.uk", "2026-09-24T10:00:00.000Z", "Plumbing"), score: 0 }];
    db.because.set("bettys.co.uk", because);
    db.homes.set("bettys.co.uk", { status: 200, html: imperva, readAt: "2026-09-24T09:59:00.000Z" });
  };
  const listed = async () => (await import("@/lib/scan/gallery")).readGallery(VIEW);

  it.each(["bot_protection", "home_wordless"])("(%s) is absent from /scans, from its category's count and from the landing's strip", async (because) => {
    const { readGallery, readRecent } = await import("@/lib/scan/gallery");
    withdrawn(because);
    expect((await listed()).entries.map((e) => e.domain)).toEqual(["harbour.example", "quay.example"]);
    expect((await listed()).total).toBe(2);
    expect((await readGallery({ ...VIEW, kind: "local-service" })).total).toBe(1);
    expect((await readRecent(8)).map((e) => e.domain)).not.toContain("bettys.co.uk");
  });

  it("comes back when a pass measures its market", async () => {
    withdrawn("bot_protection");
    await listed();
    db.because.clear();
    db.scans = db.scans.map((r) => (r.domain === "bettys.co.uk" ? { ...r, scanned_at: "2026-10-23T10:00:00.000Z" } : r));
    expect((await listed()).entries.map((e) => e.domain)).toContain("bettys.co.uk");
  });

  it("whose market was read from its listing is listed, without a score", async () => {
    withdrawn("bot_protection");
    db.because.clear();
    expect((await listed()).entries.find((e) => e.domain === "bettys.co.uk")).toMatchObject({ score: null });
  });
});
