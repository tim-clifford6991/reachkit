-- supabase/migrations/20260909130000_rls_functions_search_path.sql
--
-- BUILD §10 default-deny, issue #384 — the two things the Supabase security
-- advisor named after the 2026-09-08 cutover (`docs/DEPLOYMENT.md` §4), and
-- nothing else. No column, no index, no policy and no behaviour changes
-- here: every function below is the function that was already there, with a
-- search path it no longer inherits from its caller.
--
-- ── 1. `function_search_path_mutable` (WARN, eight functions) ───────────
--
-- A function created without a `set search_path` clause runs under
-- *whatever* path its caller has set. `store_current_report(...)` naming
-- `scans` therefore means "the first `scans` on the caller's path" — and a
-- role that may create objects can put its own `scans` in front of the real
-- one, so a call meant for the customer's report row writes somewhere else.
-- The three trigger functions are the sharper case: they fire on *someone
-- else's* statement, under that session's path, and two of them are the
-- only thing standing between an edit and an immutable-by-promise column
-- (`opportunities.acceptance`, `drafts.grounded_fact->>'passage'`).
--
-- The fix is one clause per function, `set search_path = ''` — an empty
-- path pinned to the function, which no caller can move. `pg_catalog` is
-- still searched implicitly for types, operators and built-ins (`now()`,
-- `coalesce`, `jsonb_build_array`, the `->>` and `||` operators), so the
-- only names that need spelling out are this schema's own tables, and they
-- are spelled `public.<table>` below. That is stricter than
-- `= pg_catalog, public`, which the issue also allowed: with an empty path
-- a table this schema gains later cannot be reached from these bodies by
-- accident — it has to be named.
--
-- **Every body below is copied from the migration that created it**, with
-- `scans` → `public.scans`, `drafts` → `public.drafts`, `sites` →
-- `public.sites`, `destinations` → `public.destinations` as the whole of
-- the change. The originals, which stay the place to read *why* each does
-- what it does:
--   * `20260905120000_scans_current_flip.sql`   store_current_report
--   * `20260906090000_opportunities_core.sql`   opportunities_acceptance_is_immutable
--   * `20260906090100_opportunities_supply.sql` opportunities_touch_status_changed_at
--   * `20260906120000_drafts_core.sql`          drafts_passage_is_immutable
--   * `20260906120100_drafts_publishing.sql`    publish_transition
--   * `20260906120300_drafts_veto.sql`          redeem_veto_token
--   * `20260906120400_sites_settings.sql`       save_publishing_settings
--   * `20260906130000_sites_setup.sql`          apply_setup_choice
--
-- `create or replace` keeps each function's oid, so the three triggers
-- created against them (`opportunities_acceptance_immutable`,
-- `opportunities_status_changed_at`, `drafts_passage_immutable`) are not
-- touched and do not need re-creating.
--
-- ── 2. `rls_enabled_no_policy` (INFO, four tables in `public`) ──────────
--
-- `auth_links`, `domain_blocks`, `email_suppressions` and `fetches` have
-- row-level security on and no policy at all. That is the design, not an
-- omission: BUILD §10's default-deny means a table nobody may read under a
-- request key carries *no* policy, and `dbAdmin()` (`service_role`,
-- `BYPASSRLS`) is its only reader. Each migration says so in its own
-- header; the advisor reads `pg_description`, so §3 below says it where the
-- advisor looks. The other two tables the advisor names live in schema
-- `v2_archive` — v2's frozen objects, kept as the cutover's rollback path
-- (`docs/DEPLOYMENT.md` §3.6) and not v3's to comment on or to change.
--
-- `structure.md` rule 3: topic token `rls`, BP-002's — this is the schema's
-- own default-deny/security posture, not any one leaf's table.

-- ── 1. The eight functions, each with a pinned, empty search path ───────

create or replace function store_current_report(
  p_scan_id uuid,
  p_domain text,
  p_site_id uuid,
  p_tier text,
  p_status text,
  p_score integer,
  p_drivers jsonb,
  p_report jsonb,
  p_cost_cents integer,
  p_stopped_reason text,
  p_correction_state text,
  p_supersedes_scan_id uuid,
  p_make_current boolean
) returns uuid
language plpgsql
set search_path = ''
as $$
begin
  -- 1. The row. A free pass adopts the row admission already inserted; a
  --    paid pass has none yet and inserts one under the id it was given.
  update public.scans set
    site_id            = coalesce(p_site_id, site_id),
    domain             = p_domain,
    tier               = p_tier,
    status             = p_status,
    score              = p_score,
    drivers            = p_drivers,
    report             = p_report,
    cost_cents         = p_cost_cents,
    finished_at        = now(),
    stopped_reason     = p_stopped_reason,
    correction_state   = p_correction_state,
    supersedes_scan_id = coalesce(p_supersedes_scan_id, supersedes_scan_id)
  where id = p_scan_id;

  if not found then
    insert into public.scans (
      id, site_id, domain, tier, status, score, drivers, report, cost_cents,
      finished_at, stopped_reason, correction_state, supersedes_scan_id
    ) values (
      p_scan_id, p_site_id, p_domain, p_tier, p_status, p_score, p_drivers, p_report,
      p_cost_cents, now(), p_stopped_reason, p_correction_state, p_supersedes_scan_id
    );
  end if;

  -- 2. The flip, in the one order the partial unique index permits: clear
  --    the domain's previous pointer, then set this row's. A pass that
  --    produced no report never reaches here, so a failed re-scan and a
  --    failed correction both leave the previous report untouched.
  if p_make_current then
    update public.scans set is_current = false
      where domain = p_domain and is_current and id <> p_scan_id;
    update public.scans set is_current = true where id = p_scan_id;
  end if;

  return p_scan_id;
