# Single Scan URL + Consistent Free Lead Magnet — Design

- **Date:** 2026-07-07
- **Status:** Approved for planning (pending final spec review)
- **Author:** Tim + Claude

## Problem

The scan/report experience is fragmented across three routes and three renderers,
with a score that changes basis between the free and paid views. Concretely:

- **Three routes** show "a scan": `/scan/[id]` (live), `/scan/[id]/results` (result),
  `/report/[slug]` (public teardown).
- **Three renderers:** `FindingsReveal` (free teaser), `ResultsScreen` (paid/full
  and free-redacted public), and a bespoke `FreeScanTeardown` (public free) — so the
  same scan looks different depending on the path.
- **Three scoring engines** sharing only pillar weights: the free findings proxy
  blend (`lib/scan/score.ts`, ~low), the verified v1 (`score-full.ts`), and the v2
  registry (`registry-score.ts`, ~high). The free teaser shows the low number; the
  full report shows the high number; the second overwrites the first. Observed live:
  redship.io findings score **16** vs report score **80**.
- **No lazy/shareable entry:** a scan is created by the form POST, then the user
  navigates. Sharing `/scan/redship.io` only works if a scan already exists; opening
  the URL does not start one.

Note: the earlier fear that free users get the expensive deep pass is **not** a bug —
tier is entitlement-gated (anonymous/free → findings-only; only active-paid → deep).
Every DB scan is `full` only because they were run while logged in on a trial.

## Goals

1. **One canonical URL:** `/scan/<slug>` is the single public page for a scan.
2. **One consistent public renderer** for the free lead magnet.
3. **Shareable + lazy:** opening `/scan/<slug>` for an un-scanned domain starts the
   scan (bot-safe); a never-opened shared link costs nothing.
4. **One score:** identical number everywhere, never moves on upgrade.
5. **Protect CAC:** the free scan stays cheap, fast, and keeps the existing live
   loading interface.
6. **Growing SEO catalog:** every completed scan is a permanent, searchable public
   teardown listed on `/teardowns` — an indexable growth surface for ReachKit.

## Non-Goals

- Redesigning the authenticated `/app` paid dashboard (only touched where it reads
  data or where post-checkout landing needs wiring).
- Changing the billing/checkout/entitlement mechanics.
- Adding a per-scan ownership model.

## The Core Model: Two Separate Surfaces

The design's central decision is a hard separation, chosen to avoid auth-mixing risk:

### Surface A — Public free lead magnet: `/scan/<slug>`

- **Publicly accessible, no auth logic.** No `currentUser()` / entitlement branching
  on this route → fully cacheable, fast, no auth surface to leak through.
- **Always the free/locked view**, regardless of who opens it — even a logged-in paid
  user opening this URL sees the locked lead magnet. Payload is **hard-redacted to
  free** (`redactReportForTier(payload, "free")`), exactly like today's `/report`.
- Shows: discoverability score + initial metrics (positioning gap, top finding,
  competitor count, etc.). **Locked:** full competitor set, keyword/market drill-down,
  and the action plan — behind a single upgrade CTA.
- This is the shareable artifact, listed on the `/teardowns` index.

### Surface B — Paid full report: authenticated `/app`

- The existing auth-gated dashboard (`app/(app)/app/**`, `currentUser()` →
  `/login`, `PaywallScreen` for non-entitled). Fully unlocked report + deep sections.
- The upgrade CTA on Surface A → checkout → account provisioned → deep pass runs
  (`ensureDeepScan` → `scan/deepen`) → full report surfaces here.

**Why:** the public page is a marketing lead magnet; the paid product is an
authenticated app. Keeping them on separate surfaces removes all per-viewer auth
logic from the public page and makes "public = always free" true by construction.

## Component 1: Routing & Redirects

- `/scan/<slug>` (in `app/(funnel)/scan/[id]/`) becomes the one page. It renders every
  state at the same URL (no redirect to a UUID or `/results`):
  - **No scan for this domain yet** → render metadata + a shell; a **client effect**
    starts the scan (see Component 2), then streams live progress → result.
  - **In progress** → live `ScanProgress` narrative (existing, incl. this session's
    hand-off fix).
  - **Done** → the locked result dashboard (Component 3).
- **301 redirects** (permanent): `/scan/<id>/results` → `/scan/<slug>`,
  `/report/<slug>` → `/scan/<slug>`.
