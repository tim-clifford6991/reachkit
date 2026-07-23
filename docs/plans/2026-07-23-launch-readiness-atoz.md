# Launch readiness A→Z — the whole system, one plan

> **Status:** DRAFT for owner (Tim) approval — 2026-07-23, built during the Fable window. Absorbs and re-sequences: the product-contract reset (Phases 0–E), the whole-app upgrade (M1–M4), and everything between here and "a stranger pays €59 and gets recurring value with zero manual intervention."
> **Method:** four parallel full-system audits (reset-program status · money path · free funnel/marketing · ops/infra) + the owner-approved contract (REQUIREMENTS.md R-1.5/R-1.6) as the filter.

## 0. What "launch-ready" means (the definition we're building to)

1. **The funnel is complete and honest end-to-end:** land → free scan (≤45s, ≤20¢) → wow report → €59 checkout → account + deep scan + magic link, all automatic → weekly recurring value.
2. **Every rendered surface passes the quality contract** (REQUIREMENTS §12): honesty, magnitude, terseness, one-path, contract-fit, mobile/tokens.
3. **Nothing spends invisibly; nothing breaks silently:** caps enforced, alerts reach a human, kill switch works, a failed pipeline degrades.
4. **Marketing can start:** the public surfaces say what the product now is, and the share/gallery loop exists.

## 1. Where we are (verified 2026-07-23)

