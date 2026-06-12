-- Drop the original 2-arg signature so Postgres does not have an ambiguous overload.
-- The new 4-arg version (with defaults) satisfies 2-arg callers transparently.
drop function if exists match_embeddings(vector, int);

create or replace function match_embeddings(
  query vector(1024),
  match_count int,
  p_subject_type text default null,
  p_app_id uuid default null
)
returns table (content text, similarity float)
language sql stable as $$
  select content, 1 - (embedding <=> query) as similarity
  from embeddings
  where (p_subject_type is null or subject_type = p_subject_type)
    and (p_app_id is null or app_id = p_app_id)
  order by embedding <=> query limit match_count;
$$;
