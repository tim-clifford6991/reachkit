-- Persist the full grounding (why an action exists + what it's based on) ONTO the
-- action row at creation time, so every task — tracked or suggested — always
-- carries its own provenance and can deep-link back, with zero dependency on
-- re-matching the action's title against a freshly-regenerated synthesis plan
-- (owner 2026-07-24: "persist the full grounding onto the action when it's
-- created" — the fix for tracked actions showing a bare "queued from your plan").
--
-- Shape (all optional): {
--   targetKeywords: string[],                         -- gap keywords the action targets
--   exemplars: { domain, url, position? }[],          -- rival pages already winning them
--   evidence: string,                                 -- the source evidence line (may hold a URL)
--   pain: string,                                     -- the buyer pain/angle it addresses
--   sourceThread: { title, url },                     -- the community thread it replies to
--   volume: number                                    -- est. monthly search volume
-- }
-- Additive + nullable → zero-downtime; older rows read back null and fall through
-- to the existing title-match path.
alter table public.actions add column if not exists grounding jsonb;

comment on column public.actions.grounding is
  'Action provenance captured at creation (targetKeywords/exemplars/evidence/pain/sourceThread/volume) so the plan UI can always show why it matters + deep-link its source, independent of synthesis title-matching.';
