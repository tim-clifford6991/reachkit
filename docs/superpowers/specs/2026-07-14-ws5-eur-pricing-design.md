# WS5 — EUR pricing (switch everything to EUR, centralize the price source)

**Date:** 2026-07-14 · **Status:** design approved (decisions locked) · **Workstream:** 5 of 6

## Context & decisions (locked)

User feedback: switch pricing from USD to EUR. Decisions (2026-07-14):
- **EUR-only** (not multi-currency) — one currency everywhere.
- **Straight swap:** Solo **€59/mo · €590/yr**, Growth **€129/mo · €1,290/yr** (annual = 2 months free = 10× monthly; ≈ €49/mo and ≈ €108/mo effective).
- **Stripe EUR prices created by me via MCP** — DONE (live account `acct…Ua4c`):
  - `STRIPE_PRICE_SOLO` = `price_1Tt78iIFnqPzUa4czxog9NS7` (Solo Monthly €59)
  - `STRIPE_PRICE_SOLO_ANNUAL` = `price_1Tt790IFnqPzUa4cJsvLXb9V` (Solo Annual €590)
  - `STRIPE_PRICE_GROWTH` = `price_1Tt79DIFnqPzUa4cFPfre01J` (Growth Monthly €129)
  - `STRIPE_PRICE_GROWTH_ANNUAL` = `price_1Tt79RIFnqPzUa4cJSX6k6s3` (Growth Annual €1290)
  - Attached to existing products Solo `prod_Uhfa0EWPQ1h0VH` / Growth `prod_UhfaxTxKVR01WP`. Old USD prices stay **active** (existing subscriptions keep their currency; Stripe never migrates a live sub's currency).

## Audit — where price/currency lives today (all USD)

- **Structured tier data:** `app/(marketing)/pricing/pricing-plans.tsx` `PLANS` (`$59`/`$590`/`$129`/`$1,290` + `≈ $49/mo`/`≈ $108/mo` notes). The primary source.
- **JSON-LD (SEO/AI crawlers):** `lib/seo.ts` — `softwareApplicationLd({priceUsd})` and `offerLd({tiers:[{priceUsd}]})` emit `priceCurrency: "USD"` (`:58`, `:127`). Consumed by `app/(marketing)/pricing/page.tsx` (`priceUsd: 59/129`) and the landing (`priceUsd: 0` — the free app).
- **Prose copy:** `app/(marketing)/compare/compare-content.ts` — ~10 inline `$59/mo`, `$129/month`, `$59` mentions; `pricing/page.tsx` description "From $59/mo".
- **Reusable card:** `components/sections/pricing-table.tsx` `TierCard` takes a formatted `price` string (currency-agnostic — no change needed beyond what feeds it).
- **Design captures (NOT live-imported — grep-confirmed no importer):** `components/sections/captured/{pricing-html,landing-html}.ts` (2 `$` price refs each) — static DS artifacts; update for parity, non-blocking.
- **Stale test data:** `components/sections/sections.test.ts` (`$0`, `$29` — `$29` is stale, unrelated to live prices).
- **Env → Stripe:** `lib/config/env.ts` `STRIPE_PRICE_{SOLO,GROWTH}{,_ANNUAL}` → `priceIdFor(plan, interval)` → `checkout.ts`. The Price objects carry the currency; code just references IDs. **The env vars must point to the new EUR IDs** (local `.env.local` + Vercel prod) or checkout still charges USD.

## Design

### 1. Single price source — `lib/billing/pricing.ts` (new)

Kill the duplication. One module owns the numbers + currency + formatting:
```ts
export const CURRENCY = { code: "EUR", symbol: "€" } as const;
export interface TierPrice { plan: "solo" | "growth"; name: string; monthly: number; annual: number; }
export const TIERS: readonly TierPrice[] = [
  { plan: "solo",   name: "Solo",   monthly: 59,  annual: 590 },
  { plan: "growth", name: "Growth", monthly: 129, annual: 1290 },
];
export function fmtPrice(amount: number): string;        // 59 → "€59", 1290 → "€1,290"
export function annualPerMonth(annual: number): number;  // 590 → 49, 1290 → 108  (round(annual/12))
export function tierByPlan(plan: "solo" | "growth"): TierPrice;
```
Pure + unit-tested. `fmtPrice` uses `toLocaleString("en-US")` for the thousands comma (`€1,290`).

### 2. Refactor consumers to the source

- **`pricing-plans.tsx`:** build `PLANS`' money fields from `TIERS`/`fmtPrice`/`annualPerMonth` (`monthly.price = fmtPrice(t.monthly)`, `annual.note = \`≈ ${fmtPrice(annualPerMonth(t.annual))}/mo · 2 months free\``). Feature lists/descriptions stay.
- **`lib/seo.ts`:** change the LD builders from `priceUsd`/`"USD"` to a currency-aware shape — `priceCurrency: CURRENCY.code` (EUR) and rename the field `priceUsd` → `price` (or `priceEur`) across `softwareApplicationLd`, `OfferTier`, `offerLd`. Update both call sites (`pricing/page.tsx`, landing `page.tsx` — landing passes `0`, still valid). The free app's LD keeps `price: 0` with `priceCurrency: "EUR"` (or omit currency for free — keep EUR for consistency).
- **`pricing/page.tsx`:** the `priceUsd: 59/129` offer tiers → `price: 59/129` (EUR via the updated builder); the description "From $59/mo" → "From €59/mo".
- **`compare-content.ts`:** swap the ~10 `$59`/`$129`/`$59/mo`/`$129/month` prose mentions → `€…`. Marketing prose — a careful find/replace of the price tokens only (don't touch other `$`-free copy).
- **Captured HTML:** update the `$` price refs in `captured/{pricing-html,landing-html}.ts` to `€` for DS parity (non-blocking; they're not rendered live).
- **`sections.test.ts`:** if it asserts a live price string, update; the `$29` looks stale — leave unless it blocks (confirm at build).

### 3. Env wiring (Stripe already done)

- **Local `.env.local`:** set the 4 `STRIPE_PRICE_*` to the EUR IDs (gitignored; for local dev).
- **Vercel prod env:** update the 4 `STRIPE_PRICE_*` to the EUR IDs (via Vercel API/CLI) BEFORE the deploy, so live checkout charges EUR. `.env.example` may list the var names (no secret values) — no change needed unless it carries example IDs.

## Cost & invariants

- No score-model / scan-pipeline touch. Pure marketing + billing-config change.
- Existing USD subscriptions unaffected (Stripe keeps their price/currency); only NEW checkouts use the EUR IDs.
- Tokens only for any UI; the pricing card component is currency-agnostic (formatted string in).
- Bundle: marketing pages have their own budgets; a lib constant + string swaps won't grow first-load meaningfully — CI verifies.
- **The JSON-LD `priceCurrency` is SEO-visible** — it MUST read `EUR` after this (crawlers/AI read it). Guard: a unit test on the LD builder asserting `priceCurrency: "EUR"`.

## Testing / verification

- Unit: `lib/billing/pricing.ts` (`fmtPrice` comma formatting, `annualPerMonth` rounding, `tierByPlan`); `lib/seo.ts` LD builders emit `priceCurrency: "EUR"` + the right amounts.
- Grep gate: no `$` + price digits remain in live marketing surfaces (`app/(marketing)`, `components/sections` excl. captured/tests) after the swap.
- Live (fixtures=false), post-deploy + post-env-update: render `/pricing` (cards read €59/€129, annual €590/€1,290, "≈ €49/mo"), the landing, a compare page (prose reads €); start a real Stripe checkout for Solo monthly and confirm the Stripe page shows **€59** (proves the EUR price ID is wired). Confirm view-source JSON-LD shows `priceCurrency":"EUR"`.

## Success criteria

Every user-visible price reads EUR (cards, notes, compare prose, JSON-LD); checkout charges the EUR Stripe prices; the price source is single (`lib/billing/pricing.ts`); existing subs untouched; all gates green.

## Out of scope

- Multi-currency / geo-detection / a currency toggle (explicitly deferred — EUR-only chosen).
- VAT/tax handling (Stripe Tax) — not in this pass.
- Migrating existing USD subscribers to EUR (Stripe can't re-currency a live sub; they stay USD until they re-subscribe).
