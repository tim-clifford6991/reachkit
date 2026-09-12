-- supabase/migrations/20260912120000_destinations_hostname.sql
--
-- SPEC §5 (issue #322) — the hostname a customer's pages are served at,
-- and what the project's domain list says about it.
--
-- §5's ruling of 2026-09-12 ("Own CMS is white-label on the customer's
-- subdomain") made the subdomain label a choice: the pages are served at
-- `<label>.<customer-domain>`, and the label is chosen in step 3 of
-- onboarding. Until now the host was a pure function of `sites.domain` and
-- one pinned label, so there was nothing to store and nothing to look a
-- Host header up against.
--
-- **Three columns, on `destinations` and not on `sites`.** The host is a
-- fact about *where this site publishes*, which is what a destination row
-- is; a site that disconnects its hosted destination and connects
-- WordPress has no hosted hostname any more, and a column on `sites` would
-- outlive the thing it describes. The issue states it directly: the
-- verification state is stored "on the destination row".
--
--   hostname             `<label>.<domain>`, as the customer's CNAME names
--                        it and as the edge matches a Host header against
--                        it. Null for a destination with no host of its
--                        own — every WordPress row, and a hosted row
--                        created before this migration, which the default
--                        label still serves.
--   hostname_state       what the project's domain list says: the record
--                        has not resolved yet, or it has and the pages are
--                        served. Two members and no third — §5 rules the
--                        customer reads "waiting for DNS" or "live", and a
--                        third value here would be a third word somebody
--                        has to invent.
--   hostname_checked_at  when the vendor was last asked. The customer
--                        never reads it; it is what keeps a re-check from
--                        being made on every render.
--
-- Rule 3: the filename carries the `destinations` topic token.

alter table destinations
  add column hostname text null,
  add column hostname_state text null
    check (hostname_state in ('pending_dns', 'live')),
  add column hostname_checked_at timestamptz null;

comment on column destinations.hostname is
  'SPEC §5 (2026-09-12) — `<label>.<customer-domain>`: the host the customer CNAMEs, the host added to the project''s domain list, and the host the edge resolves. Null for a destination that serves at no host of its own.';

comment on column destinations.hostname_state is
  'SPEC §5 (2026-09-12) — what the project''s domain list says: `pending_dns` reads as "waiting for DNS", `live` reads as "live". Two members, because the customer reads two words.';

-- ONE PROJECT, ONE HOSTNAME.
--
-- The same shape of invariant as `destinations_one_live_per_site`, for the
-- same reason: a host that two live destinations claim is a Host header
-- with two answers, and the edge would serve whichever row it read first.
-- Lower-cased because a hostname is case-insensitive and the customer who
-- types `Blog` and the customer who types `blog` have chosen one host.
--
-- Partial, on a live row with a host: a disconnected destination keeps its
-- row (ADR-080) and must not hold a hostname the customer is re-connecting.
create unique index destinations_one_live_hostname
  on destinations (lower(hostname))
  where deleted_at is null and hostname is not null;

comment on index destinations_one_live_hostname is
  'SPEC §5 — a hostname is claimed by at most one live destination, so the edge''s Host lookup has exactly one answer. A soft-deleted row is out of the index.';

-- BUILD §4.3's mode-and-destination transaction, carrying the host.
--
-- The same two writes as before plus the host the founder chose, still
-- committing together: a destination row written without the hostname the
-- founder was shown the record for is a founder who pointed a CNAME at a
-- host nothing serves.
--
-- **The old three-argument function is dropped and replaced by one whose
-- fourth argument defaults.** Overloading instead would make every existing
-- three-argument call ambiguous; defaulting means the running deployment's
-- own call — which names `p_site_id`, `p_mode` and `p_kind` — keeps
-- resolving to this function and keeps working across the deploy, writing
-- a null hostname exactly as it did before.
--
-- **The pinned, empty search path comes with it** (issue #384's hardening,
-- `20260909130000_rls_functions_search_path.sql`). A redefinition that
-- dropped the clause would hand this function's path back to its caller,
-- which is exactly the advisor finding that migration closed — so the
-- clause and the `public.`-qualified table names are part of the body here
-- and not an afterthought somebody re-applies later.
drop function if exists apply_setup_choice(uuid, text, text);

create or replace function apply_setup_choice(
  p_site_id uuid,
  p_mode text,
  p_kind text,
  p_hostname text default null
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

  insert into public.destinations (site_id, kind, config, health, hostname, hostname_state)
  values (
    p_site_id,
    p_kind,
    null,
    'expired',
    p_hostname,
    -- A host nobody has pointed yet is waiting for DNS, and that is the
    -- state it is created in rather than a null somebody has to read as
    -- one. A destination with no host of its own has no such state.
    case when p_hostname is null then null else 'pending_dns' end
  )
  returning id into v_destination_id;

  return v_destination_id;
end;
$$;
