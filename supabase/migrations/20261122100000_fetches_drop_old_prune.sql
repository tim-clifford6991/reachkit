-- supabase/migrations/20261122100000_fetches_drop_old_prune.sql
--
-- Contract: drops the two revoked functions that scanned every payload;
-- `fetches_html_due` and `fetches_html_prune` replace them. No row or column changes.
--
-- Applied by hand after the replacement's deploy is READY (docs/RUNBOOK.md §9).
set lock_timeout = '3s';
drop function if exists public.prune_page_html(timestamptz, integer);
drop function if exists public.page_reads_underived(timestamptz, integer);