- **SEO/share preserved:** move OG image (`opengraph-image`), Article JSON-LD, and the
  copy-paste share badge from `/report/[slug]` onto `/scan/[id]`.
- Slug resolution (`resolveScanParam`) already maps a domain slug ↔ scan; the URL stays
  the domain (`/scan/redship.io`), with the resolved scanId used internally for SSE.

## Component 2: Lazy, Bot-Safe Auto-Start

- Auto-start is **client-triggered**: the server renders the shell + metadata only; a
  client effect POSTs `/api/scan` `{ store_url }` to create-or-dedup + enqueue, gets the
  scanId, and begins streaming. Link unfurlers / crawlers (Slack, iMessage, Googlebot)
  do not run JS → **no scan triggered** → no wasted cost.
- **The public entry always creates a `free`-tier scan** (cheap, findings-only, 15¢
  budget) regardless of viewer. Paid users scan new sites from inside `/app`
  (`scan-current`, tier `full`). This keeps the public lead magnet cheap and removes
  the live deep-pass wait from the public page entirely.
- **Guards:** existing per-IP `assertRateLimit`, per-app dedup (one scan row per
  domain, reused), free budget cap. Invalid/un-scannable domain → clean "couldn't scan
  that" state (not a 404).

## Component 3: One Public Renderer — `ResultsScreen` (locked)

- The public free page uses the **same `ResultsScreen` shell as the paid app**, hard-
  locked to free: score + initial metrics visible; deep sections blurred/locked with
  the upgrade CTA. Same design language, so upgrading feels like "unlock what you
  already see" — but the page stays always-free with no auth logic.
- **Retire** `FindingsReveal` and `FreeScanTeardown` (and the dead section-stack
  imports in the old results page). One renderer for the public surface.
- The upgrade CTA is the acquisition→checkout action (`CapturedUnlockButton` →
  `/api/scan/[id]/checkout`), consistent across the public page.

## Component 4: One Score — Fixed Basis

- **Single scoring module** computes the headline from a **fixed signal set that the
  free scan can measure** (Wave-A on-site HTML hygiene + preliminary facts). The
  registry/18-signal engine is the source of truth.
- **Fixed denominator:** the headline is normalized over the fixed basis, not "measured
  signals only", so adding deep signals in the paid pass does **not** move the number.
  Both the free findings pipeline and the deep pass call the **same function over the
  same basis** → `score_total` is identical free↔paid and never changes on upgrade.
