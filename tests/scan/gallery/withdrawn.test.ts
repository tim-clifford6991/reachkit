// A card whose market was withdrawn — read off a page that held none of the
// site's words — is not listed until a pass measures one; a card measured
// off a protection's page whose market was read from its listing is listed
// without a score. `unstable_cache` runs for real; only the database is a
// double, answering the view, the current reports and the home reads.
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
  listing: [] as ListingRow[],
  /** Each domain's current report's `market.because`, where it has one. */
  because: new Map<string, string>(),
  /** The stored plain read of each domain's home address. */
  homes: new Map<string, { status: number; html: string; readAt: string }>(),
}));

vi.mock("@/lib/db", () => {
  function query(table: string) {
    let columns = "";
    const eq = new Map<string, unknown>();
    const among = new Map<string, readonly unknown[]>();
    let without: readonly string[] = [];
    const self = {
      select: (c: string) => ((columns = c), self),
      not: (column: string, operator: string, list: string) =>
        (column === "domain" && operator === "in" ? (without = list.slice(1, -1).split(",")) : null, self),
      or: () => self,
      order: () => self,
      range: () => self,
      limit: () => self,
      is: () => self,
      eq: (column: string, value: unknown) => (eq.set(column, value), self),
      in: (column: string, values: readonly unknown[]) => (among.set(column, values), self),
      then: (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(answer(table, columns, eq, among, without)).then(resolve, reject),
    };
    return self;
  }
  function answer(table: string, columns: string, eq: Map<string, unknown>, among: Map<string, readonly unknown[]>, without: readonly string[]) {
    if (table === "free_scan_listing") {
      const categories = among.get("category");
      const rows = db.listing.filter((r) => !without.includes(r.domain) && (categories === undefined || categories.includes(r.category)));
      return { data: rows, error: null, count: rows.length };
    }
    if (table === "scans" && among.has("report->market->>because")) {
      const asked = among.get("report->market->>because")!;
      const rows = [...db.because].filter(([, because]) => asked.includes(because)).map(([domain]) => ({ domain }));
      return { data: eq.get("is_current") === true ? rows : [], error: null };
    }
    if (table === "scans") {
      const newest = db.listing.map((r) => r.scanned_at).sort().at(-1);
      return { data: newest === undefined ? [] : [{ finished_at: newest }], error: null };
    }
    if (table === "fetches" && eq.get("source") === "egress.safeFetch") {
      const keys = among.get("cache_key") ?? [];
      const rows = [...db.homes]
        .filter(([domain]) => keys.includes(`https://${domain}/`))
        .map(([domain, home]) => ({ id: domain, cache_key: `https://${domain}/`, created_at: home.readAt, status: home.status, bytes: home.html.length, headers: {}, readAt: home.readAt }));
      return { data: rows, error: null };
    }
    if (table === "fetches" && columns === "id, payload") {
      const ids = among.get("id") ?? [];
      const rows = [...db.homes].filter(([domain]) => ids.includes(domain)).map(([domain, home]) => ({ id: domain, payload: { url: `https://${domain}/`, ...home, bytes: home.html.length, headers: {} } }));
      return { data: rows, error: null };
    }
    return { data: [], error: null };
  }
  return { dbAdmin: () => ({ from: query }) };
});

const imperva = readFileSync(join(__dirname, "../../measure/domain/fixtures/challenge/imperva-challenge.bettys.co.uk.html"), "utf8");
const card = (domain: string, category: string, score: number | null, at = "2026-11-02T10:00:00.000Z"): ListingRow => ({
  domain,
  company: domain,
  score,
  category,
  scanned_at: at,
  has_logo: false,
});
const VIEW = { search: "", kind: null, sort: "newest", shown: 16 } as const;

beforeEach(() => {
  cacheStore.clear();
  db.because.clear();
  db.homes.clear();
  // The withdrawn card's stored category is the one its invented market named.
  db.listing = [card("bettys.co.uk", "Plumbing", 0), card("quay.example", "Plumbing", 52, "2026-11-01T10:00:00.000Z")];
  db.because.set("bettys.co.uk", "bot_protection");
  db.homes.set("bettys.co.uk", { status: 200, html: imperva, readAt: "2026-11-02T09:59:00.000Z" });
});

describe("a card whose market was withdrawn", () => {
  it("is absent from /scans, from its category's count and from the landing's strip", async () => {
    const { readGallery, readRecent } = await import("@/lib/scan/gallery");
    const all = await readGallery(VIEW);
    expect(all.entries.map((e) => e.domain)).toEqual(["quay.example"]);
    expect(all.total).toBe(1);
    const local = await readGallery({ ...VIEW, kind: "local-service" });
    expect(local.entries.map((e) => e.domain)).toEqual(["quay.example"]);
    expect(local.total).toBe(1);
    expect((await readRecent(8)).map((e) => e.domain)).toEqual(["quay.example"]);
  });

  it("is absent where the home page that said nothing was the site's own too", async () => {
    const { readGallery } = await import("@/lib/scan/gallery");
    db.because.set("bettys.co.uk", "home_wordless");
    expect((await readGallery(VIEW)).entries.map((e) => e.domain)).toEqual(["quay.example"]);
  });

  it("comes back when a pass measures its market", async () => {
    const { readGallery } = await import("@/lib/scan/gallery");
    await readGallery(VIEW);
    db.because.delete("bettys.co.uk");
    db.listing = [{ ...db.listing[0]!, scanned_at: "2026-11-03T10:00:00.000Z" }, db.listing[1]!];
    expect((await readGallery(VIEW)).entries.map((e) => e.domain)).toEqual(["bettys.co.uk", "quay.example"]);
  });
});

describe("a card measured off a protection's page whose market was read from its listing", () => {
  it("is listed, without a score", async () => {
    const { readGallery } = await import("@/lib/scan/gallery");
    db.because.clear();
    const shown = (await readGallery(VIEW)).entries.find((e) => e.domain === "bettys.co.uk");
    expect(shown).toMatchObject({ domain: "bettys.co.uk", score: null });
  });
});
