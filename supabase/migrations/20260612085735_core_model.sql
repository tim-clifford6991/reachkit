create extension if not exists "pgcrypto";

create table apps (
  id uuid primary key default gen_random_uuid(),
  store_url text not null,
  platform text not null check (platform in ('ios','android','web')),
  name text, category text,
  icp_mode text,
  business_type text check (business_type in ('b2c_consumer','prosumer','b2b')),
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  app_ids uuid[] not null default '{}',
  tier text not null default 'free' check (tier in ('free','solo','growth')),
  founder_voice jsonb,
  created_at timestamptz not null default now()
);

create table scans (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','collecting','extracting','synthesizing','critiquing','formatting','done','degraded','failed')),
  tier text not null default 'free' check (tier in ('free','full')),
  score_total int, score_breakdown jsonb,
  started_at timestamptz, completed_at timestamptz,
  cost_cents int not null default 0
);

create table evidence (
  id bigint generated always as identity primary key,
  scan_id uuid not null references scans(id) on delete cascade,
  source_type text not null,
  url text, excerpt text,
  captured_at timestamptz not null default now()
);

create table findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  category text not null,
  basis text not null check (basis in ('evidence_based','probability_based')),
  confidence numeric(3,2) not null,
  body jsonb not null,
  evidence_ids bigint[] not null default '{}'
);

create table actions (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(id) on delete cascade,
  category text not null,
  title text not null, effort_min int, deadline date,
  expected_outcome jsonb,
  draft text, status text not null default 'pending',
  verify_url text, verify_state text not null default 'pending',
  score_component text, created_at timestamptz not null default now()
);

create table score_snapshots (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(id) on delete cascade,
  taken_at timestamptz not null default now(),
  total int not null, breakdown jsonb not null,
  installs_reported int
);

create table competitors (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(id) on delete cascade,
  competitor_store_url text, name text,
  source text not null, confirmed boolean not null default false
);

create table monitors (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(id) on delete cascade,
  kind text not null,
  query text, cadence text not null default 'weekly',
  last_run_at timestamptz,
  watermark jsonb not null default '{}'
);

-- Foreign-key indexes: Postgres does not auto-index FKs, and these are all hot
-- parent-id lookups ("this app's scans/actions/competitors", "this scan's evidence/findings").
create index on scans(app_id);
create index on evidence(scan_id);
create index on findings(scan_id);
create index on actions(app_id);
create index on score_snapshots(app_id);
create index on competitors(app_id);
create index on monitors(app_id);
