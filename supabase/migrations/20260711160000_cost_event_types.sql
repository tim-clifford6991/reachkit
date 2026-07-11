-- Cost-transparency events (hardening Phase 3a/3d):
--   intel-spend — an interactive intel gather (intel / intel-stream / select /
--                 candidates) spent external DataForSEO/Tavily USD; payload tags
--                 the source surface so interactive spend is distinguishable
--                 from scan-pipeline spend on the same scan row.
--   cost-alert  — a cost threshold was crossed (per-scan all-in or per-user
--                 daily); surfaced on the owner-only /app/diagnostics.
alter table scan_events drop constraint scan_events_type_check;
alter table scan_events add constraint scan_events_type_check
  check (type in ('artifact','facts','findings','report','refresh','intel-spend','cost-alert','done','error'));
