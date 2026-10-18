-- supabase/migrations/20261017130000_fetches_attribution.sql
--
-- Issue 1478 · SPEC §6 (owner, 2026-10-17): "review costs per user, per day
-- and per week to have complete transparency."
--
-- The ledger knew a call's scan and nothing else. A site was reached through
-- `scans.site_id`, a draft's calls were keyed to the scan that grounds it and
-- looked like that pass's own, and a failed or timed-out call could not be
-- told from one that answered. `scans.cost_cents` and `drafts.cost_cents`
-- were written by the process that spent, so a call still in flight when the
-- pass closed (0.8–1.6¢ on 26 free scans) left the roll-up and the ledger
-- disagreeing. And what the vendors billed lived only in files on the box.
--
-- This file:
--   1. gives every `fetches` row its site, its activity, its draft and its
--      outcome — filled by the database on insert, so no write path can
--      leave one out, and backfilled for the rows already there at 0¢;
--   2. derives `scans.cost_cents` and `drafts.cost_cents` from the ledger,
--      so the two can no longer disagree;
--   3. adds `vendor_days`: one row per vendor per UTC day of what the vendor
--      itself billed, a monthly row per fixed vendor, and the box's spend by
--      domain;
--   4. adds the `cost_site_day` view the owner's cost page and `npm run
--      costs` read: estimated beside billed, per site or named segment, per
--      day, vendor and activity. A free scan's spend joins the site that was
--      provisioned from it.
--
-- Nothing that decides whether to call reads any of it: the caps and the
-- reservations stay on `reserved_cents` and `cost_cents` (#1408), and the
-- per-site day (`fetches_site_spend_since`, #885) is unchanged. RLS on, no
-- policy, service role only, like every cost table: no cost figure is ever
-- rendered to a customer.

-- ── 1. Attribution ──────────────────────────────────────────────────────

alter table public.fetches
  add column if not exists site_id uuid references public.sites (id),
  add column if not exists activity text,
  add column if not exists draft_id uuid references public.drafts (id),
  add column if not exists outcome text;

comment on column public.fetches.site_id is
  'Issue 1478. The site whose spend this is: the scan''s site, filled on insert. Null for a free scan; cost_site_day joins a free scan to the site provisioned from it.';
comment on column public.fetches.activity is
  'Issue 1478. Why the call was made: free_scan, onboarding, weekly, rescore (a deep pass after the site''s first), draft, smoke, test or box. Filled on insert from the scan unless the writer names it; a draft''s calls are named draft by their cost context.';
comment on column public.fetches.draft_id is
  'Issue 1478. The draft this call was made for, where one was written. A draft''s calls stay keyed to their grounding scan; this is what tells them from the pass''s own.';
comment on column public.fetches.outcome is
  'Issue 1478. ok, failed or timeout, read from the stored payload on insert. A failed call the vendor bills is still a failed call.';

-- A domain no customer has: the reserved names of RFC 2606 and RFC 6761.
create or replace function is_test_domain(p_domain text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_domain is not null and (
    lower(p_domain) in ('example.com', 'example.net', 'example.org', 'localhost')
    or lower(p_domain) ~ '\.(example\.(com|net|org)|test|example|invalid|localhost)$'
  );
$$;

-- The outcome a stored payload says the call had. The three failure shapes
-- are the seam's own (`src/lib/costs/refusal.ts`) and the model seam's
-- (`src/lib/llm/index.ts`, `parseOutcome` and `failure`).
create or replace function fetch_outcome(p_payload jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_payload) <> 'object' then 'ok'
    when p_payload ? 'refusal' then case when p_payload ->> 'refusal' = 'timeout' then 'timeout' else 'failed' end
    when p_payload ? 'vendorFailure' then case when p_payload ->> 'vendorFailure' = 'timeout' then 'timeout' else 'failed' end
    when p_payload ? 'parseOutcome' and p_payload ->> 'parseOutcome' <> 'success' then
      case when p_payload ->> 'failure' = 'timeout' then 'timeout' else 'failed' end
    else 'ok'
  end;
$$;

-- Why a pass's call was made, from its scan: the activity a row gets when
-- its writer does not name one.
create or replace function scan_activity(p_scan_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when s.tier = 'free' and s.smoke then 'smoke'
    when s.tier = 'free' and public.is_test_domain(s.domain) then 'test'
    when s.tier = 'free' then 'free_scan'
    when s.tier = 'weekly' then 'weekly'
    when exists (
      select 1 from public.scans e
       where e.site_id = s.site_id and e.tier = 'deep' and e.id <> s.id and e.created_at < s.created_at
    ) then 'rescore'
    else 'onboarding'
  end
  from public.scans s
  where s.id = p_scan_id;
$$;

create or replace function fetches_attribute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.site_id is null then
    select s.site_id into new.site_id from public.scans s where s.id = new.scan_id;
  end if;
  if new.activity is null then
    new.activity := public.scan_activity(new.scan_id);
  end if;
  if new.outcome is null then
    new.outcome := public.fetch_outcome(new.payload);
  end if;
  return new;
end;
$$;

create trigger fetches_attribute
  before insert on public.fetches
  for each row
  execute function public.fetches_attribute();

-- The backfill, at 0¢: every row is read, none is bought again.
update public.fetches f set site_id = s.site_id from public.scans s where s.id = f.scan_id and f.site_id is null;
update public.fetches set outcome = public.fetch_outcome(payload) where outcome is null;
-- A row before 2026-10-17 was a draft's where its model call was one of the
-- draft pipeline's.
update public.fetches set activity = 'draft' where activity is null and source like 'generate.%';
update public.fetches set activity = public.scan_activity(scan_id) where activity is null;

-- A draft's calls before this file, matched to the draft written for the
-- same site within fifteen minutes of them: the nearest one.
update public.fetches f
   set draft_id = (
     select d.id from public.drafts d
      where d.site_id = f.site_id
        and d.created_at between f.created_at - interval '15 minutes' and f.created_at + interval '15 minutes'
      order by abs(extract(epoch from d.created_at - f.created_at))
      limit 1
   )
 where f.activity = 'draft' and f.draft_id is null and f.site_id is not null;

-- And the reads that draft made: a Google search, a news search, a volume
-- or a page read on the same scan, after that pass had finished, between the
-- draft's first and last model call.
with windows as (
  select f.scan_id, f.draft_id, min(f.created_at) - interval '1 minute' as opened, max(f.created_at) + interval '1 minute' as closed
    from public.fetches f
   where f.draft_id is not null
   group by 1, 2
)
update public.fetches f
   set activity = 'draft', draft_id = w.draft_id
  from windows w, public.scans s
 where f.scan_id = w.scan_id
   and s.id = f.scan_id
   and s.finished_at is not null
   and s.finished_at < w.opened
   and f.created_at between w.opened and w.closed
   and f.activity <> 'draft'
   and f.source in ('serp/google/organic', 'serp/google/news', 'dataforseo_labs/google/keyword_overview', 'egress.safeFetch');

alter table public.fetches alter column activity set not null;
alter table public.fetches alter column outcome set not null;
alter table public.fetches add constraint fetches_activity_known check (
  activity in ('free_scan', 'onboarding', 'weekly', 'draft', 'rescore', 'smoke', 'test', 'box')
);
alter table public.fetches add constraint fetches_outcome_known check (outcome in ('ok', 'failed', 'timeout'));

create index if not exists idx_fetches_site_day on public.fetches (site_id, created_at);
create index if not exists idx_fetches_draft_id on public.fetches (draft_id) where draft_id is not null;

-- ── 2. The roll-ups are the ledger's ────────────────────────────────────
--
-- `carried_cents` is spend a row counts that its own ledger rows do not
-- hold: an earlier row's spend a retry carries under the same 12¢ purse
-- (SPEC §2, issue 715), and, on a draft written before this file, what its
-- figure held that the backfill could not match to a call. So:
--
--   scans.cost_cents  = carried_cents + Σ fetches.cost_cents on the scan, its drafts' calls left out
--   drafts.cost_cents = carried_cents + Σ fetches.cost_cents on the draft
--
-- A process may still write `cost_cents` — the deploy runs before this file
-- is applied, and must still be right then — but the database replaces what
-- it wrote with the ledger's figure.

alter table public.scans add column if not exists carried_cents numeric(12,4) not null default 0;
alter table public.drafts add column if not exists carried_cents numeric(12,4) not null default 0;

comment on column public.scans.carried_cents is
  'Issue 1478. Spend this row counts that its own ledger rows do not hold: the retried report''s spend a retry carries (issue 715). cost_cents = carried_cents + the ledger.';
comment on column public.drafts.carried_cents is
  'Issue 1478. On a draft written before 2026-10-17, the part of its figure no ledger row could be matched to. cost_cents = carried_cents + the ledger.';

create or replace function scan_ledger_cents(p_scan_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(f.cost_cents), 0)::numeric(12,4)
    from public.fetches f
   where f.scan_id = p_scan_id and f.activity <> 'draft';
$$;

create or replace function draft_ledger_cents(p_draft_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(f.cost_cents), 0)::numeric(12,4)
    from public.fetches f
   where f.draft_id = p_draft_id;
$$;

create or replace function scans_cost_from_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.cost_cents := new.carried_cents + public.scan_ledger_cents(new.id);
  return new;
end;
$$;

create or replace function drafts_cost_from_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.cost_cents := new.carried_cents + public.draft_ledger_cents(new.id);
  return new;
end;
$$;

create trigger scans_cost_from_ledger
  before update of cost_cents, carried_cents on public.scans
  for each row
  execute function public.scans_cost_from_ledger();

create trigger drafts_cost_from_ledger
  before update of cost_cents, carried_cents on public.drafts
  for each row
  execute function public.drafts_cost_from_ledger();

-- A ledger row written, or moved to a draft, moves the roll-up it is part
-- of. The two `before` triggers above compute the figure.
create or replace function fetches_roll_up()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.scans set cost_cents = carried_cents + public.scan_ledger_cents(id) where id = new.scan_id;
  if new.draft_id is not null then
    update public.drafts set cost_cents = carried_cents + public.draft_ledger_cents(id) where id = new.draft_id;
  end if;
  if tg_op = 'UPDATE' and old.draft_id is not null and old.draft_id is distinct from new.draft_id then
    update public.drafts set cost_cents = carried_cents + public.draft_ledger_cents(id) where id = old.draft_id;
  end if;
  return null;
end;
$$;

create trigger fetches_roll_up
  after insert or update of cost_cents, activity, draft_id on public.fetches
  for each row
  execute function public.fetches_roll_up();

-- The drafts before this file keep their figure: what the backfill matched
-- is the ledger's, the rest is carried.
update public.drafts d
   set carried_cents = greatest(d.cost_cents - public.draft_ledger_cents(d.id), 0);
-- And every scan's figure becomes the ledger's.
update public.scans set cost_cents = carried_cents + public.scan_ledger_cents(id)
 where cost_cents is distinct from carried_cents + public.scan_ledger_cents(id);

-- ── 3. What the vendors billed ──────────────────────────────────────────

create table vendor_days (
  id uuid primary key default gen_random_uuid(),
  vendor text not null,
  -- A UTC day; for a fixed row, the first day of its month.
  day date not null,
  kind text not null,
  -- A box row's domain; '' on every other row, so a day is one row.
  domain text not null default '',
  -- What the vendor billed, in cents of `currency`. Null where nothing
  -- reported it, which is never read as zero.
  billed_cents numeric(12,4),
  currency text not null default 'usd',
  -- A box row's price-book figure, beside what the vendor billed it.
  estimated_cents numeric(12,4),
  -- DataForSEO's reading at the day's opening: balance and all deposits.
  balance_cents numeric(12,4),
  deposited_cents numeric(12,4),
  source text not null,
  read_at timestamptz not null default now(),
  constraint vendor_days_one_row unique (vendor, day, kind, domain),
  constraint vendor_days_kind_known check (kind in ('usage', 'fixed', 'box')),
  constraint vendor_days_currency_known check (currency in ('usd', 'eur'))
);

alter table vendor_days enable row level security;

comment on table vendor_days is
  'Issue 1478. What each vendor billed: usage per UTC day (DataForSEO from its balance, Anthropic from its cost report), one fixed row per vendor per month, and box spend by domain. '
  'dbAdmin()-only; BUILD §10 default-deny; no anon/authenticated policy by design.';

revoke all on public.vendor_days from anon, authenticated;
grant select, insert, update, delete on public.vendor_days to service_role;

-- ── 4. The view the owner reads ─────────────────────────────────────────

create view cost_site_day
with (security_invoker = true)
as
select
  (f.created_at at time zone 'utc')::date as day,
  coalesce(f.site_id, provisioned.id) as site_id,
  case
    when coalesce(f.site_id, provisioned.id) is not null then null
    when s.smoke then 'smoke'
    when public.is_test_domain(s.domain) then 'test'
    when f.activity = 'box' then 'box'
    else 'free'
  end as segment,
  case
    when f.source like 'egress.%' then 'own'
    when position('/' in f.source) > 0 then 'dataforseo'
    else 'anthropic'
  end as vendor,
  f.activity,
  count(*)::integer as calls,
  sum(f.cost_cents)::numeric(12,4) as estimated_cents,
  -- Null where no call of the group carried a charge; `billed_calls` says
  -- how many of `calls` did.
  sum(f.billed_cents)::numeric(12,4) as billed_cents,
  count(f.billed_cents)::integer as billed_calls,
  -- D34's reading: what the vendor billed where it said, the estimate where
  -- it did not.
  sum(coalesce(f.billed_cents, f.cost_cents))::numeric(12,4) as judged_cents,
  count(*) filter (where f.outcome = 'failed')::integer as failed_calls,
  count(*) filter (where f.outcome = 'timeout')::integer as timeout_calls
from public.fetches f
join public.scans s on s.id = f.scan_id
left join lateral (
  select p.id from public.sites p
   where f.site_id is null and p.provisioned_from_scan_id = f.scan_id
   order by p.created_at
   limit 1
) provisioned on true
group by 1, 2, 3, 4, 5;

comment on view cost_site_day is
  'Issue 1478. The ledger per UTC day, per site or named segment (free, smoke, test, box), per vendor and activity: estimated beside billed. A free scan''s spend is the site''s it was provisioned into.';

revoke all on public.cost_site_day from anon, authenticated;
grant select on public.cost_site_day to service_role;

-- ── Grants on the functions ─────────────────────────────────────────────

revoke all on function public.is_test_domain(text) from public, anon, authenticated;
revoke all on function public.fetch_outcome(jsonb) from public, anon, authenticated;
revoke all on function public.scan_activity(uuid) from public, anon, authenticated;
revoke all on function public.scan_ledger_cents(uuid) from public, anon, authenticated;
revoke all on function public.draft_ledger_cents(uuid) from public, anon, authenticated;
revoke all on function public.fetches_attribute() from public, anon, authenticated;
revoke all on function public.scans_cost_from_ledger() from public, anon, authenticated;
revoke all on function public.drafts_cost_from_ledger() from public, anon, authenticated;
revoke all on function public.fetches_roll_up() from public, anon, authenticated;
grant execute on function public.is_test_domain(text) to service_role;
grant execute on function public.fetch_outcome(jsonb) to service_role;
grant execute on function public.scan_activity(uuid) to service_role;
grant execute on function public.scan_ledger_cents(uuid) to service_role;
grant execute on function public.draft_ledger_cents(uuid) to service_role;
