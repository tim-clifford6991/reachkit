-- supabase/migrations/20261121100100_fetches_html_due_index.sql
--
-- Expand-only: one partial index, built without blocking reads or writes.
--
-- One statement in its own file: `concurrently` fails inside a transaction,
-- and a paste of two statements is one. A failed build leaves an invalid
-- index: drop it and run this again (docs/RUNBOOK.md §9).
create index concurrently if not exists idx_fetches_html_due on public.fetches (created_at)
  where html_pruned_at is null and source in ('egress.safeFetch', 'on_page/instant_pages');
