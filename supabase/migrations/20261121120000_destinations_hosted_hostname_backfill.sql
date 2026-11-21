-- Every live hosted destination stores the host it is served at, so the edge
-- finds a site by that stored host alone. Data only: no column, index or
-- policy changes.
--
-- A live hosted row with no host is given `content.<site domain>`,
-- the address it is served at today. It is `live` when the site has a live
-- hosted page, else `pending_dns`. A row whose host another live destination
-- already holds, or that shares its host with another row here, is left as it
-- is and reported, never overwritten: the read-back below names it.

do $$
declare
  r record;
begin
  create temporary table hostname_backfill on commit drop as
  select
    d.id,
    'content.' || lower(trim(s.domain)) as host,
    exists (
      select 1 from publications p
      where p.site_id = d.site_id
        and p.destination = 'hosted'
        and p.published_at is not null
        and p.unpublished_at is null
    ) as serving
  from destinations d
  join sites s on s.id = d.site_id
  where d.kind = 'hosted'
    and d.deleted_at is null
    and d.hostname is null
    and coalesce(trim(s.domain), '') <> '';

  for r in
    select b.id, b.host from hostname_backfill b
    where exists (
        select 1 from destinations o
        where o.deleted_at is null and o.hostname is not null and lower(o.hostname) = b.host
      )
      or (select count(*) from hostname_backfill c where c.host = b.host) > 1
  loop
    raise notice 'hostname backfill skipped: destination % would take host %, which another row holds or claims', r.id, r.host;
    delete from hostname_backfill where id = r.id;
  end loop;

  update destinations d
  set hostname = b.host,
      hostname_state = case when b.serving then 'live' else 'pending_dns' end
  from hostname_backfill b
  where d.id = b.id;
end;
$$;

-- Read-back, run after the apply; 0 is the expected answer:
--   select count(*) from destinations
--   where kind = 'hosted' and deleted_at is null and hostname is null;
