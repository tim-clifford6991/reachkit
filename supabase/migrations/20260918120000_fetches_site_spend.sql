-- supabase/migrations/20260918120000_fetches_site_spend.sql
--
-- §6.5, issue 885 — the per-site half of the daily ceiling.
--
-- **The defect this closes.** `CAPS.DAILY_PRODUCT_C` (5000¢) is one figure
-- for the whole product for one UTC day, summed by
-- `fetches_spend_since(since)` (`20260909200000_fetches_daily_spend.sql`,
-- `20260910090000_fetches_money.sql`). It does not care *whose* spend
-- reached it. A single site in a retry loop — or one whose market keeps
-- failing and re-measuring — could therefore consume the day, after which
-- every other customer's pass, draft and publish was refused, silently,
-- until midnight UTC. At one customer that is invisible; at fifty it is an
-- outage nobody is told about. `CAPS.DAILY_SITE_C` is the missing per-site
-- figure and this function is the read behind it.
--
-- **It is the product read, one predicate narrower.** Same ledger
-- (`fetches`), same settled column (`cost_cents`), same exact unit
-- (`numeric(12,4)`, issue #449 — a day of 0.06¢ SERPs must total 0.06¢ × n
-- and not the 0¢ a `bigint` sum recorded), same UTC boundary handed in by
-- the caller, same `coalesce(..., 0)` so "no rows" and "nothing spent" are
-- one fact to a ceiling, same `stable` / `security invoker` / pinned empty
-- `search_path` / `service_role`-only execute. The only difference is the
-- join to `scans`, which is where a ledger row's site lives:
-- `fetches.scan_id` is `not null` and every paid call in the product —
-- a deep or weekly pass, a draft, setup's rival suggestion, the
-- opportunity typing — is ledgered against the scan row that grounds it.
--
-- **A free scan is not in this sum and cannot be.** `scans.site_id` is
-- null for every free-tier row, so no `site_id` argument can match one.
-- That is the right answer rather than a gap: a free scan has no customer
-- to charge, and the free path's own bounds are `FREE_BOUNDS`, enforced at
-- the door in `src/lib/scan/admission.ts`.
--
-- **No index is added, and none is needed.** Every column this read
-- filters on is already indexed: `idx_fetches_scan_id` serves the join,
-- `idx_scans_site_id` the site lookup, and `idx_fetches_created_at`
-- (`20260909200000_fetches_daily_spend.sql`, the only index on
-- `created_at` alone) the day predicate — the selective one, since a
-- site's ledger rows accumulate for as long as it is a customer and only
-- one day of them is ever wanted. `tests/costs/context.test.ts` already
-- holds that last index in place.
--
-- **Idempotent.** `create or replace function`, and nothing else: no
-- column, no row, no index and no grant elsewhere changes, so this file
-- can be applied twice or applied after a later one without effect.
--
-- `structure.md` rule 3: this file carries the `fetches` topic token
-- (`src/lib/db/topics.ts`, owner BP-007); `site` and `spend` narrow it and
-- are not a second topic — `topicOf()` resolves this filename to
-- `{ token: "fetches", owner: "BP-007" }`, exactly as it does for
-- `20260909200000_fetches_daily_spend.sql`.

create or replace function fetches_site_spend_since(p_site_id uuid, p_since timestamptz)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(f.cost_cents), 0)::numeric(12,4)
  from public.fetches f
  join public.scans s on s.id = f.scan_id
  where s.site_id = p_site_id
    and f.created_at >= p_since;
$$;

revoke all on function fetches_site_spend_since(uuid, timestamptz) from public;
revoke all on function fetches_site_spend_since(uuid, timestamptz) from anon;
revoke all on function fetches_site_spend_since(uuid, timestamptz) from authenticated;
grant execute on function fetches_site_spend_since(uuid, timestamptz) to service_role;
