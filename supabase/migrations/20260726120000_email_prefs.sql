-- Email preferences per user (intake 2026-07-26-email-system).
-- A jsonb map of { emailType: boolean }. Absent key ⇒ the type's DEFAULT applies
-- (see lib/email/prefs.ts DEFAULT_ON) — so an existing user with '{}' gets the
-- sensible defaults (weekly/status on, daily off) without a backfill.
alter table public.users
  add column if not exists email_prefs jsonb not null default '{}'::jsonb;

comment on column public.users.email_prefs is
  'Per-type email opt-in/out map {emailType: boolean}. Absent key ⇒ type default (lib/email/prefs.ts).';