- **Branch `reset/pr1-product-contract` (PR #127): 28 commits ahead of main, unmerged.** Contains: reset Phases 0 (contract) · H (capability ledger + quality contract) · S (slim free spine) · A (market size + share, leader fetch) · B (relevance judge) · C (free floor of 3 + tease) — plus this session's M1 (one keyword spine on the dashboard), M2 (dead render island cut), M3a (competitors=lessons, customers=ICP+communities; approved via artifact).
- **Phase D (search-visibility split + demand/ rename): NOT started** (1,935-line file, no rename).
- **Phase E (paid pipeline consolidation, intel → thin reader): NOT started** — Pipeline B still recomputes per tab-load.
- **M3b (write-only producer cuts: reviews O-7, creators O-8) + M4 (rank-over-time): pending, sequenced below.**
- **Crons real:** weekly-refresh Mon 09:00 · score-pulse Thu 09:00 · cache cleanup daily 03:00.
- **Cost reality:** $7.50 DataForSEO credits — every phase below is scan-budgeted.

### 1.1 Reset-program status (Audit A, verified)

| Phase | Status | Evidence |
|---|---|---|
| PR1 contract → REQUIREMENTS.md | **LANDED** | `d8e0402`; §0 push-list + R-1.5/R-1.6 |
| PR2 capability ledger + quality contract | **LANDED** | `30d9345`; ledger has 9 entries; §12 table live |
| PR3 slim free spine | **LANDED** | `e40cd69` |
| PRs4-5 Phase A market size + share | **LANDED** (renamed: `computeMarketFromLeader`/`pickCategoryLeader` inline in search-visibility + `lib/scan/market.ts`) | `afb4613` + `29fa678` |
| PRs6-7 Phase B relevance judge | **LANDED** — `lib/scan/relevance-judge.ts` exists (+test) | `5ba0bec` + `93af550` |
| PR8 Phase C free floor of 3 + tease | **LANDED** — `FREE_MIN_ACTIONS=3` | `ac3fa34` |
| Phase D split/rename | **NOT STARTED** — search-visibility.ts is ONE 106KB file; `lib/scan/demand/` collision persists | — |
| Phase E paid consolidation | **PARTIAL** — P1/M1/M2/M3a landed; the two paid pipelines still parallel | this session |

Key facts: PR #127 = +3,913/−4,679 over 93 files, MERGEABLE; **none of the reset is on main**. Intakes dir has exactly one doc. OPEN rows remaining: O-1, O-2, O-3, O-4 (gates paid sign-off), O-6.
**Bonus for later phases:** the relevance judge already exists — the deferred "classified rival keywords on the spine" is a wiring job, not a build.
### 1.2 Money path (Audit B, verified)

Chain: pricing **SOLID** (€59/€129 one source) → checkout **SPLIT** → webhook **SOLID** (4 events, signature-verified, idempotent ledger, mark-after-success) → provisioning **SOLID** (ONE `provisionCheckoutUser` for both paths — the historic never-deepened drift is fixed; deep scan + magic link both fire, race-safe) → entitlements **SOLID** (`assertPaid` + grace window) → recurring compute **SOLID** (weekly-refresh cron, idempotent per-ISO-week) → recurring EMAIL **MISSING**.

| Finding | Severity |
|---|---|
| **€59 live end-to-end NEVER run** — a mis-registered webhook = "charged but never provisioned" with no signal | **BLOCKER** |
| **Pricing page doesn't sell**: "Start Solo €59" → `/login?next=/app/billing`, NOT anonymous checkout. The built `PricingCheckoutLinks` component is unmounted dead code. Only the free-report Unlock button reaches anonymous checkout. | **BLOCKER (conversion)** |
| No recurring email to paid users (sole email = onboarding magic link) | HIGH (churn) |
| Annual `priceIdFor` silently falls back to MONTHLY price when annual id unset | MED (annual not reachable from live surface today) |
| `assertPaid` tripwire pins only 5 of ~11 cost-bearing authed routes | LOW (all gate correctly today) |

### 1.3 Free funnel + marketing (Audit C, verified)

Land → scan → progress → report → CTA → checkout: **ALL SOLID** (no email gate, hard tier=free, SSE progress, rich data-board, many wired unlock CTAs with the price stated, anonymous checkout). SEO **SOLID** (robots welcomes AI crawlers, full sitemap incl. every public scan, JSON-LD, per-scan OG). Viral **SOLID** (share modal, badge embed = dofollow loop, gallery + teardowns + RSS).

| Finding | Severity |
|---|---|
| **ZERO email capture on the free path** — a non-converting visitor is unrecoverable; no "email me my report", no nurture | **BLOCKER (funnel leak #1)** |
| **"18-signal" over-claim** (landing + pricing + HowTo JSON-LD) vs the product's own honest ~9 measured / 3 active axes | **BLOCKER (credibility at the pay moment)** |
| Free report teases per-rival "why they win / share of category" — paid does NOT deliver that yet (deferred with the judge) | **BLOCKER (over-promise = refund risk)** |
| "Daily fix calendar" on the unlock band vs the actual weekly plan | LOW (label) |
| `roadmap`/`status` = ComingSoon + placeholder `imprint` in the visible nav | MED (trust dent at decision time) |
| cardpointers.com still in the marketing "scanned companies" ticker | MED (pair with O-6 purge) |
### 1.4 Ops/infra (Audit D, verified)

| Area | Status | Detail |
|---|---|---|
| Inngest crons + kill switch + caps + rate limit | **READY** | 3 crons honor `SCANNING_ENABLED`; caps free 25¢/full 150¢ degrade; 10/IP/hr hashed |
| Inngest re-sync | **READY** | push + deployment + 30-min cron heartbeat workflows (the stale-sync gotcha is automated away) |
| **`INNGEST_EVENT_KEY` not env-validated** | **BLOCKER** | Only the serve-side signing key is enforced; unset ⇒ event *sending* fails silently — the "paid deep scans never ran" class. Add to PAID_KEYS. |
| Error alerting | **MISSING** | No Sentry; prod exceptions → console only. Cost alerts: console + PostHog + optional Slack webhook. |
| Owner observability | **RISKY** | `/app/diagnostics` 404s unless `REACHKIT_OWNER_EMAILS` set; Slack page only if `COST_ALERT_WEBHOOK_URL` set. Set both at launch. |
| CI gates | **READY** | build / eval-integration / mobile-smoke all blocking on PR; live-smoke manual |
| Bundle debt | **RISKY** | 4 app pages pinned over 275KB (max 293KB) — growth blocked, debt carried |
| Preview deploy protection | **UNVERIFIED** | Dashboard-only setting; OWNER-TODO outstanding |
| cardpointers residue | **RISKY** | In the marketing "scanned companies" ticker + possibly prod app_ids (O-6) — purge both |
| test-* routes / dev-auth | **READY** | blockInProd 404s; dev-auth refuses non-local |
| score calibration | **RED (known)** | measured non-enforcing in live-smoke only |

## 2. The launch-critical path (sequenced — every phase names its scan cost)

### L0 — Merge + deploy + config hardening (today · 0 scans)
1. **Merge PR #127** (28 commits; MERGEABLE, 0 conflicts, main hasn't moved past the base; all gates green) → auto-deploy → the inngest-sync workflows re-register functions automatically.
2. **`INNGEST_EVENT_KEY` boot validation** (✅ done this session — added to `PAID_KEYS` + schema) + **owner sets in Vercel:** `INNGEST_EVENT_KEY` (verify present), `COST_ALERT_WEBHOOK_URL` (Slack), `REACHKIT_OWNER_EMAILS` (else diagnostics 404s).
3. Owner verifies **preview deployment protection** in the Vercel dashboard (unverifiable from repo).
4. Live-verify: one anonymous free scan on prod reaches `done`.

### L1 — The truth pass: make every public claim true (0 scans, highest conversion leverage)
1. **Pricing page sells:** mount the existing-but-dead `PricingCheckoutLinks` → "Start Solo €59" goes straight to anonymous Stripe checkout (today it bounces to `/login`).
2. **"18-signal" claim fixed down** everywhere (landing, pricing, HowTo JSON-LD) to the honest measured count — the report itself already walked it back; the marketing must match (R-1.3: never contradict our own hero).
3. **Per-rival "why" teaser reconciled** with what paid delivers post-M3a (lessons + referrers + communities). Recommended for launch: fix the *copy* to sell what's real; the judge-classified rival keywords land post-launch (the judge already exists — wiring, not building).
4. "Daily fix calendar" → weekly. `roadmap`/`status` out of the nav (or shipped as one-pagers). `imprint` completed.
5. **cardpointers purge**: out of the marketing ticker (repo) + out of prod `app_ids` (one SQL — closes O-6).
6. **Annual honesty**: `priceIdFor` fails loudly instead of silently billing monthly (or annual hidden until configured).

### L2 — M3b + paid corpus: cut the invisible cost, gate the paid surfaces (1 deep scan ≈ 66¢)
1. **M3b producer cuts** (already owner-approved): reviews (O-7) + creators (O-8) out of `full-scan`/prompts/types/redaction/diagnostics; `reviewThemes` out of the action generator; content-intel only where it feeds the plan (O-9).
2. **O-4 captures** (both zero-spend, prod creds): cardpointers tier=full fixture + reachkit.app intel-cache fixture → paid rubric extends to the intel blocks (closes the §12 "paid UNENFORCED" gap).
3. **The ONE deep scan** validates both: actions still generate well without reviews, paid surfaces render the contract.

### L3 — Money-path certification (the €59 live test · 1 provisioning deep scan ≈ 66¢)
1. **A real €59 purchase** (owner's card): anonymous checkout → webhook → provision → deep scan fires → magic link arrives → `/app` shows the three pillars → cancel via portal → `past_due` grace verified conceptually. The only end-to-end proof that "charged but never provisioned" can't happen.
2. `pnpm check:live` after (webhook endpoint + prices + Inngest + health).
3. Extend the `assertPaid` tripwire to all ~11 cost-bearing routes (test-only).

### L4 — The retention loop: email exists (0 scans · NEW requirement → intake first, R-9.2)
1. **Free-path email capture**: "Email me my report" on the free report (the recovery handle for the #1 funnel leak). Optional, never a gate (the no-friction scan stays).
2. **Weekly digest email** for paid: the Monday refresh mails "your number moved → here's this week's plan" (the pull-back for the weekly-meter pitch; Resend is already wired).
3. Both enter via ONE intake doc + REQUIREMENTS §9 update in the same PR.

### L5 — Paid week-1 completeness (0 scans)
1. **M4 — per-keyword rank-over-time** on Progress (persisted spine keywords over the weekly refreshes).
2. Weekly-refresh dry-run against the L3 paid app: Monday cron → trend point + plan update + (L4) digest.
3. Kill-switch drill: `SCANNING_ENABLED=false`, verify friendly pause, revert.

### L6 — Launch execution (3 free scans ≈ 48¢)
1. Scan 3 archetypes live on prod (normal SaaS / directory / 0-ranking) → headless-render each → read the actual text (the standing rule).
2. Soft launch: share to the first channel, watch `/app/diagnostics` + Slack alerts.
3. Marketing begins (Tim). The gallery/teardowns/badge loops are already live.

## 3. Post-launch fast-follows (explicitly NOT launch-gating)

| Item | Why deferred |
|---|---|
| **Phase D** — split the 106KB `search-visibility.ts`, rename `lib/scan/demand/` | Structural hygiene; zero user-visible change |
| **Phase E** — paid consolidation: `/api/app/intel` → thin reader of `report_payload` (kills per-tab-load metered recompute) | Biggest structural payoff, XL, staged PRs; rubric-gated by the O-4 fixtures from L2 |
| **Rival-keyword "why" on the spine** via the EXISTING relevance judge | Enrichment, not a pillar; wiring job now the judge exists |
| **O-10 cloud-only Supabase** | Dev/CI plumbing |
| Bundle debt (4 pages, max 293KB) · Sentry decision · score calibration (the red rule) · per-FIELD G9 sweep | Ratchets, not launch gates |

## 4. Decisions for Tim (defaults marked)

1. **Merge PR #127 now (L0)?** *(Default: yes — clean merge, gates green, drift risk grows daily.)*
2. **Pricing page → anonymous checkout (L1.1)?** *(Default: yes — mount the existing component.)*
3. **"18-signal" claim: fix the copy DOWN to the honest count** *(default)*, or build an 18-signal paid surface up? *(Copy-down ships today; building up is a feature.)*
4. **Rival-"why" teaser: copy-fix for launch** *(default)*, or wire the judge-classified rival keywords into the spine pre-launch (+1 day)?
5. **Email capture + weekly digest in launch scope (L4)?** *(Default: yes — the #1 funnel leak and the churn gap; Resend already wired.)*
6. **€59 live test (L3)** needs your card + ~10 minutes together — when?
7. **Sentry: skip for launch** *(default: console + PostHog + Slack cost-webhook + Inngest dashboard is enough for week 1)*, or add now?
8. **Close O-1/O-2/O-3 with their stated defaults?** *(Default: yes — all three defaults are live behavior already.)*

## 5. Budget & timeline

- **DataForSEO spend for the ENTIRE plan: ≈ $1.80 of $7.50** (L2 deep scan 66¢ + L3 provisioning deep scan 66¢ + L6 three free scans 48¢; L0/L1/L4/L5 are zero-scan). ~$5.70 remains for first real users.
- **Timeline at this session's pace:** L0+L1 = day 1 · L2+L3 = day 2 (L3 needs the owner's card) · L4+L5 = day 3 · L6 = day 3–4. Marketing starts inside the 24–48h window the owner set for ship-to-sell.
- **Stop-points:** after L1 (truth pass live-verified), after L2 (M3b deep-scan validation), after L3 (money certified), after L5 (week-1 value) — each a Tim checkpoint per the standing milestone rule.

## 6. Prod-DB verifications (read-only, 2026-07-23)

- **Legacy-payload census (18 live public reports):** 0 missing `searchVisibility` · 9 current data-board shape (`categoryCard`) · 1 tiers-only legacy · 2 paid `market` blobs · 0 review fields · 2 creators rows. All shapes are covered by the legacy render scenario — merging #127 breaks no permanent public report (R-10.2). The market model persists INSIDE `categoryCard`/`nicheCard` (no separate `sv.market` key — the plan's original field name was renamed in build).
- **O-6 is smaller than feared:** the cardpointers app row is ORPHANED — no user's `app_ids` references it (the enrolment was already detached). Purge = delete the app row (scans cascade) + the marketing-ticker entry.
- **⚠ SEQUENCING CATCH:** the cardpointers deep scan (`35e30a99`) is the SOURCE for the O-4 tier=full capture. **Run the L2 capture BEFORE the L1/O-6 purge** — purging first destroys the only live tier=full payload. (L1 executes the ticker removal; the DB purge moves to L2, after the capture.)

## 7. Deep-validation pack (five parallel agents, in flight)

Launched 2026-07-23 to make the L-phases mechanical; results attach here as they land:
1. **L1 truth-pass surgical spec** — file:line change-list for pricing→checkout, 18-signal claim, rival-why teaser, nav stubs, annual honesty.
2. **M3b surgical cut spec** — the full producer graph (reviews/creators/landscape/strengths), the action-generator prompt-shape change, weekly-refresh/deepen cohesion, guard updates.
3. **Security posture sweep** — unauthenticated API surface, SSRF, IDOR, RLS on post-audit tables, XSS via scanned-site content, secrets in client bundles.
4. **Per-field data-contract map** — every `report_payload` + Pipeline-B field: writer → reader → verdict (rendered/orphan/legacy), incl. NEW orphans created by M3a (gathered-but-no-longer-rendered = fresh invisible cost), + the Phase-E collapse map.
5. **Paid week-1 story walkthrough** — minute-0 → hour-1 → tabs → plan round-trip → week-2 Monday, every incoherence ranked.
