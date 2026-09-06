-- supabase/migrations/20260906090100_users_provisioning_keys.sql
--
-- BUILD §13 — provisioning's second idempotency key and the one column the
-- 15-minute chase reads. Sub-token `users_provisioning`.
--
-- REQ-024 criterion 3: "once that processing ends the address still has
-- exactly one account, one site and one running subscription". The
-- functional unique index over `lower(email)` is the database-level half of
-- that guarantee — the half a handler cannot forget. The baseline's
-- `users.email unique` is case-sensitive and would let `A@b.com` open a
-- second account beside `a@b.com`; this index is what closes it.
--
-- `first_signed_in_at` is what `paymentsAwaitingSignIn` reads, and the
-- partial index beneath it is the read's access path: rows with a checkout
-- session and nobody signed in yet — which is a handful at any moment,
-- never the whole table.
--
-- No `payments` table and no `provisioning_attempts` table is created here,
-- deliberately: the durable record a replayed webhook conflicts on is the
-- `users` row's own `checkout_session_id`, and a second table holding the
-- same fact is a second thing to keep true.

create unique index users_email_lower_key on users (lower(email));

alter table users add column first_signed_in_at timestamptz;

alter table users add column sign_in_chased_at timestamptz;

comment on column users.first_signed_in_at is
  'When this account was first signed in to. Null means nobody has: what the 15-minute chase reads (REQ-024 c5).';
comment on column users.sign_in_chased_at is
  'When the 15-minute chase mail was sent. Null means it has not been: a tick that runs twice sends once (REQ-024 c5).';

create index users_awaiting_sign_in_idx
  on users (checkout_session_id)
  where first_signed_in_at is null and sign_in_chased_at is null;
