# Project Blueprint — a transferable build charter

> **Purpose.** This is the one document you copy into a **new** project so you never start from zero. It is not any one product's spec — it is the distilled *way of building* that the first product paid for in shipped bugs, plus the concrete stack, payment model, data-sourcing playbook, design system, and cost/data laws that carry over unchanged.
>
> **How to read it.** The doc is ordered by *execution order*, not importance:
> - **Part I — Speed** (§1–§4): the fastest path to paid value. Stage ladder, day-0 charter, data sourcing, the lead magnet. This is what you do in week one.
> - **Part II — The build** (§5–§10): stack, architecture, payments, cost tracking, design system, data discipline. The essentials, installed as you build.
> - **Part III — Scale** (§11–§14): the anti-drift ratchet, the viral-principles compass, the paid-for lessons, the working rhythm. Adopted as the product earns it — not on day 0.
>
> **The governing law:** **Simple scales, fancy fails.** Every decision below is a bias toward the fewest processes, the fewest paths, the least data, the least generated text, and the most measurement. When a change needs a new special case to work, that is the signal the process is wrong — fix the process, not the case.

---

## 0. The ten laws (read these even if you read nothing else)

These are non-negotiable at every stage. Everything later in this doc is one of these ten made concrete.

1. **Fix the class, never the case.** Before fixing anything, name the class: *"what else fails this same way?"* Then fix all of it, once. A fix that resolves the reported symptom and leaves its siblings standing is not done. A fix that adds an edge case to an already-branchy path is a regression even when it works.
2. **As few processes as possible; one path per use case.** One entry point, one path, no special-casing per tier/product/entry/auth-state. Duplicated paths always drift until only one of them is correct. When you catch yourself writing a second implementation of a capability, stop — make the first one shared. Corollary: **no feature flags, at all costs** — every user runs the same code. A flag is a per-user path fork: it doubles the states to test, hides untested permutations, and rots into a branch nobody remembers. Ship everything to everyone; if a feature isn't ready for all users, it isn't ready.
3. **Complexity is the enemy. Simple scales, fancy fails.** Prefer the boring, intrinsic, self-contained solution over the clever one. A half-applied clever transform looks *worse* than none.
4. **Track every cost at the unit and the user level.** No call spends money anonymously. Every cost-bearing call (LLM or data) is attributable to a work-unit (a "scan," a "job," a "request") and through that to a user. A cost row that no user can be billed for is a bug, not an edge case.
5. **Retrieve only the data the app renders. Never more.** Before adding a paid/fetched data call, name the surface that renders it. If you can't, the call must not exist. This binds per-*field*, not just per-call: fetching 50 rows to show 8 is the same waste at smaller scale.
6. **Store as much as you cheaply can.** Data you already paid to fetch or compute is stored, not thrown away. Storage is cheap; re-fetching is expensive and moves your numbers. (This is the honest twin of law 5: fetch narrowly, but keep everything you fetched.)
7. **Never generate long LLM prose unless the output *is* prose.** Apps are action- and data-driven. Show the number, the bar, the delta, the position — never a paragraph describing them. Generated text collapses to labels.
8. **Degrade, never invent.** When a fetch flakes or a fact-sheet is empty, the dependent field is empty and its UI section does not render. Never synthesize a plausible number or claim to fill a gap.
9. **A number measures exactly what its label says, and every number carries its label.** No metric is an alias of another, none is its own fetch-limit dressed as a total, a sampled number discloses its basis, and no figure renders "hanging loose" without a word saying what it is.
10. **A guard you have not *seen fail* is not a guard.** Every check must be watched failing (break the code, watch red, revert, watch green) before you trust it. A green check whose instrument you never verified is an unverified claim. Verify the *effect*, never a source-text proxy for it.

If a new instruction contradicts one of these, **surface the conflict** — quote the law and the instruction and ask which wins. Never silently comply (breaks the ratchet) and never silently ignore (breaks trust).

---

# PART I — SPEED: the fastest path to paid value

The goal of a new project is not a codebase — it is **100 users and the first payments, as fast as possible**. Part I is everything that happens before and during the first product code: what to decide, what data to build on, what to ship first, and — just as important — what NOT to build yet.

## 1. The stage ladder — essentials now, scale when it costs you

The full hardening machinery in Part III is what the first product needed *after* it had paying users and shipped bugs. Applied verbatim on day 0 it recreates the complexity trap this doc exists to prevent. The ladder resolves this:

**The rule: a gate is installed when its failure class first costs you something — except the day-0 six, which are ~10× harder to retrofit.**

### Stage 0 — Validate (days, not weeks)

Ship: **landing page + hard paywall + free preview (the lead magnet, §4) + Stripe checkout.** That is the entire product surface. One scan → one report → one payment.

Mandatory from the first commit — **the day-0 six** (cheap now, brutal to retrofit):

1. **The env seam** — one typed, Zod-validated env module; an ESLint rule forbids env access anywhere else.
2. **The cost context** — `costedStep` (async-local storage) wrapping every spend path, with a cost-rows table + rollup column, *before the first paid call exists*. Retrofitting attribution through 15 call signatures is misery; inheriting an ambient context is free.
3. **ONE pipeline** — a single orchestration file with named stages; tier is a parameter, never a fork.
4. **RLS default-deny** on every user-scoped table from the first migration.
5. **Semantic tokens** — light + dark in one theme file from the first component. No raw hex, ever.
6. **Store every raw fetched response** — the store-wide layer (law 6). This raw data *becomes* your acceptance corpus, your dev fixtures, and your re-fetch protection later, for free.

Explicitly **cut the fat** at Stage 0 — none of these exist yet:

- No design-system mirror, no acceptance corpus, no capability ledger, no mobile gate.
- No admin surface beyond a one-page owner diagnostics route (unit costs + failures).
- No second product, no tier permutations beyond free-preview/paid, no cron/refresh jobs.
- No typed intel tables without a proven reader; no placeholder fields ("we'll wire it later" = never).
- No feature flags, no config surface, no settings page.

### Stage 1 — First 100 users

