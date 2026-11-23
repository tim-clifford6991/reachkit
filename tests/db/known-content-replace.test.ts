// `writeKnownSource` against a live database: a replace that fails half way loses no row, and one that succeeds drops only what it no longer saw.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";
import { REST_URL, SERVICE_ROLE_KEY, loopbackFetch, psql, psqlRows } from "./substrate";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");
const APPLIED = ["00000000000001_baseline.sql", "00000000000002_rls.sql", "20260921150000_sites_content_known.sql"];
const SITE = "00000000-0000-0000-0000-000000000002";
const run = (sql: string): void => void psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
const reset = (): void => run("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
const page = (ref: string, title = ref) => ({ source: "site" as const, ref, url: ref, title, headings: [], live: true, publishedAt: null });
const titles = (): string[] => psqlRows("select title from known_content order by ref;").map(([t]) => t ?? "");
let store: typeof import("@/lib/known-content/store");

beforeAll(async () => {
  applyEnvFixture();
  process.env.SUPABASE_URL = REST_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
  globalThis.fetch = loopbackFetch as unknown as typeof fetch;
  store = await import("@/lib/known-content/store");
  reset();
  run("alter default privileges in schema public grant all on tables to anon, authenticated, service_role;");
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
  run(`insert into users (id, email, plan_status) values ('${SITE}', 'o@example.com', 'active');
    insert into sites (id, user_id, domain) values ('${SITE}', '${SITE}', 'example.com');
    NOTIFY pgrst, 'reload schema';`);
  execFileSync("sleep", ["0.3"]); // PostgREST's schema-cache reload is async.
});

afterAll(() => {
  reset();
  run("alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;");
});

describe("known content — a replace never leaves the site empty", () => {
  it("a failed write keeps the previous rows; a good one drops only the rows it no longer saw", async () => {
    await store.writeKnownSource({ siteId: SITE, source: "site", pages: [page("a"), page("b")] });
    // The title check rejects the whole statement, as any write failing half way would.
    await expect(store.writeKnownSource({ siteId: SITE, source: "site", pages: [page("b", "B"), page("c", "x".repeat(501))] })).rejects.toThrow();
    expect(titles()).toEqual(["a", "b"]);
    await store.writeKnownSource({ siteId: SITE, source: "site", pages: [page("b", "B"), page("c")] });
    expect(titles()).toEqual(["B", "c"]);
  });
  it("an address held by two live versions is written once, the first kept", async () => {
    await store.writeKnownSource({ siteId: SITE, source: "site", pages: [page("d", "new"), page("d", "old")] });
    expect(titles()).toEqual(["new"]);
  });
});
