-- supabase/migrations/20260906090200_sites_provisioning_columns.sql
--
-- BUILD §13 — what provisioning creates a site with. Sub-token
-- `sites_provisioning`.
--
-- §13, quoted: "upsert user, create site (domain null if scanless — asked
-- at setup)". The baseline declared `sites.domain not null`, written before
-- §13's scanless purchase had a row to land in; a purchase made away from
-- any report has no domain until setup asks for one, and the alternative to
-- a null is a fabricated address on somebody's account. The not-null is
-- dropped here rather than worked around at the call site.
--
-- `provisioned_from_scan_id` records which report the purchase came in
-- with, so setup can show that domain to confirm or change rather than
-- asking the founder to type it (REQ-021 c6). It references `scans` with
-- no cascade (ADR-051 point 2).
--
-- `sites_one_per_user` is §13's "one site" as an index. One site per
-- account is not a v1.1 restriction to be relaxed by a caller — BUILD §17
-- names multi-site a non-goal — and a second row for one account is the
-- shape a replayed webhook would create if the handler alone were guarding
-- it.

alter table sites alter column domain drop not null;

alter table sites add column provisioned_from_scan_id uuid references scans (id);

comment on column sites.provisioned_from_scan_id is
  'The free report the purchase was begun from, where there was one. Null for a scanless purchase (REQ-021 c6, c7).';

create unique index sites_one_per_user on sites (user_id);
