-- SPEC §9 (#690) — a technical issue ReachKit fixes on a page becomes a Fix
-- opportunity: `fix_page`. It stays in the Fix family's shape — no search,
-- no band, no proposed slug — and names the page it updates in `target_ref`.
-- One more readiness reason: the site's destination cannot update that page.

alter table opportunities drop constraint opportunities_type_closed;
alter table opportunities add constraint opportunities_type_closed check (
  type in (
    'answer_page', 'keyword_page', 'comparison_page', 'format_page',
    'expand_page', 'answerable_page', 'refresh_page',
    'unblock', 'fix_page', 'listed_page'
  )
);

alter table opportunities drop constraint opportunities_family_matches_type;
alter table opportunities add constraint opportunities_family_matches_type check (
  (type in ('answer_page', 'keyword_page', 'comparison_page', 'format_page') and family = 'write')
  or (type in ('expand_page', 'answerable_page', 'refresh_page') and family = 'improve')
  or (type in ('unblock', 'fix_page') and family = 'fix')
  or (type = 'listed_page' and family = 'earn')
);

alter table opportunities drop constraint opportunities_unready_reason_closed;
alter table opportunities add constraint opportunities_unready_reason_closed check (
  unready_reason is null or unready_reason in (
    'not_assessed', 'cluster_suppressed', 'url_retired',
    'keyword_gate', 'format_not_allowed', 'no_grounding_fact',
    'destination_cannot_address'
  )
);
