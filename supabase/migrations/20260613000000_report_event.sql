alter table scan_events drop constraint scan_events_type_check;
alter table scan_events add constraint scan_events_type_check check (type in ('artifact','facts','findings','report','done','error'));
