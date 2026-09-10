-- supabase/migrations/20260910120000_users_identity_supabase_auth.sql
--
-- BUILD §13 (#468) — identity moves onto Supabase Auth. Sub-token
-- `users_identity` (BP-061's), like the two migrations it undoes.
--
-- Owner ruling 2026-09-10: "I don't buy or like that we have `auth_links` —
-- this should be wrapped into the Supabase auth system." Supabase's
-- `generateLink` now mints the one-time token and `verifyOtp` redeems it;
-- the session is Supabase's own. So the two things this schema held for a
-- home-made sign-in go:
--
--   * `auth_links` (and `auth_links_one_live_idx`, which goes with it) —
--     the SHA-256 token table from `20260906100100_users_identity_links.sql`.
--     It had no function or trigger of its own.
--   * `users.sessions_valid_from` — the stamp that ended every session at
--     once (`20260906100000_users_identity_columns.sql`). Ending sessions is
--     `auth.admin.signOut(token, 'global' | 'others')` now.
--
-- **`users.id` is `auth.users.id`**, rather than a new `auth_user_id`
-- column. The smaller migration: one constraint, no column, no backfill of
-- a second id, and no reader anywhere learns a new name — every `user_id`
-- foreign key in this schema already means the right thing. Provisioning
-- creates the `auth.users` row first and inserts `users` with its id
-- (`src/lib/account/store.ts`).
--
-- The foreign key is added **only where `auth.users` exists** — every
-- Supabase project, and not the repository's db substrate
-- (`scripts/db-substrate/`), which shims the `auth` schema's functions but
-- not GoTrue's tables. It is `not valid`: it binds every row written from
-- here on and does not re-check rows that predate it. It carries **no**
-- `on delete` action (ADR-051 point 2): the purge deletes `users` first and
-- the `auth.users` row after it (`src/lib/account/lifecycle/purge.ts`), so a
-- cascade nobody wrote can never do it instead.
--
-- Rollback (by hand, master only — PROCESS §3):
--   alter table users drop constraint if exists users_id_auth_users_fkey;
--   alter table users add column sessions_valid_from timestamptz;
--   -- then re-run the `create table auth_links …`, its grant, its RLS line
--   -- and `auth_links_one_live_idx` exactly as written in
--   -- 20260906100100_users_identity_links.sql. No row comes back: the
--   -- links were single-use and the old code would need redeploying too.

drop table if exists auth_links;

alter table users drop column if exists sessions_valid_from;

do $$
begin
  if to_regclass('auth.users') is not null
     and not exists (select 1 from pg_constraint where conname = 'users_id_auth_users_fkey') then
    alter table users
      add constraint users_id_auth_users_fkey
      foreign key (id) references auth.users (id)
      not valid;
  end if;
end
$$;

comment on column users.id is
  'The account''s auth.users.id (#468): Supabase Auth owns the sign-in link and the session; this row owns everything else.';
