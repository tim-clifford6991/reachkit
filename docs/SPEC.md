# ReachKit — MVP Specification

The nine features below are the product. Anything not needed by one of them is out of scope (§11).
UI is `docs/DESIGN.md` (daisyUI, Recharts, lucide) — this file does not describe pixels, artboards or canvas.
Every customer-visible sentence is a key in `src/lib/presentation/copy/keys/`. Do not invent copy; `TODO(copy)` on screens, send nothing in mail.
Pinned numbers live in `src/lib/config/constants.ts`. Newest dated line in a section wins. Pre-2026-09-11 log: `docs/archive/2026-09-11/`.

## §0 Terms

| Term | Meaning |
|---|---|
| **SEO / GEO** | Google organic findability of the customer’s domain / whether ChatGPT, Google AI Mode and AI Overviews name them. |
| **Discoverability Score** | One 0–100 number. `Score = round(∛(Foundations × Answerability × Presence))`, `Presence = max(1, √(SearchPresence × AIPresence))`. Each factor 0–100. Bands: invisible 0 · hard-to-find 25 · findable 50 · dominant 75. An unmeasured factor nulls the whole score — no partial score. |
| **Market** | Category the scan measures; the customer may correct it. It fixes the twelve questions, the rivals and the volumes. |
| **Site profile** | Page inventory (URL, title, h1, purpose), site name, products/claims, brand-voice summary. Up to 100 pages from sitemap + internal links. Free scan stores inventory + name; voice is paid-only, shown at setup (2026-09-12). |
| **Rival** | Domain in Google’s top ten or named in an AI answer; at most five per site. |
| **Question** | One of the market’s twelve biggest buyer searches. |
| **Opportunity** | Write (missing page) · Improve (owned URL) · Fix (technical) · Earn (first-party citable asset on their domain — never outreach). |
| **Asset** | What one day publishes: new post, new page, or update to an existing page. At most one a day. |
| **Veto** | Finished draft waits, visible and stoppable, before it publishes. Default 24 h, range 1–7 days, never zero. |

## §1 Landing and marketing

**User gets** One field, no account: type a domain and scan. Why AI answers matter, what ReachKit does, how to start. One price on `/pricing`: €49/month, VAT included, cancel in one click. Privacy, terms and imprint one click from every public page.

**Rules**
- Exactly one text input and one submit on the landing. No sign-in or payment before submit.
- Any written domain (scheme, `www`, path, case) reaches one report; a malformed value stays here with the typed text and one error line.
- One plan only: no tiers, seats, annual or add-ons.
- Same header (brand · Sign in · one solid CTA) and footer (brand, rights, removal address, Product, Legal) on every public page.
- 2026-09-15  No header exceptions: `/scan/{domain}`, `/veto/{token}`, `/opt-out/{token}` and `/signin` use the same header. The report keeps its copy-link beside the CTA. Footer still on every public route.
- The offer is one component, used on the report and on `/pricing`; only the Start target differs.
- A 16:9 video block with a play control and one written line, whether or not the asset exists. Secondary CTAs scroll to the field.
- 2026-09-14  The header CTA is outline on every public page; each screen’s own action is its only solid button (supersedes “one solid CTA” in the header and ruling 2b’s two solids on the landing).

**Done when** `Example.com`, `https://www.example.com/pricing` and `EXAMPLE.COM` hit the same report. `/pricing` states €49/month VAT included and has one checkout control. `/privacy`, `/terms` and `/imprint` are in the landing footer.

## §2 Free scan

**User gets** A scan of any domain with no account. Named stages with elapsed times (no spinner, %, countdown). A permanent public report: score, band, limiting factor, AI-answers card, Google-search card, technical issues (§9), the DIY method, one first-page proposal. Full first page mailed on request.

**Rules**
- Cap 12¢ and 50 s (target 40 s) under a 60 s platform limit. The pass outlives the HTTP response.
- Same domain inside 7 days: stored report, spend nothing. Failed scan: 24 h cool-down. 5 scans/IP/hour, 1 in flight/IP, 200/day.
- Cut-off factor: "—" and no band word; one line per unmeasured driver; measured cards still render with “Retry this part”.
- Unreadable home page: no score, no rivals, no invented numbers; one line saying the home page could not be read.
- Reports are `noindex` forever, not in the sitemap, nothing blurred or paywalled.
- Measurement is US Google in English, stated in one always-visible line. Category may be corrected once within 7 days; correction reuses cached AI answers and says so.
- Twelve questions: search text only — no per-question volume.
- Driver mini-bars `n/10` live in the report header only.
- Scan builds the site profile (up to 100 pages) inside the same 12¢ cap; weekly pass refreshes it (2026-09-12).

