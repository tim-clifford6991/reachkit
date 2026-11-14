-- supabase/migrations/20261114120000_sites_onboarding_mails.sql
--
-- SPEC §8, Onboarding mails — the two once-per-site onboarding notices and
-- whether each has gone. Expand-only: two nullable stamps on `sites`.
--
--   setup_done_mail_sent_at   "Your setup is done" was claimed for sending.
--   connected_mail_sent_at    "Your website is connected" was claimed.
--
-- Claimed by a conditional update before the send (`... where x is null`),
-- so a second delivery of the same trigger sends nothing; cleared again only
-- when the send itself failed (`src/lib/mail/onboarding`).
--
-- Rule 3: the filename carries the `sites` topic token.

alter table sites
  add column setup_done_mail_sent_at timestamptz,
  add column connected_mail_sent_at timestamptz;

-- A site that finished setup before these mails existed is never sent them late.
update sites
  set setup_done_mail_sent_at = now(), connected_mail_sent_at = now()
  where setup_completed_at is not null;
