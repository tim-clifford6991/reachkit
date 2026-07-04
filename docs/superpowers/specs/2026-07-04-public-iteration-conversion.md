# Public-pages iteration — conversion, cohesion, funnel integrity

**Date:** 2026-07-04. Follows the launch-readiness merge (PR #11). Source: Tim's verbal feedback + fact-finding sweep + prod telemetry.

**North star:** every public surface drives conversion into the free scan, then the paid plan. Provocative, competitor-framed copy. No internal jargon, no vendor names. One-click paths everywhere.

## Decisions (Tim, 2026-07-04)

- Free tools live set: **On-page SEO check** (exists, unlisted), **AI visibility check** (new), **Meta & social preview** (new). Keyword-gap teaser: not now. All other stubs removed.
- Upgrade CTAs: **direct Stripe checkout, Solo default**. `/app/billing` stays reachable (Settings) for Growth/compare/manage.
- Compare: **deepen all 9 + add 3–4 adjacent tools**; `/compare` index becomes the holistic ReachKit pitch.
- Free scan: **trim to 10–20s / ≤15¢** — market/demand sweep leaves the free tier (paid unlock). Free result = score + findings + positioning mirror + competitors.
- Subdomain `app.`: stays deferred until the custom domain is attached (impossible on vercel.app; migration is cheap via single APP_URL).

## Facts that bound the work

- Free scans already skip `runFullScan` (lib/inngest/functions/scan-requested.ts:149; FREE_SCAN_BUDGET_CENTS=20). Free external calls today: ~1 SERP + 2 SERP demand + ~3 domain_rank_overview + 2–3 Tavily + ~4–6 LLM (1 Sonnet synth). Steps are sequential Inngest steps; SERP live timeout 15s.
- Full scans (prod telemetry): 53–102s, 11.7–27.2¢, 21–48 LLM calls — runs post-payment behind the onboarding calculating step, so its duration is masked.
- Dashboard "unexpected error" on first click = deployment skew (0 server errors in 24h; old tab + new deploy). Fix at platform level.
- Payment-first is already wired: results CTA POSTs /api/scan/[id]/checkout (anon, carries scanId), webhook attaches the scanned app to the new account.
- Marketing nav has no active-page indicator. Hero headline/subtext at components/sections/scan-hero.tsx:34/38; landing sections in components/sections/captured/landing-html.ts.
- /compare: 9 hardcoded slugs, ~60–90 words each. /tools: 5 listed (1 live); /tools/on-page-check functional but unlisted.
- Bundle budgets bind: (marketing) 220 KB gzip first-load. Client-heavy imports on marketing pages need lazy client wrappers (see setup-overlay-lazy.tsx pattern).

## Waves

- **W1 Landing + nav.** Active-page indicator (aria-current) in marketing nav. Hero rewrite: provocative competitor-framing — headline in the register of "Your competitors are being found. You aren't. See exactly why." — subtext and proof-card in the same voice; time claim phrased "in under a minute" (W5 owns the real number). Keep "You shipped a great product…" section; sharpen the 1-2-3 steps to show simplicity + value.
- **W2 How-it-works.** Replace "synthesis"/internal jargon with buyer language (scan what you have → measure what buyers search → your ranked plan). Remove ALL vendor/data-source names (DataForSEO, Tavily, model names). Keep the give-away-the-secret framing; every section lands on the free-scan CTA.
- **W3 Free tools.** Three live tools, kit idiom, SEO-optimized metadata, each ending in a scan CTA: (1) on-page check listed + polished; (2) AI visibility check — llms.txt, robots AI-crawler rules, structured data, meta completeness for AI answers; (3) meta & social preview — Google/X/LinkedIn render + missing tags. Server-side fetch only (reuse on-page-check's safe-fetch/SSRF guard + rate limiting), no paid APIs. Remove stub entries.
- **W4 Compare.** /compare index = holistic value pitch (the category story: rank trackers tell you numbers, ReachKit tells you what to do). Each of 9 slugs → full differentiator page (~500–900 words: who the tool is for, where it wins, where ReachKit wins, the workflow difference, honest verdict + table + CTA). Add adjacent: SparkToro-adjacent audience tools, Mangools, SE Ranking, Gummysearch (pick 3–4 with search demand). Footer/compare index list updated.
- **W5 Free-scan performance.** Instrument free-tier duration end-to-end (scans started/completed + pipeline_runs coverage). Remove light-market step from free tier; verify results page renders cleanly without market data. Parallelize/merge steps where durability allows; tighten SERP timeouts. Target ≤20s p50, ≤15¢ hard. Report measured number for the hero claim.
- **W6 Funnel + infra.** (a) All "Upgrade" CTAs (app layout sidecard, settings, dashboard-hero, synthesis-view, app-switcher) POST direct Solo checkout (shared client action). (b) Scan→app continuity: verify + close — onboarding prefills scanned domain AND free-scan-discovered competitors (no re-discovery), calculating step runs the full scan. (c) Deployment-skew fix: enable skew protection; error boundary auto-retries once on stale-chunk failures. (d) Legacy /app/competitors picker pre-checks saved cohort (small fix folded in).

## Verification

Gates per wave (tsc, lint 0 errors, tests) + controller combined gate + build + `pnpm check:bundle` + live walkthrough: free scan E2E timing, tools functional, compare/landing/how-it-works visual, upgrade one-click to Stripe test checkout, onboarding prefill.
