-- supabase/migrations/20260906140000_destinations_core.sql
--
-- BUILD §9 (issue #48) — the destinations topic: a reason, a breakage
-- clock, one live destination per site, and no cascade.
--
-- §10 already gives the row `id, site_id, kind, config jsonb, health,
-- created_at`. Everything below is what makes §9's "expired credential is
-- a **state** … not an error loop" a thing the database can hold.
--
-- **`health` is not widened.** §10 fixes it at three members and the
-- customer reads exactly three states — working, needs reconnecting,
-- failing. A fourth occasion costs a `health_reason`, a copy key and an
-- action, and costs nothing here (ADR-086: "a credential that cannot
-- publish is its own occasion — a `HealthReason`, not a fourth health
-- state").
--
-- `structure.md` rule 3: the filename carries the `destinations` topic
-- token (`src/lib/db/topics.ts`).

alter table destinations
  -- What the last check concluded, and the only thing that selects the
  -- written line and the action a surface offers. Eight members, closed:
  -- three requirements land different lines inside `expired` alone (DNS
  -- unset, never connected, credential expired), and `cannot_publish`
  -- lands its own inside `error`.
  add column health_reason text null
    check (
      health_reason in (
        'never_connected',
        'dns_unset',
        'dns_elsewhere',
        'credentials_expired',
        'credentials_invalid',
        'unreachable',
        'destination_rejected',
        'cannot_publish'
      )
    ),

  -- When the destination last *changed* state — not when it was last
  -- looked at. The 24 hours before one breakage mail are counted from
  -- here, and "no further mail until it is reconnected and breaks again"
  -- is a comparison against it. `now()` for an existing row is the truth
  -- available: the row's history before this migration is not recorded.
  add column health_changed_at timestamptz not null default now(),

  -- The once-per-breakage guard. Set when the mail is handed to the mail
  -- seam, and cleared on every transition back to `ok` — that clearing is
  -- how "until it is reconnected and breaks again" is expressed as data
  -- rather than as a rule someone has to remember.
  add column broken_mail_sent_at timestamptz null,

  -- When the destination was last checked. The customer reads this date,
  -- and §9's promise is that it is never more than 24 hours old whether or
  -- not a publish was attempted in between — which is why it is refreshed
  -- on the read path and not by a job.
  add column last_checked_at timestamptz not null default now(),

  -- Disconnect destroys the credential and keeps the row: pages already
  -- published stay live and their publications point at this destination.
  add column deleted_at timestamptz null,

  -- Whether this credential can publish and not merely create a post.
  -- `null` for a hosted destination and before the first probe. It is a
  -- health *input*, and the only one on this row: `false` makes the
  -- destination `error` / `cannot_publish` and the queue holds there. The
  -- probe that writes it is the WordPress adapter's (#54); the column and
  -- the state it selects are this issue's.
  add column publish_capable boolean null;

-- ONE LIVE DESTINATION PER SITE.
--
-- §9 publishes a page to the destination the customer chose, and to no
-- other. Making that a database invariant rather than a branch is what
-- keeps it true: with a single live row per site there is no second row a
-- fallback could ever select, so "nothing is published to any other
-- destination" holds by construction and not by everyone remembering it.
--
-- Partial, on `deleted_at is null`: a disconnected destination keeps its
-- row (see `deleted_at` above) and must not block the connection that
-- replaces it.
create unique index destinations_one_live_per_site
  on destinations (site_id)
  where deleted_at is null;

comment on index destinations_one_live_per_site is
  'BUILD §9 — one live destination per site. A soft-deleted row (deleted_at not null) is out of the index, so disconnect-then-connect is an ordinary customer action.';

-- NO CASCADE, HERE OR ANYWHERE INTO `publications` (ADR-080).
--
-- `publications` is keyed on `(draft_id, destination)` and that row, written
-- before the destination call, is half of the at-most-once guarantee. A
-- cascade reaching it would make disconnect-and-reconnect — an ordinary
-- customer action — start every page over as a first attempt against a
-- destination that already holds the posts. `destinations` therefore
-- declares no foreign key toward `publications` at all, and its own
-- `site_id` reference keeps the baseline's default `no action`.
comment on column destinations.deleted_at is
  'BUILD §9 — disconnect sets this and nulls `config`; the row and every publication pointing at it survive (ADR-080: neither may be tidied away).';

comment on column destinations.config is
  'BUILD §9 — ciphertext, never plaintext. Written and read only through src/lib/publish/destinations/config/; no read path used by any surface selects it.';

comment on column destinations.health_reason is
  'BUILD §9 / ADR-086 — what the last check concluded. Selects the written line and the action; never widens `health`, which stays §10''s three states.';

-- Existing rows predate the reason: a destination that is `ok` has no
-- reason to give, and one that is not was never given one to record.
update destinations set health_reason = 'never_connected' where health <> 'ok';