**Done when** A stranger gets a scored report from `/` with no account; the same URL is the same report a day later; a production free scan is ≤ 12¢ and ≤ 50 s; an unreadable site says so and shows no score.

## §3 Pay and sign-in

**User gets** Stripe Checkout at €49/month tax-inclusive, no account beforehand. Country for records; VAT number optional. After payment the browser lands on setup, signed in. Magic-link mail is for later visits. Later sign-in is email only. Card, invoices, cancel in Stripe’s portal from Settings.

**Rules**
- One live Stripe Price; boot refuses a mismatch.
- Account is created by the payment webhook, never a signup form. A second payment from the same address buys no second subscription and says so.
- Magic link only: no password, no social. Link lasts 24 h; a new one spends older ones. Sign-in copy is identical whatever the address, revealing nothing about who has an account.
- 2026-09-14  Stripe success URL is this deployment’s `/auth/checkout`, which signs the payer in and sends them to `/setup`. Cancel returns to the page they started from. Never a host this process does not name.
- Plan and price are ours; every other billing number is read from Stripe.
- Cancel names the exact date access ends; export stays with no end date.
- Account routes are server-gated. Sign-out is global.
- Buying with no report still completes; the site address is asked afterwards.
- Delete: tombstone at once, purge within 30 days (2026-08-31). Danger-zone unlocks only after the customer types the words on the screen (2026-09-07).

**Done when** A Stripe test-mode payment on this deployment creates the account and lands the payer on `/setup`, signed in, with no form before pay. No password control exists. Settings shows €49 and links to Stripe’s portal. Cancel names the end date.

## §4 Dashboard

**User gets** `/app` after sign-in. Nav: Overview, Calendar, Settings only. Score with change and band, AI answers `n/12` against a goal, pages published, rivals’ lines, this week, next publish time, at most two “needs you” items.

**Rules**
- Every headline number has a change, a goal or a denominator.
- Display reads stored Monday measurements and draft/publication rows — nothing is recomputed for the screen.
- Trend is 12 trailing weeks. Goals: AI answers 6/12, score 50, pages 30.
- Week 0 (before first Monday): "—" in tiles, one chart point, nothing presented as a measurement.
- If ReachKit stopped its own work, the screen says so and gives a resume date or none — no vendor/cap detail.
- Customer may set veto window, publish time and time zone. Mode is not a customer-facing value (2026-09-10). Autopilot is the only mode.

**Done when** Sign-in lands on `/app` with three nav items. No session on `/app` goes to `/signin`. A paid account before its first Monday shows no invented score or rivals.

## §5 Onboarding

**User gets** Three decisions on one screen after payment: rivals (pre-filled, removable, add their own, max five), market category (editable) with the twelve questions read-only, publishing (hosted subdomain label they choose, or WordPress). Brand voice shown and editable. Then a named-stage wait and the first page.

**Rules**
- One submit finishes setup. No wizard, no engine settings.
- Sixth rival refused with the limit named. Invalid rival (not a domain, unreachable, own domain, duplicate) refused in one line. Empty market refused in one line.
- Hosted is default (no third-party credential). WordPress sits beside it and may be connected later (site, username, application password — password never echoed; refusal is the destination health state, not a vendor sentence).
- Hosted is white-label at `<label>.<customer-domain>` after one CNAME (2026-09-12). Save adds the hostname via Vercel Domains API. Settings: “live” / “waiting for DNS”. No ReachKit mark on those pages.
- Voice is paid-only, built at setup, editable there and in settings (2026-09-12). Inventory and site name are shown as read.
- The profile crawl honours `robots.txt` per path and its `Crawl-delay` (capped at 1 s), holds at most 8 MB in total, and aborts reads still in flight at its time budget (2026-09-12).
- Waiting names the step, is live at least every 30 s, no percentage, no promised duration. Degraded pass still releases with one sentence; ten minutes releases regardless.

**Done when** Finishing setup reaches `/app` with a first draft. A sixth competitor is refused. CNAME for the chosen label is shown; destination reads waiting then live. Voice edit persists in settings. Wrong WordPress password shows destination health, no vendor text.

## §6 Weekly scan

**User gets** Every local Monday: new score, AI answers, Google positions, rival movement, a verdict on every published page, the next three things, or an honest empty hand.

