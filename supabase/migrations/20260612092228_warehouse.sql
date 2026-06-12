-- Layer 1: raw evidence (immutable, append-only, content-hash deduped)
create table raw_documents (
  id bigint generated always as identity primary key,
  subject_type text not null,
  subject_key text not null,
  source_type text not null,
  url text,
  content_hash text not null,
  body jsonb,
  fetched_at timestamptz not null default now(),
  mode text not null check (mode in ('ios','android','web')),
  unique (subject_type, subject_key, content_hash)
);

-- Layer 2: compressed fact sheets (cheap-model output, shared, TTL'd)
create table fact_sheets (
  id bigint generated always as identity primary key,
  subject_type text not null, subject_key text not null,
  kind text not null,
  body jsonb not null,
  evidence_ids bigint[] not null default '{}',
  model_version text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  shared boolean not null default true
);
create index fact_sheets_subject_idx on fact_sheets (subject_type, subject_key, kind);
create index fact_sheets_expiry_idx on fact_sheets (expires_at);

-- Layer 3: outcomes (the compounding moat)
create table outcomes (
  id uuid primary key default gen_random_uuid(),
  action_id uuid references actions(id) on delete set null,
  app_id uuid not null references apps(id) on delete cascade,
  verified_signal text,
  observed_delta jsonb,
  observed_at timestamptz not null default now()
);
-- FK indexes (consistent with the core-model migration; Postgres doesn't auto-index FKs)
create index on outcomes(app_id);
create index on outcomes(action_id);

-- Cost telemetry (margin enforcement, §13)
create table pipeline_runs (
  id bigint generated always as identity primary key,
  scan_id uuid references scans(id) on delete cascade,
  stage text not null,
  model text,
  tokens_in int not null default 0, tokens_out int not null default 0,
  cost_cents numeric(8,3) not null default 0,
  critic_rejections int not null default 0,
  duration_ms int not null default 0,
  created_at timestamptz not null default now()
);
create index pipeline_runs_scan_idx on pipeline_runs (scan_id);
