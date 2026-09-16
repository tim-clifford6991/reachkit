-- supabase/migrations/20260916120000_drafts_publishing_approval.sql
--
-- BUILD §9, REQ-057 c2 (issue #790) — a customer's approval is recorded in
-- the same statement that moves the page.
--
-- `drafts.approved_at` and `approved_by` were added by
-- `20260906120300_drafts_veto.sql` as "the moment the customer explicitly
-- approved the page", and `becomesPublishable` reads `approved_at` first.
-- Nothing ever wrote them, so a customer's approval never made a page
-- publishable: a copilot page, which only an approval can release, never
-- went out, and an early approval under autopilot still waited for the
-- window. This is the one function every move goes through, so the
-- approval is written where the move is, atomically with the state and the
-- record (the mover issues one write, never two).
--
-- Only a customer's approval is stamped. The window's end is a clock
-- approving a page already due by its deadline — the migration that added
-- the column keeps it null there — and stamping the tick's moment would
-- push the page to the publish time after whenever the tick ran late.
-- The moment is the record's own `at`, so the column and the history agree.
--
-- Everything else in the body is `20260909130000_rls_functions_search_path.sql`'s
-- definition, unchanged, including its pinned search path.

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
  customer_approval boolean := p_to = 'approved' and p_record->'actor'->>'kind' = 'customer';
begin
  update public.drafts set
    state = p_to,
    transitions = coalesce(transitions, '[]'::jsonb) || jsonb_build_array(p_record),
    publishable_since = case
      when p_to in ('in_review', 'approved', 'failed') then coalesce(publishable_since, now())
      when p_to in ('published', 'skipped', 'unpublished') then null
      else publishable_since
    end,
    approved_at = case
      when customer_approval then coalesce((p_record->>'at')::timestamptz, now())
      else approved_at
    end,
    approved_by = case
      when customer_approval then p_record->'actor'
      else approved_by
    end
  where id = p_draft_id and state = p_from;

  get diagnostics moved = row_count;
  return moved = 1;
end;
$$;
