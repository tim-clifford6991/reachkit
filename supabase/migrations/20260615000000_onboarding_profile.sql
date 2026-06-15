-- Post-checkout onboarding backfill (payment-first funnel).
-- Collected after the user lands in the dashboard via the magic link:
--   display_name      — who they are (personalization)
--   distribution_goal — their primary distribution goal (focuses the action plan)
--   icp_confirmed     — the confirmed/edited ICP (only for scan-first users)
--   onboarded_at      — null = onboarding incomplete (the dashboard gate)
alter table users add column display_name text;
alter table users add column distribution_goal text;
alter table users add column icp_confirmed jsonb;
alter table users add column onboarded_at timestamptz;
