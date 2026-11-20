-- supabase/migrations/20261120120000_rls_sessions_read_only.sql
--
-- A customer's session reads its own rows and writes none: every write the
-- app makes goes through `dbAdmin()` (service_role), so no session write is
-- needed. Only restricts: no table, column or select policy is touched, and
-- `service_role` keeps every privilege it had.

-- Every public table, today and any made later, refuses a session's write.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;

-- With RLS on and no write policy, a later grant still admits no row.
drop policy if exists users_update_own on public.users;
drop policy if exists sites_update_own on public.sites;
drop policy if exists drafts_update_own on public.drafts;
drop policy if exists destinations_insert_own on public.destinations;
drop policy if exists destinations_update_own on public.destinations;
drop policy if exists destinations_delete_own on public.destinations;
drop policy if exists site_profile_edits_insert_own on public.site_profile_edits;
drop policy if exists site_profile_edits_update_own on public.site_profile_edits;
drop policy if exists site_profile_edits_delete_own on public.site_profile_edits;
