# ReachKit v2 — Remaining Work

Status of the v2 build. M1–M5 are **built, tested (752 unit tests green), and on `main`**. M4 + M5 are **flag-gated** (`REACHKIT_MARKET_ANALYSIS`, default off) — zero prod impact until enabled.

Legend: ☐ todo · ☑ done · ⏳ deferred

---

## A. Go-live & validation (turn on what's built)
- ☐ **Apply prod migration `search_cache`** — prod has `distribution_profiles` but is missing `search_cache` (caching degrades gracefully without it, but apply for completeness). `supabase db push` or apply `20260616120000_search_cache.sql`.
- ☐ **Set `REACHKIT_MARKET_ANALYSIS=true`** in Vercel (Production) — the only env var prod is missing for v2. Test on a Preview env first.
- ☐ **Run a web-mode paid scan** on a preview deploy → eyeball the report (competitor profiles · you-vs-them matrix · demand pockets · plan) + the "Draft for Reddit → Open" handoff.
- ☐ **Enable Stripe `customer.subscription.trial_will_end`** on the webhook endpoint (the pre-charge reminder email won't fire otherwise). Confirm `APP_URL` is the prod domain (it is).
- ☐ **Verify per-paid-scan cost** ≤ ~$2 on a real run (credits replenished + search cache in place).

## B. Unfinished pieces inside shipped phases
- ☐ **Stage 5 — Share-of-Voice panel.** Shipped: SEO standing (your keywords vs rival median). Missing: mention-SOV (your share of community conversation vs rivals) + a clean SOV visual.
- ☐ **Weekly-refresh ↔ market analysis.** The weekly refresh updates scores/monitors but does NOT re-run the M4 market analysis — paid competitor/demand data goes stale until a re-scan. Wire a cheap weekly re-refresh (search + profile caches make it affordable).
- ☐ **App-mode market analysis.** Market analysis is web-only (domain-centric); app-store scans get the old report. Needs an app→website resolution step.
- ☐ **Free competitor teaser quality.** Free names competitors via the older "alternatives-to" discovery, not the prominence-ranked engine. Optional: run the cheap propose-only discovery in the free scan.
- ☐ **Demand brief quality.** Demand sweep derives its problem statement from the homepage description; an LLM step to extract a clean problem/audience would sharpen pain-query quality.
- ☐ **Community presence accuracy.** Counts are the search page sample (≤20/≤10), not true totals; HN brand-token search can be noisy. Use HN `nbHits` + tighter matching.

## C. M6 — later tiers (deferred by design)
- ⏳ **Official-API auto-posting (Tier 1)** — true scheduling on open APIs: dev.to, LinkedIn-personal (`w_member_social`), Mastodon, Threads. Consider forking Postiz/Mixpost (AGPL). (Bluesky removed.)
- ⏳ **Productized "Lead Radar"** — the dogfood demand engine pointed at the user's product as a paid surface; plus an internal scheduled Lead Radar + inbox for ReachKit's own growth (runner exists; no schedule/inbox yet).
- ⏳ **Premium data sources (Growth tier)** — SimilarWeb traffic, X/Twitter mentions, social-listening; deeper SEO history (`historical_rank_overview`).
- ⏳ **AI-visibility SOV** — DataForSEO LLM Mentions / AI-visibility API (how often you vs rivals are named by ChatGPT/Perplexity/AI Overviews).

## D. Operational / external setup (parallel, lead-time)
- ☐ **Request a Reddit API app** (2–4 wk approval) — v1 works without it via `site:reddit.com` search; official API is a later enrichment.
- ☐ **DataForSEO cost tier** — switch background SERP from `live/advanced` to standard (queued) before high volume (needs the async task-post/poll flow).
- ☐ **DataForSEO Backlinks subscription** (optional) — re-enables domain authority/referring-domains (currently "—"); flip `DATAFORSEO_BACKLINKS=true` once subscribed.
- ☐ **Don't build on** Google CSE / Bing search (deprecated/retired) — use Serper.dev or DataForSEO SERP for `site:` queries.

---

## Shipped (for reference)
- ☑ **M1** Two-track scan (cheap free / deep paid + deepen-on-pay)
- ☑ **M2** Deep domain profiling (content/distribution crawl + SEO + cohort + shared cache)
- ☑ **Discovery** Category/market-first, prominence-ranked competitor discovery
- ☑ **M3** Demand discovery + dogfood lead-radar, recency-first
- ☑ **M4** Gap analysis → distribution plan → paid report (4 sections, flag-gated)
- ☑ **M5** Execution layer — one-click handoff + draft engine + coach (flag-gated)
- ☑ **Hardening** Backlinks off, persistent search cache, cache versioning
- ☑ **Bluesky removed**

## Env vars
**Local (`.env.local`)** — all keys present. To test v2 locally set `REACHKIT_MARKET_ANALYSIS=true` (currently `off`) and `REACHKIT_USE_FIXTURES=false`.
**Prod (Vercel)** — all keys present; **add `REACHKIT_MARKET_ANALYSIS=true`** (only missing var). `DATAFORSEO_BACKLINKS` optional.
