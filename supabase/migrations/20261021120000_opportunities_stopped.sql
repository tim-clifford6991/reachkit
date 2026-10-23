-- Whether the customer stopped this topic. A stopped topic is dropped for
-- good: no later pass proposes it again, whatever volume it measures, while
-- a row a gate dismissed may still return on a higher volume. The column is
-- written where the customer stops a page; RLS is unchanged.
alter table opportunities add column if not exists stopped boolean not null default false;

-- The draft stops already on file, 0¢; a second run changes nothing. A skip
-- of a draft the generator stopped rests its topic instead, so it is left out.
update opportunities o
   set stopped = true
  from drafts d
 where d.opportunity_id = o.id
   and d.state = 'skipped'
   and o.status = 'dismissed'
   and o.stopped = false
   and not coalesce(
     (select t.move ->> 'from' from jsonb_array_elements(d.transitions) with ordinality t(move, n)
       where t.move ->> 'to' = 'skipped' order by t.n desc limit 1) = 'needs_attention'
     and (select t.move ->> 'from' from jsonb_array_elements(d.transitions) with ordinality t(move, n)
           where t.move ->> 'to' = 'needs_attention' order by t.n desc limit 1) = 'generating',
     false
   );
