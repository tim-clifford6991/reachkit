-- Deep-pass completion marker.
--
-- Free scans now persist a lightweight `report_payload`, so "report_payload
-- present" is no longer a reliable "the deep pass already ran" sentinel (it was
-- replaced by an actions-table check). But a deep pass that legitimately floors
-- to ZERO actions (critic drops all cards AND the deterministic floor throws)
-- would write no actions row, so the actions sentinel can under-report a
-- completed deep pass — risking a costly duplicate re-deepen. `deepened_at` is
-- set once at the end of runFullScan and is the unambiguous marker.
alter table scans add column if not exists deepened_at timestamptz;

comment on column scans.deepened_at is
  'Timestamp the deep pass (runFullScan) completed for this scan. NULL = never deepened. The robust "deep pass done" sentinel; see lib/scan/deepen.ts hasDeepReport().';

-- Backfill: existing scans that already ran the deep pass (have a persisted
-- action plan) are marked deepened so the new marker is correct for them too.
update scans s
set deepened_at = coalesce(s.completed_at, s.created_at)
where s.deepened_at is null
  and exists (select 1 from actions a where a.scan_id = s.id);
