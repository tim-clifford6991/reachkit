-- scripts/db-substrate/shim.sql
--
-- The parts of a Supabase database that live outside `supabase/migrations/`
-- and that the `db` vitest project depends on: the three request roles, the
-- `auth` schema, and the `auth.uid()` / `auth.role()` shims every
-- request-scoped RLS policy calls.
--
-- Applied by `up.sh` to a bare PostgreSQL 18 cluster. Idempotent: safe to
-- re-run against a database that already has it.

-- The three roles Supabase gives every project. None can log in: PostgREST
-- connects as the owner and `set role`s into one of them per request.
-- `service_role` bypasses RLS, which is what makes `dbAdmin()` an admin
-- client at all.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Real Supabase's own shims read `request.jwt.claims` — the single JSON GUC
-- PostgREST sets from the verified token — not the per-claim
-- `request.jwt.claim.*` GUCs, which PostgREST 16.2 does not set at all. A
-- policy calling `auth.uid()` against the per-claim GUCs is silently always
-- null, so RLS is unobservable; these read the JSON GUC, as production does.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'sub'),
    ''
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select nullif(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role'),
    ''
  )
$$;
