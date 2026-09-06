# Decisions

Append-only. One ruling per line, dated, newest last. A ruling here is not re-opened; if it turns out wrong, a new dated line supersedes it and says so. Reasoning lives in the linked issue/PR, or — for `ADR-` lines — in `archive/sdlc-factory-2026-09-04/corpus/docs/decisions/`.

Format (checked by `scripts/drift-audit.mjs`): `YYYY-MM-DD  ruling — optional source`

2026-08-28  Greenfield build to BUILD.md. The shipped reachkit.app repo is reference, not substrate; copy no file wholesale. — BUILD §1
2026-08-28  Free report AI matrix = the `ai_overview` block inside 12 live organic SERPs (2.4¢). The free path makes zero AI Optimization API calls. — BUILD §6.2
2026-08-28  MVP is US-English only: one `SERP_LOCATION` constant, one written footer line. Locale derivation is v1.1. — BUILD §6.3a
2026-08-28  Draft editing is a Markdown textarea with a live preview pane; no rich-text editor. — BUILD §4.6
2026-08-28  No Stripe Tax at launch. Charge €49 tax-inclusive, collect country + VAT ID so records exist. Accepted compliance debt; revisit before meaningful EU B2C volume. — BUILD §13
2026-08-28  Supply is the cap: never invent an opportunity to fill a day; the calendar is never padded. — BUILD §7, §4.6
2026-08-31  One band-label registry (`BAND_LABELS`) owns all six band words; disjointness asserted once. — ADR-001
2026-08-31  Report pages are `noindex` forever and in no sitemap; v1 report removal is a written request, not an authenticated control. — ADR-002
2026-08-31  One arbiter (`account()`) decides a place's single empty-state line over a closed cause union with fixed precedence; ReachKit's own stop outranks every other cause that is also true. — ADR-011
2026-08-31  The spend ceiling outranks the verdict: a cut-off factor nulls the score; no partial score is ever computed. — ADR-021
2026-08-31  One closed, pinned list of AI reader user-agents (`AI_READER_AGENTS`); blocked-readers count, unblock lines and hosted robots policy all read it. — ADR-022
2026-08-31  Declared answer and measured answer are two facts; a pending change is computed as their difference, never stored as a state. — ADR-030
2026-08-31  One directory per mail kind under `src/lib/mail/templates/<kind>/`. — ADR-040
2026-08-31  A nurture sequence that missed its window is dropped forever; a re-delivery starts nothing; an opted-out address still receives the page it asked for. — ADR-041
2026-08-31  Address-wide suppression and per-kind notification toggles are two mechanisms and never merge. — ADR-042
2026-08-31  Active access is `users.paid_through > now()` alone; `plan_status` is recorded and never read by the gate. — ADR-050
2026-08-31  Deletion is a tombstone plus a 30-day purge; unreachability is enforced by row policy, not by callers. — ADR-051
2026-08-31  The €49 Stripe Price is tax-inclusive with Stripe Tax off; switching tax on must never raise a customer's bill. — ADR-052
2026-08-31  Weekly measurement is triggered hourly and gated on each site's own local Monday; "Mon 06:00 UTC" is not the trigger. — ADR-060
2026-08-31  "Nothing worth publishing" is a proven arm, never the fallback; an unattributed empty day is ReachKit's own stop. — ADR-061
2026-08-31  One automatic regeneration; a draft that has entered review is never regenerated. — ADR-070
2026-08-31  The `publications` row (written before the destination call) plus the destination-side marker are the at-most-once guarantee; neither may be tidied away. — ADR-080
2026-08-31  `AI_CRAWLERS` is folded into `AI_READER_AGENTS`; one name. — ADR-090
2026-08-31  Path ownership is by most-specific declared glob; a feature may own files inside a container it is not a child of when it says so. — ADR-091
2026-09-01  A page has four ways of having no ordinary verdict — verdict / not judgeable / not measured / no week — none may be merged, and all four are terminal. — ADR-071, ADR-072
2026-09-01  A ReachKit post in a customer's WordPress carries two marks: the invisible idempotency marker and a visible findability stamp; neither does the other's job. — ADR-083
2026-09-01  Every CMS publishes live in one call; "created" and "made live by us" are two booleans and never merge back. Unpublish is scoped by liveness and names which of five things happened. — ADR-081, ADR-082, ADR-084
2026-09-01  The post-publish check has three outcomes; "could not be confirmed" asserts nothing, is final, and never merges with "no page found". — ADR-085
2026-09-01  A credential that cannot publish is its own occasion (a `HealthReason`, not a fourth health state) with a distinct line and an action leading to a different account. — ADR-086
2026-09-02  The publishing subsystem's six leaves are one strongly connected component at node level and acyclic at file level; the cycle is broken at file granularity, never by deleting a true dependency. — ADR-092
2026-09-02  Layout law: three named bands (compact / medium / wide); content fits its box or the box changes; text is never shrunk to fit; no type step below the floor is minted. — ADR-093
2026-09-03  One canonical domain key from one parser (`parseDomain` → `CanonicalDomain`) used by every domain-keyed row, URL and counter. — ADR-020
2026-09-03  The free report's AI matrix DOES set `load_async_ai_overview` (counts Google's actual AI answers). BUILD.md §6.2/§6.4 "never set it" is superseded for the first pass. — ADR-094
2026-09-03  Free-scan cap stays 12¢ ("a lead magnet … wasting money on it is a crime"). A market-correction re-run does not buy async AI Overviews; the corrected card counts cached AI answers and its disclosure says so. — OWNER-QUESTIONS item 9
2026-09-03  Free report verdict is the score, its band word and one written line naming the factor holding it down. The three driver mini-bars are removed. — OWNER-QUESTIONS item 4 (supersedes BUILD §4.1 header strip)
2026-09-03  Per-question `{vol}/mo` is removed from the 12-questions list; the search text stays. The market-total volume footnote is removed, both halves. — OWNER-QUESTIONS items 5, 6 (supersedes BUILD §4.1)
2026-09-03  Overview's AI-answers tile shows one reading only: weeks present in the trailing window. The composite score has no tile on Overview. — OWNER-QUESTIONS items 7, 8 (supersedes BUILD §4.5)
2026-09-03  Search Console connection is POSTPONED, not answered: "get users on app and later start reviewing and improving based on feedback." — OWNER-QUESTIONS item 3
2026-09-04  Conformance suites are scoped by path glob over the surface tree, not by call-site lists; they run in CI. — ADR-010
2026-09-04  `GeneratedText` is a nominal brand; `fromStored` is the only construction path. Deleting the brand "looks like tidying" and is forbidden. — ADR-012
2026-09-04  The sdlc-factory process is retired for this project. Corpus and plugin frozen under `archive/sdlc-factory-2026-09-04/`; requirements and work orders become GitHub issues, waves become milestones, validation becomes CI, traceability becomes `Closes #N`. Three owner files carry intent: BUILD.md, DECISIONS.md, ARCHITECTURE.md. Rules that matter are checks, not prose.
2026-09-04  `MarketSet` is a declared type owned by the questions leaf (`src/lib/market/questions/market-set.ts`); the report blob's market section takes the leaf's shape, and coherence is a member of it. — ADR-095
2026-09-05  Layout tokens (`--breakpoint-lg` 1024px, `--breakpoint-xl` 1280px, `--t-floor` 11px) live as `:root` custom properties in `src/ui/layout/layout.css`, imported by the root layout; not in `theme.css` (whose `:root` is BUILD §2.1 verbatim) and not a Tailwind `@theme`. — #65
2026-09-05  The landing's medium and wide arms are one column (`same-as-below`) until REQ-099's demo component lands; that build re-declares them. — #65
2026-09-05  The type floor is 11px — the bottom of BUILD §2.3's 10.5–11px eyebrow range and what `type.css` already draws; no type step below it is minted. — #65 (ADR-093 decision 3)
2026-09-05  Layout containment (check 2) considers only elements that generate a box; hidden placeholders and `<script>` tags are skipped. Clarifies ADR-093. — #65
2026-09-05  A test fixture lives beside its test, never in the archived corpus — `tests/presentation/copy/__fixtures__/RULING-copy-2026-09-04.json`. — #61
2026-09-05  The layout conformance suite gates merges (required status check on main). — #68
2026-09-05  Dev environment: Vercel project `reachkitv3` (team timclifford) on this repo; `main` → https://dev.reachkit.app; every PR gets a preview. `NEXT_PUBLIC_APP_URL=https://dev.reachkit.app`, `KILL_SWITCH=false`, `HOSTED_EDGE_CNAME_TARGET=content.dev.reachkit.app` there; production cutover of reachkit.app stays M4 per the go-live plan.
2026-09-05  Foundations = (gates + clarity) / 2: gates = share of AI_READER_AGENTS the robots policy lets through (halved by a targeted noindex; a generic noindex on the home document is a measured 0 decided before robots); clarity = a quarter of the scale per signal present (structured data, Open Graph, ≥1 heading, visible text). — #74
2026-09-05  The evidence-density curve saturates at 20 evidence tokens per 1k visible characters. — #74
2026-09-05  A citation is a reference whose host is the customer's domain or a subdomain; a mention is any other reference carrying the brand token whole (the domain's first label, tokenised on non-alphanumerics). — #74
2026-09-05  Measured inputs are `Measured<T>` end to end — `foundationsOf`/`answerabilityOf` take `Measured<OnPageFacts>`, never `null`: a null cannot say why (REQ-004). — #74
2026-09-05  robots.txt `disallowedAgents` is keyed by the pinned AI_READER_AGENTS spelling for named readers (matched case-insensitively), other tokens lowercased; the named group's verdict outranks the wildcard (RFC 9309 §2.2.1). — #72
2026-09-05  Report removal (REQ-002): `domain_blocks` has no writer in the product (owner inserts by hand); the blocked arm is a 410 with one written line naming the address that restores it; `REPORT_REMOVED_STATUS = 410` pinned; the route wires `removedResponse()` in #25. — #28
2026-09-05  The app shell's model (measured weeks, the no-publish precedence resolver) lives in `src/app/(account)/app/_shell/` as presentation-side derivation; ARCHITECTURE rule 1 reads: no measurement, no vendor call, no persistence in src/app — pure derivation for rendering is allowed there. — #83
2026-09-05  Under `/app` the layout owns the route's `Surface` root; pages under it declare none. — #83
2026-09-05  Template question forms ("best X" → "What's the best X?") are code, not copy — the deterministic fallback shape; model-worded questions carry `phrasing: 'model'`, not the GeneratedText brand. — #82
2026-09-05  For M1 fixture screens the "preview reviewed by the owner" gate is discharged by the delegated owner (master) on code review + the layout conformance suite; the owner steers visually on dev.reachkit.app after merge and corrections come back as issues — ship-then-steer. — #9/#83
2026-09-05  The job platform is Inngest (BUILD §1), named in exactly one file, `src/jobs/client.ts`; `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` are the SDK's own bindings, not members of env.ts. — #86
2026-09-05  `DRAFT_DUE_HOUR_LOCAL = 18` (site-local, ADR-060) and `JOB_FAN_OUT_CONCURRENCY = 10` are pinned; revisit with the first weekly cost report. — #86
2026-09-05  AI Mode price-book rows follow DATA-COSTS.md's 2026-09-03 re-check: `AI_MODE_LIVE_C` 0.4¢, `AI_MODE_STD_C` 0.12¢; BUILD §6.1 (0.2 / 0.06) is superseded and amended under #2. — #87
2026-09-05  `RIVAL_SCORE` is pinned as its two weights (1 per top-10 appearance, 2 per AI citation), never as the formula; `constants.ts` holds prices and boundaries, not formula shape. — #87/#88
2026-09-05  Owner-owed copy keys on fixture screens render as the visible marker `TODO(copy)`; mail keeps the throw (a mail never ships a placeholder). — #93
2026-09-05  Tailwind 4 needs an explicit entry point: `src/ui/tailwind.css`, imported by the root layout, is the one home of `@import "tailwindcss"` + the daisyUI plugin; until #93 no utility or daisyUI class had ever applied. — #93
2026-09-05  Dev deployment: Vercel project `reachkitv3`, production branch `main`, https://dev.reachkit.app; Deployment Protection stays `all_except_custom_domains`. Secrets marked sensitive on the v2 project cannot be copied through the API — the owner enters them in the dashboard; until then they hold the placeholder `PENDING_OWNER_SETS_IN_VERCEL_DASHBOARD`. v3 must not point at the v2 production Supabase project (`reachkit`, Postgres 17); a dedicated dev project is an owner decision. — #5
2026-09-05  The `Vercel` deployment check is a required status on `main`; a PR is not done while its preview build fails. — #5
2026-09-05  `StoredReport` (src/lib/scan/report.ts) carries `presence: PresenceCard` beside the AI-answers card and no `rivalSizes` member until the rival-sizing module (#37) declares `RivalSize`; a section a stage never produced is a compile error, never a missing key. — #100
2026-09-05  ADR-095's "coherence is a member of it": *it* is the report blob — `coherence` sits on `StoredReport`, not inside `MarketSet`. — #100
2026-09-05  Calendar actions are projected from the publishing transition table, never listed per stage; Move/Skip/Veto call a declared publishing interface whose stub rejects with `PublishingNotBuiltError` — a control never appears to work before its engine exists. — #99
2026-09-05  The two calendar custom surfaces live under `src/ui/components/custom/` so the registered component barrel stays closed at fifteen. — #99
2026-09-06  `StoredReport` carries the twelve questions twice by decision, not drift: `questions: Measured<Question[]>` is the record (keyword, volume, intent, score, rank — read by ranking and the paid pass's frozen set); `aiAnswers.rows[].question: StoredQuestion` is the screen's, numbered and GeneratedText-gated (REQ-093 c3). Two promises, two shapes; `report.ts` states this. — #103
2026-09-06  The category has ONE home: `market.profile.category` (ADR-095). The top-level `category` member is removed; the verdict strip reads through `sections.ts`. Blob version bumped; `readStoredReport` guards the old version. — #103
2026-09-06  REQ-098 c4/c5 (a score card on the sign-in screen) are deferred: the sign-in screen is one address field, one action and the written no-password line, nothing else, until the owner names the score for that surface. Strings REQ-098 c2 states verbatim are transcribed as copy values, not owed. — #106
2026-09-06  `/pricing` and `/signin` are the two public surfaces beside `/` and `/scan/{domain}`; the offer is one component (`PricingCard`) rendered on the report and on /pricing with only the Start destination differing. — #106
2026-09-06  No duration is promised anywhere on setup or the waiting screen (REQ-025 c1 outranks BUILD §4.3's "first page in ~3 minutes" footer, which is amended under #2); the waiting screen names the step, never how long. — #111
2026-09-06  Custom CSS stays inside BUILD §2.2's allowance (sidebar, calendar grid, day panel, AI dot-matrix, chart SVGs); screen-level stylesheets (settings.css, setup.css) are replaced by utilities; #12 asserts it by path glob. — #107/#111
2026-09-06  `nextPublishStatement(stopped: boolean)` rather than BP-054's `stop: WorkStop | null`: the shell states that ReachKit stopped, never why; ADR-061's unattributed empty day belongs to the calendar's empty-date resolver, not to the shell's next-publish line. — #115
2026-09-06  BUILD §2 is mechanical: four CI suites under tests/ui/design (no emoji, component registry conformance, custom CSS by path glob, token audit, numerals in `.num`); the tab bar is boxed (`tabs-box`) per §2.2 "boxed + bordered". — #114
2026-09-06  Draft Markdown is a declared subset rendered by one in-repo renderer (headings, paragraphs, lists, links, emphasis, code); raw HTML is never passed through, every href is vetted, and the same serialiser produces the screen, the copy-as-HTML and the copy-as-Markdown, so the three cannot disagree. No Markdown dependency until fidelity demands one. — #119
2026-09-06  The report page resolves its arm from the store in fixed precedence — malformed → removed → report → scanning → cooldown → refused → starting; a stored report outranks refusal and cooldown (a report is a thing to read; the refusal travels as the one notice beside it); a removed domain is rewritten in middleware to a route handler that answers 410 (page.tsx cannot); `*.example.com` fixtures answer only for reserved names. — #109
2026-09-06  Rival suggestion has two sources by path: a market inferred from a report → that report's deriveRivals (0¢); a market the founder stated → competitors_domain (its own empty answer for a domain without presence stands in for §6.6's presence clause); no market → nothing sought. RivalSize is declared in src/lib/market/rivals and joins StoredReport under #103. — #118
