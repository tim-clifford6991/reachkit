-- scans.stage_events — the pass's own stage transitions, written where a
-- *second process* can read them.
--
-- Issue #540 · BUILD §3 (`GET /api/scan/{scanId}/progress`) · BUILD §4.1
-- States ("scanning (named stages with elapsed times, no spinner)") ·
-- REQ-003 c1 and c3.
--
-- **This discharges a caveat `src/lib/scan/stages.ts` flagged the day it
-- was written.** That module carried the free scan's stage transitions on
-- a module-scoped, in-process event bus, and said of it: "this only
-- carries events within one Node process, so if the job that runs
-- `runScan` and the process that serves this route are ever different
-- deployed instances, a second transport (Postgres LISTEN/NOTIFY, a
-- queue) replaces this bus without changing `progress`'s own exported
-- shape". On the platform this product deploys to they *are* different
-- instances: `POST /api/scan` runs the pass inside its own invocation and
-- `GET …/progress` is served by another, so the subscriber listened to an
-- empty bus in its own process and the visitor read the first stage
-- handle forever. This column is that second transport.
--
-- **Not LISTEN/NOTIFY.** The only two ways to reach Postgres in this
-- product are `db()` and `dbAdmin()` (`src/lib/db/index.ts`), both
-- PostgREST over HTTP, and PostgREST carries no `LISTEN`. A notification
-- is also not durable: a subscriber that attaches after a transition has
-- already happened must still be shown it, because the ordinary case is
-- exactly that — the POST claims the slot and starts the pass before the
-- browser's `EventSource` connects. So the transport is the *recorded*
-- transition, and the reader polls it.
--
-- **An ordered log, not a map.** `sites.setup_stage_times`
-- (`20260909120000_sites_setup_stage_times.sql`) records one instant per
-- stage, because the screen it feeds asks only "how long did each finished
-- stage take". This stream asks something else: replay every transition,
-- in the order it happened, including the one terminal ending, so a
-- subscriber that joins late sees the same events in the same order as one
-- that was there from the first. A jsonb array of the engine's own
-- `StageEvent` values answers that and nothing is derived on the way out:
-- each element is serialised to the wire verbatim, exactly as the
-- in-process bus's events were.
--
-- Fourteen elements at most (six stages × entry and exit, plus the one
-- ending), so no retention policy is owed here — the row's own lifetime is
-- the log's.
--
-- **`[]` and not null.** A scan that has recorded no transition yet and a
-- scan whose pass has not started are the same fact to a reader — nothing
-- has happened — so the empty array is the honest default and neither the
-- engine nor the route needs an arm for a null.
--
-- Rule 6: the `scans` topic with the `stage_events` sub-token. The
-- timestamp sorts after every migration on disk at implementation time; it
-- depends on `00000000000001_baseline.sql` for the table and on nothing
-- else.

alter table scans
  add column stage_events jsonb not null default '[]'::jsonb;

comment on column scans.stage_events is
  'The pass''s stage transitions and its one ending, in the order they happened, each element '
  'a `StageEvent` from src/lib/scan/stages.ts serialised verbatim. Appended by that module''s '
  'producers through append_scan_stage_event; read by progress(scanId), which replays the array '
  'and then polls it, so the progress stream crosses the process boundary between the invocation '
  'that runs the pass and the one that serves GET /api/scan/{scanId}/progress (issue #540).';

-- **The append, as one statement.** A read-modify-write from the engine
-- would be two round trips per transition against a pass that has fifty
-- seconds in total, and would race the ending against a stage exit that
-- read the array before it. This does the whole of it in the database.
--
-- **The ending closes the log**, which is the guard `stages.ts`'s own
-- `publish` used to hold: after the one terminal event, no event of any
-- kind is recorded. A driver racing its own cleanup against a ceiling that
-- already ended the pass is a timing accident, not a caller error, so the
-- attempt is dropped rather than raised.
--
-- A `scanId` with no row is a no-op: the two paid tiers insert their
-- `scans` row only when they store a report, and nothing streams their
-- progress (the founder's waiting screen reads `sites.setup_stage` —
-- `src/lib/scan/deep/progress.ts`), so a paid pass records nothing here
-- and is not an error.
create or replace function append_scan_stage_event(p_scan_id uuid, p_event jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.scans
     set stage_events = scans.stage_events || jsonb_build_array(p_event)
   where scans.id = p_scan_id
     and not exists (
           select 1
             from jsonb_array_elements(scans.stage_events) as recorded
            where jsonb_exists(recorded, 'ending')
         );
end;
$$;

-- The same posture `fetches_spend_since` takes
-- (`20260909200000_fetches_daily_spend.sql`): a function is executable by
-- `public` unless it is told otherwise, and this one writes. Only the job
-- runner's own role drives a pass, so only that role may record what a
-- pass did — a visitor who could call this could write stage transitions
-- into any scan's stream.
revoke all on function append_scan_stage_event(uuid, jsonb) from public;
revoke all on function append_scan_stage_event(uuid, jsonb) from anon;
revoke all on function append_scan_stage_event(uuid, jsonb) from authenticated;
grant execute on function append_scan_stage_event(uuid, jsonb) to service_role;
