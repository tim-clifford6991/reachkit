-- supabase/migrations/20261120200000_users_subscription_offer_spots.sql
--
-- The first-50 offer's spots: one row per spot a paid checkout took. A cancel
-- keeps the row counted; only a full refund in the first 14 days sets
-- `freed_at`, which gives the place back.
--
-- The partial unique index on `place` is the race-safe cap: two checkouts
-- can never hold the same place, and `place` only runs 1 to 50. The
-- subscription is the key, so one checkout never holds two spots.
--
-- No foreign key to `users`, on purpose (as `refunds`): the 30-day purge must
-- not give a taken spot back.
--
-- RLS: enabled, no policy. Read and written only through `dbAdmin()`.
-- Expand-only; applied by hand before the deploy whose code reads it.

create table if not exists offer_spots (
  place int not null check (place between 1 and 50),
  user_id uuid not null,
  subscription_id text primary key,
  taken_at timestamptz not null default now(),
  freed_at timestamptz
);

create unique index if not exists offer_spots_place_held_key on offer_spots (place) where freed_at is null;
create index if not exists offer_spots_user_id_idx on offer_spots (user_id);

alter table offer_spots enable row level security;

comment on table offer_spots is
  'The first-50 offer: one row per spot a paid checkout took; freed_at only on a full refund in the first 14 days. '
  'No FK to users so the purge frees nothing. dbAdmin()-only; default-deny; no anon/authenticated policy by design.';

revoke all on offer_spots from anon, authenticated;
grant select, insert, update on offer_spots to service_role;