- **Each failure class gets its gate on first occurrence** — that is law 1 applied to the harness itself. First cache-poison → the policy-version mechanism. First number–label lie → that guard family. First payload crash on a legacy row → the legacy-shaped fixture.
- **The live-config tripwire the day real money flows** (webhook endpoint, prices, currency — §7). In-repo tests cannot see a dead webhook in a provider dashboard.
- **The mobile gate at first real traffic** (§9) — your first 100 users are on phones.
- Behavioral guard tests accumulate; keep the unit suite ~5s so pre-commit stays painless.

### Stage 2 — Hardening (a conversion surface worth protecting exists)

- The **acceptance corpus** (§11) — captured verbatim from your stored raw responses (which you have, because of day-0 #6).
- The **capability ledger** — one implementation per capability, second definition fails the build.
- **Design parity** gates, if you maintain a rendered design mirror.
- **Retention machinery** — cron refresh, score-over-time, monitoring (§4: the second visit).

## 2. The Day-0 Project Charter (fill this in before scaffolding anything)

You arrive with a problem and a solution. Before the first `create-next-app`, answer these on one page. The viral principles (§12) are **inputs here, not review criteria later**. An unanswered question is an open decision with a stated default — never silently skipped.

| # | Question | Principle / section |
|---|---|---|
| 1 | **The problem, in a customer's own words.** Describe it better than they can. | P21, P14 |
| 2 | **Who pays, and the price.** Price ≥ ~20× unit COGS (§3.4) and above competitors. | P8, P32 |
| 3 | **The ≤10-word description.** If you can't say it in one sentence, users won't either. | P30 |
| 4 | **The one thing.** What is this product known for? Everything else is cut. | P11 |
| 5 | **The wave.** What trend/tech/problem are people already discussing that this rides? | P13 |
| 6 | **The name.** Known words, no wordplay, no explanation needed. | P23 |
| 7 | **The free/paid boundary, decided ONCE.** Exactly what the free preview shows and what sits behind the paywall. (The first product re-litigated this for weeks because it was never fixed up front.) | P8, P25, §4 |
| 8 | **The shareable artifact.** What does a user send to someone else? (§4 — the growth loop.) | P4, P5, P25 |
| 9 | **The anchor data source(s) + unit cost.** Per-preview COGS and per-paid-unit COGS, computed from §3 *before* code. | §3 |
| 10 | **Snapshot or monitoring?** Snapshot value → one-time payment. Monitoring value → subscription, and the recurring refresh COGS must fit inside the recurring price. | P27, §7 |
| 11 | **The second visit.** What brings a user back on day 8? Data products decay after the first report — the return visit is designed, not hoped for. | §4 |
| 12 | **The pathological archetypes.** The 3–4 input shapes that will break this domain (for a site-analysis product: SPA sites, directories, zero-footprint subjects, wrong-subject brand twins). These seed the corpus later. | §13 L12 |
| 13 | **Done for Stage 0 =** 100 users / first N payments — written as numbers, so "done" is a measurement, not a feeling. | §1 |

Bonus: write **five headline candidates** now, test on friends, keep the one remembered the next day (P17).

## 3. Data-sourcing playbook — where the product's data comes from

Data sourcing was the single most expensive recurring question of the last project. Decide it up front, in this order.

### 3.1 The first question

**"Who already has this data, and what is the cheapest *consented* path to it?"** — asked before any provider is chosen, any SDK installed, any scraper written.

### 3.2 The source hierarchy (strict preference order)

1. **The user's own artifact** — a URL they submit, a file they upload, a paste. Free, consented, always the right subject.
2. **First-party derived** — you fetch/parse their public artifact yourself. Cheap and controlled, but fragile: assume the SPA-fetch class of failure and design the degraded path on day one.
3. **OAuth into accounts the user already owns** — Search Console, Analytics, Stripe, Shopify, YouTube. **Evaluate this before any paid aggregator.** Perfect proprietary data, zero marginal cost, consent built in — and a retention lock. (The first product never used it and paid for aggregators instead; connecting Search Console would have eliminated half the external spend *and* the entire wrong-subject bug class for tracked products.)
4. **Free structured public APIs** (HN Algolia, iTunes, web.archive class) — rate-limited but stable and $0.
5. **Paid aggregators** (DataForSEO/Tavily class) — only under a cost context with per-tier caps (§8), and only when 1–4 can't cover the field.
6. **Scraping** — last resort. Assume it breaks; budget the fallback before shipping it.
7. **The LLM is NEVER a data source — only a transformer.** It labels, classifies, names a category, picks a phrase. It does not know facts. Every fabrication the last project shipped was a violation of exactly this line (a search API's "answer" laundered into invented user reviews).

### 3.3 The anchor-call pattern

Converge on the **smallest set of paid calls whose data can be derived into many surfaces**. The first product's single keyword-rankings call ended up feeding the score, the classification, the footprint, the demand model, and the opportunity list.

**Design metric: surfaces-per-paid-call — maximize it.** Ten cheap calls that each feed one widget is the anti-pattern; one call recombined into five surfaces is the pattern. Corollary: before adding call #2, prove call #1's stored data can't be derived into the new surface.

### 3.4 Source evaluation checklist (before committing to any source)

- **Unit cost** per call, and per *rendered field* (law 5 binds per-field).
- **Rate limits** and what the product does at the limit (degrade, never queue-forever).
- **Volatility** — does the same query return a different answer next week? If yes, your persisted layer is the truth and any re-fetch is gated behind an explicit freshness window (lesson 7: re-fetching moves your numbers).
- **Entity-resolution risk** — is the source keyed by *name* or by *domain/ID*? Name-keyed sources ship wrong-subject bugs (yourbrand.ai vs yourbrand.app; acquire.io vs acquire.com). Require domain/ID-level attribution; a bare name match is never attribution.
- **Coverage of the pathological archetypes** (charter Q12) — test the source against them before integrating, not after.
- **ToS / consent** — scraped and aggregated data carries terms; OAuth data carries consent.

### 3.5 Unit economics before code

From the source list, compute **preview COGS** and **paid-unit COGS** first. Price at **≥ ~20× unit cost** (reference point from the first product: ~18¢ preview, ≤150¢ paid unit, €59 price). If the math doesn't clear, the *source list* is wrong — fix it before building, not after. This number also decides one-time vs subscription (charter Q10).

### 3.6 Raw data is an asset from day one

Because of day-0 six #6, every response is stored verbatim. That stored layer is, in order of payoff: (a) re-fetch protection and score stability, (b) your dev fixtures — real captured data, never hand-authored, (c) the Stage-2 acceptance corpus, (d) future surfaces derived at zero marginal cost (§3.3), and (e) the raw material for programmatic-SEO lead magnets (§4.2).

## 4. The lead magnet & the growth loop

Getting to 100 users is a distribution problem, not a build problem. The doc's answer has three parts, all designed on day 0 (charter Q7, Q8, Q11):

### 4.1 The free preview IS the lead magnet

A free *preview*, never a free *plan*: it runs the cheap tier of the one pipeline, shows the product genuinely working on the visitor's own input (P10, P25 — show before you explain, play before pay), and stops at the paywall line decided in the charter. It is **surface-driven** — identical for anonymous, authed, and paid viewers (§6.2) — it never runs the expensive path and never enrolls anyone. Cost-capped at the preview COGS from §3.5. One CTA on it, straight into checkout (P22, P28).

### 4.2 Secondary magnets: programmatic surfaces from data you already have

Derived from the stored raw layer at near-zero marginal cost: comparison pages (`/compare/[slug]` — P31, the comparison table), example galleries and teardowns, small free tools. Each is a static, indexable page whose data was already paid for. Never fetch *new* paid data for a magnet — magnets are the law-6 dividend, not a new cost center.

### 4.3 The shareable artifact — the loop itself

**"What does a user send to someone else?"** Every data product should have exactly one answer. The first product's is the public report URL with an OG image designed like a YouTube thumbnail (P5) — anyone can run the preview on any site and send the link. Design the artifact deliberately: a stable public URL, an OG image that earns the click, a footer worth sharing (P4), and the recipient lands one click from running their own.

### 4.4 The second visit is designed, not hoped for

Data products decay after the first report. Decide on day 0 what brings a user back on day 8: a refresh with an honest delta ("▲ +N since last scan" — computed from persisted data, never a re-measurement artifact), a completed-action verification loop (predicted vs observed movement), or a monitoring alert. This machinery *ships in Stage 2*, but the charter names it in Stage 0 so the data model supports it (score snapshots over time cost nothing to store from day one).

---

# PART II — THE BUILD: stack, structure, money, data

## 5. The stack (what to reach for, and why)

A single-stack Next.js app on Vercel. **No separate backend service** — API routes stay thin; all heavy/long-running work is offloaded to a background-job runner. This is the whole architecture in one sentence, and it is deliberately boring.

**This stack is the default. Deviate only with a written reason in the charter** — never re-litigate it per project.

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router)** on **Vercel** | Server Components by default (`rsc: true`). React 19 + React Compiler. |
| Long-running work | **Inngest** (`/api/inngest`, `maxDuration=300`) | Scans, deepen, cron refresh, verify. API routes only *enqueue*; Inngest *does*. |
| Data | **Supabase** (Postgres + **RLS** + **pgvector**) | RLS on every user-scoped table. pgvector for embeddings. DB client confined to `lib/db` / `lib/auth` / `middleware.ts`. |
| Auth | Supabase Auth + magic link (via email provider) | Session refresh in `middleware.ts` must **fail open**, never throw on a missing env. |
| Payments | **Stripe** | See §7. One-time-first mindset; hard paywall. |
| LLM | **Anthropic Claude** (`@anthropic-ai/sdk`) | Confined to `lib/llm`. Every call writes a cost row (§8). Model-tiered per task (§8). |
| Embeddings | Voyage/embedding provider | Stored in pgvector, never re-fetched. |
| Email | **Resend** | Magic links, transactional only. |
| Analytics | **PostHog** (`posthog-js` + `posthog-node`) | Product analytics + LLM cost observability. |
| UI primitives | **shadcn** (`base-nova` style, **Base UI** not Radix) + **lucide** icons | `@/components/ui`. |
| Charts / data viz | **Recharts** + a small "intel kit" of `Gauge`/`Bar`/`Donut`/`KpiRow`/`DataTable` | The app renders data as data (law 7). |
| Styling | **Tailwind v4** with a **semantic-token theme** | Tokens only — never arbitrary values or raw hex (§9). |
| Validation | **Zod** | All external input + env parsing. |
| Toasts / cmd / motion | sonner · cmdk · motion/gsap/lenis (sparingly) | Motion is a garnish, not a load-bearing feature. |

**Runtime notes that age badly in LLM memory, corrected:** stay on the **Node.js runtime** (Fluid Compute), not Edge — streaming/SSE work fine on Node. Default function timeout is 300s. Configure the project in `vercel.ts` (typed) over `vercel.json`. When you need an external service, provision a **real integration** via the platform marketplace before hardcoding a provider SDK.

**The no-feature-flags rule: avoid feature flags at all costs — everything runs for all users.** This is how you scale quickly: one codebase, one behavior, zero rollout matrix. Every `if (flag)` in production is three defects at once: a mistyped-env foot-gun (one bad var once handed out free upgrades and turned off rate-limiting), an untested permutation (n flags = 2ⁿ states, and you test one), and a path fork that drifts (law 2). No gradual rollouts, no percentage gates, no per-cohort variants, no A/B flags — a feature that isn't ready for 100% of users isn't ready to merge; keep it on a branch, not behind a flag. Test seams are *injected* (a provider you install in tests, `null` in prod), not read from env. Production reads zero product flags. The only two allowed env-driven switches, both ops not product: a **kill switch** (pause new work without a redeploy) and **owner-gated** surfaces (an allow-list of owner emails for diagnostics).

## 6. Technical architecture — the shape

### 6.1 Layers and their boundaries (machine-enforced)

```
app/         →  routes + thin API handlers        (may import lib, components)
lib/         →  all logic: scan/pipeline, llm, billing, db, config
components/   →  UI only
```

Enforced by a dependency-cruiser gate (`check:arch`), not by good intentions:

- `lib ✗→ app` (logic never reaches up into routes)
- `lib/scan`, `lib/llm`, `lib/billing` `✗→ components` (logic never imports UI)
- The **LLM SDK lives only in `lib/llm`**; the **DB client only in `lib/db`/`lib/auth`/`middleware.ts`**.
- **Production `✗→` dev scaffolding and test fixtures** — fixture *data* can never re-enter the prod import graph. Fixtures reach prod only through the injected seam (which is `null` in prod).
- **All env access goes through one module** (`lib/config/env.ts`), enforced by an ESLint rule. Only `NODE_ENV`, `NEXT_PUBLIC_*`, and platform-injected `VERCEL_*` may be read as literals. One typed, Zod-validated env module is the single seam — nothing to mistype elsewhere.

### 6.2 The work spine (the one path)

The heavy work is a single pipeline with named stages: **collect → extract → synthesize → critic → format → persist.** One orchestration file is the spine; everything hangs off it. Two tiers (a cheap "free/preview" pass and an expensive "deep/paid" pass) run the **same pipeline** — the tier is a parameter, not a fork. A background sentinel column marks the deep pass done; never overload a payload field to mean "was deepened."

**Public/preview surfaces are surface-driven, not viewer-driven.** The public entry point behaves identically for everyone — anonymous, authed, or paid — because the *surface* decides the tier, not the viewer's plan. (A paid viewer pasting a URL into the public box once triggered a silent expensive deep scan and auto-enrolled a third-party URL: a per-viewer branch that should never have existed.)

### 6.3 Resilience invariants

- **A pipeline failure leaves a renderable `degraded` partial** — never a permanent stuck-ACTIVE status.
- **Every consumer of a stored JSON payload null-coalesces** (`?? []`) — older rows predate newer fields. A new field added to a render must be defaulted at the props boundary, not read raw. (A missing `?? []` on a new field is invisible to a test suite that always builds the *current* shape — so keep one legacy-shaped fixture that asserts "no throw.")
- **Rate-limit abuse at the edge** (e.g. N jobs / IP-hash / hour, with an in-flight window). Store only the hash, never the IP.

### 6.4 Security floor (day 0 — every item here shipped as a *fix* last time)

- **SSRF guard on every user-submitted URL**: http(s) only, resolve-and-block private/link-local ranges, no redirect-following into internal hosts.
- **Stripe webhook signature verification** — the webhook creates accounts; an unverified webhook is an account-creation API.
- **Open-redirect check** on auth callbacks and any `?redirect=` param — same-origin allowlist only.
- **RLS default-deny** on every user-scoped table (day-0 six #4) — the API layer is not the security boundary, the database is.
- **Privacy-minimal abuse data**: hash identifiers you rate-limit on; never store the raw IP.

## 7. Payment structure

The money model is where the viral principles bite hardest (§12: 1, 8, 12, 16, 27, 32). Concretely:

- **Stripe, hard paywall, payment before data.** Signups don't validate; a credit card does. The funnel is **Stripe → email → magic link → account** — the account is *created by the webhook* after payment, not before. Don't build a free tier that leeches support and server cost for <3% conversion.
- **A free *preview*, not a free *plan*** (§4.1). A preview is a marketing surface; a plan is a liability.
- **Popcorn pricing: at most three tiers.** Good / Better / Best. Every extra tier is another decision and another reason to leave. Put **"Pricing" in the header** (P16) and make the price impossible to miss.
- **The subscription decision rule (data-cost-driven, not taste-driven):** *snapshot value → one-time payment; monitoring value → subscription, and the recurring refresh COGS (§3.5) must fit inside the recurring price.* One-time is ~10× easier to sell (P27) — add recurring only when the product's value genuinely recurs.
- **Price above competitors** (P32) — nobody talks about the second-cheapest option. Enable **promotion codes** at checkout for controlled discounting rather than lowering the sticker price.
- **Billing state lives on the user row**, updated by the webhook. Entitlements/redaction gating is one module; every cost-bearing authenticated route calls `assertPaid` *before* any gather — the UI paywall does not protect the API.
- **The webhook is one shared provisioning path.** Anonymous-checkout and in-app-upgrade must run the *same* provisioning code, or they drift until only one deepens/creates-account correctly.
- **Verify the live money surface out-of-band** (Stage 1, the day money flows — §11's live-config tripwire): the live webhook endpoint targets the right domain with the right handled events, prices resolve/active/correct-currency/no-accidental-trial, and the pricing page renders the real number. In-repo tests cannot see a dead webhook endpoint in the provider dashboard.

## 8. Cost tracking — unit-level and user-level, always

**No call spends money anonymously.** This is law 4, and it is the reason the business is legible.

- **Two mechanisms, both required (both installed day 0 — day-0 six #2):**
  - **LLM spend:** every model call writes a cost row keyed by the work-unit id. A rollup column on the work-unit is the total. A caller may pass a null id and **inherit the ambient costed step** from an async-local context — so you never thread an id through 15 generator signatures. A cost row with a null work-unit id = money nobody can be billed for = the bug this closes.
  - **External data spend:** every cost-bearing caller runs inside a **cost context** (`costedStep` / async-local storage). Because both LLM and data ride the same context, wrapping a route in the costed step attributes *both* at once.
- **Caps at three levels:** a tool-call count cap per job; a cents cap per tier; and a **per-unit soft cap** that, on breach, **flips a flag and degrades** (skips remaining enrichment) — it **never throws** (degrade, never invent). The unit is stamped with a "cap hit" timestamp, visible on the owner diagnostics page.
- **The cap derives from the tier through one seam** (`capCentsFor(step, tier)`). No step hard-codes the full cap for a cheap tier.
- **LLM model tiering is a first-class cost lever:** the cheap/fast model for classification, labeling, and extraction; the big model only for the few synthesis/judgment steps. Choose the model per *task*, pin it per call site, and let the cost rows tell you when a task earned an upgrade or a downgrade.
- **Reporting:** an owner-only diagnostics surface shows per-unit stage costs, all-time and monthly per-user spend (a SQL view), and a cost-alerts strip. This is not optional instrumentation — it is how you notice a cache-key drift silently doubling spend.
- **The ledger guard (Stage 1+):** every cost-bearing "cached fetch" wrapper must have a *live consumer that calls it*. A new wrapper with no consumer fails the build. This is law 5 as a machine check.

## 9. Design system — tokens, data-first, mobile-gated

The design system is the second seam after env. Its whole job is to make light/dark, mobile, and consistency *free* rather than per-component vigilance.

- **Tokens only. Never arbitrary Tailwind values or raw hex.** Light theme in one place (`globals.css @theme`), dark in `.dark` overrides. Use semantic tokens (`bg-surface`, `text-muted`, `text-accent`) or the CSS vars. `bg-[#6e56f7]` and `text-[13px]` are forbidden — they break light/dark and drift from the system.
- **Data-driven, not word-driven** (law 7, and P3 — numbers over adjectives). Show gaps/trends/performance as *the data itself*: bars, gauges, sparklines, deltas, positions, counts. Never a paragraph describing the data.
- **Every number carries its label.** No bare `88` — always "Footprint strength 88/100." When multiple scores on different scales appear together, each is unambiguously named so they can't be confused. Data-driven + always-labelled = a number a first-time viewer reads without a tooltip.
- **Reuse before you build.** Keep a component **inventory** (what exists, active vs archived, each component's live counterpart). Compose from existing primitives (shadcn/Base UI) + the intel kit before writing anything new. Only add a genuinely new atomic component when no composition works — then add it to the inventory in the same change.
- **Mobile is a machine-checked gate** (Stage 1 — first real traffic), not a review item. A headless check loads every route at 390px and 360px and **fails** if any content element's right edge spills the viewport. The trap: **inline styles beat every stylesheet rule**, so a media query silently does nothing to an inline `grid`. Make things responsive *intrinsically* (`repeat(auto-fit, minmax(min(100%, 280px), 1fr))`) where possible; when a breakpoint is unavoidable move that property out of inline into a scoped `<style>`. A flex/grid child needs `min-width: 0`; a URL/host needs `overflow-wrap: anywhere`. Verify the *computed* style at the target width — a half-applied fix looks worse than none.
- **Direction of truth is code → design mirror, never the reverse** (Stage 2, if you keep a rendered design-system pane at all). A change made only in the pane is not real. Parity is enforced by four layers: token/band parity (hard-fail), mirror existence (hard-fail), mirror freshness (warn), and **label drift** (hard-fail — every visible label in a live component must actually be *rendered* by its mirror card, compared against the prerender, not the source text). **"Blessing" a mirror re-pins a hash and verifies nothing** — never bless a card you have not diffed against its live counterpart (this shipped a nav that said "Progress" for weeks after it became "History").

## 10. Data discipline — narrow in, wide storage, no prose

Laws 5, 6, 7, 8 as one working practice:

- **Fetch narrowly (law 5).** Name the render surface before the fetch. Per-field, not per-call. No write-only tables: if nothing reads it back, don't store a typed table for it (retire it).
- **Store widely (law 6).** Everything you *did* fetch or compute is persisted so you never re-fetch. Re-fetching is not just cost — it **moves your numbers** (a cache expiring days later returns different data, which surfaces as a false "▲ improved since last scan"). Persisted inputs → stable outputs. Gate any re-fetch behind an explicit freshness window; reuse the persisted layer inside it.
- **Never cache an empty/failure result**, and refuse stale blanks on read-back. A cached sheet also carries a **policy version**; bumping the policy invalidates every sheet cached under the old policy even inside its TTL. This is the cache-poisoning class fix.
- **No long LLM text (law 7).** The LLM's job is to *label* and *classify*, not to write. It names a category, identifies a subject, picks a phrase — data everything else. Every generated sentence on a data surface is a defect.
- **Degrade, never invent (law 8).** Empty input → absent field → unrendered section. The renderer omits an ungrounded section rather than showing a plausible synthesis. The one time this was violated, an unlaunched product's scan invented glowing user reviews that never existed — because a search API's "answer" was laundered in as review #1 and there was no empty-sheet guard.
- **A rendered number measures its label (law 9).** No metric aliases another; none equals its own fetch limit dressed as a total; a sample discloses its basis; comparative copy ("the weaker half") renders only when the comparison holds; counts are computed, never a literal. One concept has **one name** product-wide, computed by **one shared function** (two forks of "is this a brand keyword?" drifted and classified the same input differently).

---

# PART III — SCALE: the ratchet, the compass, the tuition

Part III is what turns a validated prototype into a substantial, sustainable product. Adopt it per the stage ladder (§1) — each gate the moment its class first costs you something, the whole set once real revenue depends on the surfaces they protect.

## 11. The anti-drift harness — how "iterate forward, never backwards" is enforced

The single most valuable thing the first product built was not a feature — it was the **ratchet**: machine-checked gates that a change may *strengthen* but may never *weaken to make a regression pass*. Port this shape to any new project. Every gate runs in CI **and** on pre-commit (keep the unit suite ~5s so this is painless).

| Gate | What it pins | Stage |
|---|---|---|
| **Behavioral guard tests** | Each invariant has a test that has been *seen to fail*. Break the code, watch red. | 0–1 |
| **Architecture boundaries** | §6.1, via dependency-cruiser. | 0–1 |
| **Live cloud config** | §7 — code ↔ provider dashboards (webhook endpoint, prices, currency, job registration, health). The only class of drift no in-repo gate can see. | 1 (day money flows) |
| **Mobile overflow** | §9, headless at 390/360px. | 1 (first traffic) |
| **Doc-contract tripwire** | The load-bearing constants restated in your rules-doc are pinned to the source constants — a change in one is a signal to update the other in the *same commit*. | 1–2 |
| **Guard-honesty tripwire** | Source tripwires must assert a *real call* through a helper that blanks comments/strings, brace-matches the function body, and **refuses an assertion that is true by construction** (asserting a symbol against the file that *defines* it). Self-tested against the exact false-negative that once shipped. | 1–2 |
| **Number–label honesty** | The law-9 family: no aliasing, no fetch-limit-as-total, samples disclose basis, counts computed. | 1–2 |
| **Acceptance corpus (the oracle-before-the-change)** | Real outputs captured *verbatim* from production (never hand-authored), rendered through the *real* public path, asserted against a rubric (no garbage strings; every rendered number derives from the payload; empty-in → no-section; comparative copy only when true; magnitude/credibility floors). The corpus and rules only **grow**; suppressions only **shrink**; expectations only **tighten**. | 2 |
| **Capability ledger — one impl per capability** | A registry maps each capability → its one canonical module. A *second* definition of a registered symbol anywhere fails the build. This is the machine form of "one path per use case" — it makes the duplications you keep making (two upgrade paths, two demand systems, free/paid forks) *fail* instead of drift. | 2 |
| **Design parity** | §9, token/mirror/label-drift. | 2 |

**The Change Protocol.** To change an invariant, a token, or a boundary *on purpose*, update all in the **same commit**: (1) the source constant/rule, (2) its guard, (3) the rules-doc, (4) the architecture doc if structural. A new invariant gets a guard *before* merge. Never delete a check without a documented reason in the commit body.

**The Acceptance clause (corpus-first / product-level TDD).** A user-visible change declares its acceptance criterion — a new corpus expectation or rubric rule — **before** implementation, watches it fail, then makes it green. This is the one discipline that actually stopped failure classes from recurring: it moves the acceptance oracle from "the owner reads the live render and finds the bug" (late, expensive, human) to pre-merge.

**The Feedback Protocol.** (1) User feedback is *always* made durable — a rule in the rules-doc if it's a way of working, an invariant + guard if it's load-bearing behavior, memory otherwise. "Noted" without a durable write is not taking it on board. (2) When feedback is about what a render *shows* ("this feels thin/too small/not credible"), the durable form is a **corpus threshold, not a per-site patch**: capture the offending render verbatim, encode the judgment as a rubric rule, watch it fail, make it green.

## 12. The 32 viral principles, mapped to concrete practice

The principles are a compass, not a checklist. Here they are folded into where they actually change a decision. **The complete source text is embedded verbatim in Appendix C** — this document is self-contained; no companion file travels with it. The charter (§2) is where most of them are *answered*; this section is the map from principle → decision.

### Money & validation (the hard-paywall cluster)
- **1 — No free plan.** Free users are a liability; <3% convert. Ship a free *preview* (a marketing surface, §4.1) — never a free *plan*. → §7.
- **8 — Hard paywall; ask for payment before data.** Card first, account second (webhook-provisioned). → §7.
- **12 — Popcorn pricing.** Good / Better / Best, max three. → §7.
- **16 — Pricing impossible to miss.** "Pricing" in the header. → §7.
- **27 — Avoid subscriptions.** One-time is 10× easier to sell; add recurring only when the value genuinely recurs (the §7 decision rule). → §7.
- **32 — Price above competitors.** Nobody talks about the second-cheapest. → §7.

### The one-thing product
- **11 — Do one thing.** Be known for one tool that solves one problem. Every feature you add is one people forget. This is P11 = law 2 (few processes) pointed at the product surface.
- **30 — Describable in under 10 words.** If you can't say it in one sentence, users won't either. → charter Q3.
- **13 — Ride a wave.** Build around a trend/tech/problem people already discuss — the wave does half the marketing. → charter Q5.
- **19 — Do something people have never seen.** Nobody shares a clone.

### The hero & landing (sell from the top)
- **20 — Sellable from the hero alone.** 80% never scroll past it. Fix the hero first.
- **6 — One idea per screen.** One screen, one message.
- **10 / 25 — Show before you explain; let people play before they pay.** A demo/preview beats paragraphs, and puts your best feature *on* the landing page — which is exactly the lead-magnet model in §4.
- **21 — Empathy before selling.** Describe the problem better than the customer can, before offering the solution. → charter Q1.
- **22 — One call to action.** Multiple paths → many choose none. One next step.
- **28 — A CTA that says what happens next.** "Analyze My Website," not "Get Started." Remove uncertainty.

### Copy & headline
- **3 — Numbers, not adjectives.** "Save 4 hours every week," not "fast." This *is* law 7 (data-driven) in copy form.
- **7 — A headline a fifth-grader gets.** Simple words.
- **17 — A headline remembered the next day.** Write five, test, keep the one that sticks. → charter bonus.
- **18 — An emotional headline.** People remember feelings, not features.
- **24 — Sell a human desire, not a feature.** More money/time/health/status, less pain. Features are vehicles.
- **26 — No weak words.** No "most/many/rarely." Make statements, not estimates. (This is law 9 applied to marketing: a claim you can picture, remember, and challenge.)
- **9 — Copy only you could write.** If a competitor could paste it onto their site, it's too generic. Write from experience.
- **14 — Steal copy from customers.** They describe it better than you. Write like they talk.

### Trust & shareability
- **2 — Three colors.** Black text, white background, one color for the buy button. This is the *design-token discipline* (§9) pointed at attention: one accent token owns the CTA.
- **4 — A footer people want to share.** 97% won't buy but might share. Finish strong. → §4.3.
- **5 — Treat the OG image like a YouTube thumbnail.** It's seen more than the site. If they don't click, they don't watch. → §4.3.
- **15 — A founder people can see and hear.** A founder screen-recording beats a corporate promo.
- **23 — A name people remember.** Known words, no wordplay, no explanation required. → charter Q6.
- **29 — Don't launch without testimonials.** Collect proof before traffic.
- **31 — Compare yourself to competitors.** A simple comparison table on the features customers care about makes the switch obvious. → §4.2 (a programmatic magnet).

**The through-line:** principles 3, 26, and 31 are the *same honesty rule* this codebase enforces in machine checks (law 9) — a claim measures what it says, in strong specific numbers, comparable and challengeable. The marketing and the product obey one standard.

## 13. The lessons that cost the most (steer around these)

Every one of these shipped, was found by a human reading a live render, and became a machine gate. Import the gates, skip the tuition.

1. **Fixtures and canned test data mask real-adapter bugs.** Production ships one path with no fixtures. Always live-test a change against real adapters on a real deploy before trusting it — a clean fixture suite certified a scan that failed on a real single-page-app fetch.
2. **The conversion surface is verified by rendering the live page, not by reading the stored payload.** Garbage chips, a zero-state that never rendered, a self-contradicting hero — all passed a payload check and failed the eye. Headless-render the real page and read the actual text.
3. **A guard on dead code is a guard on nothing.** A component no page imported was "guarded" by its own test — delete the dead code and the guard with it.
4. **A source-text match is not an effect.** `active={key === "history"}` "contains" the word History; an import/comment/type-ref "contains" a symbol. Assert the rendered/actual effect. Prove every new guard bites; verify the mutation actually applied (`git diff --stat` non-empty) before trusting a "pass."
5. **Blessing/re-pinning verifies nothing.** It certifies whatever is there as "fresh forever," including drift. Only ever bless what you diffed.
6. **Duplicated paths drift until one is wrong.** Two upgrade paths (only one deepened), two ladder shapes, two demand systems, a free/paid action fork, two brand-keyword detectors. Every one was fixed *reactively* after drift shipped. The capability ledger (§11) makes the second implementation fail the build — build it early.
7. **Re-fetching moves your numbers.** A score that was stable free→paid dropped on upgrade because a cache expired and the re-fetch returned different footprint data — surfacing as a false "improvement." Reuse the persisted layer inside a freshness window (law 6).
8. **An LLM will launder a failed fetch into a fabrication if you let it.** A search API's "answer" became invented user reviews. Guard empty sheets at synthesis *and* omit ungrounded sections at render (law 8). The LLM is never a source (§3.2).
9. **A metric that's true-by-construction hides forever.** `captureRate = score` and `keywordsRanked = 50` (its own fetch limit) passed every gate because they were tautologies. The number–label honesty family (law 9, §11) exists because the strong harness was blind to this whole class.
10. **Inline styles beat media queries; the layout viewport lies.** §9. Measure `documentElement.clientWidth`, not `window.innerWidth` (the browser expands the layout viewport to fit overflow, making an innerWidth check unfalsifiable on exactly the broken pages).
11. **Cloud dashboards drift out of code's sight.** A webhook pointed at a dead domain for days. The live-config tripwire (§11) is the only thing that sees it.
12. **Every shipped failure class lived in an unenumerated cell.** Before designing a substantive change, fill a **permutation matrix**: tier × auth × entry-surface × data-state (fresh/legacy/empty/pathological/wrong-subject). Every touched cell is covered or excluded-with-reason. No blank cells — the three worst leaks were each one unenumerated cell. (Charter Q12 seeds the data-state axis on day 0.)

## 14. Working rhythm — the intake, the docs, the memory

Keep the process light but durable:

- **Three living docs, kept in sync:** a **requirements** doc (owner-readable, "what it must do," with an `OPEN(O-n)` push-list of decisions waiting on the owner), a **rules-of-engagement** doc (this file's descendant — "how to change it"), and an **architecture** doc (how it's built, with a few diagrams). When they disagree, that's a bug in one — raise it, never silently reconcile. (At Stage 0, the charter §2 *is* the requirements doc; split them when the product earns it.)
- **Substantive change → a short intake doc first**, and its requirements-delta ships in the same PR. The intake forces, in order: the verbatim requirement · a restatement with deltas · clarifying questions asked and recorded · the permutation matrix (lesson 12) · acceptance criteria written first · the class statement · the rendered-surface ledger. Anything you can't decide becomes an `OPEN(O-n)` for the owner; the stated default applies until they rule. Never resolve an open item silently.
- **Substantive** = alters user-visible behavior, a data contract, a cost-bearing call, or tier/auth/entry handling. **Not substantive** = copy tweaks, typo/mechanical fixes, guard-green refactors, test/docs-only. When in doubt, it's substantive.
- **Durable memory over session memory.** One fact per file, with a one-line index. Convert relative dates to absolute. Record *why*, not just *what*. Don't store what the repo already records.

---

## Appendix A — Bootstrap order (the executable Stage-0 sequence)

The scaffold sequence for a new repo, in order. Each step is small; the order is the point — the day-0 six land *before* the features that would make them painful to retrofit.

1. **Charter first** (§2) — the one-pager, answered. No code before it.
2. **Scaffold**: `create-next-app` (TS, App Router, Tailwind v4), repo, Vercel project.
3. **Env seam**: `lib/config/env.ts` (Zod-validated) + the ESLint rule forbidding env access elsewhere.
4. **Database**: Supabase project, first migration with RLS default-deny; DB client confined to `lib/db`/`lib/auth`.
5. **Cost context**: `costedStep` (AsyncLocalStorage) + cost-rows table + rollup column — *before any paid call exists*.
6. **Pipeline skeleton**: one orchestration file, named stages, `tier` parameter, `degraded`-partial status handling.
7. **Jobs**: Inngest at `/api/inngest`; API routes enqueue only.
8. **Tokens**: semantic theme in `globals.css` (`@theme` + `.dark`); shadcn init; the intel-kit primitives as you need them.
9. **Store-raw layer**: every adapter response persisted verbatim (§3.6).
10. **Payments**: Stripe product + ≤3 prices, checkout route, **signature-verified** webhook as the ONE provisioning path, `assertPaid` on every cost-bearing authed route.
11. **Auth**: magic link via Resend; fail-open session middleware; open-redirect check on callbacks.
12. **The free preview** (§4.1): surface-driven tier, SSRF-guarded input, IP-hash rate limit, preview cost cap.
13. **Landing**: hero sellable alone, one CTA that says what happens next, pricing in the header, OG image designed like a thumbnail, shareable public result URL.
14. **Analytics**: PostHog client + server.
15. **First gates**: unit-test harness (~5s), `check:arch` skeleton, husky pre-commit running both.
16. **Deploy + live-verify**: run the real flow on the real deploy (a real input end-to-end, headless-render the result page and *read the text*). Then ship to the first users.

Stage-1/2 gates (§11) install afterwards, each on first occurrence of its class — plus the live-config tripwire the day money flows.

## Appendix B — The one-paragraph version

Answer the charter before writing code: the problem in a customer's words, who pays and at what ≥20×-COGS price, the ≤10-word description, the one thing, the free/paid boundary decided once, the shareable artifact, and the anchor data source — preferring the user's own artifact and OAuth-connected data over paid aggregators, with the LLM as a transformer and never a source. Then build the smallest sellable loop: a single Next.js app on Vercel, thin API layer, heavy work in a background-job runner, Postgres+RLS, one typed env module, one pipeline parameterized by tier — and ship landing + free preview (the lead magnet) + hard paywall + Stripe, with the day-0 six installed from the first commit: env seam, cost context, one path, RLS, tokens, store-everything-raw. Track every cent to a unit and a user; fetch only what you render and store everything you fetch; render data as data with every number labelled; degrade instead of inventing. Add each hardening gate the first time its failure class costs you something — behavioral guards you've watched fail, the acceptance corpus captured from production, the capability ledger that fails the second implementation, the live-config tripwire for the dashboards code can't see — and design the second visit and the share loop on day 0 even though their machinery ships later. Fix the class not the case, keep the paths few, and when a fix needs a new special case, fix the process instead. Simple scales, fancy fails.

## Appendix C — The 32 Principles of a Viral Product (full source text, verbatim)

> Embedded in full so this blueprint travels as ONE file. These are the central building principles every new product is built on top of — read them raw, then use the §12 map and the §2 charter to act on them. In the author's words: *"These are not rules. They're patterns. Use them as a compass, not a checklist."*

**1. A viral product does not have a free plan.**
Free users are leeches. They increase support, server costs, and make you build features your paying customers don't want. Less than 3% of free users ever convert. Remove your free plan.

**2. A viral product has three colors.**
Every color fights for attention. The more colors you add, the less people notice what matters. Black text. White background. One color for the Buy button.

**3. A viral product uses numbers instead of adjectives.**
"Fast" is forgettable. "Save 4 hours every week" isn't.

**4. A viral product ends with a footer people want to share.**
97% of visitors won't buy, but they might share. People remember what they see last. Finish strong.

**5. A viral product treats the OG image as a YouTube thumbnail.**
"If they don't click, they don't watch." Your OG image is often seen more than your actual website. Design it like a YouTube thumbnail.

**6. A viral product reveals one idea per screen.**
Don't try to say everything at once. One screen should communicate one idea and nothing else. One screen. One message. Just like the Instagram feed.

**7. A viral product has a headline a fifth grader can understand.**
Complexity kills curiosity. Use simple words. Your mum should get it.

**8. A viral product has a hard paywall.**
Signups don't pay the bills. If nobody is willing to pull out their credit card, you don't have validation. Ask for payment before asking for data.

**9. A viral product has copy only you could write.**
If a competitor could copy-paste your landing page onto their website, your copy is too generic. Write from experience.

**10. A viral product shows the product before it explains it.**
A demo communicates more than paragraphs of text. Show. Don't tell.

**11. A viral product does one thing.**
The more things you do, the less people remember. People don't remember Swiss Army knives. They remember the tool that solved their problem. Be known for one thing.

**12. A viral product uses Popcorn Pricing.**
Your visitors came to buy a product, not study a spreadsheet. Every pricing tier you add creates another decision and another reason to leave. Keep it to three choices: Good. Better. Best.

**13. A viral product rides a wave.**
Build around trends, technologies, and problems people are already discussing. The wave does half the marketing for you.

**14. A viral product steals its best copy from customers.**
Customers already describe your product better than you do. Write like your customers talk.

**15. A viral product has a founder people can see and hear.**
People buy from people. A screen recording from the founder beats a corporate promo video or a wall of features. Show your face.

**16. A viral product makes pricing impossible to miss.**
The pricing section is one of the first places visitors look. They use it to understand the product, not just the price. Put "Pricing" in the header.

**17. A viral product has a headline people remember the next day.**
Write five headlines. Show them to friends. Wait 24 hours and ask which one they remember. Keep the one that sticks.

**18. A viral product has an emotional headline.**
People don't remember features. They remember feelings. Your headline should make people laugh, say wow, or think what the fuck is this. Write for humans.

**19. A viral product does something people have never seen before.**
Nobody shares another clone. Surprise people.

**20. A viral product can be sold from the hero section alone.**
80% of visitors won't scroll past the hero. If they don't understand the product and want it within a few seconds, you've already lost. Fix the hero first.

**21. A viral product shows empathy before it sells.**
Before people trust your solution, they need to believe you understand their problem. Describe the problem better than they can.

**22. A viral product has one call to action.**
Every extra button creates hesitation. When people have multiple paths, many choose none. Give people one next step. Just one.

**23. A viral product has a name people remember.**
Use words people already know. Avoid wordplay, made-up words, and names that require explanation.

**24. A viral product sells a human desire, not a feature.**
People buy more money, more time, better health, more status, or less pain. Features are just vehicles to get there. Sell the outcome, not the feature.

**25. A viral product lets people try the product before buying it.**
Don't hide your best features behind a paywall. Put them on the landing page. Let people play before they pay.

**26. A viral product does not use weak words.**
"Most", "many", "rarely" weaken your message because nobody knows what they mean. Strong copy makes clear claims that people can picture, remember, and challenge. Make statements, not estimates.

**27. A viral product does not have a subscription.**
People already pay for enough subscriptions. Don't add another monthly charge unless you can't ship without it. One-time payments are 10x easier to sell.

**28. A viral product has a call to action that says what happens next.**
"Get Started" means nothing. "Analyze My Website" tells people exactly what they're about to do. Remove uncertainty.

**29. A viral product does not launch without testimonials.**
A landing page without testimonials is asking strangers to trust you blindly. Get a few users, friends, or beta testers first and collect their feedback. Collect proof before traffic.

**30. A viral product can be described in under 10 words.**
If you can't explain your product in one sentence, your users won't either.

**31. A viral product compares itself to competitors.**
People don't care what your product does. They care why they should switch. Show a simple comparison table with the features your customers care about. Make the decision obvious.

**32. A viral product is more expensive than its competitors.**
Nobody talks about the second cheapest option. Charge more.

> *"This is what I've learned from 5 years of building 35 startups in public, watching hundreds of launches make $0, and a few reach millions of people. These are not rules. They're patterns. Use them as a compass, not a checklist. And if you've found a 33rd principle, I'd love to hear it."*
