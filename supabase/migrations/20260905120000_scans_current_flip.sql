-- supabase/migrations/20260905120000_scans_current_flip.sql
--
-- BUILD §4.1, §6.5 (issue #25) — the write half of the current-report
-- pointer: one function, so "insert the new scan and flip the pointer" is
-- one transaction and not three round trips a crash can land between.
--
-- **Why a function and not application code.** `20260904110000_scans_current.sql`
-- made two current reports for one domain unrepresentable with a partial
-- unique index. That index also fixes the order the flip must happen in:
-- the previous row's `is_current` has to be cleared *before* the new row's
-- is set, or the index rejects the write. Those are two statements, and
-- the only client any code here may hold is a PostgREST client
-- (`dbAdmin()`), where each `.from(...)` is its own HTTP request and its
-- own implicit transaction — the same limitation `src/lib/scan/admission.ts`
-- documents for `claimFreeScanSlot`. Between two such requests a crash
-- would leave the domain with **no** current report at all: the customer's
-- report would vanish from its own address because a *new* scan failed
-- halfway through storing. A plpgsql body runs inside one transaction, so
-- the clear and the set commit together or not at all, and the flip is the
-- commit point — anything that fails before it leaves the previous report
-- and its date exactly where they were.
--
-- No trigger, no advisory lock and no row-level pessimistic lock appears
-- here.
-- The partial unique index is still the constraint; this function only
-- makes the two statements it forces atomic.
--
-- `structure.md` rule 3a: the name carries the bare `scans` topic
-- (BP-012's own), the same way `*_scans_current.sql` does — this is that
-- node's own pointer, not a leaf beneath it. It adds no column and no
-- index; `scans.status`, `stopped_reason`, `is_current`,
-- `supersedes_scan_id` and `correction_state` are all already on the table.

create or replace function store_current_report(
  p_scan_id uuid,
  p_domain text,
  p_site_id uuid,
  p_tier text,
  p_status text,
  p_score integer,
  p_drivers jsonb,
  p_report jsonb,
  p_cost_cents integer,
  p_stopped_reason text,
  p_correction_state text,
  p_supersedes_scan_id uuid,
  p_make_current boolean
) returns uuid
language plpgsql
as $$
begin
  -- 1. The row. A free pass adopts the row admission already inserted; a
  --    paid pass has none yet and inserts one under the id it was given.
  update scans set
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
    insert into scans (
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
    update scans set is_current = false
      where domain = p_domain and is_current and id <> p_scan_id;
    update scans set is_current = true where id = p_scan_id;
  end if;

  return p_scan_id;
end;
$$;
