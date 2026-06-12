-- §10.2 action-card fields + report payload (Task 5, Cycle 3)

alter table actions add column scan_id uuid references scans(id) on delete cascade;
alter table actions add column why text;
alter table actions add column evidence_ids bigint[] not null default '{}';
alter table actions add column draft_requires_edit boolean not null default true;
alter table actions add column verification jsonb;          -- { method: 'url'|'self_report'|'rank_check', state: 'pending' }
alter table actions add column basis text;                  -- 'evidence_based' | 'probability_based'
alter table actions add column confidence numeric(3,2);
create index on actions(scan_id);                           -- FK index (Postgres doesn't auto-index FKs)

alter table scans add column report_payload jsonb;           -- the four-question report (§5.6)
