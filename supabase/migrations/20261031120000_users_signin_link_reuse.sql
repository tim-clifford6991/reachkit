-- A sign-in link asked for again within 15 minutes is the same link (REQ-024 c4,
-- owner default 2026-10-31). Its own table, not columns on `users`, because
-- `users_select_own` / `users_update_own` would hand a session its own sealed
-- link. RLS on, no policy, no grant to anon or authenticated: only `dbAdmin()`
-- (`service_role`) reads or writes it. Expand-only.
create table if not exists public.signin_links (
  user_id uuid primary key references public.users(id) on delete cascade,
  sealed text not null,
  issued_at timestamptz not null
);

alter table public.signin_links enable row level security;

revoke all on public.signin_links from anon, authenticated;
grant select, insert, update, delete on public.signin_links to service_role;

comment on table public.signin_links is
  'The live sign-in link''s token hash, AES-256-GCM sealed under its own HKDF label, and when it was minted. '
  'Re-sent only while younger than 15 minutes; deleted once redeemed. dbAdmin()-only; no policy by design.';
