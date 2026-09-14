-- supabase/migrations/20260915090100_drafts_retention.sql
--
-- SPEC §8, Retention (issue #569) — the veto reminder goes only on an
-- unopened draft, once.
--
--   opened_at         the owner first opened the draft view. Stamped once.
--   veto_reminded_at  the veto reminder for this draft was sent.
--
-- Partial index: the reminder's due query reads only drafts in review whose
-- reminder has not gone.
--
-- Rule 3: the filename carries the `drafts` topic token.

alter table drafts
  add column opened_at timestamptz,
  add column veto_reminded_at timestamptz;

create index idx_drafts_veto_reminder_due
  on drafts (veto_deadline)
  where state = 'in_review' and veto_reminded_at is null and opened_at is null;
