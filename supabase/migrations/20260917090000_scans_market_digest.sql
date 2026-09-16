-- supabase/migrations/20260917090000_scans_market_digest.sql
--
-- Issue 796 — the owner's Monday market digest has read this weekly pass.
--
-- Issue 770 mailed the owner on every paid pass that found too little market, so
-- a thin site mailed every Monday. A site's first (deep) pass still mails at
-- once; a weekly pass is folded into one owner digest per Monday, sent by the
-- maintenance tick once that Monday has ended in every zone. This column is
-- that digest's once-ness, stamped on the site-week row the weekly pass
-- already owns — the same shape `scans.digest_sent_at` gives the customer's
-- own Monday mail.
--
-- **Stamped on every weekly row the digest read, not only the too-small
-- ones.** A row that was not too small is read and settled in the same
-- tick; left null it would be re-read at every tick for the rest of the
-- week. A digest the seam did not accept stamps nothing, so the next tick
-- offers the week again.
--
-- No index: every read is already keyed by `week_start` on `tier = 'weekly'`
-- rows, a handful per site per week.

alter table scans
  add column market_digest_at timestamptz null;

comment on column scans.market_digest_at is
  'Issue 796. When the owner''s Monday market digest read this weekly pass (too small or not). Null means not yet read, including a digest the send seam refused, which the next maintenance tick retries.';
