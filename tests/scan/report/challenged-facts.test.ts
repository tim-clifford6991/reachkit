// `challengedHomes` against a live schema: a home read the re-score already judged is answered from its kept facts,
// with no page body downloaded, and the same as from the stored payloads where no fact is kept.
// A `db`-project suite (`LIVE_SCHEMA_TESTS`).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { REST_URL, SERVICE_ROLE_KEY, loopbackFetch, psql, psqlRows } from "../../db/substrate";
import "../../opportunities/env";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../../supabase/migrations");
const ALL = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort();
const BLOCK_PAGE = readFileSync(new URL("../../measure/domain/fixtures/challenge/cloudflare-block.sage.com.html", import.meta.url), "utf8");
const SITE_PAGE = `<html><head><title>Garden tools</title></head><body><h1>Garden tools</h1><p>${"Spades and rakes made to last. ".repeat(80)}</p></body></html>`;
const VERSION = "facts-test";
const READ_AT = "2026-10-20T10:00:00.000Z";

function run(sql: string): void {
  psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function value(sql: string): string {
  const id = psqlRows(sql)[0]?.[0];
  if (id === undefined) throw new Error(`no row from: ${sql}`);
  return id;
}

function resetSchema(): void {
  run("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
}

const quoted = (json: unknown) => `'${JSON.stringify(json).replaceAll("'", "''")}'::jsonb`;

/** One ledgered read, with the facts the re-score derives from it kept beside it where `kept`. */
async function read(domain: string, source: string, payload: unknown, at: string, kept: boolean): Promise<void> {
  const scanId = value(`insert into scans (domain, tier, status) values ('${domain}', 'free', 'done') returning id;`);
  const key = `https://${domain}/`;
  const id = value(
    `insert into fetches (scan_id, source, cache_key, policy_version, cost_cents, reserved_cents, payload, created_at) values ` +
      `('${scanId}', '${source}', '${key}', 1, 0, 0, ${quoted(payload)}, '${at}') returning id;`
  );
  if (!kept) return;
  const { pageFactsOf } = await import("../../../src/lib/scan/page-facts");
  run(`insert into fetch_facts (fetch_id, scan_id, facts_version, facts) values ('${id}', '${scanId}', '${VERSION}', ${quoted(pageFactsOf(key, payload))});`);
}

function document(domain: string, html: string, status: number) {
  return { url: `https://${domain}/`, status, html, bytes: html.length, readAt: READ_AT };
}

/** Two protected homes, one the vendor's browser drew past its protection, each read twice: facts kept and not. */
async function seed(): Promise<void> {
  for (const kept of [true, false]) {
    const blocked = `blocked-${kept}.example.org`;
    const drawn = `drawn-${kept}.example.org`;
    await read(blocked, "egress.safeFetch", document(blocked, BLOCK_PAGE, 403), READ_AT, kept);
    await read(blocked, "on_page/instant_pages", [document(blocked, BLOCK_PAGE, 403)], "2026-10-20T10:00:05.000Z", kept);
    await read(drawn, "egress.safeFetch", document(drawn, BLOCK_PAGE, 403), READ_AT, kept);
    await read(drawn, "on_page/instant_pages", [document(drawn, SITE_PAGE, 200)], "2026-10-20T10:00:05.000Z", kept);
  }
}

let challengedHomes: typeof import("../../../src/lib/scan/challenged").challengedHomes;
const bodies: string[] = [];

beforeAll(async () => {
  process.env.SUPABASE_URL = REST_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
  process.env.RK_FACTS_VERSION = VERSION;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    const response = await (loopbackFetch as unknown as typeof fetch)(...args);
    bodies.push(await response.clone().text());
    return response;
  }) as typeof fetch;
  resetSchema();
  for (const file of ALL) psql(["-v", "ON_ERROR_STOP=1", "-q", "-f", path.join(MIGRATIONS, file)]);
  await seed();
  run("NOTIFY pgrst, 'reload schema';");
  await new Promise((resolve) => setTimeout(resolve, 500));
  ({ challengedHomes } = await import("../../../src/lib/scan/challenged"));
}, 60_000);

afterEach(() => {
  bodies.length = 0;
});

afterAll(() => {
  delete process.env.RK_FACTS_VERSION;
  globalThis.fetch = loopbackFetch as unknown as typeof fetch;
  resetSchema();
});

const asked = (kept: boolean) => [
  { domain: `blocked-${kept}.example.org`, at: new Date(READ_AT) },
  { domain: `drawn-${kept}.example.org`, at: new Date(READ_AT) },
];

describe("challengedHomes reads the facts the re-score kept", () => {
  it("answers a protected home, and one the browser drew past it, from kept facts without downloading a page", async () => {
    expect([...(await challengedHomes(asked(true)))]).toEqual(["blocked-true.example.org"]);
    expect(bodies.join("")).not.toContain("Garden tools");
    expect(bodies.join("")).not.toContain("Cloudflare");
  });

  it("answers the same from the stored payloads where no fact is kept", async () => {
    expect([...(await challengedHomes(asked(false)))]).toEqual(["blocked-false.example.org"]);
    expect(bodies.join("")).toContain("Garden tools");
  });

  it("reads the payloads where the kept facts are another version's", async () => {
    process.env.RK_FACTS_VERSION = "an-older-build";
    try {
      expect([...(await challengedHomes(asked(true)))]).toEqual(["blocked-true.example.org"]);
      expect(bodies.join("")).toContain("Garden tools");
    } finally {
      process.env.RK_FACTS_VERSION = VERSION;
    }
  });
});
