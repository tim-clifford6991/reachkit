-- supabase/migrations/20260909200000_fetches_daily_spend.sql
--
-- BUILD §6.5, issue #329 — reading the ledger for one UTC day, and nothing
-- else. No column, no policy, no behaviour change to any existing row.
--
-- `fetches` is "ledger + cache + raw store in one" (BUILD §10). The cache
-- reads it by key and the purge reads it by `scan_id`, and both have their
-- index. The product-wide daily ceiling asks a question neither of those
-- shapes answers — *what has the whole product spent since midnight* — so
-- this migration adds the two things that question needs:
--
--  1. `idx_fetches_created_at`, the only index on `created_at` alone. The
--     existing `(source, cache_key, policy_version, created_at desc)`
--     leads on the cache key, so a bare "since midnight" predicate cannot
--     use it.
--
--  2. `fetches_spend_since(timestamptz)`, which sums `cost_cents` over
--     that window **in the database**. The alternative — selecting the
--     day's rows and adding them up in the process — is what the seam
--     would do on every pass, and a busy day is thousands of rows: the
--     guard would cost more than the calls it guards. `sum()` over an
--     index range is one number over the wire.
--
-- `coalesce(..., 0)` so an empty day is 0¢ rather than null: the caller is
-- a ceiling check, and "no rows" and "nothing spent" are the same fact.
-- `bigint` because the sum of an `integer` column is one in Postgres; the
-- caller narrows it, and no day can approach the range either way.
--
-- **`stable`, not `volatile`** — the same `since` gives the same answer
-- within one statement, which is what lets the planner run it once.
--
-- **`security invoker` and `set search_path = ''`** — the shape
-- `20260909130000_rls_functions_search_path.sql` put on every other
-- function in this schema (issue #384): an empty path pinned to the
-- function, with this schema's own table named `public.fetches` in the
-- body, so no caller can move what `fetches` resolves to.
--
-- **Executable by `service_role` only.** Postgres grants `execute` on a
-- new function to `public` by default, and this one returns money.
-- `fetches` itself is RLS-enabled with no policy and is reachable only
-- through `dbAdmin()` (BP-007: "No cost figure is ever rendered to a
-- customer") — a function anyone holding an anon key could call would be
-- the hole that promise does not have. The revoke below closes it, and
-- `security invoker` means even a caller who could execute it would still
-- read `fetches` as themselves, which under RLS with no policy is nothing.
--
-- `structure.md` rule 3/3a: the filename carries the `fetches` topic token
-- (`src/lib/db/topics.ts`, owner BP-007); `daily_spend` narrows it and is
-- not a second topic.

create index if not exists idx_fetches_created_at on fetches (created_at desc);

create or replace function fetches_spend_since(p_since timestamptz)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(f.cost_cents), 0)::bigint
  from public.fetches f
  where f.created_at >= p_since;
$$;

revoke all on function fetches_spend_since(timestamptz) from public;
revoke all on function fetches_spend_since(timestamptz) from anon;
revoke all on function fetches_spend_since(timestamptz) from authenticated;
grant execute on function fetches_spend_since(timestamptz) to service_role;
