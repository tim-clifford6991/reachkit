-- supabase/migrations/20260906150100_users_erasure_tickets.sql
--
-- BUILD §4.7 (issue #52) — the danger zone's ticket.
--
-- REQ-079 criterion 2: "Given the customer starts either action, when they
-- have not explicitly confirmed it, then nothing is unpublished, deleted or
-- cancelled." Criterion 3: "an export of their pages is produced and
-- downloaded by them before anything is unpublished or deleted; if it cannot
-- be produced, or they do not take it, the action does not proceed and says
-- why."
--
-- A ticket is what makes both of those a state rather than a convention. It
-- is written when the archive has been built, stamped `taken_at` when the
-- whole archive has left this process, and stamped `spent_at` when the
-- action it authorises has run. A confirmation reaching the engine without
-- one of those stamps is refused by name, and there is no second entry point
-- to either action.
--
-- **The foreign key carries no cascade.** ADR-051: the purge is the only
-- deleter, and a cascade here would remove a customer's ticket rows the
-- moment anything upstream went, which is a delete nobody asked for.
-- The row is purged with the account.

create table danger_tickets (
  ticket text primary key,
  site_id uuid not null references sites (id),
  action text not null check (action in ('unpublish_all', 'delete_account')),
  created_at timestamptz not null default now(),
  -- The moment the whole archive left this process for the customer's own
  -- session. The strongest available claim, and deliberately not "the
  -- customer holds the file", which nothing on this side can know.
  taken_at timestamptz null,
  -- The moment the action ran. A second confirmation on a spent ticket is
  -- refused rather than run twice.
  spent_at timestamptz null,
  expires_at timestamptz not null
);

alter table danger_tickets enable row level security;

-- Default-deny (§10). The engine reaches this table through dbAdmin() only:
-- a ticket is minted, stamped and spent server-side, and no customer session
-- reads or writes one directly.
create policy danger_tickets_no_access on danger_tickets
  for all
  using (false)
  with check (false);

create index danger_tickets_site_idx on danger_tickets (site_id);

comment on table danger_tickets is
  'One danger-zone action, begun and awaiting its confirmation (REQ-079 c2, c3). Purged with the account (ADR-051); nothing else deletes a row here.';