**Rules**
- Hourly tick; fires 06:00 on each site’s local Monday — not “Monday UTC”.
- Cluster by parent topic. One cluster-day, at most one Write per cluster. Improve of an owned URL outranks a new page (2026-09-11).
- A day is filled only by an opportunity that passes readiness. Never pad the calendar (2026-09-11).
- “Not working” on a cluster: no new Write there for four weeks; Improve of the live URL stays allowed.
- Cap 40¢ per site per week; degrade with a stated reason; money spent is always ledgered.
- A week that measured nothing says so. Missing values omit the row, never repeat last week.
- Residual keyword pages need every extra gate, not volume ≥ 10/mo alone. Format pages: comparison / alternative / integration / template only (2026-09-10).
- 2026-09-15  Readiness (owner): a `keyword_page` is ready only when volume ≥ min, the band is `winnable`, intent is commercial or transactional, and no owned URL ranks for it (else Improve); otherwise `keyword_gate`. Parent topic is a mechanical `clusterKey()` of the query’s content words (lower-cased; stop words, brand tokens and trailing `s` removed; sorted and joined) — Improve uses the same key. A grounding fact is at least one passage from the site’s own measured page text; if none, every Write/Earn/Improve row is `no_grounding_fact` and supply is 0. Write order among types: `answer_page` > `comparison_page` > `format_page` > `keyword_page`. A `format_page` is ready only when its query contains comparison / vs / alternative / integration / template.

**Done when** After local Monday, every measured number has a new date and a delta. Empty days show a written cause, not filler. A “not working” cluster publishes no new page for it the next week.

## §7 Calendar and daily publish

**User gets** One calendar of planned / in review / live / waiting. At most one page a day. Whole draft to read, 24 h to stop it from the mail without signing in. Markdown edit with live preview. Published assets link into their own site.

**Rules**
- Autopilot only: generate → veto → publish. No Copilot, no mode picker, on no screen and in no mail (2026-09-11).
- Veto default 24 h, range 1–7 days, never zero. Same window for updates as for new pages (2026-09-11).
- At most one publish a day, eight a week. Kinds: new post, new page, update of an existing page.
- Every asset links to real inventory pages (pricing, about, features, product) and to earlier assets in its cluster. No link known to go nowhere. Drafts follow the stored voice. No fact that is not on their site or in the profile (2026-09-12).
- Markdown subset only; one serialiser for screen, copy-as-HTML and copy-as-Markdown. One auto-regeneration before review; never after. Edits save with no save button.
- The brief picks facts from the customer’s own pages by index and writes none; no fact picked, no draft. Each opportunity type has one fixed outline. The answerability pass may only reorder sections, shorten a first block to 40–320 characters under a question heading, and insert facts from the brief. A draft that claims a test, carries a byline, date or case study, adds a question heading, states a number no fact holds, or does not open with an answer is stopped.
- Publish is one idempotent call to the destination on the customer’s domain. At +24 h: reachable, indexable, in a sitemap, AI-readable.
- Public veto link redeems on GET once. MVP paid service ends at a page on the customer’s own domain (2026-09-11).
- Opportunity status (2026-09-15, master interim, owner to confirm): a written draft queues its opportunity; a vetoed draft dismisses it; needs_attention leaves it queued.

**Done when** The draft-ready mail link stops that page with no session. An untouched draft publishes at window end on their domain. No two assets share a date. An empty day states its cause and offers no publish.

## §8 Mail

**User gets** Mail only on the occasions below, one shell (why it arrived, how to stop it), plain-text twin. Three switches for stoppable kinds plus one address-wide opt-out. No newsletter.

