-- Structured execution target (WHO/WHERE) for an action, so outreach actions
-- carry a concrete venue/recipient instead of defaulting to a blank email.
-- Nullable + no backfill: legacy actions keep today's title-derived routing.
alter table public.actions add column if not exists target jsonb;

comment on column public.actions.target is
  'ActionTarget { channel, label, url? } — the concrete venue/recipient an action executes against. Null for on-site tasks and legacy rows.';
