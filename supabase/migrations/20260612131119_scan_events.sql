create table scan_events (
  id bigint generated always as identity primary key,
  scan_id uuid not null references scans(id) on delete cascade,
  type text not null check (type in ('artifact','facts','done','error')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index scan_events_scan_idx on scan_events (scan_id, id);
alter table scan_events enable row level security;  -- service-role only; the SSE route reads via the service client

alter table scans add column preliminary_facts jsonb;
