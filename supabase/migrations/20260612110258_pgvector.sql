create extension if not exists vector;

-- One embeddings table for all semantic content (§5.7: reviews, threads, PAA, positioning, findings, drafts)
create table embeddings (
  id bigint generated always as identity primary key,
  subject_type text not null,          -- 'review' | 'thread' | 'question' | 'positioning' | 'finding' | 'draft'
  subject_key text not null,
  app_id uuid references apps(id) on delete cascade,
  content text not null,
  embedding vector(1024) not null,     -- dimension is a deliberate placeholder; the embedding model is chosen in Cycle 2 and this is re-confirmed/migrated then
  model text not null,
  model_version text not null,
  created_at timestamptz not null default now()
);
create index embeddings_hnsw_idx on embeddings using hnsw (embedding vector_cosine_ops);
create index embeddings_subject_idx on embeddings (subject_type, app_id);

create or replace function match_embeddings(query vector(1024), match_count int)
returns table (content text, similarity float)
language sql stable as $$
  select content, 1 - (embedding <=> query) as similarity
  from embeddings order by embedding <=> query limit match_count;
$$;