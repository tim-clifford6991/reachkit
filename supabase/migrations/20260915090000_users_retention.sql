-- supabase/migrations/20260915090000_users_retention.sql
--
-- SPEC §8, Retention (issue #569) — what the retention / win-back sequence
-- needs to know about an account, and what it has already told it.
--
--   last_seen_at              the account was last signed in or last opened
--                             /app. "Idle 7 days" is measured from it, and a
--                             sign-in after a nudge starts a new idle spell.
--                             Backfilled from `first_signed_in_at`.
--   inactivity_nudged_at      the nudge for the current idle spell was sent.
--                             One per spell: due again only once
--                             `last_seen_at` has moved past it.
--   payment_failed_mailed_at  the payment-failed mail for the current
--                             failed spell was sent. Cleared by the billing
--                             store when the plan is no longer `past_due`.
--   cancellation_mailed_at    the cancellation mail (with the end date) was
--                             sent for the current cancellation.
--   winback_sent_at           the win-back was sent. Never cleared: it goes
--                             once and never repeats.
--
-- Every stamp is written only after the mail left (`src/lib/mail/retention`).
--
-- Rule 3: the filename carries the `users` topic token.

alter table users
  add column last_seen_at timestamptz,
  add column inactivity_nudged_at timestamptz,
  add column payment_failed_mailed_at timestamptz,
  add column cancellation_mailed_at timestamptz,
  add column winback_sent_at timestamptz;

update users set last_seen_at = first_signed_in_at where last_seen_at is null;
