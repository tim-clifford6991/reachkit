-- Idempotent-upsert key for monitor seeding (Cycle 4 Task 7): one monitor row
-- per (app_id, kind) so seedMonitors can upsert with onConflict "app_id,kind"
-- and a re-run never duplicates monitors.
create unique index if not exists monitors_app_kind_uniq on monitors (app_id, kind);
