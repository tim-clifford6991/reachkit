-- sites.setup_stage_times — when each named stage of the deep pass began.
--
-- issue #356 · UI-SPEC S11 · REQ-029 c1
--
-- **This reverses a sentence in `20260906130000_sites_setup.sql`.** That
-- migration introduced `setup_stage` and said of it: "Never a percentage
-- and never a time: there is no column here a duration could travel in."
-- That was right for the screen as REQ-025 c1 then stood — the waiting
-- screen stated no duration anywhere, and the absence was asserted.
--
-- The owner's approved screen set (2026-09-08) draws S11 with an elapsed
-- time beside every finished stage, and ruling 11a makes the drawing the
-- reference. A duration the screen composed from its own clock would be a
-- number the pass never measured — the browser's reading of how long a tab
-- was open, not the work's — so the instant each stage began is recorded
-- here, and the screen subtracts.
--
-- **A map, not a timestamp.** One `entered_at` column would answer only
-- "how long has the current stage been running", and the set draws the
-- *finished* ones: a stage's duration is the difference between its own
-- entry and the next stage's. So the row accumulates one entry per stage,
-- keyed by the same handle `setup_stage` carries.
--
-- The current stage's own elapsed time is deliberately still not
-- answerable, and the set draws it as `–` rather than a running clock.
-- Nothing here ticks.
--
-- **`{}` and not null.** A pass that has recorded no stage yet, and a
-- founder whose pass has not started, are the same fact to a reader — no
-- stage has begun — so the empty map is the honest default and the screen
-- needs no third arm for a null.
--
-- Rule 6: the `sites` topic with the `setup_stage_times` sub-token. The
-- timestamp sorts after every migration on disk at implementation time.
-- It depends on `20260906130000_sites_setup.sql` for the column it sits
-- beside, and on nothing else.

alter table sites
  add column setup_stage_times jsonb not null default '{}'::jsonb;

comment on column sites.setup_stage_times is
  'When each named deep-pass stage began, keyed by the handle in src/lib/scan/stages.ts. '
  'Written by runDeepPass''s recordStage; read by the waiting screen, which subtracts '
  'consecutive entries to state a finished stage''s elapsed time (UI-SPEC S11).';
