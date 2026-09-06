-- BUILD §8 hard rule 4 — the do-not-claim check's one stored column.
--
-- The verdict of the last claim check, including the hash of the list it was
-- reached against. That hash is the whole mechanism: "is this draft's check
-- still current?" is answered by comparing it to a hash of
-- `sites.do_not_claim` as it stands right now, so the answer is derived on
-- every read and a draft is held from the instant the customer saves a
-- change — before any job runs.
--
-- Deliberately **not** here, and their absence is the point:
--   * no `outstanding` column and no `recheck_due` flag — either could be
--     stale, and a stale flag is how a forbidden claim reaches a customer's
--     site;
--   * no queue table — nothing has to be fanned out, so nothing can be
--     missed by a job that failed;
--   * no version column on `sites` — the hash is computed from the list
--     itself, so a write that forgets to bump it cannot exist.
--
-- Topic token `drafts`, sub-token `drafts_claims` (`src/lib/db/topics.ts`).

alter table drafts add column if not exists claim_check jsonb;

-- The sweep's set, and any "what is being held" read, in one indexed scan.
-- `is distinct from` rather than `<>` so a draft with no check at all — the
-- most outstanding kind there is — is in the index rather than out of it.
create index if not exists idx_drafts_claim_outstanding
  on drafts (site_id)
  where (claim_check ->> 'state') is distinct from 'passed';
