-- SPEC §6 — the cluster and readiness columns the weekly pass writes: the
-- parent topic a row belongs to, the sibling searches it absorbed, and
-- whether it passes readiness with the reason it does not. Nothing derives
-- them yet, so every row defaults to "not assessed"; the Earn family of
-- SPEC §0 joins the closed sets, and publishes a page, so it proposes a slug.

alter table opportunities add column if not exists cluster_key text;
alter table opportunities add column if not exists absorbed_queries text[] not null default '{}'::text[];
alter table opportunities add column if not exists ready boolean not null default false;
alter table opportunities add column if not exists unready_reason text default 'not_assessed';

alter table opportunities add constraint opportunities_cluster_key_nonempty check (
  cluster_key is null or btrim(cluster_key) <> ''
);

alter table opportunities add constraint opportunities_unready_reason_closed check (
  unready_reason is null or unready_reason in (
    'not_assessed', 'cluster_suppressed', 'url_retired',
    'keyword_gate', 'format_not_allowed', 'no_grounding_fact'
  )
);

alter table opportunities add constraint opportunities_ready_iff_no_reason check (
  ready = (unready_reason is null)
);

alter table opportunities drop constraint opportunities_type_closed;
alter table opportunities add constraint opportunities_type_closed check (
  type in (
    'answer_page', 'keyword_page', 'comparison_page', 'format_page',
    'expand_page', 'answerable_page', 'refresh_page',
    'unblock', 'listed_page'
  )
);

alter table opportunities drop constraint opportunities_family_closed;
alter table opportunities add constraint opportunities_family_closed check (
  family in ('write', 'improve', 'fix', 'earn')
);

alter table opportunities drop constraint opportunities_family_matches_type;
alter table opportunities add constraint opportunities_family_matches_type check (
  (type in ('answer_page', 'keyword_page', 'comparison_page', 'format_page') and family = 'write')
  or (type in ('expand_page', 'answerable_page', 'refresh_page') and family = 'improve')
  or (type = 'unblock' and family = 'fix')
  or (type = 'listed_page' and family = 'earn')
);

alter table opportunities drop constraint opportunities_slug_iff_write;
alter table opportunities add constraint opportunities_slug_iff_publishes check (
  (family in ('write', 'earn')) = (proposed_slug is not null)
);

create unique index opportunities_open_cluster_uniq
  on opportunities (site_id, cluster_key)
  where status in ('open', 'queued') and family <> 'fix';

create index opportunities_site_ready_idx
  on opportunities (site_id) where ready and status = 'open';
