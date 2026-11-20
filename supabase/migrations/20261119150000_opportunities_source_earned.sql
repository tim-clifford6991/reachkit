-- A topic may come from a search Search Console measured the site's live pages on (`earned`).
-- It only widens the set: every row stored today still passes. RLS is unchanged.
alter table opportunities drop constraint if exists opportunities_source_closed;
alter table opportunities add constraint opportunities_source_closed check (
  source is null or source in ('ai_gap', 'product', 'problem', 'category', 'best_x', 'earned')
);

comment on column opportunities.source is
  'Where the topic came from (SPEC §6): ai_gap, product, problem, category, best_x or earned (a search Search Console measured).';
