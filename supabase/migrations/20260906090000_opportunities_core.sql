-- BUILD §7, §10 — the opportunities table, constrained so that a ninth
-- kind, a mismatched evidence shape and a rewritten acceptance test are
-- unrepresentable.
--
-- The baseline created `opportunities` loosely (`00000000000001_baseline.sql`):
-- every column §10 names, and no check beyond `status`. This migration is
-- §7's own shape on top of it. Nothing here is enforced a second time in
-- application code: the trigger and the constraints below *are* the
-- invariants, and `src/lib/opportunities/` relies on them rather than
-- restating them.
--
-- Topic token `opportunities`, sub-token `opportunities_core`
-- (`src/lib/db/topics.ts`).
--
-- The table has no writer on disk before this migration, so the type and
-- nullability changes below run against an empty table. They are written
-- without a backfill deliberately: a `set not null` that fails loudly on
-- unexpected rows is better than one that invents values to satisfy
-- itself.

-- ── Columns ────────────────────────────────────────────────────────────

-- The Fix family targets no search: `target_query` is null for exactly an
-- `unblock`, which is what makes "never generated" a shape rather than a
-- policy.
alter table opportunities alter column target_query drop not null;

-- `proposed_slug` (§10) is the Write family's alone — the slug a generated
-- page will publish under. An Improve target's page already has a url and
-- a Fix target has no page.
alter table opportunities alter column proposed_slug drop not null;
alter table opportunities alter column title drop not null;

-- The universal reference: the proposed slug (write), the page's own url
-- (improve), or the url the barrier was found on (fix). It is a member of
-- the de-duplication key below, which is why every family has one.
alter table opportunities add column if not exists target_ref text;
update opportunities set target_ref = proposed_slug where target_ref is null;
alter table opportunities alter column target_ref set not null;

-- 0..1, two decimals. `text` in the baseline; a number the ranking
-- multiplies by belongs in a numeric type.
alter table opportunities alter column effort type numeric(3, 2) using effort::numeric(3, 2);
alter table opportunities alter column effort set not null;

alter table opportunities alter column evidence set not null;
alter table opportunities alter column acceptance set not null;

-- ── The closed sets ────────────────────────────────────────────────────

alter table opportunities add constraint opportunities_type_closed check (
  type in (
    'answer_page', 'keyword_page', 'comparison_page', 'format_page',
    'expand_page', 'answerable_page', 'refresh_page',
    'unblock'
  )
);

alter table opportunities add constraint opportunities_family_closed check (
  family in ('write', 'improve', 'fix')
);

-- `family` is a stored, constrained **mirror** of the type→family map in
-- `src/lib/opportunities/types.ts` — never a second source of truth. A row
-- whose two columns disagree cannot be written.
alter table opportunities add constraint opportunities_family_matches_type check (
  (type in ('answer_page', 'keyword_page', 'comparison_page', 'format_page') and family = 'write')
  or (type in ('expand_page', 'answerable_page', 'refresh_page') and family = 'improve')
  or (type = 'unblock' and family = 'fix')
);

-- The evidence blob's own discriminator must be the row's family, so a
-- consumer that branches on the column and a consumer that branches on the
-- blob can never disagree about which shape they are holding.
alter table opportunities add constraint opportunities_evidence_family_agrees check (
  evidence ->> 'family' = family
);

alter table opportunities add constraint opportunities_effort_unit_interval check (
  effort >= 0 and effort <= 1
);

-- ── The Fix family's null columns ──────────────────────────────────────
--
-- Stated as biconditionals, not as "null allowed": a Write row with a null
-- band would be a page nobody sized, and an `unblock` with a band would be
-- an instruction that had been ranked.

alter table opportunities add constraint opportunities_fit_band_closed check (
  fit_band is null or fit_band in ('winnable', 'reach', 'not-yet')
);

alter table opportunities add constraint opportunities_fit_band_iff_not_fix check (
  (family = 'fix') = (fit_band is null)
);

alter table opportunities add constraint opportunities_target_query_iff_not_fix check (
  (family = 'fix') = (target_query is null)
);

alter table opportunities add constraint opportunities_slug_iff_write check (
  (family = 'write') = (proposed_slug is not null)
);

-- ── The acceptance test is written once ────────────────────────────────
--
-- §7: every opportunity carries an acceptance test. A published page is
-- judged against the test recorded when its opportunity was created, and
-- that test is never rewritten — including where it can no longer be
-- evaluated. The trigger is the invariant; no application code repeats it.
-- Correcting a malformed test means dismissing the opportunity and
-- deriving a new one.

create or replace function opportunities_acceptance_is_immutable()
returns trigger
language plpgsql
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

create trigger opportunities_acceptance_immutable
  before update on opportunities
  for each row
  execute function opportunities_acceptance_is_immutable();

-- ── De-duplication, and the reads the engine makes ─────────────────────
--
-- The partial unique index is the whole of de-duplication: a weekly
-- re-measurement re-deriving the same target adds nothing, while a target
-- whose earlier page is `done` or `dismissed` may be proposed again.
-- `coalesce(target_query, '')` is load-bearing — nulls are distinct in a
-- unique index, so without it two `unblock` rows for the same barrier page
-- would both be admitted.
create unique index opportunities_open_target_uniq
  on opportunities (site_id, type, coalesce(target_query, ''), target_ref)
  where status in ('open', 'queued');

create index opportunities_site_status_idx on opportunities (site_id, status);
create index opportunities_site_open_idx on opportunities (site_id) where status = 'open';
