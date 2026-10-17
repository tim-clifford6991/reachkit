-- supabase/migrations/20261017120000_rls_privileges.sql
--
-- Issue 1483 — no function in `public` is executable by a session by
-- default, and every RLS policy reads `auth.uid()` once per statement.
--
-- **1. The default.** Postgres grants `execute` on every new function to
-- `PUBLIC`, and the project's default privileges (`pg_default_acl`, role
-- `postgres`, schema `public`, type `f`) grant it to `anon` and
-- `authenticated` as well. Each service-only function so far revoked the
-- three by hand; one that forgot (`known_content_near`, issue 1472) was
-- callable with the publishable key. After this file a new function in
-- `public` is executable by its owner and `service_role` only, and a
-- function a session must call is granted to it by name, in its own
-- migration. The `PUBLIC` default is global (Postgres cannot revoke a global
-- default per schema), so it binds the functions this role creates anywhere.
--
-- **2. The functions still open.** Nine were created under the old default
-- and never revoked. Every RPC caller among them goes through `dbAdmin()`
-- (`service_role`): `store_current_report` (src/lib/scan/store.ts),
-- `apply_setup_choice` (src/lib/publish/setup/apply.ts), and
-- `publish_transition`, `save_publishing_settings` and `redeem_veto_token`
-- (`publishDb()`, src/lib/publish/db.ts). The other four are trigger
-- functions; Postgres checks `execute` on a trigger function when the
-- trigger is created, never when it fires, so a session's update still runs
-- them. `service_role` is granted each by name, so `dbAdmin()` keeps its
-- access whatever the default was when the function was made.
--
-- **3. The policies.** The advisor's `auth_rls_initplan`: a bare
-- `auth.uid()` in a policy is evaluated per row; `(select auth.uid())` is an
-- init plan, evaluated once per statement. The same value either way, so
-- every policy admits exactly the rows it admitted before. `alter policy`
-- keeps each policy's command and roles; only the expressions change, and
-- each keeps its `deleted_at is null` (ADR-051 point 3).
--
-- `tests/db/function-privileges.test.ts` (`schema · RLS`) fails a function
-- in `public` a session can execute that is not allow-listed there, and a
-- policy that calls `auth.uid()` bare.
--
-- Not applied by the PR that adds it; applied after merge through the
-- Supabase connector (docs/PROCESS.md step 4).

-- ── 1. The default ───────────────────────────────────────────────────────

alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges revoke execute on functions from public;
alter default privileges in schema public grant execute on functions to service_role;

-- ── 2. The functions still open ──────────────────────────────────────────

revoke all on function store_current_report(uuid, text, uuid, text, text, integer, jsonb, jsonb, numeric, text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function store_current_report(uuid, text, uuid, text, text, integer, jsonb, jsonb, numeric, text, text, uuid, boolean) to service_role;

revoke all on function apply_setup_choice(uuid, text, text, text) from public, anon, authenticated;
grant execute on function apply_setup_choice(uuid, text, text, text) to service_role;

revoke all on function publish_transition(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function publish_transition(uuid, text, text, jsonb) to service_role;

revoke all on function save_publishing_settings(uuid, text, integer, time, text, jsonb) from public, anon, authenticated;
grant execute on function save_publishing_settings(uuid, text, integer, time, text, jsonb) to service_role;

revoke all on function redeem_veto_token(text, timestamptz) from public, anon, authenticated;
grant execute on function redeem_veto_token(text, timestamptz) to service_role;

revoke all on function drafts_passage_is_immutable() from public, anon, authenticated;
grant execute on function drafts_passage_is_immutable() to service_role;

revoke all on function opportunities_acceptance_is_immutable() from public, anon, authenticated;
grant execute on function opportunities_acceptance_is_immutable() to service_role;

revoke all on function opportunities_touch_status_changed_at() from public, anon, authenticated;
grant execute on function opportunities_touch_status_changed_at() to service_role;

revoke all on function publications_acceptance_is_immutable() from public, anon, authenticated;
grant execute on function publications_acceptance_is_immutable() to service_role;

-- ── 3. The policies ──────────────────────────────────────────────────────

alter policy users_select_own on public.users
  using (id = (select auth.uid()) and deleted_at is null);

alter policy users_update_own on public.users
  using (id = (select auth.uid()) and deleted_at is null)
  with check (id = (select auth.uid()) and deleted_at is null);

alter policy sites_select_own on public.sites
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.users u where u.id = sites.user_id and u.deleted_at is null)
  );

