-- Market history (ChannelIntel Phase 2) — weekly per-app snapshot of the
-- competitive picture, so the report can show trends + "you vs rival median"
-- benchmarks over time. `score_snapshots` already covers the user's own score;
-- this extends history to the cohort (self + rivals).
--
-- Written by the weekly refresh (service-role). RLS enabled with NO policy =>
-- service-role only, matching score_snapshots; an owner-read policy is added when
-- the trend UI surfaces it.

create table if not exists market_snapshots (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(id) on delete cascade,
  taken_at timestamptz not null default now(),
  -- Normalised summary: { self: {...}, rivals: [...], shareOfVoice, demandPocketCount }
  summary jsonb not null
);

create index if not exists market_snapshots_app_id_idx on market_snapshots (app_id);
create index if not exists market_snapshots_taken_at_idx on market_snapshots (taken_at);

alter table market_snapshots enable row level security;
