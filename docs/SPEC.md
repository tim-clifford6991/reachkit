# ReachKit — MVP Specification

The nine features below are the product. Anything not needed by one of them is out of scope (§11).
UI is `docs/DESIGN.md` (daisyUI, Recharts, lucide) — this file does not describe pixels, artboards or canvas.
Every customer-visible sentence is a key in `src/lib/presentation/copy/keys/`. A missing sentence is drafted and shipped, never `TODO(copy)`; the owner corrects the wording (§12, 2026-09-16). A mail carrying the marker still sends nothing.
Pinned numbers live in `src/lib/config/constants.ts`. Newest dated line in a section wins. Pre-2026-09-11 log: `docs/archive/2026-09-11/`.

## §0 Terms

**Goal (owner, 2026-09-16)** Users pay ReachKit to generate content that improves their SEO and GEO ranking. Each day the system decides the best content for that business — from what it knows of the business, the posts the site already has, and what its rivals rank for — and either publishes a new post or updates an existing page (§7). Everything is right-sized to the business’s own presence — its footprint (§6): never compete for searches outsized for the site. A new site that ranks for almost nothing — ReachKit itself — still gets winnable, small targets, not an empty calendar. Every change serves this goal.

| Term | Meaning |
|---|---|
| **SEO / GEO** | Google organic findability of the customer’s domain / whether ChatGPT, Google AI Mode and AI Overviews name them. |
| **Discoverability Score** | One 0–100 number. `Score = round(∛(Foundations × Answerability × Presence))`, `Presence = max(1, √(SearchPresence × AIPresence))`. Each factor 0–100. Bands: invisible 0 · hard-to-find 25 · findable 50 · dominant 75. An unmeasured factor nulls the whole score — no partial score. |
| **Market** | Category the scan measures; the customer may correct it. It fixes the twelve questions, the rivals and the volumes. |
| **Site profile** | Page inventory (URL, title, h1, purpose), site name, products/claims, brand-voice summary. Up to 100 pages from sitemap + internal links. Free scan stores inventory + name; voice is paid-only, shown at setup (2026-09-12). |
| **Rival** | Domain in Google’s top ten or named in an AI answer; at most five per site. |
| **Question** | One of the market’s twelve biggest buyer searches the site can win — right-sized per §6 (2026-09-16). |
| **Footprint** | How many keywords the site itself ranks for, and each rival’s count. The measure of a business’s presence that right-sizing scales with (§6, 2026-09-16) — not the score’s Presence factor. |
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
- Fail closed (2026-09-16, #792): a free-scan bound or the day's spend that cannot be read refuses the scan with the paused line and logs the step; nothing is spent on a count nobody has. Every paid call reads the day's spend again first; an unreadable total skips the call and the pass holds.
- 2026-09-16  (#826, owner) The free first page is written once per report and stored with its scan. Every lead on that report is mailed the same stored page; a second lead costs nothing. A page the hard rules refused is recorded once, and later leads get the "no page to write" notice without another attempt.
- 2026-09-17  (#835, owner ruling) The free scan walks the same seed ladder as the deep pass (§6 thin markets): up to 3 extra seeds — head term, then vocabulary — plus the ranked rows already bought, with the 50 → 20 → 10 steps, stopping as soon as it has questions, all inside the 12¢ cap and the free time budget. The extra seeds are paid from the twelve’s share of the cap: a seed is bought only while that share still holds it and a search for every question already selected.

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
- 2026-09-16  (#753, owner: fix the cause and the class) The browser's own time zone is written on the first signed-in screen while the site has none, and never over one already set. A founder who finished setup and whose site has no zone lands on `/setup/zone`, which says why and opens `/app` once the zone is known — never back on `/setup`. No two account screens redirect to each other.
- 2026-09-16  (#793, owner; supersedes the week-0 line above) The deep pass is week 0. Before the first Monday the score, AI answers and rivals’ lines show what the deep pass measured, labelled as the starting measurement with the date weekly readings begin; a section the deep pass did not measure keeps the dash and its first-due line. From the first Monday the weekly scans take over, and the first deltas compare against week 0. The growth chart’s weekly line and week count stay weekly-only.
- 2026-09-17  What a page is optimising for is shown (owner walk, #867). The founder is told, on the page they edit and on the day they open: the target search and how it is asked, its searches a month, its keyword difficulty beside the ceiling this site is judged against (§6), its winnability band, and where each of §6.2's three answer engines stood on that question. Every one of those is a measurement the pass already made, copied onto the opportunity at creation and rendered through the unmeasured arm where it was never read — never a zero and never an estimate. The two dimensions are named in the product's plain words — **Search** for what a page is written to rank for, **AI answers** for the engines — and "SEO" and "GEO" are never printed as jargon. The Overview says which engine its AI-answers number is counted from (Google's AI Overview, §6.2) and names the engines measured beside it, and states what this week's pages aim at by naming the searches, never a count. No new tile and no new screen.
- 2026-09-17  Category measures now, and says so (owner decision, #866): a **changed** market category starts a pass at once (§6, #837) and every line about it says that, with roughly what it costs — never a Monday effective date. A refused start (a pass under way, the day's bound reached) says which. Saving the category already being measured spends nothing and starts nothing, and says so. A **domain** change is unchanged: it lands at the weekly pass and keeps its dated line. Settings also offers a standalone *measure again now* — the same pass, the same daily bound, the same refusals and loader — so forcing one never means editing the category. A pass records the category it measured under on its stored report, which is what lets a category change be seen as pending and be seen cleared when a pass adopts it; a calendar day held by a pending category change names the measurement it waits on, not a date.
- 2026-09-17  Stopped means stopped (owner, #841): “ReachKit stopped its own work” is stated only for a real stop — the kill switch is engaged, or the day’s spend ceiling is reached. A pass that ended degraded or failed is not a stop; a pass that found too little market is the market-too-small state (§6), never “ReachKit stopped”.

**Done when** Sign-in lands on `/app` with three nav items. No session on `/app` goes to `/signin`. A paid account before its first Monday shows no invented score or rivals.

## §5 Onboarding

**User gets** Three decisions on one screen after payment: rivals (pre-filled, removable, add their own, max five), market category (editable) with the twelve questions read-only, publishing (hosted subdomain label they choose, or WordPress). Brand voice shown and editable. Then straight into the app, where the deep pass and the first page arrive in the background (2026-09-16).

**Rules**
- One submit finishes setup. No wizard, no engine settings.
- Sixth rival refused with the limit named. Invalid rival (not a domain, unreachable, own domain, duplicate) refused in one line. Empty market refused in one line.
- Hosted is default (no third-party credential). WordPress sits beside it and may be connected later (site, username, application password — password never echoed; refusal is the destination health state, not a vendor sentence).
- Hosted is white-label at `<label>.<customer-domain>` after one CNAME (2026-09-12). Save adds the hostname via Vercel Domains API. Settings: “live” / “waiting for DNS”. No ReachKit mark on those pages.
- Voice is paid-only, built at setup, editable there and in settings (2026-09-12). Inventory and site name are shown as read.
- The profile crawl honours `robots.txt` per path and its `Crawl-delay` (capped at 1 s), holds at most 8 MB in total, and aborts reads still in flight at its time budget (2026-09-12).
- Waiting names the step, is live at least every 30 s, no percentage, no promised duration. Degraded pass still releases with one sentence; ten minutes releases regardless.
- 2026-09-16  Owner (#777, supersedes the waiting screen above): one submit releases the founder straight into `/app`. The deep pass is a background job; while it runs the app names its current step (same rules: live at least every 30 s, no percentage, no promised duration) and refreshes itself when the pass and the first draft finish. A lost enqueue is retried, never silently dropped (#782).
- 2026-09-16  First draft vs never pad (#777): the first draft is written from the deep pass’s best ready opportunity — never from a filler. The pass uses the thin-market steps in §6, so a new or small site still gets one. If it still ends with no ready opportunity, there is no first draft: the pass records *market too small* and the app tells the founder why in place of the draft.
- 2026-09-16  The first draft and the evening drafts are written and wait in review while the destination is still pending — hosted DNS not yet resolving, WordPress not yet connected. Publishing still waits for a destination that works.
- 2026-09-16  The deep pass's `scans` row is claimed when setup accepts the founder's address; a stated market's suggested rivals (`competitors_domain`) are spent against that row, and the deep pass adopts it rather than inserting a second. A free upgrade's suggestions are its report's own rivals, bought for nothing.
- 2026-09-17  Setup always offers rivals (owner walk, #838). The rivals the site's own pages name are offered first, for nothing, on either market. An inferred market whose report found no rivals falls back to `competitors_domain` on the founder's own domain — the stated market's call, spent against the claimed row under `DEEP`, bounded by `TIMING.suggestCeilingS`, refused by the kill switch. The screen opens seeking and the card asks; only a vendor that answers none, fails or is refused settles on "none found".
- 2026-09-17  (#855, owner) A first pass a ceiling stopped (`time_ceiling`, `spend_ceiling`) is measured again automatically: the maintenance tick that re-sends a lost onboarding pass re-measures a site whose newest deep pass ended on a ceiling, as a #837 re-measure under its bound, within 24 h of setup. Until a pass finishes, the side panel, Overview and the Calendar's supply line say the market is still being measured — never *market too small*, never a broader category. The lines are drafted; the owner corrects the wording.
- 2026-09-16  Settings shows the hosted CNAME record (name, type, value) for as long as the host is waiting for DNS — the same record setup showed, not only once at setup (#754). A calendar date held by a setting names the one setting that holds it; a host waiting for its CNAME points at that record. Those lines are drafted (#759); the owner corrects the wording.
- 2026-09-16  Owner ruling (#757): the founder can complete the CNAME and verify it from the setup page, before submitting. The check is keyed on the hostname — `<label>.<the site's own stored address>`, derived on the server, never a host the browser names — attaches it to the project (idempotently) and reports what the vendor says; submit then records the state. Settings offers the same check beside the record for a host waiting for DNS.
- 2026-09-16  A check answers one of three: live, waiting for DNS, or could not ask (no token bound, or the vendor did not answer) — never the second in place of the third. It asks now rather than waiting out the hourly re-check, at most once per `DESTINATION_HOSTNAME_CHECK_FLOOR_S` per site; a press inside that says when the founder may ask again and shows no answer as new. An address changed on screen but not submitted is not checked. A label checked and not submitted stays on the project's domain list. The lines are drafted (#759); the owner corrects the wording.
- 2026-09-17  (#840, from the owner's walk) A press inside the floor counts down to zero on screen with the button disabled, then re-enables it. A deployment with no verification bound answers *not configured* — its own line, which does not tell the founder to try again, asks nothing and spends no floor — kept apart from a vendor that did not answer. The same block serves `/setup` and Settings. The lines are drafted; the owner corrects the wording.
- 2026-09-16  Owner ruling (#760): where the record is added is derived, not generic. An NS lookup on the zone of the site's own stored address (no vendor API, no credential, bounded, never blocking the record) names the provider where the nameservers are one of a short closed list, names the nameserver itself where they are not, and falls back to the generic line where nothing answers. The Cloudflare proxy line shows only when the provider is Cloudflare. The lines are drafted; the owner corrects the wording.
- 2026-09-17  DNS guidance a founder can follow (owner, #856). The record block on `/setup` and in Settings is one guide chosen from the #760 NS lookup — Cloudflare, GoDaddy, Namecheap, Squarespace (the `googledomains.com` nameservers), Route 53, Vercel, else generic: numbered steps, the record as a table in that provider's field labels with a copy button per value, a link to the provider's DNS page where one exists, and Name stated as exactly what that field takes (the host less its zone). Cloudflare gets one proxy instruction — DNS only, the grey cloud — with its reason in one line. Check connection asks public DNS first, with no vendor credential: record found and pointing here, found and pointing elsewhere (the target shown; a proxy's address counts as elsewhere), or no record yet; a resolver that did not answer says so and is never "not yet". The Vercel domain verification stays the second step; a deployment without it bound says so only as that step, in words that follow what DNS confirmed. Where the vendor says live, only the live line shows. The lines are drafted; the owner corrects the wording.
- 2026-09-17  Owner (#839): the setup section showing what was read of the site is called *Your voice*. A site that reads gets a voice: the paid pass's voice call has room for a whole answer, and the deep pass seeds the founder's voice from it unless they wrote their own. Where no voice has been read yet (the free scan reads none), the voice box is empty and editable under a line inviting the founder to describe it — never a blank section. The line is drafted; the owner corrects the wording.

**Done when** Finishing setup reaches `/app` at once; the first draft follows in the background, or the founder is told the market was too small. A sixth competitor is refused. CNAME for the chosen label is shown; destination reads waiting then live. Voice edit persists in settings. Wrong WordPress password shows destination health, no vendor text.

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
- 2026-09-15  Earn readiness (owner): a `listed_page` is ready only when the site’s own pages hold a passage of its asset’s kind — `comparison_table`: from a pricing, features or product page; `integration_page`: from a page whose URL, title or h1 matches the integration words that chose the asset; `original_data_page`: a passage carrying a numeral. Otherwise `no_grounding_fact`.
- 2026-09-16  Right-sizing law (owner, #777): a target is offered only if it is winnable *for this site’s presence*. The bar scales with the site’s own footprint and its rivals’ (§0): a site that ranks for little gets small, long-tail and AI-answer targets and never head terms; larger searches are admitted only as its own presence grows. This applies to the free report’s twelve questions, the deep pass and every weekly pass.
- 2026-09-16  Thin markets (owner defaults, #777; the owner may override on review). A pass that is short of twelve questions reads the market this way, stopping as soon as twelve survive:
  - Seeds, in order: the confirmed category → a 2–3 word head term derived from it → the site profile’s vocabulary. At most 3 extra suggestion purchases per pass, inside that pass’s own cap.
  - 2026-09-17  Head term (#836): derived from the category’s noun phrase, not only the words before its first connective. Where fewer than two words come before the connective (“SEO and content marketing software”), the head term is the category’s last 3, then 2, content words (“content marketing software”). It is never the category itself and never one word.
  - Candidates are pooled from suggestions, the rivals’ ranked keywords and the site’s own ranked keywords, de-duplicated before selection. Ranked keywords already bought for sizing are reused, not bought again.
  - Volume floor steps 50 → 20 → 10 /mo, only as far as needed to reach twelve questions. Each question records the step it came from, and that step is the “min” readiness checks it against.
  - A paid pass (deep or weekly) ends with at least one ready opportunity, or records *market too small* and tells the founder why. Too few questions is never a silent empty calendar.
  - 2026-09-17  (#835, owner) The free scan uses this ladder too, stopping as soon as it has questions rather than twelve, inside its own 12¢ cap (§2).
- 2026-09-17  Cold-start right-sizing (owner walk, #858; drafted defaults, the owner may correct the numbers). Volume alone is not a difficulty signal: the vendor's keyword difficulty (`keyword_properties.keyword_difficulty`, 0–100) is read on every suggestion (and on a ranked row where the vendor carries it) at no extra cost, and suggestions are bought against it. A search is offered only at or under the site's difficulty ceiling, `30 + 10 × log10(1 + own ranked)` (Winnable at or under `15 + 10 × log10(1 + own ranked)`), at most 100; a row the vendor gives no difficulty is read on volume. The demand ceiling's cold-start floors are 300/mo (Reach) and 100/mo (Winnable), were 1000 and 200; the multiples stay 10× and 2×. While that ceiling is at its floor, a search of 3+ content words scores 2× its intent score, so specific long-tail searches carrying the profile's words lead the twelve. The ladder steps volume down; it never raises either ceiling.
- 2026-09-17  Rivals are right-sized (owner walk, #858). A rival banded far is never presented as the site's rival: a paid pass keeps a domain it holds a far band for out of the report's rivals and lists near before middle before unsized; setup offers `competitors_domain`'s competitors banded by the counts that call returns (near, then middle, then unsized; never far — all far is "none found"); Overview draws the reachable tracked rivals as rows and names the far ones on one secondary line as market leaders, with the one control to change who the site is measured against, and says first when none is within reach. Every tracked rival is still measured. The free report buys no rival size (§6.4 never-list and its 12¢ cap, owner 2026-09-17), so its rivals carry no band and no reach claim.
- 2026-09-16  Never pad (2026-09-11) still holds under these rules: the seeds, pool and volume steps widen which searches are measured; every other readiness gate stands unchanged.
- 2026-09-16  Market too small, told to the owner (#796): a site’s first (deep) pass mails the owner at once; weekly passes are one owner digest per Monday listing their scan ids, sent once that Monday has ended in every zone — never one mail per site per week.
- 2026-09-17  Measure again now (owner ruling, #837): no founder waits for Monday. A paid pass that is short widens at once (the steps above). If it still ends *market too small*, the app offers 2–3 broader categories derived from the site's stored profile (its category's head term and shorter tails, the profile's category, vocabulary and offering type) and a field for the founder's own words — in the side panel's notice, and on Overview and Calendar when they are empty for that reason. Picking one saves it as the site's category and re-measures right away as a background deep pass (`scan/run` on a fresh claimed row) with the side-panel loader, whose first draft fills the calendar. A category changed in Settings re-measures right away too. Bound (drafted default, the owner may override): one pass at a time per site (a started pass counts as under way for 30 minutes), and at most 3 deep passes started per site in any 24 hours, the onboarding pass included; a refused press says why in one line and starts nothing. No customer-visible line points at Monday for a thin market.
- 2026-09-17  Paid pass ceiling (#855): a paid pass (deep, weekly) is bounded in time by its own ceiling, `TIMING.paidPassCeilingS` (240 s), read between calls — never the free report's 50 s — inside the job invocation its measurement runs in (`jobsCeilingS`, 300 s). Its twelve SERPs are bought at once. It sizes its rivals and scores its twelve itself; ranked rows served from the cache window keep the date they were measured. A pass a ceiling stopped did not finish reading its market and is never *market too small* (§5).
- 2026-09-16  Verdicts (owner, #795): every published page gets a verdict every Monday. Its acceptance test is recorded on the page when it is published — the opportunity’s own, else top 20 for its search. Its target search is read every week whether or not it is among the twelve, from the site’s own ranked keywords the pass already buys; a week that could not read them says *not measured* for that page. A search is never “no longer tracked”, and a page retired for that reason before this rule is judged again.

**Done when** After local Monday, every measured number has a new date and a delta. Empty days show a written cause, not filler. A “not working” cluster publishes no new page for it the next week.

## §7 Calendar and daily publish

**User gets** One calendar of planned / in review / live / waiting. At most one page a day. Whole draft to read, 24 h to stop it from the mail without signing in. Markdown edit with live preview. Published assets link into their own site.

**Rules**
- Autopilot only: generate → veto → publish. No Copilot, no mode picker, on no screen and in no mail (2026-09-11).
- Veto default 24 h, range 1–7 days, never zero. Same window for updates as for new pages (2026-09-11).
- At most one publish a day, eight a week. Kinds: new post, new page, update of an existing page.
- Fail closed (2026-09-16, #792): when the day's or week's publishes cannot be counted, the page is held, not published, the log says why, and the next tick asks again.
- Every asset links to real inventory pages (pricing, about, features, product) and to earlier assets in its cluster. No link known to go nowhere. Drafts follow the stored voice. No fact that is not on their site or in the profile (2026-09-12).
- Markdown subset only; one serialiser for screen, copy-as-HTML and copy-as-Markdown. One auto-regeneration before review; never after. Edits save with no save button.
- The brief picks facts from the customer’s own pages by index and writes none; no fact picked, no draft. Each opportunity type has one fixed outline. The answerability pass may only reorder sections, shorten a first block to 40–320 characters under a question heading, and insert facts from the brief. A draft that claims a test, carries a byline, date or case study, adds a question heading, states a number no fact holds, or does not open with an answer is stopped.
- Publish is one idempotent call to the destination on the customer’s domain. At +24 h: reachable, indexable, in a sitemap, AI-readable.
- Public veto link redeems on GET once. MVP paid service ends at a page on the customer’s own domain (2026-09-11).
- Opportunity status (2026-09-15): a written draft queues its opportunity; a vetoed draft dismisses it.
- 2026-09-17  Target choice (owner walk, #858): a Write or Earn target's competition band reads the search's own keyword difficulty where the vendor gave one — the measurement of that very top ten — beside the top ten's ranked counts, taking the better of the two; above the difficulty ceiling (§6) the target is outsized for every type. So a cold-start site's long-tail question whose small domains nobody sized is still a winnable or reach target, never an unmeasured one.
- 2026-09-16  Draft edits (owner, #789): the editor saves the title, the body and the meta description. Every save re-runs the hard rules and the claim check on the edited text. An edit that breaks a rule is still saved, the page says so, and the page is held from publishing on every route until a later save passes. The state and the veto window do not change.
- Stopped drafts (2026-09-16, #788): a date keeps one draft row across every attempt. A draft the hard rules stop for the last time moves to needs_attention with the rules that stopped it. Regenerate writes that date's draft again on the next hourly draft tick.
- 2026-09-16  (#813) A step that could not run after the date's row exists (the claim check, answerability, any later step) ends the same way: after the one automatic second attempt, the row moves to needs_attention naming the step. No second row; Regenerate restarts it.
- 2026-09-17  Stopped draft counts as queued (owner, #833): a draft resting in needs_attention after its rules or a step stopped it keeps its opportunity queued, so that opportunity fills no other day and the near-duplicate check counts the draft as queued. The founder resolves it from the draft: Regenerate rewrites the one row; Skip releases the opportunity to open.
- 2026-09-16  Daily decision (owner, #777): each day chooses between a *new post* (Write/Earn) and an *update of an existing page* (Improve/Fix), whichever ranks higher for this site. Update candidates are the site’s own pages — its ranked URLs and crawled inventory, not only the home page — matched to the market’s questions; both sides are right-sized per §6. An empty day is still a stated cause, never filler.
- 2026-09-16  (#781) An update is offered only where the site's destination can deliver it: otherwise it is not ready (`destination_cannot_address`) and never fills a day. A hosted destination updates a page ReachKit published there — a new version at the same address, served in place of the old one and listed once; a page outside ReachKit is not updatable there. WordPress keeps updating any page of the site.
- 2026-09-17  (#855) A `fix_page` the site's destination cannot deliver — every one on a hosted-only site — is never the day's work and never supply: it is stored not ready (`destination_cannot_address`), no draft is written from it, and supply depth does not count it. It fills a day only where a WordPress destination can deliver it.
- Hosted index (2026-09-16): the root of a hosted host lists every live page, newest first, with a search; a site with nothing published says so instead of answering 404.
- 2026-09-17  Plan horizon (owner, #857): the calendar plans from today to the day before the next weekly pass — through that week's Sunday in the site's own zone, and on a Monday through the coming Sunday whether or not the pass has run. Only those dates carry a planned page or an empty day's account. A past date shows what happened on it (published, stopped, skipped, held) and nothing else. A date after the horizon carries no planned page and no line; one quiet marker (“Planned after Monday’s scan”) stands on its first date. A supply state is stated once, at the top of the calendar, and never repeated per cell or in the day panel; a law cause (ReachKit stopped) is stated on the first empty date in the horizon only. The daily draft job agrees: it writes one draft, for tomorrow, from the current pass's ranking — so Sunday evening's draft for Monday is written before Monday's pass, and nothing further ahead is ever drafted.

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
- 2026-09-17  Owner ruling (#836): jobs delivered to production’s frozen 11 Sep build are fixed by deploying main to production.
- 2026-09-16  Copy: `TODO(copy)` is never a shipped state for a customer-visible string — the marker renders as itself, so an unwritten key is visible breakage. A missing sentence is drafted in the registry’s voice and shipped, every new or changed string is named in the PR body, and the owner corrects the wording (#759).
