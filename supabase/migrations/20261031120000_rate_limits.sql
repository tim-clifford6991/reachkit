-- Abuse limits shared by every instance: one fixed-window count per scope,
-- hashed key and window. `src/lib/limits` is the only caller; the scope names
-- the rule, the key kind and the window, so two windows on one key never share a row.
create table rate_limits (
  scope text not null,
  key text not null check (key ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (scope, key, window_start)
);

-- No policy: no session reads or writes a count.
alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;
grant select, insert, update, delete on rate_limits to service_role;

comment on table rate_limits is
  'Abuse-limit counts per scope, hashed key and fixed window, taken only through take_rate_limits. '
  'dbAdmin()-only; BUILD §10 default-deny; no anon/authenticated policy by design.';

-- One round trip counts every key a request has. A refused take still counts,
-- so a flood stays refused. About one call in a hundred sweeps windows older
-- than two days, so retention needs no job.
create function take_rate_limits(p_scopes text[], p_keys text[], p_window_s integer[], p_max integer[])
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean := true;
  taken integer;
begin
  for i in 1 .. coalesce(array_length(p_scopes, 1), 0) loop
    insert into public.rate_limits as r (scope, key, window_start, hits)
    values (
      p_scopes[i],
      p_keys[i],
      to_timestamp(floor(extract(epoch from now()) / p_window_s[i]) * p_window_s[i]),
      1
    )
    on conflict (scope, key, window_start) do update set hits = r.hits + 1
    returning r.hits into taken;
    allowed := allowed and taken <= p_max[i];
  end loop;

  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return allowed;
end;
$$;

revoke all on function take_rate_limits(text[], text[], integer[], integer[]) from public;
revoke all on function take_rate_limits(text[], text[], integer[], integer[]) from anon;
revoke all on function take_rate_limits(text[], text[], integer[], integer[]) from authenticated;
grant execute on function take_rate_limits(text[], text[], integer[], integer[]) to service_role;
