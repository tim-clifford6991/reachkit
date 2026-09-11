# Decisions — product rulings

**Product rulings only** (owner ruling 2026-09-11). Append-only: one ruling per line, dated, newest last. A ruling here is not re-opened; if it turns out wrong, a new dated line supersedes it and the old row is **struck in place**, never deleted.

Two kinds of ruling are **not** here. A **process** ruling is a rule in `docs/PROCESS.md` §8. An **implementation** ruling — how a module does its work — is a comment at that module, where the person changing the code will read it; `ARCHITECTURE.md` says which module. The record as it stood before the split, with every row, is `docs/archive/DECISIONS-full-2026-09-11.md`.

Reasoning lives in the linked issue/PR, or — for `ADR-` lines — in `archive/sdlc-factory-2026-09-04/corpus/docs/decisions/`.

Format (checked by `scripts/drift-audit.mjs`): `YYYY-MM-DD  ruling — optional source`

2026-08-28  Greenfield build to BUILD.md. The shipped reachkit.app repo is reference, not substrate; copy no file wholesale. — BUILD §1
2026-08-28  Free report AI matrix = the `ai_overview` block inside 12 live organic SERPs (2.4¢). The free path makes zero AI Optimization API calls. — BUILD §6.2
2026-08-28  MVP is US-English only: one `SERP_LOCATION` constant, one written footer line. Locale derivation is v1.1. — BUILD §6.3a
2026-08-28  Draft editing is a Markdown textarea with a live preview pane; no rich-text editor. — BUILD §4.6
2026-08-28  No Stripe Tax at launch. Charge €49 tax-inclusive, collect country + VAT ID so records exist. Accepted compliance debt; revisit before meaningful EU B2C volume. — BUILD §13
2026-08-28  Supply is the cap: never invent an opportunity to fill a day; the calendar is never padded. — BUILD §7, §4.6
2026-08-31  One band-label registry (`BAND_LABELS`) owns all six band words; disjointness asserted once. — ADR-001
2026-08-31  Report pages are `noindex` forever and in no sitemap; v1 report removal is a written request, not an authenticated control. — ADR-002
2026-08-31  One closed, pinned list of AI reader user-agents (`AI_READER_AGENTS`); blocked-readers count, unblock lines and hosted robots policy all read it. — ADR-022
2026-08-31  Deletion is a tombstone plus a 30-day purge; unreachability is enforced by row policy, not by callers. — ADR-051
2026-08-31  The €49 Stripe Price is tax-inclusive with Stripe Tax off; switching tax on must never raise a customer's bill. — ADR-052
2026-08-31  Weekly measurement is triggered hourly and gated on each site's own local Monday; "Mon 06:00 UTC" is not the trigger. — ADR-060
2026-08-31  `AI_CRAWLERS` is folded into `AI_READER_AGENTS`; one name. — ADR-090
2026-09-01  A ReachKit post in a customer's WordPress carries two marks: the invisible idempotency marker and a visible findability stamp; neither does the other's job. — ADR-083
2026-09-01  Every CMS publishes live in one call; "created" and "made live by us" are two booleans and never merge back. Unpublish is scoped by liveness and names which of five things happened. — ADR-081, ADR-082, ADR-084
2026-09-02  Layout law: three named bands (compact / medium / wide); content fits its box or the box changes; text is never shrunk to fit; no type step below the floor is minted. — ADR-093
2026-09-03  The free report's AI matrix DOES set `load_async_ai_overview` (counts Google's actual AI answers). BUILD.md §6.2/§6.4 "never set it" is superseded for the first pass. — ADR-094
2026-09-03  Free-scan cap stays 12¢ ("a lead magnet … wasting money on it is a crime"). A market-correction re-run does not buy async AI Overviews; the corrected card counts cached AI answers and its disclosure says so. — OWNER-QUESTIONS item 9
2026-09-03  Free report verdict is the score, its band word and one written line naming the factor holding it down. The three driver mini-bars are removed. — OWNER-QUESTIONS item 4 (supersedes BUILD §4.1 header strip)
2026-09-03  Per-question `{vol}/mo` is removed from the 12-questions list; the search text stays. The market-total volume footnote is removed, both halves. — OWNER-QUESTIONS items 5, 6 (supersedes BUILD §4.1)
2026-09-03  Overview's AI-answers tile shows one reading only: weeks present in the trailing window. The composite score has no tile on Overview. — OWNER-QUESTIONS items 7, 8 (supersedes BUILD §4.5)
2026-09-03  Search Console connection is POSTPONED, not answered: "get users on app and later start reviewing and improving based on feedback." — OWNER-QUESTIONS item 3
~~2026-09-05  Dev environment: Vercel project `reachkitv3` (team timclifford) on this repo; `main` → https://dev.reachkit.app; every PR gets a preview. `NEXT_PUBLIC_APP_URL=https://dev.reachkit.app`, `KILL_SWITCH=false`, `HOSTED_EDGE_CNAME_TARGET=content.dev.reachkit.app` there; production cutover of reachkit.app stays M4 per the go-live plan.~~  **Superseded — superseded 2026-09-08 by the one-Vercel-project, one-Supabase-project ruling.**
2026-09-05  AI Mode price-book rows follow DATA-COSTS.md's 2026-09-03 re-check: `AI_MODE_LIVE_C` 0.4¢, `AI_MODE_STD_C` 0.12¢; BUILD §6.1 (0.2 / 0.06) is superseded and amended under #2. — #87
2026-09-05  Owner-owed copy keys on fixture screens render as the visible marker `TODO(copy)`; mail keeps the throw (a mail never ships a placeholder). — #93
~~2026-09-05  Dev deployment: Vercel project `reachkitv3`, production branch `main`, https://dev.reachkit.app; Deployment Protection stays `all_except_custom_domains`. Secrets marked sensitive on the v2 project cannot be copied through the API — the owner enters them in the dashboard; until then they hold the placeholder `PENDING_OWNER_SETS_IN_VERCEL_DASHBOARD`. v3 must not point at the v2 production Supabase project (`reachkit`, Postgres 17); a dedicated dev project is an owner decision. — #5~~  **Superseded — superseded 2026-09-08 by the one-Vercel-project, one-Supabase-project ruling.**
~~2026-09-05  The `Vercel` deployment check is a required status on `main`; a PR is not done while its preview build fails. — #5~~  **Superseded — superseded 2026-09-09 — `Vercel` is no longer a required check.**
2026-09-06  REQ-098 c4/c5 (a score card on the sign-in screen) are deferred: the sign-in screen is one address field, one action and the written no-password line, nothing else, until the owner names the score for that surface. Strings REQ-098 c2 states verbatim are transcribed as copy values, not owed. — #106
2026-09-06  `/pricing` and `/signin` are the two public surfaces beside `/` and `/scan/{domain}`; the offer is one component (`PricingCard`) rendered on the report and on /pricing with only the Start destination differing. — #106
2026-09-06  No duration is promised anywhere on setup or the waiting screen (REQ-025 c1 outranks BUILD §4.3's "first page in ~3 minutes" footer, which is amended under #2); the waiting screen names the step, never how long. — #111
2026-09-06  Draft Markdown is a declared subset rendered by one in-repo renderer (headings, paragraphs, lists, links, emphasis, code); raw HTML is never passed through, every href is vetted, and the same serialiser produces the screen, the copy-as-HTML and the copy-as-Markdown, so the three cannot disagree. No Markdown dependency until fidelity demands one. — #119
2026-09-06  The Settings billing card shows the plan (our fact), the price (our pin) and the portal control — no next-invoice and no card row: REQ-097 (ReachKit renders no billing value it computed) outranks BUILD §4.7's row list, because Stripe's API returns raw facts, never rendered text, and formatting them is computing. BUILD §4.7 is amended under #2. — #34
~~2026-09-06  Identity: `auth_links` stores only a SHA-256 of a 256-bit secret (no plaintext column exists); issuing spends every live link for the same (user, purpose) so the newest works (REQ-024 c4); redemption is one conditional statement; the session cookie is HMAC-signed so middleware's presence check cannot be forged; `users.email` moves only inside the redemption statement of the new address's own link (REQ-077). — #137~~  **Superseded — superseded 2026-09-10 — identity is Supabase Auth (#468).**
2026-09-07  Owner-owed keys that are labels on controls carry the TODO(copy) marker (an unwritten label is a control nobody can name and the empty value would throw the screen down); owner-owed sentences on screens render the marker; mail keeps the throw. The three #35 refusal lines stay empty and so a refused email change speaks nothing until written. Every settings read is bounded at 800 ms and made concurrently. — #186
2026-09-07  One rule for owner-owed keys on screens: the TODO(copy) marker (2026-09-05). Overview's page test that "no owed key renders anything" is the one exception and is retired — its owed keys move to the marker so a far rival's control is visible on dev before its words exist. Mail keeps the throw. — #234 follow-up
2026-09-07  The screen rule has no exceptions: every owner-owed key on a screen carries the TODO(copy) marker (Overview's twenty moved in #242; the no-presence-yet family across overview/calendar/report moves in #246); mail keeps the throw. — #242
2026-09-07  The public surface follows the owner-approved card idiom of 2026-09-02 ("A · Six boxes"), ported from the archive's previews/app idiom routes: landing = accent hero (tagline · subline · one field · one pill CTA · specimen card) · video (absent state not rendered) · why-care · what-it-does · how-to-start; sign-in = split with the glass score panel (owner-supplied strings verbatim); the idiom's card, button and action-panel rules become the design system's; the two values the owner did not rule stay ruled (--r-box 14, mono numerals). v2 is not a source. Header and footer are proposed, marked as such, for the owner to strike or keep. — #266
~~2026-09-07  Public header and footer (proposed, not in the approved idiom; the owner strikes or keeps): semantic header/nav/footer laid out with utilities and the idiom pill Btn — no sixteenth component; wordmark · pricing · sign-in · one CTA; footer product · legal (three owner-owed static routes) · opt-out · one fine-print line; one solid primary per screen, so on / the hero CTA is the primary and the header carries only sign-in; the compact menu is the registered collapse; links only to routes that exist. — #266~~  **Superseded — superseded 2026-09-08 by ruling 3a — the chrome is approved, not proposed.**
2026-09-08  The public surface is the owner-approved card idiom, ported (#285): src/ui/idiom carries the idiom's four tokens, the card head slot, IdiomCard and ActionPanel; Btn gains the three pill ranks and on-accent inversion, Progress onAccent, Stat labelInHead; the two values the owner did not rule stay ruled (--r-box 14, mono numerals). Landing = hero (tagline · subline · one field · one inverted pill · specimen card) · why-care · what-it-does · how-to-start (repeats the hero's action, no second primary); the video block renders nothing while the asset is absent. Sign-in = the split with the glass card; three panel sentences are owner-supplied and written. Overview = Take A, six boxes, heads on the three tiles only — growth, rivals and the week strip carry no head because a head that needs a new sentence is a new promise. The hero specimen shows one row until the multi-row matrix is wired. The landing is excluded from the borrowed-value rule because it has no customer and its specimen is the product's own, labelled. — #285
~~2026-09-08  Public header and footer ship marked "proposed — not in the approved idiom" for the owner to keep or strike; /privacy, /terms, /imprint exist as owner-owed static routes so a footer link reaches a page. — #285~~  **Superseded — superseded 2026-09-08 by ruling 3a — the chrome is approved, not proposed.**
~~2026-09-08  The header never carries a solid primary: its scan control is the outline secondary on every public route and absent on /; the screen's own action is the one solid. Quiet on-accent ink meets WCAG AA for its size against the darkest point of the accent gradient, ratios stated. — #290~~  **Superseded — superseded 2026-09-08 by rulings 2b and 3a (#357).**
~~2026-09-08  The report screen's one solid primary is the pricing card's Start (the journey's next step); the free-page card's submit is the outline secondary in accent. — #291~~  **Superseded — superseded 2026-09-08 by ruling 2b (#357).**
~~2026-09-08  The layout sweep's "today" is a fixture: one clock seam (now()) that every render-path date read on the account surfaces goes through, a fixture instant honoured only in the test/fixture environment and refused by the boot invariants in a production build, and the seed anchored to the same instant — so the live overview and the live calendar are photographable and deterministic across a Monday. Dropping screens from the baselines is refused. — #305~~  **Superseded — superseded the same day by the fuller RK_FIXED_NOW ruling below.**
2026-09-08  The complete screen set (docs/design/approved/full-set/) is approved and is the UI specification of record; UI-SPEC.md wins over BUILD §4 until the §4 amendment lands. — #357 #368
2026-09-08  Ruling 1b: the report header keeps its three driver mini-bars with their n/10 values. Amends REQ-004 c2 and BUILD §4.1 — driver values may be shown on the header strip and nowhere else. — #357 UI-SPEC §1
2026-09-08  Ruling 2b: two solid primaries are allowed on one screen where the approved set draws them (landing: header CTA + hero CTA; report: Email me + Start). Supersedes the master rulings of #290 and #291, and with them #294's statement that no public screen is exempt from the one-primary rule (its public exemption list is no longer empty: the landing and the report are on it by the set's own drawing); every further landing CTA scrolls to the one field (REQ-099 c3). — #357 UI-SPEC §1
2026-09-08  Ruling 3a: the public header is brand · Sign in (quiet) · one solid CTA, and every public page carries the minimal footer (brand, rights line, removal address, Product, Legal). The footer is new; the legal routes and the removal address are reachable from every public page. Supersedes the "proposed — not in the approved idiom" marking the chrome shipped under (#285). — #357 UI-SPEC §1
2026-09-08  Ruling 4c: the demo video block renders a 16:9 frame with a play control and one written line before the asset exists. Amends REQ-099 c6, and supersedes the absent-renders-nothing arm of #285 (tokens.md §9.4's "absent" reading). — #357 UI-SPEC §1
2026-09-08  Ruling 5c: the sign-in card (47/100, +6 pts est.) and the hero component's figures render as drawn on example.com, with no source date and no example line. Amends REQ-098 c5 and REQ-099 c8 / open question 4 — a reserved-domain specimen is admitted without the written line — and supersedes #303's omission of the glass card's inverse pill while no measured delta exists. — #357 UI-SPEC §1
2026-09-08  Ruling 6a: "Discoverability Score" is the number's name on every surface that labels it — the report head eyebrow, the Overview tile, the landing component tile, and the weekly and report mail. — #357 UI-SPEC §1
2026-09-08  Ruling 7a: headline numerals are JetBrains Mono (--font-num: var(--font-mono)) with no sans option; the numerals toggle is removed. Closes tokens.md §9.2's second unruled value in the direction BUILD §2.3 already stated. — #357 UI-SPEC §1
2026-09-08  Ruling 8a: the card radius is --r-box 14px everywhere and --r-card is removed. Closes tokens.md §9.2's first unruled value against the drawn 18px. — #357 UI-SPEC §1
2026-09-08  Ruling 9a: a problem card carries a severity word from the closed set (Critical · Worth fixing · Nothing to fix) AND the who-does-it badge (Free fix · 10 min / ReachKit writes / ReachKit rewrites). Amends REQ-009 c1, c5 and c8 — the two are one card's two facts, not alternatives. — #357 UI-SPEC §1
2026-09-08  Ruling 10a: every literal in the approved set resolves to the token ladder — type 15 / 13 / 12 / 11.5 / 11 (--t-body --t-sm --t-xs --t-explain --t-eyebrow) with nothing under 11px, sidebar --w-sidebar 222px, day panel --w-day-panel 290px, breakpoints 640 / 768 / 1024 / 1280, and the chip --s-6 square with --r-field. ADR-093 d1 and d3 hold and the token gate (#349) is strict. — #357 UI-SPEC §1
2026-09-08  Ruling 11a: the approved set's unbracketed strings are approved copy as written — the registry fills those keys from the set rather than marking them TODO(copy); only a bracketed string stays owner-owed. — #357 UI-SPEC §1
2026-09-08  Ruling 12a: a control the requirements mandate and the approved set omitted is built in the set's idiom rather than dropped; UI-SPEC §3 marks each one new. — #357 UI-SPEC §1
2026-09-08  REQ-004 c2 amended: driver values are allowed on the report header strip only (ruling 1b). — #357 #368
2026-09-08  REQ-099 c6 amended: the demo video block renders a 16:9 frame with a play control and one written line before the asset exists (ruling 4c). — #357 #368
2026-09-08  REQ-098 c5 and REQ-099 c8 / open question 4 amended: a reserved-domain specimen renders its figures as drawn, without the source-or-example written line (ruling 5c). — #357 #368
2026-09-08  REQ-009 c1, c5 and c8 amended: a problem card states a closed-set severity word and the who-does-it badge together (ruling 9a). — #357 #368
2026-09-10  The free pass has two ceilings — its own (`TIMING.reportCeilingS`) and the platform's (`maxDuration` on `/api/scan`); the pass is registered with `after()` so it outlives the response, and `account/maintenance` sweeps a free scan left `running` past the platform bound to `failed`. — master, #438/#443 (BUILD §11 amendment)
2026-09-10  Copy: the owner approved the master's drafted set for every owed key — 393 keys, drafted from reachkitv2's copy plus BUILD, UI-SPEC and the REQ criteria (proposal sheet https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102) — applied byte for byte by #458 (mail), #459 (public) and #460 (app). "Never invent copy" now reads: the master drafts from v2 and the spec, the owner approves the sheet, implementers apply it byte for byte; a new key is owner-owed again and travels the same route. — owner, 2026-09-10 (PROCESS §2.3, §4)
~~2026-09-10  Pending, owner: `INFERENCE_PRICE_BOOK.nano` (20 / 125 ¢ per MTok) prices a model nobody buys — both tiers resolve to `claude-haiku-4-5` — so every nano call is ledgered at a fifth of its cost and `CAPS.FREE_C` is computed from a price that does not exist. The owner rules: price the row at Haiku's rate, or choose a real cheaper model. — master, #455 adjacent 2 (DATA-COSTS, Inference)~~  **Superseded — superseded 2026-09-11 — the nano row is priced at Haiku's rate.**
~~2026-09-10  Queue order is product impact, ruled by the owner after the velocity audit (production served `TODO(copy)` on every public route while 205 PRs merged in six days): (1) the approved copy on every screen, (2) the UI suite complete as the approved artifacts draw it — daisyUI components, the charts (GrowthLine, RivalSparkline, driver bars), the token set, (3) the free scan complete end to end on production, (4) sign-up, payment and auth, (5) the paid dashboard including onboarding and the deep pass, (6) CMS and automation. Nothing from a later phase is dispatched while an earlier phase has open issues, except work already in flight; the master keeps `state/queue.txt` in that order. The three copy PRs land serially (one snapshot regeneration each), and an assertion whose only subject is the placeholder state may be deleted rather than retargeted. — owner, 2026-09-10 (PROCESS §7)~~  **Superseded — superseded 2026-09-11 — the value chain in the root README is the queue order.**
2026-09-10  Autopilot is the product. Setup no longer offers Autopilot vs Copilot. The published mode is Autopilot: generate → veto window → publish. Copilot remains an internal transition (explicit approve) used only when a draft is in `needs_attention` or when the customer sets the veto window to 7 days and acts. No setup radio, no pricing bullet, no mail subject may say Copilot. — owner, brief docs/briefs/autopilot-quality-2026-09-10.md §1.1
2026-09-10  Set-and-forget quality is a deriver problem, not an approval problem. A day is filled only by an opportunity that passes readiness (`opportunityReady()`). Unready opportunities never enter `planned`. — owner, brief docs/briefs/autopilot-quality-2026-09-10.md §1.2
2026-09-10  Improve outranks Write. After clustering, the calendar prefers `expand_page` / `answerable_page` / `refresh_page` on an owned URL in the cluster over a new `keyword_page` or `format_page` for that cluster. — owner, brief docs/briefs/autopilot-quality-2026-09-10.md §1.3
2026-09-10  Opportunities are clustered by parent topic before ranking. The calendar unit is one cluster-day, not one keyword-day. Multiple queries that share a parent topic produce at most one Write target. — owner, brief docs/briefs/autopilot-quality-2026-09-10.md §1.4
2026-09-10  `keyword_page` is a residual type. It fires only when the extra gates in §3 of the brief all pass. Volume ≥10/mo alone is not sufficient. — owner, brief docs/briefs/autopilot-quality-2026-09-10.md §1.5
2026-09-10  `format_page` fires only when the missing format is one of the closed demand-bearing formats: comparison, alternative, integration, template. Glossary, changelog, "blog," and "resources hub" do not qualify. — owner, brief docs/briefs/autopilot-quality-2026-09-10.md §1.6
2026-09-10  A new family Earn exists with type `listed_page`. Trigger: a platform or publisher in `PLATFORM_DOMAINS` (or a measured citing domain) names a rival on a query in the market set and does not name the customer. Autopilot action is first-party only: write a citable asset on the customer's domain that those sources could cite. Autopilot never sends outreach mail. — owner, brief docs/briefs/autopilot-quality-2026-09-10.md §1.7
2026-09-10  Autopilot default veto window stays 24h, range 1–7 days. 0 days is removed so a draft always has a veto path. Pause remains one click and instant. — owner, brief docs/briefs/autopilot-quality-2026-09-10.md §1.8
2026-09-10  Empty calendar copy treats emptiness as competence: the system looked, nothing passed readiness or supply. It is never framed as an outage or as ReachKit being stopped unless an account-level stop is actually true (ADR-011 precedence still holds). — owner, brief docs/briefs/autopilot-quality-2026-09-10.md §1.9
2026-09-10  Monday Not working on a cluster suppresses new Write opportunities in that cluster for `CLUSTER_SUPPRESS_WEEKS` (pin 4). Improve of the live URL in that cluster remains allowed. — owner, brief docs/briefs/autopilot-quality-2026-09-10.md §1.10
2026-09-10  Answerability pass may not add question-shaped headings as an objective. It may only reorder existing sections, shorten a first block into 40–320 chars when a question heading already exists, and insert customer-sourced evidence already present in the brief. Numeral stuffing to lift evidenceDensity is a hard-rule failure. — owner, brief docs/briefs/autopilot-quality-2026-09-10.md §1.11
2026-09-10  Hosted destination stays `content.{customer-domain}` for MVP. WordPress posts must be created on a path of the customer's registered domain, never on a ReachKit host. Do not add a shared publishing network. — owner, brief docs/briefs/autopilot-quality-2026-09-10.md §1.12
~~2026-09-10  Owner owes: the UI-SPEC calendar headline "One page a day. Every day." (S14; `calendar.head`, approved under 11a) is rewritten to a key that does not promise a filled grid (copy + UI-SPEC amendment, named in the PR body). — owner, brief docs/briefs/autopilot-quality-2026-09-10.md §1 (owner owes)~~  **Superseded — superseded 2026-09-11 — `calendar.head` is approved as written.**
2026-09-10  Supersedes the 2026-09-06 (#142) 'four values' reading of REQ-057 c8 / REQ-073 c4: mode is no longer a customer-facing value — the pair is veto window, publish time and time zone; `sites.mode` and `publications.mode(approved/autopilot)` remain as data, written by the state machine. — master, brief §1.1/§2
2026-09-10  Identity is on Supabase Auth (owner ruling: "I don't buy or like that we have `auth_links` — this should be wrapped into the Supabase auth system"): sign-in and email-change links are minted by the admin `generateLink` call and mailed only through the product's shell; `/auth/confirm` verifies with `verifyOtp` and sets the `@supabase/ssr` session; the middleware gates `(account)/**` on a server-verified `getUser()`; `users.id` is `auth.users.id`; erasure deletes the `auth.users` row; sign-out everywhere is the admin global sign-out. Supersedes the 2026-09-06 identity ruling (#137: `auth_links` SHA-256, HMAC session cookie, `sessions_valid_from`). Dependency `@supabase/ssr` authorised. Supabase Auth dashboard settings (Site URL, redirect allow-list `/auth/confirm`, OTP expiry 86400 s, Secure email change off, no Supabase mail) are the master's, recorded in DEPLOYMENT. — owner, #468 (PR 492)
2026-09-11  #436's contrast fixes are approved as token changes under the approval gate: the four derived state inks (`--ink-quiet`, `--ok-ink`, `--warn-ink`, `--bad-ink` — each its tone mixed toward `--ink` in oklab at the lowest 5 % step that clears 4.5:1 on every ground it is drawn on, in both themes) and the tinted badge skin (the tone's tint behind the tone's own ink, as the approved set draws `.b-*`); no hue is minted, and a border, bar or chart line keeps its tone. — owner, 2026-09-11 (master session, selector; PR 436, #328)
2026-09-11  Copy approved as written: `record.verification.never.noLiveAddress` = "not checked"; `notice.site-unreadable` = "We couldn’t read this site’s home page, so nothing here could be measured. Check the address and scan again."; `calendar.head` = "Pages go live when one is ready — at most one a day." (supersedes the approved "One page a day. Every day.", brief §8); `landing.step.3.title` = "Pages go live on your domain" (supersedes the approved "One page goes live every day"); `settings.voice.remove-claim` = "Remove {claim}". Applied byte for byte by #516. — owner, 2026-09-11 (master session, selector; #516)
2026-09-11  UI-SPEC is complete on its own (§2.4 interaction states, §2.5 responsive per band, §2.6 icon vocabulary, §2.7 admission rule), and its sixteen open items are ruled (§0): the proposed button, field, switch, option, tag, collapse, calendar and footer states; one motion token `--motion-fast .18s`; the compact band keeps the Workspace nav as one row; every artifact `max-width:1024px` is built as 1023.98 so 1024 is medium; S17 stays tabbed below 1024; 768 joins the layout sweep. — owner, 2026-09-11 (#489, #527)
2026-09-11  The record is split as ruled: 82 of its 250 rows are product rulings and stay (12 of them struck in place as superseded), 40 process rulings become `docs/PROCESS.md` §8, and 128 implementation rulings become `// DECISIONS <date>:` comments in the 90 modules `ARCHITECTURE.md` maps them to. Nothing is deleted: `docs/archive/DECISIONS-full-2026-09-11.md` is the file as it stood. A row quoted by `tests/pins.test.ts` stays here by rule — a ruling the code asserts is a ruling of record. — owner, 2026-09-11 (DECISIONS, PROCESS §8, ARCHITECTURE)

---

## Where the moved rows went

Of the 250 rows this file held on 2026-09-11: **70** are product rulings and are above; **12** were already superseded and are struck above; **40** were process rulings and are now `docs/PROCESS.md` §8; **128** were implementation rulings and are now comments in the 90 modules `ARCHITECTURE.md` maps them to:

- `src/app/(account)/app/_overview/model.ts` — 2 rulings
- `src/app/(account)/app/_session/account.ts` — 1 ruling
- `src/app/(account)/app/_shell/model.ts` — 1 ruling
- `src/app/(account)/app/_shell/nopublish.ts` — 1 ruling
- `src/app/(account)/app/_shell/weeks.ts` — 1 ruling
- `src/app/(account)/app/calendar/empty.ts` — 1 ruling
- `src/app/(account)/app/calendar/month.ts` — 1 ruling
- `src/app/(account)/app/calendar/publishing.ts` — 1 ruling
- `src/app/(account)/app/calendar/store.ts` — 1 ruling
- `src/app/(account)/app/layout.tsx` — 1 ruling
- `src/app/(account)/app/settings/account-actions.ts` — 1 ruling
- `src/app/(account)/app/settings/danger-actions.ts` — 1 ruling
- `src/app/(account)/app/settings/danger-state.ts` — 1 ruling
- `src/app/(account)/app/settings/destination-actions.ts` — 2 rulings
- `src/app/(account)/app/settings/model.ts` — 5 rulings
- `src/app/(account)/layout.tsx` — 2 rulings
- `src/app/(account)/setup/page.tsx` — 2 rulings
- `src/app/(hosted)/resolve-host.ts` — 1 ruling
- `src/app/(public)/page.tsx` — 1 ruling
- `src/app/(public)/privacy/page.tsx` — 1 ruling
- `src/app/(public)/scan/[domain]/_modules/ai-answers.tsx` — 1 ruling
- `src/app/(public)/scan/[domain]/page.tsx` — 3 rulings
- `src/app/(public)/veto/[token]/page.tsx` — 1 ruling
- `src/instrumentation.ts` — 1 ruling
- `src/jobs/client.ts` — 1 ruling
- `src/jobs/lead-nurture.ts` — 2 rulings
- `src/jobs/run.ts` — 1 ruling
- `src/lib/account/billing/access-gate.ts` — 1 ruling
- `src/lib/account/billing/gate.ts` — 1 ruling
- `src/lib/account/billing/portal.ts` — 1 ruling
- `src/lib/account/export/index.ts` — 1 ruling
- `src/lib/account/stripe/client.ts` — 1 ruling
- `src/lib/config/constants.ts` — 5 rulings
- `src/lib/costs/ledger.ts` — 1 ruling
- `src/lib/egress/robots-memo.ts` — 1 ruling
- `src/lib/egress/robots.ts` — 1 ruling
- `src/lib/egress/safe-fetch.ts` — 2 rulings
- `src/lib/generate/index.ts` — 1 ruling
- `src/lib/generate/rules/index.ts` — 1 ruling
- `src/lib/generate/store.ts` — 1 ruling
- `src/lib/llm/index.ts` — 1 ruling
- `src/lib/mail/draft-ready/index.ts` — 1 ruling
- `src/lib/mail/kinds.ts` — 2 rulings
- `src/lib/mail/leads/sequence.ts` — 1 ruling
- `src/lib/market/questions/market-set.ts` — 1 ruling
- `src/lib/market/questions/phrase.ts` — 1 ruling
- `src/lib/market/rivals/derive.ts` — 2 rulings
- `src/lib/measure/drivers.ts` — 1 ruling
- `src/lib/measure/measured.ts` — 1 ruling
- `src/lib/measure/parse.ts` — 1 ruling
- `src/lib/measure/score.ts` — 1 ruling
- `src/lib/measure/text.ts` — 1 ruling
- `src/lib/opportunities/pass.ts` — 1 ruling
- `src/lib/opportunities/verdicts/index.ts` — 2 rulings
- `src/lib/opportunities/winnability/band.ts` — 1 ruling
- `src/lib/presentation/generated/index.ts` — 1 ruling
- `src/lib/presentation/place/index.ts` — 1 ruling
- `src/lib/publish/daily/index.ts` — 1 ruling
- `src/lib/publish/daily/sites.ts` — 2 rulings
- `src/lib/publish/destinations/health/index.ts` — 2 rulings
- `src/lib/publish/destinations/store.ts` — 1 ruling
- `src/lib/publish/destinations/wordpress/adapter.ts` — 1 ruling
- `src/lib/publish/machine/guards.ts` — 2 rulings
- `src/lib/publish/machine/index.ts` — 1 ruling
- `src/lib/publish/machine/table.ts` — 1 ruling
- `src/lib/publish/record/index.ts` — 1 ruling
- `src/lib/publish/render/markdown.ts` — 1 ruling
- `src/lib/publish/settings/index.ts` — 2 rulings
- `src/lib/publish/types.ts` — 3 rulings
- `src/lib/publish/verify/coverage.ts` — 1 ruling
- `src/lib/publish/verify/index.ts` — 1 ruling
- `src/lib/scan/domain.ts` — 1 ruling
- `src/lib/scan/removal.ts` — 1 ruling
- `src/lib/scan/report.ts` — 5 rulings
- `src/lib/scan/run.ts` — 1 ruling
- `src/lib/scan/stages.ts` — 1 ruling
- `src/lib/scan/weekly/index.ts` — 1 ruling
- `src/lib/vendors/dataforseo/labs.ts` — 1 ruling
- `src/ui/components/Btn.tsx` — 2 rulings
- `src/ui/components/Card.tsx` — 1 ruling
- `src/ui/components/Table.tsx` — 1 ruling
- `src/ui/components/custom/index.ts` — 1 ruling
- `src/ui/idiom/CardHead.tsx` — 3 rulings
- `src/ui/layout/layout.css` — 1 ruling
- `src/ui/layout/shell.css` — 1 ruling
- `src/ui/layout/surface.css` — 1 ruling
- `src/ui/tailwind.css` — 1 ruling
- `src/ui/theme.css` — 4 rulings
- `src/ui/type.css` — 3 rulings
- `tests/ui/layout/checks.ts` — 2 rulings

Nothing was deleted. `docs/archive/DECISIONS-full-2026-09-11.md` is the original file.
