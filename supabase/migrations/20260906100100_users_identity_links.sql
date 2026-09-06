-- supabase/migrations/20260906100100_users_identity_links.sql
--
-- BUILD §13 — `auth_links`: the one-time key this product signs in with.
-- Sub-token `users_identity` (BP-061's; `links` is a descriptive suffix,
-- not a second sub-token, so `topicOf()` still resolves exactly one).
--
-- This is BUILD §10's tenth table and it clears §10's own bar — "a 10th
-- table needs a rendered surface that reads it, specified first": every
-- sign-in in the product reads it, and the account card reads the pending
-- change it carries (REQ-077 c4).
--
-- **No column here stores a token.** `token_hash` is the SHA-256 of a
-- 256-bit random token (BP-061 decision 3, `LINK_TOKEN_BYTES`); the
-- plaintext exists in the mail and nowhere else, so a read of this table
-- yields no working key to any account. `tests/account/columns.test.ts`
-- asserts the table has these six columns and no seventh, which is what
-- stops a later migration adding a convenience `token` beside them.
--
-- The primary key is the hash, deliberately: a redemption looks a token up
-- by the only thing it knows, and there is no second index to keep true.
--
-- `auth_links_one_live_idx` is BP-061's rate limit, as an index rather than
-- a rule a caller remembers: "at most one live token per (user_id,
-- purpose). Issuing a new one spends the previous. A customer who clicks
-- 'send me a link' three times has one working link — the newest — which is
-- what they will click."
--
-- ADR-051 point 2: the foreign key to `users` carries **no** `on delete
-- cascade`. A tombstoned account's links are removed by the 30-day purge,
-- not by a cascade nobody wrote.
--
-- RLS default-deny with no policy, like `email_suppressions`: issuing and
-- redeeming are server-side and reach this table through `dbAdmin()`. A
-- stranger holding a link holds a capability to sign in as one account,
-- never a read of who else has one.

create table auth_links (
  token_hash text primary key,
  user_id uuid not null references users (id),
  purpose text not null check (purpose in ('sign_in', 'email_change')),
  sent_to text not null check (sent_to = lower(sent_to)),
  expires_at timestamptz not null,
  spent_at timestamptz
);

alter table auth_links enable row level security;

-- `service_role` bypasses RLS but still needs the table grant — `BYPASSRLS`
-- skips row policies, not privileges. Matched to the baseline's own grant.
grant select, insert, update, delete on auth_links
  to anon, authenticated, service_role;

create unique index auth_links_one_live_idx
  on auth_links (user_id, purpose)
  where spent_at is null;

comment on table auth_links is
  'One-time sign-in and email-change links. BUILD §10''s tenth table; every sign-in reads it (BP-061).';
comment on column auth_links.token_hash is
  'SHA-256 of the token. The plaintext is never stored anywhere in this schema (BP-061 d3).';
comment on column auth_links.sent_to is
  'The address the link was mailed to, lowercased. For an email_change this is the new address, not the account''s current one.';
comment on column auth_links.spent_at is
  'When this link was used or superseded. Null means live; a second use finds it non-null and is refused (REQ-098 c7).';
