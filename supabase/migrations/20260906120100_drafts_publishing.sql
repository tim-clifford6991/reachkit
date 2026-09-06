-- supabase/migrations/20260906120100_drafts_publishing.sql
--
-- BUILD §9 (issue #45) — the two columns the state machine needs on
-- `drafts`, and the one statement that moves a page.
--
-- `structure.md` rule 3a: the filename carries the `drafts_publishing`
-- sub-token, which narrows the `drafts` topic and is owned by the
-- publishing node (`src/lib/db/topics.ts`). The generation columns under
-- `drafts_core` and the claim columns under `drafts_claims` are other
-- nodes' and are not touched here.

alter table drafts
  -- The append-only record of every move. One entry per transition:
  -- `{from, to, actor, reason?, at}`. No surface renders it; it is read for
  -- exactly one question — whether the page ever entered review — which is
  -- what keeps `needs_attention → generating` from raising §8's bound on
  -- automatic regeneration.
  add column transitions jsonb not null default '[]'::jsonb,

  -- The moment the page became publishable, and therefore the order a
  -- resume drains the backlog in: oldest first, `id` as the tiebreak.
  -- **A held page is the absence of an edge, not a state** — this column is
  -- how "held" is derived, and there is no `held` column anywhere.
  add column publishable_since timestamptz null,

  -- §8's hard rules, as recorded on the row. Read by exactly one guard —
  -- `needs_attention → publishing` is open only to a draft that passed
  -- every one of them, so a draft a hard rule stopped is never published by
  -- starting an attempt. **Its writer is the generation pipeline (#44);**
  -- the column defaults to false, which is the conservative arm: a draft
  -- that has not recorded passing the rules has not passed them.
  add column hard_rules_passed boolean not null default false;

-- The held set and its resume order in one index.
create index idx_drafts_publishable on drafts (site_id, state, publishable_since);

-- ── The one statement that moves a page ─────────────────────────────────
--
-- The state change and the record are one `update`, so a state that moved
-- without a record is not a bug this codebase could have: it is a write
-- Postgres cannot perform. The only client any code here may hold is a
-- PostgREST client (`dbAdmin()`), where each `.from(...)` is its own HTTP
-- request and its own implicit transaction, and `transitions = transitions
-- || …` is not expressible through it at all — the same limitation
-- `src/lib/scan/admission.ts` documents and
-- `20260905120000_scans_current_flip.sql` answers the same way.
--
-- `where … and state = p_from` is an optimistic lock, not decoration: two
-- movers racing on one draft both pass the in-memory edge check, and this
-- clause lets exactly one of them write. The loser is told the move was
-- refused and claims nothing about where the page is now.
--
-- `publishable_since` is maintained here rather than by a second write:
-- it is set the first time a page enters a state it can be held in, kept
-- across a `publishing` attempt that fails back to `failed` (so a page that
-- has waited longest keeps its place in the resume order), and cleared when
-- the page leaves the pipeline.
create or replace function publish_transition(
  p_draft_id uuid,
  p_from text,
  p_to text,
  p_record jsonb
) returns boolean
language plpgsql
as $$
declare
  moved integer;
begin
  update drafts set
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
