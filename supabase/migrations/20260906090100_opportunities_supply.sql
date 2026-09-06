-- BUILD §7 — the one column supply depth needs.
--
-- `exhaustedSince` is derived, never stored: it is the moment the site's
-- last non-Fix opportunity left `open`. That moment is only knowable if
-- the row records when its status last changed, which is this column and
-- nothing else. No counter, no `supply_depth` column, no materialised
-- view — a count with a second home drifts from the rows it counts, and a
-- customer told supply is short while it is not is what that drift
-- produces.
--
-- Topic token `opportunities`, sub-token `opportunities_supply`
-- (`src/lib/db/topics.ts`).

alter table opportunities
  add column if not exists status_changed_at timestamptz not null default now();

-- Maintained only when `status` actually changes, so an unrelated update
-- cannot move the date supply exhaustion is dated from.
create or replace function opportunities_touch_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger opportunities_status_changed_at
  before update on opportunities
  for each row
  execute function opportunities_touch_status_changed_at();

create index opportunities_site_status_changed_idx
  on opportunities (site_id, status_changed_at desc);