alter policy sites_update_own on public.sites
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.users u where u.id = sites.user_id and u.deleted_at is null)
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.users u where u.id = sites.user_id and u.deleted_at is null)
  );

alter policy scans_select_own on public.scans
  using (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.id = (select auth.uid()) and u.deleted_at is null
    )
  );

alter policy opportunities_select_own on public.opportunities
  using (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.id = (select auth.uid()) and u.deleted_at is null
    )
  );

alter policy drafts_select_own on public.drafts
  using (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.id = (select auth.uid()) and u.deleted_at is null
    )
  );

alter policy drafts_update_own on public.drafts
  using (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.id = (select auth.uid()) and u.deleted_at is null
    )
  )
  with check (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.id = (select auth.uid()) and u.deleted_at is null
    )
  );

alter policy publications_select_own on public.publications
  using (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.id = (select auth.uid()) and u.deleted_at is null
    )
  );

alter policy destinations_select_own on public.destinations
  using (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.id = (select auth.uid()) and u.deleted_at is null
    )
  );

alter policy destinations_insert_own on public.destinations
  with check (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.id = (select auth.uid()) and u.deleted_at is null
    )
  );

alter policy destinations_update_own on public.destinations
  using (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.id = (select auth.uid()) and u.deleted_at is null
    )
  )
  with check (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.id = (select auth.uid()) and u.deleted_at is null
    )
  );

alter policy destinations_delete_own on public.destinations
  using (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.id = (select auth.uid()) and u.deleted_at is null
    )
  );

alter policy leads_select_own on public.leads
  using (
    scan_id in (
      select sc.id from public.scans sc
      join public.sites s on s.id = sc.site_id
      join public.users u on u.id = s.user_id
      where u.id = (select auth.uid()) and u.deleted_at is null
    )
  );

alter policy page_verdicts_select_own on public.page_verdicts
  using (
    site_id in (
      select s.id from public.sites s
      join public.users u on u.id = s.user_id
      where u.id = (select auth.uid()) and u.deleted_at is null
    )
  );

alter policy site_profiles_select_own on public.site_profiles
  using (
    exists (
      select 1
        from public.sites s
        join public.users u on u.id = s.user_id
       where s.domain = site_profiles.domain
         and s.user_id = (select auth.uid())
         and u.deleted_at is null
    )
  );

alter policy site_profile_edits_select_own on public.site_profile_edits
  using (
    exists (
      select 1
        from public.sites s
        join public.users u on u.id = s.user_id
       where s.id = site_profile_edits.site_id
         and s.user_id = (select auth.uid())
         and u.deleted_at is null
    )
  );

alter policy site_profile_edits_insert_own on public.site_profile_edits
  with check (
    exists (
      select 1
        from public.sites s
        join public.users u on u.id = s.user_id
       where s.id = site_profile_edits.site_id
         and s.user_id = (select auth.uid())
         and u.deleted_at is null
    )
  );

alter policy site_profile_edits_update_own on public.site_profile_edits
  using (
    exists (
      select 1
        from public.sites s
        join public.users u on u.id = s.user_id
       where s.id = site_profile_edits.site_id
         and s.user_id = (select auth.uid())
         and u.deleted_at is null
    )
  )
  with check (
    exists (
      select 1
        from public.sites s
        join public.users u on u.id = s.user_id
       where s.id = site_profile_edits.site_id
         and s.user_id = (select auth.uid())
         and u.deleted_at is null
    )
  );

alter policy site_profile_edits_delete_own on public.site_profile_edits
  using (
    exists (
      select 1
        from public.sites s
        join public.users u on u.id = s.user_id
       where s.id = site_profile_edits.site_id
         and s.user_id = (select auth.uid())
         and u.deleted_at is null
    )
  );

alter policy known_content_select_own on public.known_content
  using (
    exists (
      select 1
        from public.sites s
        join public.users u on u.id = s.user_id
       where s.id = known_content.site_id
         and s.user_id = (select auth.uid())
         and u.deleted_at is null
    )
  );

alter policy publication_reads_select_own on public.publication_reads
  using (
    exists (
      select 1
        from public.sites s
        join public.users u on u.id = s.user_id
       where s.id = publication_reads.site_id
         and s.user_id = (select auth.uid())
         and u.deleted_at is null
    )
  );
