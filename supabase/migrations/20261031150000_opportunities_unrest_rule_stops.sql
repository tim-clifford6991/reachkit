-- Topics resting only because a rule stopped their draft since 2026-10-17
-- are offered again: those rules stopped sound pages and are fixed. 0¢ and
-- data only; nothing is deleted and no draft is touched, and a second run
-- changes nothing. The evening check recomputes `ready`.
--
-- A rule stop is the draft's move into `needs_attention` whose reason is
-- `rules:…`; it set `rest_until` to its run's clock plus 28 days, so a rest
-- ending later was set after it (a skip, a take-down) and stays.
update opportunities o
   set rest_until = null
 where o.status = 'open'
   and not o.stopped
   and o.unready_reason = 'resting'
   and o.rest_until > now()
   and exists (
     select 1
       from drafts d
      cross join lateral jsonb_array_elements(coalesce(d.transitions, '[]'::jsonb)) t(move)
      where d.opportunity_id = o.id
        and t.move ->> 'to' = 'needs_attention'
        and t.move ->> 'reason' like 'rules:%'
        and (t.move ->> 'at')::timestamptz >= timestamptz '2026-10-17 00:00:00+00'
        and o.rest_until <= (t.move ->> 'at')::timestamptz + interval '28 days 1 minute'
   );
