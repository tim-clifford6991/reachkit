-- supabase/migrations/20261019120000_scans_page_question_organic.sql
--
-- Issue 1548 · SPEC §6 (#908): each week the scan buys one Google result for
-- every live page's own question, and kept only its AI cell. A page's
-- verdict now reads its place from that result's organic rows
-- (`PageQuestionRow.organic`), so the rows already stored are given them
-- from the ledger at 0¢: the same purchase, as `fetches` recorded it under
-- that scan.
--
-- Data only, and idempotent. A row that already carries `organic` is left
-- alone, and so is a row whose purchase is not under its scan in the ledger
-- (it stays absent: nothing is known about it). A purchase that failed is
-- `null`: the result could not be read that week.

with matched as (
  select
    s.id as scan_id,
    (r.ord - 1)::int as idx,
    f.outcome,
    f.payload
  from public.scans s
  cross join lateral jsonb_array_elements(s.report -> 'pageQuestions' -> 'rows') with ordinality as r(row, ord)
  cross join lateral (
    select fe.outcome, fe.payload
    from public.fetches fe
    where fe.scan_id = s.id
      and fe.source = 'serp/google/organic'
      and split_part(fe.cache_key, '|', 1) = r.row -> 'question' ->> 'search'
    -- A read that answered is preferred to one that failed.
    order by (jsonb_typeof(fe.payload) = 'array') desc, fe.created_at desc
    limit 1
  ) f
  where jsonb_typeof(s.report -> 'pageQuestions' -> 'rows') = 'array'
    and not (r.row ? 'organic')
),
organic as (
  select
    m.scan_id,
    m.idx,
    case
      when jsonb_typeof(m.payload) = 'array' and jsonb_typeof(m.payload -> 0 -> 'organic') = 'array' then
        coalesce(
          (
            select jsonb_agg(jsonb_build_object('url', o ->> 'url', 'position', (o ->> 'position')::int) order by (o ->> 'position')::int)
            from jsonb_array_elements(m.payload -> 0 -> 'organic') o
            where coalesce(o ->> 'url', '') <> '' and (o ->> 'position') ~ '^[0-9]+$'
          ),
          '[]'::jsonb
        )
      else 'null'::jsonb
    end as rows
  from matched m
),
rebuilt as (
  select
    s.id,
    jsonb_agg(
      case when o.idx is null then r.row else r.row || jsonb_build_object('organic', o.rows) end
      order by r.ord
    ) as rows
  from public.scans s
  cross join lateral jsonb_array_elements(s.report -> 'pageQuestions' -> 'rows') with ordinality as r(row, ord)
  left join organic o on o.scan_id = s.id and o.idx = (r.ord - 1)::int
  where s.id in (select scan_id from organic)
  group by s.id
)
update public.scans s
set report = jsonb_set(s.report, '{pageQuestions,rows}', rebuilt.rows)
from rebuilt
where s.id = rebuilt.id;
