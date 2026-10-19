-- Issue 1549: a topic whose page the system withdrew is not left `queued`.
--
-- Before this change, `content/recheck` unpublished a live page and left the
-- row it was written for `queued`: a queued row holds its search and its
-- cluster, so nothing was ever written on that topic again, and the topic
-- counted as a page behind it. From now on the withdrawal rests the topic
-- for `TOPIC_REST_DAYS` (28), as a stopped draft's does (D26). This brings
-- the rows already withdrawn to the same state, resting 28 days from their
-- withdrawal. Data only, 0¢, and a second run changes nothing.
--
-- On 2026-10-19 production held one such row: reachkit.app's "profound
-- alternatives", withdrawn 2026-10-17.
with withdrawn as (
  select o.id, max((t->>'at')::timestamptz) as at
  from opportunities o
  join drafts d on d.opportunity_id = o.id
  cross join lateral jsonb_array_elements(coalesce(d.transitions, '[]'::jsonb)) t
  where o.status in ('queued', 'done')
    and o.family <> 'fix'
    and d.state = 'unpublished'
    and t->>'to' = 'unpublished'
    and t->'actor'->>'job' = 'content/recheck'
    and not exists (
      select 1
      from drafts live_d
      join publications p on p.draft_id = live_d.id
      where live_d.opportunity_id = o.id
        and p.published_at is not null
        and p.unpublished_at is null
    )
  group by o.id
)
update opportunities o
set status = 'open',
    rest_until = withdrawn.at + interval '28 days',
    ready = false,
    unready_reason = 'resting'
from withdrawn
where o.id = withdrawn.id;
