// The html prune's listing and prune cost the same at N and 4N reads, and only the pruned rows' TOAST is read.
// A `db`-project suite (`LIVE_SCHEMA_TESTS`).
import { readdirSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { psql, psqlRows } from "../../db/substrate";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../../supabase/migrations");
const N = 400;
const K = 5;
const run = (...sql: string[]) => psql(["-v", "ON_ERROR_STOP=1", ...sql.flatMap((s) => ["-c", s])]);
const rows = (sql: string) => psqlRows(sql).map((r) => r[0]);

// Own reads with an 8 KB html stored out of line, half in each payload shape, each with both derived rows about 1 KB wide.
function seed(count: number, from: number): void {
  run(`with s as (select id from scans limit 1), h as (select string_agg(md5(g::text), '') as html from generate_series(1, 256) g)
    insert into fetches (id, scan_id, source, cache_key, policy_version, cost_cents, reserved_cents, payload, created_at)
    select md5('read' || i)::uuid, s.id, case when i % 2 = 0 then 'egress.safeFetch' else 'on_page/instant_pages' end, 'k' || i, 1, 0, 0,
      case when i % 2 = 0 then jsonb_build_object('html', h.html || i) else jsonb_build_array(jsonb_build_object('html', h.html || i)) end,
      timestamptz '2026-09-01' + make_interval(mins => i)
    from s, h, generate_series(${from}, ${from + count - 1}) i;`);
  run(`insert into fetch_facts (fetch_id, scan_id, facts_version, facts)
    select id, scan_id, 'v', jsonb_build_object('pad', repeat(md5(id::text), 16)) from fetches on conflict do nothing;`);
  run(`insert into fetch_text (fetch_id, scan_id, text_version, url, read_at, rendered, document, text, examples, questions)
    select fetch_id, scan_id, 'v', 'u', 'r', false, true, repeat(md5(fetch_id::text), 32), '[]', '[]' from fetch_facts on conflict do nothing;`,
    "vacuum analyze fetches;", "analyze fetch_facts;", "analyze fetch_text;");
}

// Blocks one statement touches on `fetches` and its two derived tables, and on the payloads' TOAST, from I/O counters flushed when its session goes idle.
function blocks(sql: string): { table: number; toast: number } {
  const toast = "coalesce(toast_blks_read + toast_blks_hit + tidx_blks_read + tidx_blks_hit, 0)";
  const statio = `select sum(heap_blks_read + heap_blks_hit + idx_blks_read + idx_blks_hit + case when relname = 'fetches' then 0 else ${toast} end),
    sum(case when relname = 'fetches' then ${toast} else 0 end) from pg_statio_user_tables where relname in ('fetches', 'fetch_facts', 'fetch_text')`;
  const [t0 = 0, x0 = 0] = psqlRows(statio).flat().map(Number);
  run(sql, "select pg_stat_force_next_flush();");
  const [t1 = 0, x1 = 0] = psqlRows(statio).flat().map(Number);
  return { table: t1 - t0, toast: x1 - x0 };
}

function measure() {
  const due = blocks("select * from fetches_html_due(now(), 25);");
  const ids = rows("select id from fetches_html_due(now(), 25) where has_facts and has_text limit " + K);
  const prune = blocks(`select fetches_html_prune(array['${ids.join("','")}']::uuid[]);`);
  return { due, prune };
}

let small: ReturnType<typeof measure>;
let large: ReturnType<typeof measure>;

beforeAll(() => {
  run("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
  }
  const quiet = "set (autovacuum_enabled = false, toast.autovacuum_enabled = false)";
  run(`alter table fetches alter column payload set storage external, ${quiet};`, `alter table fetch_facts ${quiet};`, `alter table fetch_text ${quiet};`,
    "insert into scans (domain, tier, status) values ('cost.example', 'free', 'done');");
  seed(N, 0);
  small = measure();
  seed(3 * N, N);
  large = measure();
}, 120_000);

describe("the html prune's cost does not grow with fetches or its derived rows", () => {
  it("lists through the index: the same blocks at N and 4N, and no TOAST", () => {
    expect(Math.abs(large.due.table - small.due.table)).toBeLessThanOrEqual(2);
    expect([small.due.toast, large.due.toast]).toEqual([0, 0]);
  });

  it("prunes k reads for the same blocks at N and 4N, reading TOAST for those k alone", () => {
    expect(Math.abs(large.prune.table - small.prune.table)).toBeLessThanOrEqual(2);
    expect(small.prune.toast).toBeGreaterThan(0);
    expect(Math.abs(large.prune.toast - small.prune.toast)).toBeLessThanOrEqual(2);
  });

  it("leaves a read without both derived rows as it was, and marks only what it emptied", () => {
    const [bare] = rows(`insert into fetches (scan_id, source, cache_key, policy_version, cost_cents, reserved_cents, payload)
      select id, 'on_page/instant_pages', 'bare', 1, 0, 0, '[{"html": "<p>kept</p>"}]' from scans returning id`);
    expect(rows(`select fetches_html_prune(array['${bare}']::uuid[])`)).toEqual(["0"]);
    expect(rows(`select (payload -> 0) ? 'html' and html_pruned_at is null from fetches where id = '${bare}'`)).toEqual(["t"]);
    expect(rows("select count(*) from fetches where html_pruned_at is not null")).toEqual([String(2 * K)]);
    expect(rows("select count(*) from fetches where html_pruned_at is not null and (payload ? 'html' or (payload -> 0) ? 'html')")).toEqual(["0"]);
  });

  it("is service_role's alone and runs on an empty search_path", () => {
    const grants = rows(`select r || has_function_privilege(r, p, 'execute') from unnest(array['anon','authenticated','service_role']) r,
      unnest(array['fetches_html_due(timestamptz,integer)','fetches_html_prune(uuid[])']) p order by 1`);
    expect(grants).toEqual(["anonfalse", "anonfalse", "authenticatedfalse", "authenticatedfalse", "service_roletrue", "service_roletrue"]);
    expect(rows("select proname from pg_proc where proname like 'fetches_html_%' and not 'search_path=\"\"' = any(proconfig)")).toEqual([]);
  });
});
