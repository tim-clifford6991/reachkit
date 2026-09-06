-- supabase/migrations/20260906100000_users_identity_columns.sql
--
-- BUILD §13 · §4.7 — the account's name, the whole of a pending email
-- change, and the one stamp that ends an account's other sessions.
-- Sub-token `users_identity` (`src/lib/db/topics.ts`; BP-061 owns it), so
-- this file narrows BP-017's `users` topic and owns exactly these columns.
--
-- REQ-077 criterion 2, quoted: "a sign-in link is sent to it and the old
-- address keeps working until that link is used". The pending state is
-- three columns **beside** `users.email`, never a write to it: `email` is
-- changed inside the redemption's own transaction and at no other moment,
-- which is what makes a mistyped address cost nothing at all.
--
-- The partial unique index over `lower(pending_email)` is the half of "not
-- already a ReachKit account" a handler cannot forget. It is deliberately
-- **not** unique against `users.email`: Postgres has no cross-column unique
-- index, so the in-use check reads both columns together
-- (`src/lib/account/identity/email-change.ts`) and this index closes the
-- narrower race — two customers submitting one address in the same second.
--
-- `sessions_valid_from` is what BP-061 decision 4 needs a home for: "a
-- completed email change ends the account's other sessions". A session
-- cookie carries the moment it was issued; a cookie issued before this
-- stamp is not a session any more. One column rather than a `sessions`
-- table, because BUILD §10's bar for a new table is "a rendered surface
-- that reads it" and nothing renders a list of a customer's devices —
-- `auth_links` is the tenth table and it has one.
--
-- ADR-051 point 2: no foreign key here, and nothing added by this file
-- carries `on delete cascade`.

alter table users add column name text;
alter table users add column pending_email text;
alter table users add column pending_email_token_hash text;
alter table users add column pending_email_sent_at timestamptz;
alter table users add column sessions_valid_from timestamptz;

comment on column users.name is
  'The account holder''s own name, as the account card shows it (BUILD §4.7). Null until they write one; nothing fabricates it.';
comment on column users.pending_email is
  'An address awaiting confirmation. Null means no change is pending. Never the address that signs in — that is users.email until the link is redeemed (REQ-077 c2).';
comment on column users.pending_email_token_hash is
  'The SHA-256 of the email_change token this pending change is waiting on, so cancelling can spend it. Never a plaintext token (BP-061 d3).';
comment on column users.pending_email_sent_at is
  'When the pending change''s link was sent. The change lapses EMAIL_CHANGE_TTL_H after it (REQ-077 c4).';
comment on column users.sessions_valid_from is
  'Sessions issued before this moment are ended. Stamped when an email change completes (BP-061 d4); null means every unexpired session stands.';

-- Case-insensitive, matching `users_email_lower_key`: `Anna@Example.com`
-- and `anna@example.com` are one address, and a mixed-case row would be a
-- second pending identity for one person.
create unique index users_pending_email_lower_key
  on users (lower(pending_email))
  where pending_email is not null;
