// tests/scan/gallery/listing.test.ts — issue #1069
//
// SPEC §2 2026-09-24 (owner on #1058): every finished free scan is listed on
// `/scans` unless removed; a removed or refused site appears in neither the
// gallery nor the landing's strip. Both read `free_scan_listing`, so this is
// that view against a live, fully migrated schema.
import { readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { psql, psqlRows } from "../../db/substrate";

const MIGRATIONS = path.resolve(
  import.meta.dirname,
  "../../../supabase/migrations",
);

function resetSchema(): void {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
}

function raises(sql: string): boolean {
  try {
    psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
    return false;
  } catch {
    return true;
  }
}

function report(category: string | null, scored: boolean): string {
  const market =
    category === null
      ? { kind: "unmeasured" }
      : { kind: "measured", value: { profile: { category } } };
  return JSON.stringify({
    verdict: { scoreAndBand: { kind: scored ? "measured" : "unmeasured" } },
    market,
  });
}

function scan(a: {
  domain: string;
  score: number | null;
  finished: string;
  status?: string;
  stopped?: string;
  category?: string | null;
}): void {
  const body =
    a.status === "failed"
      ? "null"
      : `'${report(a.category === undefined ? "Bike repair" : a.category, a.score !== null)}'::jsonb`;
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `insert into scans (domain, tier, status, score, report, finished_at, stopped_reason)
     values ('${a.domain}', 'free', '${a.status ?? "done"}', ${a.score ?? "null"}, ${body},
             timestamptz '${a.finished}', '${a.stopped ?? "complete"}');`,
  ]);
}

function listing(): string[][] {
  return psqlRows(
    "select domain, company, coalesce(score::text, ''), coalesce(category, ''), has_logo from free_scan_listing order by domain;",
  );
}

beforeAll(() => {
  resetSchema();
  for (const name of readdirSync(MIGRATIONS)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, name)]);
  }
  scan({
    domain: "harbour.example",
    score: 30,
    finished: "2026-09-20T10:00:00Z",
  });
  scan({
    domain: "harbour.example",
    score: 47,
    finished: "2026-09-23T10:00:00Z",
  });
  scan({
    domain: "removed.example",
    score: 60,
    finished: "2026-09-23T10:00:00Z",
  });
  scan({
    domain: "unreadable.example",
    score: null,
    finished: "2026-09-23T10:00:00Z",
    status: "degraded",
    stopped: "site_unreadable",
    category: null,
  });
  scan({
    domain: "failed.example",
    score: null,
    finished: "2026-09-23T10:00:00Z",
    status: "failed",
    stopped: "failed",
  });
  scan({
    domain: "cutoff.example",
    score: null,
    finished: "2026-09-22T10:00:00Z",
    status: "degraded",
    stopped: "time_ceiling",
    category: null,
  });
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `insert into site_profiles (domain, site_name, logo_image, logo_type)
       values ('harbour.example', 'Harbour Bike Repair', '\\x89504e47'::bytea, 'image/png');
     insert into domain_blocks (domain, note) values ('removed.example', 'owner asked, 2026-09-24');`,
  ]);
});

afterAll(() => {
  resetSchema();
});

describe("free_scan_listing — what the gallery and the strip may show", () => {
  it("lists each finished free scan once, at its newest reading, under the name the site gives itself", () => {
    const rows = listing();
    expect(rows).toContainEqual([
      "harbour.example",
      "Harbour Bike Repair",
      "47",
      "Bike repair",
      "t",
    ]);
    expect(
      rows.filter(([domain]) => domain === "harbour.example"),
    ).toHaveLength(1);
  });

  it("lists a scan a ceiling cut off, without a score, under its domain", () => {
    expect(listing()).toContainEqual([
      "cutoff.example",
      "cutoff.example",
      "",
      "",
      "f",
    ]);
  });

  it("never lists a removed, an unreadable or a failed site", () => {
    const domains = listing().map(([domain]) => domain);
    expect(domains).toEqual(["cutoff.example", "harbour.example"]);
  });

  it("is not readable by a visitor's role, only by the server's", () => {
    expect(
      raises(
        "begin; set local role anon; select * from free_scan_listing; commit;",
      ),
    ).toBe(true);
    expect(
      raises(
        "begin; set local role service_role; select * from free_scan_listing; commit;",
      ),
    ).toBe(false);
  });

  it("keeps a stored logo small and of a picture type it can be served as", () => {
    expect(
      raises(
        "update site_profiles set logo_type = 'text/html' where domain = 'harbour.example';",
      ),
    ).toBe(true);
    expect(
      raises(
        "update site_profiles set logo_image = decode(repeat('00', 70000), 'hex') where domain = 'harbour.example';",
      ),
    ).toBe(true);
    expect(
      raises(
        "update site_profiles set logo_type = null where domain = 'harbour.example';",
      ),
    ).toBe(true);
  });
});
