-- supabase/migrations/20260906130000_sites_setup.sql
--
-- BUILD §4.3 (issue #36) — the five columns setup's own state machine
-- needs on `sites`, and the one function that makes the mode and the
-- destination a single transaction.
--
-- **Why these five and no others.** §4.3 is "three cards, one submit" and
-- then a wait. The three answers already have columns on this table
-- (`domain`, `category`, `competitors`, `mode`); what has none is *where
-- in setup this founder is*:
--
--   setup_completed_at     the submit happened (§4.3's "post-payment,
--                          once"). Null is the whole of "not finished
--                          yet" — the incomplete-setup gate, the
--                          reminders and the release deadline all read
--                          this one column and none keeps a second copy.
--   setup_released_at      the latch. Written once, never cleared.
--   setup_released_reason  which of the four triggers wrote it. Recorded
--                          because "released because it finished" and
--                          "released because ten minutes passed" are two
--                          different facts about the same founder, and
--                          the second is the one the app has to speak to.
--   setup_reminders_sent   0..3, so the bound REQ-025 c6 states ("up to
--                          three in all") is a check constraint rather
--                          than a count the sender has to remember.
--   setup_stage            which named step of the deep pass is under
--                          way. The stage stream in
--                          `src/lib/scan/stages.ts` is an in-process
--                          bus, and the pass runs in the job process
--                          while the progress endpoint answers from the
--                          web one — so the stage a founder is shown has
--                          to survive a process boundary, and one column
--                          written six times a pass is the cheapest thing
--                          that does. Never a percentage and never a
--                          time: there is no column here a duration could
--                          travel in.
--
-- No `paid_at`. REQ-025 c6's offsets are measured from the payment, and
-- the payment's own timestamp is §13's (issue #42) — but a `sites` row is
-- created by provisioning *from* that payment, so `created_at` is the same
-- instant to within one webhook, and the reminders read it rather than
-- this migration inventing a column §13 will own.
--
-- ADR-051 point 2: no foreign key here, and none of these columns cascades.
--
-- Rule 6: the `sites` topic with the `setup` sub-token. The timestamp sorts
-- after every migration on disk at implementation time so this file always
-- applies last regardless of merge order; it depends on none of them.

alter table sites
  add column setup_completed_at timestamptz null,
  add column setup_released_at timestamptz null,
  add column setup_released_reason text null
    check (setup_released_reason in ('completed', 'degraded', 'failed', 'deadline')),
  add column setup_reminders_sent integer not null default 0
    check (setup_reminders_sent >= 0 and setup_reminders_sent <= 3),
  add column setup_stage text null;

-- The latch is monotonic, and this states it in the schema rather than in
-- the writer: a reason without an instant, or an instant without a reason,
-- is not a state this table can hold.
alter table sites
  add constraint sites_release_is_whole
  check ((setup_released_at is null) = (setup_released_reason is null));

-- The reminders' due-work query: every unfinished founder, oldest first.
-- Partial, so it indexes only the rows setup has not released — a table of
-- finished founders costs this query nothing.
create index idx_sites_setup_incomplete
  on sites (created_at)
  where setup_completed_at is null;

-- BUILD §4.3's mode-and-destination pair, as one transaction.
--
-- Two writes: the publishing mode on `sites`, and the destination row for
-- the founder's chosen kind. They commit together or not at all, because a
-- founder who ends setup with a mode recorded and no destination — or the
-- reverse — is in a state no screen in this product describes. The only
-- client the application holds is a PostgREST one, where each `.from(...)`
-- is its own request and its own implicit transaction (the same limitation
-- `20260905120000_scans_current_flip.sql` documents), so the atomicity has
-- to live here.
--
-- The destination is created **deferred**: `config` null and
-- `health = 'expired'`. That is not a fourth state — it is an ordinary
-- broken destination, reached by the same reconnect path as any other, and
-- it is what lets REQ-028 c3's "choose WordPress and connect it later"
-- complete setup with no credential collected. This function resolves no
-- DNS, reaches no WordPress site and checks no health: setup makes no
-- network call at all.
--
-- There is no fallback: the kind the founder chose is the kind that is
-- written, and no other destination is ever substituted for it.
create or replace function apply_setup_choice(
  p_site_id uuid,
  p_mode text,
  p_kind text
) returns uuid
language plpgsql
as $$
declare
  v_destination_id uuid;
begin
  update sites set mode = p_mode where id = p_site_id;
  if not found then
    raise exception 'apply_setup_choice: no site % exists', p_site_id;
  end if;

  insert into destinations (site_id, kind, config, health)
  values (p_site_id, p_kind, null, 'expired')
  returning id into v_destination_id;

  return v_destination_id;
end;
$$;
