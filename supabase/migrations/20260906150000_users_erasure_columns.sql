-- supabase/migrations/20260906150000_users_erasure_columns.sql
--
-- BUILD §10, §14 (issue #52) — the promised purge date, and the tombstone's
-- one written rule.
--
-- REQ-079 criterion 7: "when 30 days have passed, then the account and the
-- sign-in address it was reached at, the site, its pages, drafts,
-- measurements, destination credentials and every copy ReachKit holds of the
-- customer's own page content … are no longer present in ReachKit's stored
-- data at all."
--
-- **The date is stored, not computed.** `purge_due_at` is stamped at
-- deletion as `deleted_at + ERASURE_DAYS` and never recomputed, so changing
-- the pin cannot retroactively move a date already promised to a customer
-- who has left.
--
-- **No `deleted_at` here.** The tombstone column is added by
-- `00000000000002_rls.sql`, as the precondition of every policy's
-- `deleted_at is null` condition; a second `add column` would fail the
-- apply. What this migration adds is the ruling that governs it, as a
-- comment on the column, because the rule and the column belong together
-- wherever a future reader meets either.
--
-- `structure.md` rule 3a: the filename carries the `users_erasure`
-- sub-token, which narrows the `users` topic (`src/lib/db/topics.ts`).

alter table users
  -- Stamped once, at deletion. Null on every live account: a row with a
  -- date here and no `deleted_at` is a fault, not a state, and the purge
  -- refuses to act on one.
  add column purge_due_at timestamptz null;

-- The due-work query is one indexed scan: `purge_due_at <= now()` over the
-- tombstoned rows. Partial, because every live account is null here and a
-- full index would be mostly empty entries.
create index users_purge_due_idx
  on users (purge_due_at)
  where purge_due_at is not null;

comment on column users.purge_due_at is
  'When this account''s rows are removed for good — stamped at deletion as deleted_at + 30 days (ERASURE_DAYS) and never recomputed, so changing the pin cannot move a date already promised (REQ-079 c7).';

comment on column users.deleted_at is
  'The tombstone (ADR-051). Deletion stamps it and issues no DELETE: unreachability is enforced by the row policies'' deleted_at is null condition, never by callers, and the rows themselves go at 30 days through the purge — the only deleter in this schema. Never add a cascade to any foreign key referencing this table, and never "finish" the delete path here.';