| Sequence | Trigger | Mails | Stops |
|---|---|---|---|
| Onboarding | Payment succeeds | `magic-link` (unstoppable) · `account` · `setup-reminder` +24/72/168 h · `draft-ready` | Setup done and first draft in review |
| Free-scan nurture | Email on the report | `report` · `first-page` (or unavailable) · `nurture` ×3 at +24/72/168 h | Subscribe, opt-out, or third mail. Missed window is dropped. Start within 7 days of capture |
| Weekly | Local Monday re-measure | `weekly` · `published` +24 h after each go-live | Kind switch off, or access ends. Unmeasured week still sends, saying so |
| Retention | Idle 7 days · veto <6 h · payment failed · cancelled | Inactivity · veto reminder · payment-failed · cancellation (end date) · hosting-end · win-back once at +30 d | Sign-in, draft resolves, payment succeeds, resume. 2026-09-15 owner approved the retention/win-back sheet (#568); those mails may send. |

**Rules** Unwritten keys send nothing. Address opt-out and per-kind toggles never merge. Unstoppable kinds still arrive with every switch off. From `hello@reachkit.app`.

**Done when** Magic link and account mail still arrive with all switches off. One opt-out click stops further follow-up. No delivered mail contains a sentence that is not a registry key.

## §9 Technical issues

**User gets** Faults in plain words, with a count and a severity, on the report, the dashboard and mail. Who fixes each (them in ten minutes, or ReachKit). Copyable fix lines on the free report. Re-checked every Monday.

**Rules**
- Checks run across the crawled profile pages, up to 100 (2026-09-12): missing/duplicate title · missing/duplicate meta description · `noindex` on a page that should be indexed · no sitemap · slow pages · broken internal links · not usable on a phone · missing structured data · AI readers blocked in `robots.txt`.
- Severity is Critical · Worth fixing · Nothing to fix. Who-does-it is “Free fix · 10 min” / “ReachKit writes” / “ReachKit rewrites”.
- Severity steps (2026-09-14): a zero is Nothing to fix. A site-wide fault (`noindex` home page, no sitemap, an AI reader blocked) is Critical whenever present. A per-page count is Worth fixing from one page and Critical at 25% of the set it was counted over.
- Slow page (2026-09-14): ReachKit’s own fetch of the page took 3 s or more. A page served from the cache has no timing and is left out of that count’s set.
- Robots fix lines name only the pinned AI-reader list (GPTBot, ClaudeBot, OAI-SearchBot, Claude-SearchBot, PerplexityBot, Google-Extended).
- `noindex` home page is Foundations = 0, not “unmeasured”.
- A ReachKit-fixable issue becomes a Fix opportunity and outranks new writing for that cluster.
- Fix opportunity (2026-09-14): one per crawled page that failed a ReachKit-fixed check, naming every such check it failed; none for a page the hosted destination serves (that template is fixed in the product, not by a day). It ranks just ahead of the first new writing in its cluster; while clusters are not derived, ahead of the first new writing at all.
- Fix delivery (2026-09-14): a metadata-only update — a new title and/or meta description written from the page’s own words, content untouched, through the same veto path. Ready only where the WordPress destination can update the page: its own host, a page with a slug, an SEO plugin for a description. Otherwise the opportunity stands and is not ready. Structured data has no WordPress field and is not ready.
- A check that could not run is absent with one why-line — never “no issues found”. Not paywalled.
- 2026-09-15  Technical-issue titles, the not-run line, and Needs-you issue controls are owner-approved (#716).
- 2026-09-14  Who fixes each check: “Free fix · 10 min” — `noindex` on an indexable page, no sitemap, slow pages, broken internal links, not usable on a phone, AI readers blocked. “ReachKit rewrites” — missing/duplicate title, missing/duplicate meta description. “ReachKit writes” — missing structured data. Copyable lines only where the line is fixed: the viewport meta line (phone), the robots `Sitemap:` line (sitemap), the robots `Allow` records (AI readers).

- 2026-09-14  On the dashboard, “Needs you” holds only the issues the customer fixes (“Free fix · 10 min”), Critical first, after drafts waiting on them; ReachKit’s own rewrites are Fix work, not “Needs you”. Read from the newest stored report (Monday’s, or the deep pass before the first Monday).

**Done when** A `noindex` home, no sitemap and a blocked AI reader show as three named issues. A pasteable fix is on the free report. Fixing one drops it next Monday.

## §11 Not in the MVP

Perplexity; Search Console; locale derivation; CMS besides hosted + WordPress; multi-site, seats, workflows; engine-tuning settings; a custom-hostname platform; WCAG certification pass; Copilot; Stripe Tax; a second score; images in drafts; blog/about/A-B; backlinks/outreach; authenticated report removal; LLM-written UI or mail.

## §12 Still owed by the owner

- Stripe test-mode payment walk on `dev.reachkit.app` (#319), then three live drafts ≤ 45¢ (#321) and a crawled free scan ≤ 12¢ / 50 s (#715).
- Production magic-link walk (#542). WordPress connect walk (#324). Gmail/Apple Mail render (#339).
- Legal imprint: legal entity, address, VAT id still `[[imprint: …]]` placeholders (#335).
- Lift of production freeze when the paying path works on dev.
