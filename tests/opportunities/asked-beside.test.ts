// `askedBeside` against a live schema: the indexed site_id read returns exactly the rows the key-only read did,
// and only the two lists it reads leave the database.
// A `db`-project suite (`LIVE_SCHEMA_TESTS`).
import { readdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REST_URL, SERVICE_ROLE_KEY, loopbackFetch, psql, psqlRows } from "../db/substrate";
import "./env";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");
const ALL = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort();

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

function site(domain: string): string {
  const user = value(`insert into users (email, plan_status) values ('owner@${domain}', 'active') returning id;`);
  return value(`insert into sites (user_id, domain) values ('${user}', '${domain}') returning id;`);
}

function scan(domain: string, tier: "free" | "deep", siteId: string | null): string {
  return value(
    `insert into scans (site_id, domain, tier, status) values (${siteId === null ? "null" : `'${siteId}'`}, '${domain}', '${tier}', 'done') returning id;`
  );
}

/** A SERP's organic rows, which the read never needs. */
const ITEMS = Array.from({ length: 40 }, (_, rank) => ({ type: "organic", rank, url: `https://rival.example.net/${rank}`, description: "organic row ".repeat(20) }));

function fetchRow(scanId: string, cacheKey: string, at = "now()", listed = true): void {
  const serp = { peopleAlsoAsk: [`asked of ${cacheKey.split("|")[0]}`], relatedSearches: ["related", 7], items: ITEMS };
  const payload = JSON.stringify(listed ? [serp] : serp);
  run(
    `insert into fetches (scan_id, source, cache_key, policy_version, cost_cents, reserved_cents, payload, created_at) values ` +
      `('${scanId}', 'dataforseo_serp', '${cacheKey}', 1, 0, 0, '${payload}'::jsonb, ${at});`
  );
}

let X = "";
const DAYS = 28;
let store: import("../../src/lib/opportunities/store").OpportunityStore;

beforeAll(async () => {
  process.env.SUPABASE_URL = REST_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
  globalThis.fetch = loopbackFetch as unknown as typeof fetch;
  resetSchema();
  for (const file of ALL) psql(["-v", "ON_ERROR_STOP=1", "-q", "-f", path.join(MIGRATIONS, file)]);
  X = site("x.example.org");
  const Y = site("y.example.org");
  const xScan = scan("x.example.org", "deep", X);
  const freeScan = scan("x.example.org", "free", null);
  const yScan = scan("y.example.org", "deep", Y);
  const place = "en|gb";
  fetchRow(xScan, `x paid|${place}|aio:cached|site:${X}|paa`);
  fetchRow(freeScan, `x free|${place}|aio:cached|site:${X}|paa`);
  fetchRow(yScan, `y paid|${place}|aio:cached|site:${Y}|paa`);
  fetchRow(xScan, `x plain|${place}|aio:cached|site:${X}`);
  fetchRow(xScan, `x deep|${place}|aio:cached|site:${X}|paa|depth:20`);
  fetchRow(xScan, `x old|${place}|aio:cached|site:${X}|paa`, `now() - interval '${DAYS + 1} days'`);
  fetchRow(xScan, `x stored|${place}|aio:cached|site:${X}|paa`, "now()", false);
  run("NOTIFY pgrst, 'reload schema';");
  await new Promise((resolve) => setTimeout(resolve, 500));
  store = (await import("../../src/lib/opportunities/store")).supabaseOpportunityStore();
}, 60_000);

afterAll(() => resetSchema());

describe("askedBeside reads a site's People-also-ask rows", () => {
  it("returns exactly the rows the key-only read returns: the site's own and its free scan's", async () => {
    const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
    const db = createClient(REST_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const old = await db.from("fetches").select("cache_key").like("cache_key", `%|site:${X}|paa`).gte("created_at", since);
    expect(old.error).toBeNull();
    const oldTerms = (old.data ?? []).map((row) => row.cache_key.split("|")[0]).sort();

    const read = await store.askedBeside(X, DAYS);
    expect(read.map((row) => row.term).sort()).toEqual(oldTerms);
    expect(oldTerms).toEqual(["x free", "x paid", "x stored"]);
    expect(read.find((row) => row.term === "x free")).toMatchObject({ peopleAlsoAsk: ["asked of x free"], related: ["related"] });
  });

  it("reads both lists from a one-row vendor list and from a stored SERP object, and downloads no organic row", async () => {
    const bodies: string[] = [];
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      const response = await (loopbackFetch as unknown as typeof fetch)(...args);
      bodies.push(await response.clone().text());
      return response;
    }) as typeof fetch;
    const read = await store.askedBeside(X, DAYS).finally(() => {
      globalThis.fetch = loopbackFetch as unknown as typeof fetch;
    });
    expect(read.find((row) => row.term === "x paid")).toMatchObject({ peopleAlsoAsk: ["asked of x paid"], related: ["related"] });
    expect(read.find((row) => row.term === "x stored")).toMatchObject({ peopleAlsoAsk: ["asked of x stored"], related: ["related"] });
    expect(bodies.join("")).toContain("asked of x paid");
    expect(bodies.join("")).not.toContain("rival.example.net");
  });
});
