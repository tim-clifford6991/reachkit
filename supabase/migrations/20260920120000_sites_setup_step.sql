-- sites.setup_step — which of the five setup steps this founder is on.
--
-- SPEC §5 (2026-09-20, #908, issue #922): "setup is **five saved steps** —
-- your site, your business, rivals, your voice, publishing … Each step
-- saves as it is left so a reload resumes."
--
-- **The step is in the URL first.** `?step=rivals` is what a reload, a Back
-- and a bookmark resume from (`nuqs`, `docs/DESIGN.md`'s library list). This
-- column is what a founder who closed the tab and came back to `/setup`
-- resumes from — the only fact the URL cannot carry.
--
-- **Why it cannot be derived.** The other four steps each leave a trace:
-- `domain` and `category` for the site step, `voice_text` for the voice
-- step, a `destinations` row for the publishing step. The rivals step does
-- not — an empty competitor set is a legal answer (REQ-026 c11) and reads
-- exactly like a step never reached — and the business step writes nothing
-- at all until #926 gives the confirmed profile a home. A derived step
-- would put a founder who deliberately kept no rivals back on step three
-- every time they returned.
--
-- **Text, nullable, no check constraint.** The five handles are
-- `src/app/(account)/setup/steps.ts`'s, and that module is where an
-- unknown value is rejected: a row carrying a step this build does not know
-- reads as "start at the beginning", which is the safe answer, and a
-- constraint here would instead turn a renamed step into a write that
-- throws in front of a paying founder. `null` is a founder who has not left
-- a step yet, which is the same thing to a reader.
--
-- It says nothing about completion: `setup_completed_at` is still the one
-- predicate every account route consults, and this column is never read as
-- a second copy of it.
--
-- Rule 6: the `sites` topic with the `setup_step` sub-token, under the
-- `sites_setup` sub-token the registry already assigns. The timestamp sorts
-- after every migration on disk at implementation time. It depends on
-- `20260906130000_sites_setup.sql` for the table's setup columns and on
-- nothing else.

alter table sites
  add column if not exists setup_step text;

comment on column sites.setup_step is
  'SPEC §5 (2026-09-20, #922): the five-step setup step this founder last left, '
  'one of the handles in src/app/(account)/setup/steps.ts. Written by each step''s '
  'save; read only to reopen /setup where the founder stopped. Null until a step is '
  'left. Never a completion predicate — sites.setup_completed_at is that.';
