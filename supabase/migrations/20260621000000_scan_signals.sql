-- 18-signal Discoverability engine: per-signal contribution rows + score versioning.
-- Powers the explainability panel, the breakdown chart, and signal-scoped action
-- verification. Written by the scan pipeline (service-role).

-- Scoring-model version stamp (current production model = 1). Bumped when the
-- signal set / weights change, so history is never retroactively re-scored.
alter table scans
  add column if not exists score_version int not null default 1,
  add column if not exists rank_data_fetched_at timestamptz;

-- History points gain a model version + provenance + optional action linkage
-- (action_id non-null => the point is an action-completion marker on the chart).
alter table score_snapshots
  add column if not exists score_version int not null default 1,
  add column if not exists source text,
  add column if not exists scan_id uuid references scans(id) on delete set null,
  add column if not exists action_id uuid references actions(id) on delete set null;

-- The signal keys an action targets, for scoped re-evaluation at verify time.
alter table actions
  add column if not exists signal_keys text[] not null default '{}';

-- One row per (scan, signal): the persisted 18-signal contribution detail.
create table if not exists scan_signals (
  id           bigint generated always as identity primary key,
  scan_id      uuid not null references scans(id) on delete cascade,
  signal_key   text not null,
  pillar       text not null check (pillar in ('content', 'outreach', 'seo')),
  raw_value    numeric,
  normalised   numeric,
  weight       numeric not null,
  contribution numeric,
  state        text not null check (state in ('pass', 'warn', 'fail', 'unmeasured')),
  platform     text,
  created_at   timestamptz not null default now()
);

create index if not exists scan_signals_scan_idx on scan_signals (scan_id);
create unique index if not exists scan_signals_scan_signal_uidx on scan_signals (scan_id, signal_key);

create index if not exists score_snapshots_action_idx
  on score_snapshots (action_id) where action_id is not null;

-- Service-role only (matches score_snapshots / market_snapshots). An owner-read
-- policy is added when the dashboard surfaces signals to authenticated clients.
alter table scan_signals enable row level security;
