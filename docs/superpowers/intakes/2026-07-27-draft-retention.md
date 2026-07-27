# Requirement Intake — draft-retention

## 1. Verbatim requirement

> "I just generated a new post for 'Post a free SEO audit template + case study
> showing WordPress site fixes' which generated cleanly (but took long and the
> user was left of loading for a long time) but when I refreshed, the draft
> disappeared. This is broken, we must always retain the content for the user to
> reuse … So yes, fix and harden based on your findings and mine above." — Tim,
> 2026-07-27

Plus the implementer's findings from the same session: (a) `/compare/null` 500s
under Cache Components (`notFound()` on unknown dynamic slug — the sibling of the
teardowns #86 fix, left unpatched, no guard); (b) the draft client has no
timeout / retry / network-vs-server error distinction (a mobile drop shows a
blank "something failed").

## 2. Restatement

A generated draft must ALWAYS be retained so the founder can return to it — a
refresh, a closed tab, or a dropped mobile connection mid-generation must never
lose completed work. **Delta from verbatim:** the owner said "retain on refresh";
I broaden to "retain server-side during generation" so the long (~30–60s) LLM
call itself is drop-safe, not just the post-success refresh — the long wait is
exactly the highest-risk window. Root cause: content drafts already persisted
server-side (`/api/content-draft` → `actions.draft`); **distribution drafts did
not** (`/api/distribute/draft` returned text only; it persisted only when the
user later opened a composer / marked done), so a refresh dropped them. Fix:
both draft routes now share ONE `upsertDraftAction` capability that generates +
persists + reuses. Also: honest loading copy ("up to a minute; saved
automatically"), an AbortController timeout, and a network-vs-server error
message. Separately, the `/compare/[slug]` 500 is fixed to `redirect("/compare")`
with a class guard covering every dynamic marketing `[slug]` route.

## 3. Open questions — asked BEFORE design

| # | Question | Answer | Answered by / date |
|---|---|---|---|
| 1 | Persist client-side (call existing `track()` after generation) or server-side (inside the route)? | Server-side — it's the only option that survives a drop DURING the long generation, and it matches content-draft's existing design (one path). | Implementer, 2026-07-27 (owner said "always retain") |
| 2 | Should daily X-post drafts also persist here? | Excluded — they're keyed by date (`DAILY_POST_PREFIX`) via `/api/action` and mapped to calendar days; persisting them as outreach actions would misfile them. Left on their existing track()-on-open flow. Noted as a follow-up. | Implementer, 2026-07-27 |

## 4. Permutation matrix

Axes touched: **tier** (paid only — drafting is `assertPaid`-gated) × **auth**
(authed) × **entry surface** (`/app` plan → `/api/distribute/draft` +
`/api/content-draft`) × **data-state**.

| Cell | Covered / Excluded | How / why |
|---|---|---|
| paid × authed × `/app` × fresh (new topic) | covered | INSERT a `pending` action carrying the draft; rehydrates as tracked on reload |
| paid × authed × `/app` × existing open action w/ draft | covered | REUSE stored draft for free (no LLM spend) unless `regenerate` |
| paid × authed × `/app` × regenerate | covered | OVERWRITE stored draft (redraft persists) — helper test (3) |
| paid × authed × `/app` × done action same title | covered | ignored; fresh insert — helper test (5) |
| paid × authed × `/app` × DB write blips after generation | covered | route returns the generated draft unsaved (degrade, never lose content) |
| paid × authed × `/app` × no active app | covered | generate-only, `{draft}` no actionId (prior behavior preserved) |
| paid × authed × `/app` × daily X-post | excluded | keyed by date via `/api/action`; not persisted here (Q2) |
| free × anon × public `/scan` | excluded | drafting is paid-only (`assertPaid`) — not reachable |
| `/compare/[slug]` × unknown slug (bot/probe) | covered | `redirect("/compare")` not `notFound()` (no 500); guard over all dynamic marketing `[slug]` routes |

## 5. Acceptance criteria (written FIRST, watched fail)

- `lib/app/draft-action-store.test.ts` — the retention contract: reuse-for-free,
  regenerate-overwrites, insert-carries-draft, done-ignored, lookup-error-throws,
  routing-persisted. Mutation-proven (break reuse guard → the reuse test fails;
  restored → green).
- `lib/testing/capability-ledger.test.ts` — new `draft-action-persist` entry:
  one definer, one live consumer (`/api/distribute/draft`) — a second impl fails.
- `app/(marketing)/unknown-slug-redirect.test.tsx` — both dynamic marketing
  `[slug]` routes redirect (not `notFound`/render) on an unknown slug.
  Mutation-proven (revert compare to `notFound()` → fails).

No report-corpus expectation: this is an in-app (paid dashboard) behavior + a
marketing-route status change, neither of which renders on the free report
corpus. The guards above are the acceptance oracle.

## 6. Class statement

Two classes: **(a) generated-data-not-retained** — every "generate an artifact
on demand" surface must persist server-side so it survives refresh/drop. Sibling
sites: content-draft (already persisted), distribution-draft (this fix). Both now
route through the ONE `upsertDraftAction` path, so a third draft surface can't
re-fork it (capability ledger). **(b) `notFound()` on a Cache-Components dynamic
`[slug]`** — 500s instead of 404ing. Siblings: `/teardowns/[slug]` (#86, fixed),
`/compare/[slug]` (this fix). The new guard enumerates ALL dynamic marketing
`[slug]` routes, so the next one is covered before it ships — the guard #86 never
wrote.

## 7. Rendered-surface ledger

No new cost-bearing calls. The distribution draft's LLM generation already
existed and already rendered (the draft textarea) — this change only persists its
output onto an `actions` row that the plan already reads back (`entry.draft` in
`mergePlanEntries`). No write-only data: the persisted draft is rendered on reload
as the tracked entry's draft. New API response field `actionId` on
`/api/distribute/draft` is consumed by the client to set `actionId` state.
