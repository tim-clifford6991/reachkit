alter table scans add column findings_payload jsonb;

-- allow the new event type
alter table scan_events drop constraint scan_events_type_check;
alter table scan_events add constraint scan_events_type_check check (type in ('artifact','facts','findings','done','error'));