- The deep pass may still persist richer signal rows for **explainability** in `/app`,
  but must **not** overwrite the headline with a different basis (removes the current
  v2 flip's headline overwrite).
- **Cost constraint (CAC):** the free pipeline computes Wave-A signals from **HTML it
  already fetches** during the free collect — no new network/API calls. This must be
  verified in planning (main implementation risk).
- Retire `lib/scan/score.ts`'s proxy blend as a **displayed** number.

## Component 5: Teardown Index (SEO growth loop)

Every **completed** scan is a permanent public artifact listed on the `/teardowns`
index, so the catalog of free scans grows over time — searchable, re-findable, and an
SEO surface for ReachKit.

- On completion, a scan appears in the `/teardowns` index (existing `listPublicScans`).
- Index entries link to the canonical **`/scan/<slug>`** (not the retired `/report/<slug>`).
- **Search / findability:** the index supports search over the listed scans and
  pagination (the list is expected to grow large — no silent top-N cap that hides
  older scans).
- **SEO:** `/scan/<slug>` pages are indexable (metadata, Article JSON-LD, OG score
  card) and included in the sitemap so search engines can crawl the growing catalog.
- Scope: this reuses the existing public-scans listing + teardown index; the changes
  are (a) repoint links to `/scan/<slug>`, (b) ensure every completed scan is listed,
  (c) add search + pagination, (d) sitemap inclusion.

## Data & Redaction Model

- Public `/scan/<slug>`: **always** `redactReportForTier(payload, "free")`. Works whether
  or not `report_payload` exists yet (a deepened scan still shows the free view here).
- `/app`: unlocked per the authenticated viewer's entitlement (existing behavior).
- One scan row per app (existing dedup). After payment, the deepen flow flips the row to
  `full` and adds `report_payload`; the public page still renders the free view.

## Error Handling

- Failed scan → inline error state (existing `ScanError`), stays on `/scan/<slug>`.
- Invalid / un-scannable domain → friendly "we couldn't scan that" (not a hard 404).
- Rate-limited / abuse → friendly "try again shortly".
- Deep pass still pending in `/app` → existing pending/refresh behavior (post-payment
  context, acceptable).

## Testing

- **Unit:** the unified score function returns identical output for free-signal vs
  full-signal inputs over the fixed basis; public redaction is always-free; slug
  resolve-or-create logic; the bot/no-JS path does not trigger a scan.
- **Integration:** opening `/scan/<new-domain>` triggers exactly one free-tier scan; a
  crawler UA / no-JS fetch triggers none; `/report/*` and `/scan/*/results` 301 to
  `/scan/<slug>`; a deepened (paid) scan still renders free on the public page and
  unlocked in `/app`; score_total equal on the public page and in `/app`; a completed
  scan appears in the `/teardowns` index linking to `/scan/<slug>` and is searchable.

## Retirements / Touched Surfaces

- **Delete:** `FindingsReveal`, `FreeScanTeardown`, `/scan/[id]/results/` subroute,
  `/report/[slug]/` route (→ redirects), dead imports in the old results page,
  `score.ts` proxy score as a display value.
- **Move:** OG image + share badge + JSON-LD onto `/scan/[id]`.
- **Keep:** `ResultsScreen`, `ScanProgress`, the registry/signals scoring engine, the
  `/app` paid dashboard, billing/checkout/deepen flow.

## Rollout / Migration — four sequential plans

Recon during planning re-sequenced the work. Two findings drove it:

- **Finding A (resolved):** `/app` does NOT render `report_payload` as a report — but it
  already surfaces the paid deliverable (action **drafts**) via the `actions` table
  (`actionBoard(appId)`, read by `/app/plan` + `/app/dashboard`). So retiring the paid
  `/scan/[id]/results` `ResultsScreen` view loses no paid value; the paid home is `/app`.
- **Finding B (re-sequence):** the free scan produces only `findings_payload`, which does
  not fit `ResultsScreen`'s `ReportPayload` shape. Rather than adapt findings into the
  report UI, the free scan will **emit a lightweight `report_payload`** (assembled from
  findings + facts + cheap **signal-derived baseline fixes**, deep sections empty). This
  makes one renderer + one score work by construction — so it is the foundation plan.

**Plan 1 — Free scan emits a lightweight report (foundation).** Free pipeline computes the
Wave-A on-site signals (from HTML it already fetches — no paid calls), the single
fixed-basis headline score, and signal-derived baseline fixes; assembles a lightweight
`report_payload` (deep sections empty) and persists it. The paid pass is updated to use
the **same** fixed-basis score function so the number is identical free↔paid. Validate the
free-cost constraint here. This delivers the unified data shape AND the unified score.

**Plan 2 — Route + renderer consolidation.** One canonical `/scan/<slug>`: renders live →
locked `ResultsScreen` result at the same URL (now possible because free has a
`report_payload`). 301 `/scan/<id>/results` and `/report/<slug>` → `/scan/<slug>`. Move OG
image + share badge + JSON-LD onto `/scan/[id]`; update all `/report/` URL references
(sitemap, teardowns index, share buttons, badge, llms.txt). Retire `FindingsReveal` and
`FreeScanTeardown`.

**Plan 3 — Lazy bot-safe auto-start.** Opening `/scan/<new-domain>` client-triggers a
free-tier scan; unfurlers/crawlers don't fire it; guards.

**Plan 4 — Teardown index (SEO).** Every completed scan listed on `/teardowns`, linking to
`/scan/<slug>`, searchable + paginated + in the sitemap.

Backfill: existing `/report` shared links and any indexed `/results` URLs 301 cleanly.

## Open Risks

1. **Free-cost of Wave-A signals** — must be computed from already-fetched HTML with no
   new paid calls. Validate first.
2. **Score optics** — a well-built site scores high on the fixed hygiene basis; the
   upgrade pitch shifts to "what to do & who to reach" rather than "your score is bad".
   Accepted trade-off for consistency.
3. **Public exposure** — every scanned domain becomes a public teardown (existing
   behavior via `/report` + `/teardowns`); no change, but noted.
