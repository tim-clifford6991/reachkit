-- supabase/migrations/20260906120100_sites_hosting_columns.sql
--
-- BUILD §13, §9 — the hosted-retention clock and the two notice stamps.
-- Sub-token `sites_hosting`.
--
-- REQ-076 criterion 10: ReachKit stops serving a departed customer's hosted
-- pages 30 days after their paid-through date. `hosted_serving_ends_at` is
-- that day, stamped when access ends, cleared on resume, and set to `now()`
-- by deletion (REQ-079 c6, another issue's write). Serving is computed from
-- this timestamp and never from a boolean a job flips: a tick that runs
-- twice, late, or not at all still yields the right answer at read time.
--
-- The two stamps are the record REQ-076 criterion 11 requires — "no
-- customer's live pages go dark without both notices having been sent". A
-- site missing either is excluded from the stop queue and raised instead
-- (BP-060 decision 3: a page going dark unannounced is worse than a page
-- served a day longer than promised). That is why they are two columns and
-- not a count: which notice is missing is the thing an operator needs.
--
-- The index is the due-work queries' access path — the tick reads sites
-- whose window has elapsed, which is a handful at any moment.
--
-- ADR-051 point 2: no cascade.

alter table sites add column hosted_serving_ends_at timestamptz;
alter table sites add column hosting_end_notice_at timestamptz;
alter table sites add column hosting_end_reminder_at timestamptz;

comment on column sites.hosted_serving_ends_at is
  'The day hosted serving stops: paid_through + HOSTED_RETENTION_DAYS, stamped at access end and cleared on resume. Null while access is live (REQ-076 c10).';
comment on column sites.hosting_end_notice_at is
  'When the notice sent at the moment access ended was sent. Null means it has not been (REQ-076 c11).';
comment on column sites.hosting_end_reminder_at is
  'When the reminder sent HOSTING_END_REMINDER_DAYS before serving stops was sent. Null means it has not been (REQ-076 c11).';

create index sites_hosted_serving_ends_at_idx on sites (hosted_serving_ends_at);
