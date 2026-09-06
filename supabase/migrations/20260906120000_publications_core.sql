-- supabase/migrations/20260906120000_publications_core.sql
--
-- BUILD §9 (issue #45) — the columns a publish attempt writes, and **the
-- unique index that is the at-most-once guarantee.**
--
-- §9: "Publishing idempotent by `(draft_id, destination)` — a retry can
-- never create a second post." That promise is an invariant of the schema
-- here, not a code path anywhere: the index below is what makes a second
-- post for one page at one destination unrepresentable, and application
-- code cannot forget it, race it, or be refactored out of it.
--
-- ADR-080 (2026-08-31), which this file exists to serve: "The
-- `publications` row (written before the destination call) plus the
-- destination-side marker are the at-most-once guarantee; neither may be
-- tidied away." The row is written by the claiming transaction
-- (`src/lib/publish/attempt/claim.ts`) **before** the adapter is called, so
-- a crash between the write and the delivery leaves a row that the next
-- attempt finds — which is the whole mechanism. A row written after the
-- call would guarantee nothing at all.
--
-- **No foreign key into `publications` carries `on delete cascade`**
-- (ADR-080 decision 3, and ADR-051 point 2 for `sites`). The baseline
-- declares `draft_id` and `site_id` with the default `no action` and this
-- file adds no constraint that changes that: a cascade would let a delete
-- somewhere else silently remove the row that proves a page was published,
-- and the one deletion path this table has is the 30-day erasure purge.
--
-- `structure.md` rule 3: the filename carries the `publications` topic
-- token, BP-045's own (`src/lib/db/topics.ts`).

-- ── The at-most-once guarantee ──────────────────────────────────────────
--
-- One post per page per destination. `publications.destination` is the
-- destination *kind* — §10 gives a site at most one destination of each
-- kind, and §9 states the idempotency key as `(draft_id, destination)`
-- in exactly those words.
--
-- The index is not an optimisation and is not a tidy-up candidate: it is
-- REQ-056 criterion 5 ("at most one post for that page exists at that
-- destination") expressed where Postgres, not application code, enforces
-- it, including against two attempts racing from two processes.
create unique index idx_publications_one_per_draft_destination
  on publications (draft_id, destination);

alter table publications
  -- Where the attempt has got to. `claimed` is written before the adapter
  -- is called; `delivered` and `failed` are written after it answered.
  -- The claim's conflict clause refuses **only** a `delivered` row: a
  -- `claimed` or `failed` row is a legitimate retry and must be allowed to
  -- become an attempt again.
  add column delivery_state text not null default 'claimed'
    check (delivery_state in ('claimed', 'delivered', 'failed')),

  -- §9's "retry ×3". Incremented by the claim, read by the retry policy.
  add column attempt_no integer not null default 0,

  -- The moment the attempt was claimed — always set, because a row exists
  -- only because an attempt was claimed for it.
  add column claimed_at timestamptz not null default now(),

  -- A member of `FailureReason` (src/lib/publish/types.ts) and never a
  -- vendor payload: nothing a destination said about itself is stored
  -- here, and nothing here is rendered without going through a copy key.
  add column failure_reason text null,

  -- The post/page id at the destination. Opaque to us, never rendered;
  -- it is what makes a re-delivery find the existing post instead of
  -- creating a second one at a destination our index cannot reach into.
  add column remote_id text null,

  -- ADR-082's discriminator, retained unchanged by ADR-084 Decision 4.
  -- Written from `DeliveryResult.madeLive` and from nothing else, so it is
  -- true only where ReachKit itself performed the act that made the page
  -- live at that destination.
  --
  -- **It will read as a dead column, and the reason has inverted.** Until
  -- 2026-09-01 it was false for every WordPress row and true for every
  -- hosted one. Since the ruling that content is published complete at
  -- every destination it is true for every row this product writes, at
  -- both destinations — a column with one value, which is exactly what it
  -- looks like and exactly what it is not. It is what keeps §9's "we never
  -- made this page live" outcome renderable at all, and it is the reason
  -- `unpublish` never writes into a post ReachKit did not make live.
  --
  -- It cannot be `live_url is not null`. ADR-081 rejected that substitution
  -- because `live_url` was null for every WordPress row, so it classified
  -- every WordPress page as never-live; `live_url` is now non-null for
  -- every WordPress row, so the same predicate would classify every
  -- WordPress page as made-live-by-us and write into a post ReachKit had
  -- left alone. Same substitution, opposite failure, both wrong.
  add column made_live_by_us boolean not null default false,

  -- Which of `UnpublishResult`'s five arms the last unpublish produced.
  -- **Not derivable** (ADR-082 Decision 6): `made_live_by_us` and
  -- `unpublished_at` together cannot separate "the post is still there",
  -- "the post is already gone" and "the site was not reached" — those are
  -- facts about what the last call *found* at a destination ReachKit does
  -- not own. It is what the page record's written line is rendered from.
  --
  -- All five are permitted, including `named_for_removal`, which no
  -- production path can write today: it is the arm held open against a
  -- page ReachKit created but did not make live, and a constraint narrowed
  -- to today's reachable population would quietly reject it.
  add column unpublish_outcome text null
    check (unpublish_outcome in (
      'removed', 'returned_to_draft', 'named_for_removal', 'already_gone', 'unreachable'
    )),

  -- §9's "+24h" check. Set to `published_at + 24h` at the moment
  -- `delivery_state` becomes `delivered` **where `live_url` is non-null**,
  -- and null where it is null. The rule reads the address, never the
  -- destination kind — which is why WordPress joined the verified
  -- population with no second destination rule written anywhere.
  add column verify_due_at timestamptz null;

-- The two ceiling counts (one a day, eight a week) are one range scan over
-- this pair.
create index idx_publications_site_published on publications (site_id, published_at);

-- The due-work scan for the 24-hour check: rows that have an address, are
-- due, and have not been checked.
create index idx_publications_verify_due on publications (verify_due_at)
  where verify is null;
