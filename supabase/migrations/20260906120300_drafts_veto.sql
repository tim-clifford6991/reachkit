-- supabase/migrations/20260906120300_drafts_veto.sql
--
-- BUILD §9 (issue #46) — the approval, the telling and the veto token.
--
-- `structure.md` rule 3a: the filename carries the `drafts_veto` sub-token,
-- which narrows the `drafts` topic and is owned by the veto leaf
-- (`src/lib/db/topics.ts`). `drafts_publishing` (the state machine's two
-- columns) and `drafts_core`/`drafts_claims` (the generation node's) are
-- other files and are not touched here.

alter table drafts
  -- REQ-057 c2's second disjunct: the moment the customer explicitly
  -- approved the page. Null under autopilot, where expiry — not an
  -- approval — is what makes the page publishable. Read by
  -- `becomesPublishable` and by the claim (which records `mode`).
  --
  -- The state machine (issue #45) already selects this column; nothing had
  -- added it. It lands here because the approval is this leaf's fact.
  add column approved_at timestamptz null,

  -- Who approved it. `{kind:'customer', userId}` or `{kind:'system', job}`,
  -- the same `Actor` shape `transitions` records. A page is never approved
  -- anonymously.
  add column approved_by jsonb null,

  -- REQ-057 c8's record of the telling: `{pair, kind, publishesAt, sentAt}`.
  -- `pair` is the four values that decide whether and when the page
  -- publishes (mode, veto hours, publish time, time zone); the telling is
  -- owed again the moment any of them differs from what was last recorded
  -- here. Null means never told, which is not the same as told on a pair
  -- that has since changed — `toldCurrentPair` distinguishes the two and
  -- both hold the page.
  --
  -- The destination clause the mail carried is stored as sent but is not
  -- part of the comparison: a destination whose health flaps must not
  -- re-open the telling obligation (BP-046 decision 5). What holds a page
  -- against a broken destination is the `destination_working` guard.
  add column told jsonb null,

  -- The veto link. Only the SHA-256 hash of the token is stored, never the
  -- token: a database read must not yield a usable stop link. Null at a
  -- veto window of zero, where REQ-057 c7 says no interval exists in which
  -- a link could be used, so none is issued.
  add column veto_token_hash text null,
  add column veto_token_expires_at timestamptz null,
  -- Single use. Set in the same statement that redeems the token, so a
  -- double click cannot skip twice.
  add column veto_token_used_at timestamptz null;

-- The redemption's one lookup, and the guarantee that two drafts cannot
-- share a token. Partial: at a zero window the column is null for every
-- draft and a plain unique index would be satisfied anyway, but the partial
-- form says which rows the uniqueness is about.
create unique index idx_drafts_veto_token_hash
  on drafts (veto_token_hash)
  where veto_token_hash is not null;

-- ── The redemption, as one statement ────────────────────────────────────
--
-- Read, expiry check and use-marking are one `update` guarded by
-- `veto_token_used_at is null`, so two concurrent clicks race on the row
-- and exactly one wins. Doing it as a select-then-update through PostgREST
-- (each `.from(...)` its own request and its own implicit transaction —
-- the limitation `src/lib/publish/db.ts` documents) would let both clicks
-- read an unused token.
--
-- It marks the token used and returns the draft id. It moves no page:
-- the `in_review → skipped` move is `transition()`'s, taken by the caller
-- with a customer actor, so the veto is one edge of the fifteen and not a
-- second mover.
--
-- The comparison is on the hash the caller computed, so no token ever
-- reaches the database.
create or replace function redeem_veto_token(
  p_token_hash text,
  p_now timestamptz
) returns table (draft_id uuid, state text)
language plpgsql
as $$
begin
  return query
  update drafts set veto_token_used_at = p_now
  where veto_token_hash = p_token_hash
    and veto_token_used_at is null
    and (veto_token_expires_at is null or veto_token_expires_at > p_now)
  returning drafts.id, drafts.state;
end;
$$;