end;
$$;

create or replace function opportunities_acceptance_is_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.acceptance is distinct from old.acceptance then
    raise exception
      'opportunities.acceptance is written once and never rewritten (opportunity %)', old.id
      using errcode = 'integrity_constraint_violation';
  end if;
  return new;
end;
$$;

create or replace function opportunities_touch_status_changed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

create or replace function drafts_passage_is_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.grounded_fact is not null
     and (old.grounded_fact ->> 'passage') is distinct from (new.grounded_fact ->> 'passage') then
    raise exception
      'drafts.grounded_fact->>''passage'' is written once and never rewritten (BUILD §8 hard rule 1)';
  end if;
  return new;
end;
$$;

create or replace function publish_transition(
  p_draft_id uuid,
  p_from text,
  p_to text,
  p_record jsonb
) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  moved integer;
begin
  update public.drafts set
    state = p_to,
    transitions = coalesce(transitions, '[]'::jsonb) || jsonb_build_array(p_record),
    publishable_since = case
      when p_to in ('in_review', 'approved', 'failed') then coalesce(publishable_since, now())
      when p_to in ('published', 'skipped', 'unpublished') then null
      else publishable_since
    end
  where id = p_draft_id and state = p_from;

  get diagnostics moved = row_count;
  return moved = 1;
end;
$$;

-- `returning drafts.id` still resolves: qualifying the target with its
-- schema does not rename the range table entry, which is the bare relation
-- name either way.
create or replace function redeem_veto_token(
  p_token_hash text,
  p_now timestamptz
) returns table (draft_id uuid, state text)
language plpgsql
set search_path = ''
as $$
begin
  return query
  update public.drafts set veto_token_used_at = p_now
  where veto_token_hash = p_token_hash
    and veto_token_used_at is null
    and (veto_token_expires_at is null or veto_token_expires_at > p_now)
  returning drafts.id, drafts.state;
end;
$$;

create or replace function save_publishing_settings(
  p_site_id uuid,
  p_mode text,
  p_veto_hours integer,
  p_publish_time time,
  p_timezone text,
  -- `[{ "draft_id": uuid, "veto_deadline": timestamptz, "clear_told": bool }]`
  p_drafts jsonb
) returns integer
language plpgsql
set search_path = ''
as $$
declare
  touched integer;
begin
  update public.sites set
    mode = p_mode,
    veto_hours = p_veto_hours,
    publish_time = p_publish_time,
    -- A null zone is never written over a stated one by this path: the
    -- caller always passes the zone in force, so `p_timezone` is the
    -- customer's own value whether or not this save changed it.
    timezone = p_timezone
  where id = p_site_id;

  -- `rows` is a CTE, not a relation: it is resolved before any search path
  -- is consulted and is deliberately left unqualified.
  with rows as (
    select
      (entry ->> 'draft_id')::uuid as draft_id,
      (entry ->> 'veto_deadline')::timestamptz as veto_deadline,
      (entry ->> 'clear_told')::boolean as clear_told
    from jsonb_array_elements(coalesce(p_drafts, '[]'::jsonb)) as entry
  )
  update public.drafts set
    veto_deadline = rows.veto_deadline,
    -- REQ-057 c8: the telling is re-opened, never sent from here. Clearing
    -- the record is what makes `customer_told` hold the page until the
    -- customer has been told again on the pair now in force.
    told = case when rows.clear_told then null else drafts.told end
  from rows
  where drafts.id = rows.draft_id and drafts.site_id = p_site_id;

  get diagnostics touched = row_count;
  return touched;
end;
$$;

create or replace function apply_setup_choice(
  p_site_id uuid,
  p_mode text,
  p_kind text
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_destination_id uuid;
begin
  update public.sites set mode = p_mode where id = p_site_id;
  if not found then
    raise exception 'apply_setup_choice: no site % exists', p_site_id;
  end if;

  insert into public.destinations (site_id, kind, config, health)
  values (p_site_id, p_kind, null, 'expired')
  returning id into v_destination_id;

  return v_destination_id;
end;
$$;

-- ── 2. The policy-less tables, said where the advisor looks ─────────────
--
-- `auth_links` already carries a table comment (`20260906100100_users_
-- identity_links.sql`); its sentence is carried forward here rather than
-- replaced, because `comment on table` overwrites rather than appends.

comment on table auth_links is
  'One-time sign-in and email-change links. BUILD §10''s tenth table; every sign-in reads it (BP-061). '
  'dbAdmin()-only; BUILD §10 default-deny; no anon/authenticated policy by design.';

comment on table domain_blocks is
  'Domains refused a scan, one row per written request (REQ-002 c4). '
  'dbAdmin()-only; BUILD §10 default-deny; no anon/authenticated policy by design.';

comment on table email_suppressions is
  'Addresses that must not be mailed — an opt-out, or an address that subscribed. '
  'dbAdmin()-only; BUILD §10 default-deny; no anon/authenticated policy by design.';

comment on table fetches is
  'The vendor-fetch ledger and cache: what each scan paid for, and what came back. '
  'dbAdmin()-only; BUILD §10 default-deny; no anon/authenticated policy by design.';
