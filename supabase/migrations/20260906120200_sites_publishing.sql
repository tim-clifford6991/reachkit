-- supabase/migrations/20260906120200_sites_publishing.sql
--
-- BUILD §9 (issue #45) — the publishing switch.
--
-- §9: "pause is one click and instant." The switch is one boolean on the
-- site, read where the decision is made — inside the claiming transaction,
-- immediately before the write — and never cached anywhere. Recording it is
-- the entire act: nothing here moves a page, and no page is skipped,
-- discarded or moved to needs-attention on account of publishing being off.
--
-- **Default true.** A site that has never touched the switch is publishing:
-- the switch is the customer's stop, not a feature flag, and a false
-- default would silently hold every page of every site that never opened
-- Settings.
--
-- `structure.md` rule 3a: the filename carries the `sites_publishing`
-- sub-token, which narrows the `sites` topic and is owned by the publishing
-- node (`src/lib/db/topics.ts`).

alter table sites
  add column publishing_enabled boolean not null default true,
  -- The moment the switch was last recorded. §9's promise is stated against
  -- this moment — "no publish attempt begins for any page after the moment
  -- the switch is recorded" — so it is a stored fact, not an inference from
  -- a log line.
  add column publishing_changed_at timestamptz null,
  add column publishing_changed_by text null
    check (publishing_changed_by in ('customer', 'system'));
