// SPEC §2 #1058 as amended 2026-11-01: `/scans/logo/{domain}` serves the
// stored logo of any domain whose report page is served, listed in the
// gallery or not, and nothing for a removed or never-scanned one. Only the
// database is a double; it answers each read by the filters it was given.
import "../../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

interface ScanRow { domain: string; is_current: boolean; report: object | null; tier: string; stopped_reason: string | null }

const db = vi.hoisted(() => ({
  scans: [] as ScanRow[],
  blocks: [] as { domain: string }[],
  profiles: [] as { domain: string; logo_image: string | null; logo_type: string | null }[],
}));

vi.mock("@/lib/db", () => {
  function query(table: string) {
    const filters: ((row: Record<string, unknown>) => boolean)[] = [];
    const self = {
      select: () => self,
      limit: () => self,
      eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), self),
      is: (column: string, value: unknown) => (filters.push((row) => row[column] === value), self),
      not: (column: string, operator: string, value: unknown) =>
        (filters.push((row) => (operator === "is" ? row[column] !== value : true)), self),
      then: (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        const rows = ({ scans: db.scans, domain_blocks: db.blocks, site_profiles: db.profiles } as unknown as Record<string, Record<string, unknown>[]>)[table];
        if (rows === undefined) return Promise.reject(new Error(`unexpected read of ${table}`)).then(resolve, reject);
        return Promise.resolve({ data: rows.filter((row) => filters.every((f) => f(row))), error: null }).then(resolve, reject);
      },
    };
    return self;
  }
  return { dbAdmin: () => ({ from: query }) };
});

const { GET } = await import("@/app/(public)/scans/logo/[domain]/route");

const get = (domain: string): Promise<Response> =>
  GET(new Request(`https://reachkit.app/scans/logo/${domain}`), { params: Promise.resolve({ domain }) });

function scanned(domain: string, row: Partial<ScanRow> = {}): void {
  db.scans.push({ domain, is_current: true, report: { domain }, tier: "free", stopped_reason: null, ...row });
  db.profiles.push({ domain, logo_image: `\\x${PNG.toString("hex")}`, logo_type: "image/png" });
}

beforeEach(() => {
  db.scans = [];
  db.blocks = [];
  db.profiles = [];
});

describe("the logo route serves every public report's logo", () => {
  it("a public report the gallery does not list answers its bytes, with the sniffed type", async () => {
    // Unreadable home pages are never listed, yet their report is served.
    scanned("fernwoodtea.example", { stopped_reason: "site_unreadable" });
    const response = await get("fernwoodtea.example");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(Buffer.from(await response.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it("is kept a day by browsers and the CDN, so a hot report reads the bytes once", async () => {
    scanned("fernwoodtea.example");
    const cache = (await get("fernwoodtea.example")).headers.get("Cache-Control") ?? "";
    expect(cache).toContain("public");
    expect(cache).toContain("max-age=86400");
    expect(cache).toContain("s-maxage=86400");
  });

  it("a removed domain answers 404, so the takedown takes the picture down", async () => {
    scanned("fernwoodtea.example");
    db.blocks.push({ domain: "fernwoodtea.example" });
    const response = await get("fernwoodtea.example");
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("a never-scanned domain answers 404, even with a profile row", async () => {
    db.profiles.push({ domain: "steepco.example", logo_image: `\\x${PNG.toString("hex")}`, logo_type: "image/png" });
    expect((await get("steepco.example")).status).toBe(404);
  });

  it("a domain whose current scan holds no report answers 404", async () => {
    scanned("fernwoodtea.example", { report: null });
    expect((await get("fernwoodtea.example")).status).toBe(404);
  });
});
