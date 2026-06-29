-- Structured intel tables: typed storage for the five intel layers.
--
-- Mirrors the pattern from domain_intel / domain_content_page: scalar columns for
-- queryable/indexable values; jsonb ONLY for genuinely variable/nested structures
-- (competitor arrays, keyword arrays, thread lists). Every table has a composite PK
-- keyed by subject_domain + cohort_key (+ natural key), a fetched_at timestamptz,
-- and uses IF NOT EXISTS so re-runs are safe.
--
-- cohort_key = sorted, comma-joined competitor domains supplied by the caller.
-- An empty string ("") means the default auto-discovered cohort.

-- 1. keyword_gap — one row per gap keyword per (subject, cohort).
--    From gatherKeywordGap → KeywordGap[].
create table if not exists keyword_gap (
  subject_domain   text        not null,
  cohort_key       text        not null default '',
  keyword          text        not null,
  volume           integer     not null default 0,
  subject_position integer,                           -- null = subject doesn't rank at all
  best_position    integer     not null default 0,
  rival_count      integer     not null default 0,    -- cross-reference: how many rivals win
  opportunity      real        not null default 0,    -- log-volume × consensus × position score
  winning_url      text,                              -- the URL of the top-ranking competitor page
  competitors      jsonb       not null default '[]'::jsonb, -- [{domain, position, url}, ...]
  fetched_at       timestamptz not null default now(),
  primary key (subject_domain, cohort_key, keyword)
);

-- 2. demand_pocket — one row per community pocket per (subject, cohort).
--    From gatherDemand → DemandIntel.community.pockets.
create table if not exists demand_pocket (
  subject_domain text        not null,
  cohort_key     text        not null default '',
  surface        text        not null,   -- e.g. "r/SaaS" or a domain
  platform       text        not null default '',
  subreddit      text,                   -- null when not Reddit
  count          integer     not null default 0,
  intent_sum     real        not null default 0,
  score          real        not null default 0,
  top_threads    jsonb       not null default '[]'::jsonb, -- [{title,url,intent,publishedAt,theme}]
  fetched_at     timestamptz not null default now(),
  primary key (subject_domain, cohort_key, surface)
);

-- 3. content_plan_item — one row per content asset per (subject, cohort).
--    From gatherSynthesis → Synthesis.contentPlan.
create table if not exists content_plan_item (
  subject_domain     text        not null,
  cohort_key         text        not null default '',
  topic              text        not null,
  format             text        not null default 'guide',    -- guide|comparison|listicle|template|tool|landing
  depth_target       text        not null default '',         -- e.g. "2,000–4,000 words"
  priority           text        not null default 'medium',   -- high|medium|low
  est_monthly_volume integer     not null default 0,
  buyer_angle        text        not null default '',
  intent             text        not null default 'informational',
  target_keywords    jsonb       not null default '[]'::jsonb, -- string[]
  brief              text        not null default '',
  agent_prompt       text        not null default '',
  evidence           text        not null default '',
  fetched_at         timestamptz not null default now(),
  primary key (subject_domain, cohort_key, topic)
);

-- 4. distribution_plan_item — one row per distribution action per (subject, cohort).
--    From gatherSynthesis → Synthesis.distributionPlan.
create table if not exists distribution_plan_item (
  subject_domain text        not null,
  cohort_key     text        not null default '',
  channel        text        not null,  -- directory|marketplace|community|media|podcast|newsletter|partner
  action         text        not null,  -- concrete action string
  ease           real        not null default 0,     -- 0–1 derived axis
  impact         real        not null default 0,     -- 0–1 derived axis
  priority       text        not null default 'medium',
  effort         text        not null default 'medium',
  target         text        not null default '',    -- the specific place
  target_url     text        not null default '',
  why            text        not null default '',
  evidence       text        not null default '',
  fetched_at     timestamptz not null default now(),
  primary key (subject_domain, cohort_key, channel, action)
);

-- 5. cohort_competitor — one row per (subject, cohort, competitor).
--    From gatherFullFunnel → FunnelResult.subject + FunnelResult.competitors.
--    Per-domain global metrics live in domain_intel; this captures the cohort
--    relationship, relative scores, and backlink quality share.
create table if not exists cohort_competitor (
  subject_domain    text        not null,
  cohort_key        text        not null default '',
  competitor_domain text        not null,
  is_subject        boolean     not null default false,
  score             integer     not null default 0,
  band              text        not null default '',
  monthly_traffic   bigint      not null default 0,
  closeness         real        not null default 0,  -- 0–1; 1 for the subject itself
  reason            text        not null default '', -- LLM closeness reason
  quality_share     real        not null default 0,  -- fraction of backlinks in quality channels
  fetched_at        timestamptz not null default now(),
  primary key (subject_domain, cohort_key, competitor_domain)
);
