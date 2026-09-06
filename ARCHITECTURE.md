# Architecture — where code lives

Owner's file. Condensed from the factory's structure map (frozen at `archive/sdlc-factory-2026-09-04/corpus/docs/registry/structure.md`). A new top-level directory or a new `src/lib/` module is a PR to this file first.

Standard Next.js (App Router) + TypeScript. `src/lib/` is the engine, `src/app/` the surfaces, `src/jobs/` the scheduled work, `src/ui/` the design system, `supabase/` the schema. Every pinned number is in `src/lib/config/constants.ts`.

## Modules

| Path | Responsibility | Public entry points | BUILD |
|---|---|---|---|
| `src/app/(public)/**` · `(account)/**` · `api/**` · `layout.tsx` · `middleware.ts` | The application container — every surface a person reaches, and thin HTTP adapters that delegate to the engine. Holds no engine logic. | `/` · `/scan/{domain}` · `/pricing` · `/setup` · `/app` (Overview · Calendar · Settings) · `/app/draft/{id}` · `api/**` | §3, §4 |
| `src/app/(hosted)/**` | Hosted-content edge — Host-keyed static rendering of published pages on `content.{customer-domain}`, plus the robots/sitemap/410 policy served there. | `GET /*` by Host · `/robots.txt` · `/sitemap.xml` | §9, §11 |
| `supabase/**` · `src/lib/db/**` | Schema, migrations, RLS default-deny, and the only two clients any code may hold. | `db()` (RLS) · `dbAdmin()` (server-only) | §10 |
| `src/jobs/**` | The job runner — scan/run · draft/generate · publish/execute · publish/verify · weekly/refresh (hourly tick, site-local Monday) · lead/nurture · account/maintenance — and the kill switch. | job registry · `serve()` | §11 |
| `src/lib/config/**` | Every pinned number and env binding, defined once, asserted once. | `constants.ts` · `env.ts` · `tests/pins.test.ts` | §6.1, §15 |
| `src/lib/egress/**` | The one way any byte leaves toward a customer- or dataset-supplied URL: SSRF-guarded, DNS-pinned, size-capped, robots-respecting. | `safeFetch()` · `resolvesInDns()` · `readRobots()` | §6.4 |
| `src/lib/costs/**` | The cost seam — every vendor/model call ledgered, cached and cap-checked; `fetches` is ledger + cache + raw store. | `withCostContext()` · `recordFetch()` · `capHit()` · `readCache()` | §6.5 |
| `src/lib/vendors/**` | The closed list of DataForSEO endpoints, and nothing else. | `rankedKeywords()` · `keywordSuggestions()` · `competitorsDomain()` · `serpOrganic()` · `aiMode()` · `llmScraper()` | §6.1–6.3 |
| `src/lib/llm/**` | The one `llm()` seam — nano + Haiku, per-call cost logging, closed call-site list. | `llm()` · `LLM_CALL_SITES` | §1, §8 |
| `src/lib/measure/**` | Deterministic parse of fetched HTML into measured quantities, score factors, band, and the measured / measured-zero / unmeasured trichotomy. | `measureDomain()` · `computeScore()` · `Measured<T>` | §5 |
| `src/lib/market/**` | Business profile, market set, the 12 questions, coherence, rival derivation and sizing. | `deriveProfile()` · `deriveMarketSet()` · `selectTwelve()` · `phraseQuestions()` · `deriveRivals()` · `sizeRivals()` | §6.6, §6.7 |
| `src/lib/scan/**` | The one scan pipeline (tier is a parameter), free-path admission, time/spend ceilings, degradation, the stored report. | `runScan()` · `admitFreeScan()` · `readCurrentReport()` | §4.1, §6.3 |
| `src/lib/opportunities/**` | The eight opportunity types, evidence, acceptance tests, winnability, ranking, supply depth, weekly verdicts. | `deriveOpportunities()` · `bandWinnability()` · `supplyDepth()` · `judgeWeek()` · `readWeek()` · `weeklyDigest()` | §7 |
| `src/lib/generate/**` | brief → outline → grounded draft → answerability pass → claim check; every hard rule enforced in code. | `generateDraft()` · `runHardRules()` · `claimCheck()` | §8 |
| `src/lib/publish/**` | State machine, veto/approval rule, destination adapters, idempotency, retries, health, 24h verification, page record. | `transition()` · `becomesPublishable()` · `publish()` · `verifyLive()` · `destinations/**` | §9 |
| `src/lib/mail/**` | One `sendEmail()`, one branded shell + plain-text twin, the register of mail kinds and their stoppability, sequence scheduling. | `sendEmail()` · `MAIL_KINDS` · `scheduleSequence()` | §12 |
| `src/lib/account/**` | Stripe checkout/webhook/portal, provisioning, magic-link identity, active access, export, unpublish-all, erasure. | `handleStripeWebhook()` · `provisionFromPayment()` · `hasActiveAccess()` · `exportEverything()` · `deleteAccount()` | §13 |
| `src/lib/presentation/**` | The copy registry (every sentence the product speaks), rendering of `Measured<T>`, the cold-start line, the generated-text brand, the stopped-work statement, band labels. | `copy()` · `renderMeasured()` · `GeneratedText` · `BAND_LABELS` | §2.5 |
| `src/ui/**` · `tests/ui/**` | Design system — daisyUI theme tokens, the registered component set, closed chart inventory, fonts, the three layout bands and `Surface`, the layout conformance suite. | `theme.css` · `components/**` · `charts/**` · `layout/**` | §2 |

## Rules (each has a check; the check is the rule)

1. **`src/app/**` holds no engine logic.** Route handlers and server components are thin adapters over a module's exported interface. *(review)*
2. **Dependency direction is one-way:** `src/app/`, `src/jobs/` → `src/lib/` → `src/lib/{config,egress,costs,db}`. `src/lib/**` never imports `src/app/**`. *(eslint `local/no-lib-importing-app`)*
3. **Module boundaries are import fences:** only `@/lib/db` outside `src/lib/db`; only `hasActiveAccess()` outside `src/lib/account/billing`; `account/export` never imports `account/billing`. *(eslint `local/no-db-internal-import`, `no-billing-internal-import`, `no-export-importing-billing`)*
4. **No `fetch(` under `src/lib/**` outside `egress/` and `vendors/`.** *(eslint `local/no-fetch-outside-egress`)*
5. **Config over constants.** A number in two files is wrong; it belongs in `constants.ts`, asserted in `tests/pins.test.ts`. *(pins test; `tests/config/constants.test.ts`)*
6. **Migrations are topic-prefixed** — `users` · `sites` · `scans` · `fetches` · `opportunities` · `drafts` · `publications` · `destinations` · `leads` · `suppressions` — with optional sub-tokens (`*_users_subscription_*`). The baseline runs once; later columns are their own migration. *(`tests/db/migration-naming.test.ts`)*
7. **The committed top-level set is closed:** `src/ supabase/ tests/ public/ scripts/ archive/ .github/ .claude/`. *(`tests/app/toolchain.test.ts`)*
8. **Every sentence the product speaks is a copy key; generated text is branded.** *(`tests/presentation/copy/string-literal-sweep.test.ts`, `generated/flow-gate.test.ts`)*
9. **Tests live beside the module** — `tests/<module>/**`. Journey tests live in `tests/journeys/`, one per arrow in BUILD §3. *(`scripts/drift-audit.mjs`)*
10. **A module marks the spec it implements** with `// BUILD §x.y` at the top of the file. *(`scripts/drift-audit.mjs`)*
