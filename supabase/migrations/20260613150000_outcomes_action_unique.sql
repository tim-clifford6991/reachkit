-- §10.4 outcomes moat (Cycle 4 Task 14) — one outcome row per verified action.
--
-- runActionVerification upserts an outcomes row keyed on action_id when an action
-- is verified; a unique constraint makes that upsert idempotent (a re-run writes
-- no duplicate). A plain (non-partial) unique index is used so PostgREST's
-- `.upsert(..., { onConflict: "action_id" })` can match it as an ON CONFLICT
-- target. action_id is nullable, and Postgres treats NULLs as DISTINCT under a
-- unique index, so app-level outcomes with no originating action (action_id NULL)
-- remain allowed and never collide.
create unique index if not exists outcomes_action_id_key
  on outcomes(action_id);
