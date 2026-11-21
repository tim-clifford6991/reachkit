-- email_suppressions.cause — `bounced` and `complained` join the closed set.
--
-- The mail vendor's webhook writes a hard bounce, a spam complaint or the
-- vendor's own suppression of an address into this store, so follow-up mail
-- stops there as it does for an opt-out.
--
-- The set is mirrored in `SuppressionCause` (`src/lib/mail/leads/store.ts`).
-- Rewritten rather than added to, because a check constraint has no ALTER.
-- It only widens the set: every row stored today still passes.

alter table email_suppressions drop constraint if exists email_suppressions_cause_check;
alter table email_suppressions add constraint email_suppressions_cause_check check (
  cause in ('opt_out', 'subscribed', 'bounced', 'complained')
);
