-- Topics a system stop rested for 28 days under the old rule are offered again: a rule, generation or supply stop
-- now rests a topic only until the site's next weekly commit, which ranks it again. 0¢ and data only; nothing is
-- deleted, no draft is touched, and a second run changes nothing. The weekly commit recomputes `ready`.
--
-- Kept resting:
--   - a topic with a customer skip in the last 28 days: that rest is the customer's no;
--   - a topic with a page the system withdrew in the last 28 days: a take-down still rests 28 days;
--   - a rest to the next weekly commit: on a whole minute and at most a week (an hour more across a clock change) away.
update opportunities o
   set rest_until = null
 where o.status = 'open'
   and not o.stopped
   and o.unready_reason = 'resting'
   and o.rest_until > now()
   and not (o.rest_until = date_trunc('minute', o.rest_until) and o.rest_until <= now() + interval '7 days 1 hour')
   and not exists (
     select 1
       from drafts d
      cross join lateral jsonb_array_elements(coalesce(d.transitions, '[]'::jsonb)) t(move)
      where d.opportunity_id = o.id
        and (
          (t.move ->> 'to' = 'skipped' and t.move -> 'actor' ->> 'kind' = 'customer')
          or (t.move ->> 'to' = 'unpublished' and t.move -> 'actor' ->> 'kind' = 'system')
        )
        and (t.move ->> 'at')::timestamptz > now() - interval '28 days 1 minute'
   );
