-- SPEC §7 (owner, 2026-10-10; issue 1390): the voice a customer fixes for
-- their pages.
--
-- A page is written in one of three voices — the business as "we", a neutral
-- guide in the third person, or a short answer — and ReachKit chooses one
-- for each page from the site's voice text, its kind of business and the
-- question (`src/lib/generate/voice/register.ts`). The customer may fix it
-- in Settings; it is never a step.
--
--   null     ReachKit chooses, page by page. Every site until it says otherwise.
--   'ours'   the business speaking, "we"
--   'guide'  a neutral guide, third person
--   'short'  a short answer, where the page's type suits one
--
-- Read by the generator on its own, and a read that fails is "not chosen",
-- so the application runs before this is applied. Row security is the
-- table's own: a column adds no policy.
--
-- Rule 3a: the `sites` topic (`src/lib/db/topics.ts`).

alter table sites
  add column writing_voice text,
  add constraint sites_writing_voice_known check (writing_voice is null or writing_voice in ('ours', 'guide', 'short'));

comment on column sites.writing_voice is
  'The voice the customer fixed for their pages in Settings (#1390, SPEC §7): ours, guide or short. '
  'Null leaves the choice to ReachKit, page by page.';
