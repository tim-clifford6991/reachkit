-- supabase/migrations/20260910090100_scans_money.sql
--
-- §6.5, issue #449 — the scan's roll-up follows the ledger's unit.
--
-- `scans.cost_cents` is the enforced roll-up: what `withCostContext`'s
-- close writes when a pass ends, and what `store_current_report` carries
-- into the row the report read serves. It was `integer`
-- (`00000000000001_baseline.sql`) for the same reason `fetches.cost_cents`
-- was, and it fails the same way — with the difference that the seam hid
-- it, because `src/lib/scan/store.ts` rounded the figure **up** to the
-- next whole cent (`Math.ceil`) on its way into the function's `integer`
-- parameter. A free pass that spent 0.72¢ was stored as 1¢; a pass that
-- spent 6.3¢ as 7¢. That is not a rounding nicety, it is the roll-up
-- disagreeing with the ledger it summarises, and after
-- `20260910090000_fetches_money.sql` there is nothing left to round for.
--
-- Two statements, and the reason each is here:
--
--  1. **`scans.cost_cents` becomes `numeric(12,4)`** — the unit
--     `20260910090000_fetches_money.sql` argues for in full, applied to
--     the roll-up so the summary and the rows it sums are one unit. The
--     seam's own write reaches this column straight through PostgREST
--     (`withCostContext`'s close), so the column type alone is what
--     decides whether a sub-cent free pass records what it spent.
--
--  2. **`store_current_report`'s `p_cost_cents` becomes `numeric`** — the
--     other write path to the same column. PostgREST casts an argument to
--     the parameter's declared type, so a `numeric` column behind an
--     `integer` parameter would still reject 0.72 at the door. A
--     parameter's type cannot be changed by `create or replace` (that
--     declares a second, overloaded function, which PostgREST then cannot
--     resolve), so the old thirteen-argument signature is dropped by that
--     exact signature and the function recreated. Everything else about
--     it is verbatim from `20260909130000_rls_functions_search_path.sql`,
--     its last definition: the same body, the same pinned empty
--     `search_path` (#384), the same schema-qualified tables, the same
--     two-statement pointer flip in the one order the partial unique
--     index permits.
--
-- **Idempotent.** `alter column ... type numeric(12,4)` against a column
-- already of that type rewrites nothing; `drop function if exists` on a
-- signature that has already been replaced is a no-op; `create or replace`
-- is one by construction. `integer` → `numeric` is implicit and lossless,
-- so every stored total keeps its value (gaining `.0000`) and no row moves.
--
-- `structure.md` rule 3: this file carries the `scans` topic token
-- (`src/lib/db/topics.ts`, owner BP-012); `money` narrows it and is not a
-- second topic. The ledger's own columns and `drafts`' roll-up are their
-- own topics' files, landing beside this one.

alter table scans alter column cost_cents type numeric(12,4);

drop function if exists store_current_report(
  uuid, text, uuid, text, text, integer, jsonb, jsonb, integer, text, text, uuid, boolean
);

create or replace function store_current_report(
  p_scan_id uuid,
  p_domain text,
  p_site_id uuid,
  p_tier text,
  p_status text,
  p_score integer,
  p_drivers jsonb,
  p_report jsonb,
  p_cost_cents numeric,
  p_stopped_reason text,
  p_correction_state text,
  p_supersedes_scan_id uuid,
  p_make_current boolean
) returns uuid
language plpgsql
set search_path = ''
as $$
begin
  -- 1. The row. A free pass adopts the row admission already inserted; a
  --    paid pass has none yet and inserts one under the id it was given.
  update public.scans set
    site_id            = coalesce(p_site_id, site_id),
    domain             = p_domain,
    tier               = p_tier,
    status             = p_status,
    score              = p_score,
    drivers            = p_drivers,
    report             = p_report,
    cost_cents         = p_cost_cents,
    finished_at        = now(),
    stopped_reason     = p_stopped_reason,
    correction_state   = p_correction_state,
    supersedes_scan_id = coalesce(p_supersedes_scan_id, supersedes_scan_id)
  where id = p_scan_id;

  if not found then
    insert into public.scans (
      id, site_id, domain, tier, status, score, drivers, report, cost_cents,
      finished_at, stopped_reason, correction_state, supersedes_scan_id
    ) values (
      p_scan_id, p_site_id, p_domain, p_tier, p_status, p_score, p_drivers, p_report,
      p_cost_cents, now(), p_stopped_reason, p_correction_state, p_supersedes_scan_id
    );
  end if;

  -- 2. The flip, in the one order the partial unique index permits: clear
  --    the domain's previous pointer, then set this row's. A pass that
  --    produced no report never reaches here, so a failed re-scan and a
  --    failed correction both leave the previous report untouched.
  if p_make_current then
    update public.scans set is_current = false
      where domain = p_domain and is_current and id <> p_scan_id;
    update public.scans set is_current = true where id = p_scan_id;
  end if;

  return p_scan_id;
end;
$$;
