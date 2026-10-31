-- A sign-in link asked for again within 15 minutes is the same link (REQ-024 c4,
-- owner default 2026-10-31). Expand-only: two nullable columns that inherit the
-- `users` RLS (default-deny; only the service role reads or writes them).
alter table public.users
  add column if not exists signin_link_sealed text,
  add column if not exists signin_link_issued_at timestamptz;

comment on column public.users.signin_link_sealed is
  'The live sign-in link''s token hash, AES-256-GCM sealed under its own HKDF label. Null once redeemed.';
comment on column public.users.signin_link_issued_at is
  'When the sealed sign-in link was minted. Re-sent only while younger than 15 minutes.';
