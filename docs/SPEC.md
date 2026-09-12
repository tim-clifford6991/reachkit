# ReachKit — MVP Specification

Rulings live here, in the section they change, dated.
A new ruling is added as one dated line the day it is made; the superseded line is struck in place.
The pre-2026-09-11 log is archived at `docs/archive/2026-09-11/DECISIONS.md`.

One document. The MVP is exactly the nine features below, expanded into the specifics they require;
anything not needed by one of the nine is out of scope (§11). Screens are named as `Canvas: <Screen>`
and live on the Claude Design canvas; artboard links are filled in by the master. UI is daisyUI plus
standard libraries — no custom design system. Every customer-visible sentence is an owner-approved
copy-registry key; a string in quotes below is a registry value, never a proposal.

Authority: this document; within it, the newest dated line wins. Pinned numbers live in `src/lib/config/constants.ts` and are stated once. Today: 2026-09-12.

## §0 Definitions

| Term | Meaning |
|---|---|
| **SEO** | Google organic findability of the customer's own domain for its market's questions — rankings, indexed pages, technical health. |
| **GEO** | Generative-engine findability: whether ChatGPT, Google AI Mode and Google AI Overviews name the customer, rather than a rival, when a buyer asks the market's questions. |
| **Discoverability Score** | The one 0–100 number combining both. `Score = round(∛(Foundations × Answerability × Presence))`, where `Presence = max(1, √(SearchPresence × AIPresence))` — SearchPresence is the SEO half, AIPresence the GEO half, and each factor is 0–100. Foundations is technical health (access gates open × clarity signals present); Answerability is how directly pages answer the market's questions, floored at 1. Four bands by lower bound: invisible 0 · hard-to-find 25 · findable 50 · dominant 75. One factor that could not be measured nulls the whole score — no partial score is ever computed. |
| **Market** | The category the scan measures for a domain, correctable by the customer; it fixes the questions, the rivals and the volumes. |
| **Site profile** | What ReachKit has read of the customer's own site: the page inventory (URL, title, h1, purpose), the site name, its products and claims, and a brand-voice summary. Built during the free scan from up to 100 pages and refreshed weekly; it grounds every draft, every link and the technical scan (2026-09-12). |
| **Rival** | A domain that answers the market's questions in Google's top ten or is named in an AI answer; at most five are tracked per site. |
| **Question** | One buyer search from the market's twelve biggest, phrased as a buyer asks it — the unit both SEO and GEO are measured over. |
| **Opportunity** | One evidenced work item with a type and a family. **Write** — a page that does not exist (answer, comparison, format, residual keyword). **Improve** — an owned URL that under-performs (expand, make answerable, refresh). **Fix** — an access gate or technical fault (§9). **Earn** — a source names a rival and not the customer; the answer is a first-party citable asset on the customer's own domain, never outreach (2026-09-10). |
| **Asset** | What one day publishes: a new post, a new page, or an update to an existing page. One asset a day at most. |
| **Veto window** | The time a finished draft waits, visible and stoppable, before it publishes. Default 24 h; range 1–7 days; there is no zero window. |

## §1 Landing and marketing pages

**User gets**
- A landing page whose one action is scanning their domain — one field, no account, no payment.
- Plain answers to why AI answers matter, what ReachKit does, and how to start, beside a specimen of the real product.
- A 16:9 video block with a play control and one written line.
- One price on `/pricing`: €49 a month, VAT included, cancel in one click.
- Privacy, terms and imprint one click away from every public page.

**Screens** `Canvas: Landing` · `Canvas: Pricing` · `Canvas: Legal page` · `Canvas: Not found`

**Rules**
- Exactly one text input and one submit control anywhere on the landing; no sign-in or payment is asked before submitting.
- Any written form of a domain — scheme, `www`, path, letter case — reaches one report address; a malformed one keeps the visitor here with the typed text intact and one line naming what is wrong.
- The hero h1 is 46 px; the video block renders whether or not the asset exists.
- Every further call to action brings the one field into view with the cursor in it.
- One plan only: no tiers, seats, annual variant or add-ons; `landing.step.3.title` = "Pages go live on your domain".
- Every public page carries the same header (brand · Sign in · one solid CTA) and footer (brand, rights line, removal address, Product, Legal).
- The offer is one component, rendered on the report and on `/pricing`, differing only in where Start goes (2026-09-06).

**Mail** —

**Done when**
- `Example.com`, `https://www.example.com/pricing` and `EXAMPLE.COM` all land on the same report address.
- `/pricing` states €49 per month and that VAT is included, and offers exactly one control that begins checkout.
- `/privacy`, `/terms` and `/imprint` are each reachable in one click from the landing footer.
- The landing shows the video frame and its written line, and every secondary CTA scrolls to the one field.

## §2 Free scan for any URL

**User gets**
- A scan of any domain with no account and no payment.
- Named stages with elapsed times while it runs — no spinner, no percentage, no countdown.
- A permanent public report address: close the tab, come back, same report.
- Score, band, the one factor holding it down, an AI-answers card, a Google-search card, the technical issues (§9), the complete DIY method, and one finished first-page proposal.
- The full first page mailed to them on request.

**Screens** `Canvas: Scan progress` · `Canvas: Free report` · `Canvas: Report — incomplete` · `Canvas: Report — unreadable site`

**Rules**
- One free scan spends at most 12¢ of data and inference; it is a lead magnet, and waste on it is not permitted.
- The pass finishes inside its own 50 s ceiling under a 60 s platform limit, targeting 40 s, and outlives the HTTP response so a closed tab still gets a stored report.
- A re-scan of the same domain inside 7 days serves the stored report and spends nothing; a failed scan cools down for 24 h; bounds are 5 scans per IP per hour, 1 in flight per IP, 200 a day.
- A factor that was cut off shows "—" and no band word, with one line per unmeasured driver saying why; measured cards still render and offer "Retry this part".
- A home page that cannot be read ends the pass unreadable: `notice.site-unreadable` = "We couldn't read this site's home page, so nothing here could be measured. Check the address and scan again."
- Report pages are `noindex` for ever and in no sitemap; nothing on the report is blurred or payment-locked.
- Measurement is US Google in English, stated in one unconditional, non-dismissible line; the measured market category may be corrected once, within 7 days.
- The report header strip carries the three driver mini-bars with their `n/10` values; driver values are shown nowhere else (2026-09-08).
- The twelve questions list the search text only — no per-question volume and no market-total footnote (2026-09-03).
- A market correction re-runs on cached AI answers, buys no fresh ones, and says so on the card (2026-09-03).
- **The scan builds the site profile**: it reads up to 100 pages of the customer's site, found from the sitemap and internal links, and stores the page inventory (URL, title, h1, purpose ∈ pricing / about / features / product / blog / contact / legal / other), the site name, its products and claims, and a brand-voice summary (tone, person, vocabulary, claims to keep, claims to avoid). Bounded: 100 pages, one run per scan, inside the existing egress caps and the 12¢ ceiling; refreshed on the weekly pass (2026-09-12).

**Mail** Free-scan lead nurture sequence (§10): `report`, `first-page` / `first-page-unavailable`, `nurture` ×3.

**Done when**
- A stranger reaches a scored report from the landing with no account, and the same address shows the same report a day later.
- A site whose home page cannot be read says so and shows no score, no rivals and no invented numbers.
- The ledgered cost of a production free scan is at most 12¢, and the pass ends inside 50 s.
- The report URL returns `noindex` and appears in no sitemap.
- Submitting an email on the report delivers the full page, and `free-page.submit` = "Email me the full page".

## §3 Stripe payment and authentication

**User gets**
- Checkout on Stripe's own page at €49 a month, tax inclusive, with no account, form or password beforehand.
- Country collected for records and a VAT number they may leave empty.
- A sign-in link in their mail the moment payment succeeds.
- Sign-in later with an email address alone — there is no password.
- Card, invoices, receipts and cancellation in Stripe's portal, reached from Settings; cancel in one click.

**Screens** `Canvas: Sign in` (idle · sent · expired) · `Canvas: Settings — Billing` · Stripe-hosted checkout and portal (not on the canvas)

**Rules**
- One tax-inclusive €49/month price; the live Stripe Price is asserted against the pinned spec at boot and a mismatch refuses to serve.
- The account is created by the payment webhook, never by a signup form; a second payment from the same address buys no second subscription and says so.
- Magic link only: no password field, no social sign-in. A link lasts 24 h and issuing a new one spends every older link.
- The sign-in screen answers in writing on the same screen, with identical wording and timing whatever the address's state, revealing nothing about who has an account.
- ReachKit renders no billing value it computed: the plan and the price are ours, everything else is read from Stripe.
- Cancelling states the exact date access ends and that export stays available with no end date.
- Account routes are gated on a server-verified user; sign-out everywhere is a global sign-out.
- Buying with no report behind it completes on the same terms and asks for the site address afterwards.
- Deleting an account writes a tombstone at once and purges within 30 days (2026-08-31).
- A danger-zone action offers export first and unlocks its control only once the customer has typed the words the screen prints, compared trimmed and case-insensitively (2026-09-07).

**Mail** Onboarding sequence (§10): `magic-link`, `account`, `setup-reminder`. Retention/win-back (§10) covers failed payment and cancellation.

**Done when**
- A Stripe test-mode payment creates the account and delivers a working sign-in link, with no form filled before payment.
- There is no password or social-sign-in control anywhere in the product.
- An expired, spent or unknown link lands on sign-in with one line offering another.
- Settings shows the plan and €49 and links to Stripe's portal for card, invoices and cancellation.
- Cancelling names the exact end date; access is refused the day after it.

## §4 Protected dashboard

**User gets**
- Overview as the first screen after sign-in; the navigation offers Overview, Calendar and Settings and nothing else.
- Whether the gap is closing: the Discoverability Score with its change and band, AI answers as `n/12` against a goal, pages published.
- How rivals' lines are moving beside their own.
- What is live this week and when the next page publishes.
- At most two things that need them, with a count of anything left over.

**Screens** `Canvas: Overview` · `Canvas: Overview — week 0` · `Canvas: Settings`

**Rules**
- Every headline number carries its change, its goal or its denominator — never bare.
- Nothing is recomputed for display: the screen reads the stored Monday measurements and the draft and publication rows.
- The trend is the trailing 12 weeks; goals are pinned (AI answers 6/12, score 50, pages 30).
- At most two items appear in "Needs you"; the sidebar states the next publish time, and the Calendar item shows a waiting count only when something waits.
- Before the first Monday the screen is week 0: no week count, "—" in the tiles with one line each, one chart point, and nothing presented as a measurement of the domain.
- When ReachKit stopped its own work the screen says so and gives a resume date or promises none, naming no cap, vendor or system detail.
- Only the listed settings are changeable; no control over measurement, spend or model choice appears anywhere.
- The customer sets the veto window, the publish time and the time zone; mode is data the state machine writes, never a customer-facing value (2026-09-10).

**Mail** The `weekly` digest (§10) is this screen's mail twin; viewing the dashboard triggers nothing.

**Done when**
- Signing in lands on `/app`, and the navigation offers exactly three destinations.
- Every number on the screen shows a delta, a goal or a denominator.
- A paid account before its first Monday shows no score, no trend and no invented rival.
- Reaching `/app` with no session lands on sign-in, not on an error.

## §5 User onboarding

**User gets**
- Three decisions, once, after payment, on one screen with one submit.
- The competitors the scan found, pre-filled and each removable, up to five, with a field to add their own.
- The market category the scan measured, editable, and the twelve buyer questions it derives.
- A publishing destination: their own site under a subdomain label they choose (`blog`, `content`, …), served white-label by ReachKit after one CNAME — or their WordPress.
- The voice ReachKit read from their site, shown and editable before anything is written.
- A named-stage wait of about three minutes, then their first page.

**Screens** `Canvas: Setup` · `Canvas: Setup — no report` · `Canvas: Setup waiting` · `Canvas: Settings — Publishing` (WordPress connect)

**Rules**
- Three decisions plus the site address; one action finishes setup. No wizard steps, no confirmation screen, no engine settings.
- Up to five competitors; a sixth is refused with the limit stated. A rival that is not a domain, is unreachable, is the customer's own domain or is already chosen is refused in one written line.
- Submitting with no market is refused in one written line.
- Both destinations are required product: hosted is the default because it needs no third-party credential; WordPress sits beside it and may be connected later.
- WordPress connect asks three fields — site address, WordPress username, application password — and never echoes the password; a refusal is the destination's own health state redrawn on the card, never a vendor error or a form-shaped sentence.
- ~~Hosted serves nothing until `content.{domain}` points at the CNAME target shown; the record appears as soon as the site address is known.~~ (superseded 2026-09-12)
- **Own CMS is white-label on the customer's subdomain** (2026-09-12): the content is stored on ReachKit and served at `<label>.<customer-domain>` once the customer adds one CNAME — exactly like a Webflow or Ghost custom domain. Nothing of ReachKit is visible to a visitor or a crawler on those pages. The customer chooses the label in step 3 of onboarding; on save the app adds the hostname to the project's domain list through the Vercel Domains API with our server-only token, the certificate is automatic once the CNAME resolves, and settings shows "live" or "waiting for DNS". Host-based routing serves that customer's pages. Our deployment shape does not change.
- **The site profile is confirmed here** (2026-09-12): the brand-voice summary read from their site is shown and editable at setup and afterwards in settings; the page inventory and site name are shown as read.
- No duration is promised on the waiting screen — it names the step, shows liveness at least every 30 s, and never shows a percentage.
- A degraded pass still releases the customer with one sentence naming what could not be measured; ten minutes releases them regardless, and they never return to the waiting screen.
- The waiting screen shows five named stage rows; the deep pass's six internal stages map onto those five (2026-09-09).

**Mail** Onboarding sequence (§10): `setup-reminder` at 24 h, 72 h and 168 h while setup is unfinished; `draft-ready` when the first draft enters review.

**Done when**
- A paid account finishing setup reaches the app with a first draft and takes no further action.
- A sixth competitor is refused with the limit named; a removed suggestion stays removed.
- ~~The DNS record is shown once the site address is known, and hosted publishing reports "not live" until it resolves.~~ (superseded 2026-09-12)
- The CNAME for the chosen label is shown once the site address is known; saving adds the hostname to the project, the destination reads "waiting for DNS" until it resolves and "live" after, and the served page carries no ReachKit mark (2026-09-12).
- The brand-voice summary is shown at setup, an edit to it persists, and settings shows the same text (2026-09-12).
- A WordPress connect with a wrong application password shows the destination's health state and no vendor text.
- Leaving setup unfinished produces the reminder mail at 24 h.

## §6 Weekly deep scan and targeting

**User gets**
- A re-measurement every Monday on their own clock: score, AI answers, Google positions, and rivals' movement.
- A verdict on every page published so far — did it move, or not.
- The next three things ReachKit will do, chosen for them.
- An honest empty hand when nothing is worth doing, instead of filler.

**Screens** `Canvas: Overview` (growth chart, rivals, this week) · `Canvas: Calendar` · `Canvas: Day panel — why this page`

**Rules**
- The weekly pass is triggered hourly and fires on each site's own local Monday at 06:00 local — "Monday 06:00 UTC" is not the trigger.
- Opportunities are clustered by parent topic before ranking; the calendar unit is one cluster-day, not one keyword-day, and several queries sharing a parent produce at most one Write target.
- Improve outranks Write: expand / make answerable / refresh on an owned URL in the cluster is preferred over a new page for that cluster.
- Supply is the cap. A day is filled only by an opportunity that passes readiness; unready opportunities never become planned work, and the calendar is never padded.
- A Monday verdict of "not working" on a cluster suppresses new Write opportunities in that cluster for four weeks; Improve of the live URL in it stays allowed.
- A weekly pass spends at most 40¢ per site; at a cap it degrades with a stated reason and never throws, and money already spent is always ledgered.
- A week that measured nothing says so; a missing value omits its row rather than repeating last week's.
- A published page has four terminal verdict states — verdict, not judgeable, not measured, no week yet — and none merges into another (2026-09-01).
- A residual keyword page fires only when every extra gate passes; volume ≥ 10/mo alone is never sufficient (2026-09-10).
- A format page fires only for a missing comparison, alternative, integration or template; glossary, changelog, blog and resources hub never qualify (2026-09-10).

**Mail** Weekly digest sequence (§10): `weekly`, subject "Monday: what moved this week".

**Done when**
- A site whose local Monday has passed shows a new measurement date and a delta on every measured number.
- A week that could not measure a value omits that row in both the screen and the mail.
- A cluster judged not working publishes no new page for it the following week.
- When supply runs out the calendar shows empty days with a written cause, not padded ones.

## §7 Content calendar with daily actions

**User gets**
- One calendar: what is planned, in review, live, or waiting on them — and why each date is what it is.
- At most one page a day; `calendar.head` = "Pages go live when one is ready — at most one a day."
- The whole page to read before it publishes, with its grounded fact marked and its source named.
- 24 hours to stop it, from the mail, without signing in.
- Markdown editing with a live preview, and Markdown or HTML to copy out.
- Every published asset linked into their own site, so the work compounds.

**Screens** `Canvas: Calendar` · `Canvas: Day panel` · `Canvas: Draft` · `Canvas: Draft edit` · `Canvas: Veto page` · `Canvas: Hosted page`

**Rules**
- Autopilot is the only mode: generate → veto window → publish. No mode choice exists on any screen, in any mail, or in the pricing.
- The veto window defaults to 24 h with a range of 1–7 days; there is no zero window, so every draft has a veto path. `mail.draftReady.autopilotWindow` = "Publishes {publishesAt} unless you say no."
- At most one publish a day and eight a week. The day's asset is one of three kinds: a new post, a new page, or an update to an existing page.
- **Cross-asset and site linking**: every published asset links out to the site's own pages — pricing, about, features — where those exist, and to the earlier published assets in its cluster; a link known to lead nowhere is not written.
- **Drafting and linking use the site profile** (2026-09-12): every asset links to the relevant real pages from the inventory — pricing, about, features, product pages — and to the earlier ReachKit pages in its cluster; drafts follow the stored brand-voice summary; no fact that is not on their site or in the profile is written.
- The draft is Markdown from a declared subset; no raw HTML is passed through, every href is vetted, and one serialiser produces the screen, the copy-as-HTML and the copy-as-Markdown so the three cannot disagree.
- One automatic regeneration before review; a draft that has entered review is never regenerated. Edits save with no save action, and nothing unsaved publishes.
- Publication is one call to the destination, idempotent per draft and destination, on the customer's own domain; at +24 h it is verified reachable, indexable, in a sitemap and AI-readable.
- An empty date carries exactly one written line naming its cause, chosen over a closed cause set with fixed precedence and framed as competence: ReachKit's own stop outranks every other true cause, "nothing worth publishing" is a proven arm and never the fallback, and it is only called a stop when an account-level stop is true (2026-08-31).
- A published WordPress post carries two marks — the invisible idempotency marker and the visible findability stamp; neither does the other's job (2026-09-01).
- The +24 h check has three outcomes; "could not be confirmed" asserts nothing, is final, and never merges with "no page found" (2026-09-01).
- The public veto link has four arms — expired and not-in-review share one line — and redeems on GET once, idempotently (2026-09-06).
- An answerability pass may only reorder existing sections, shorten a first block to 40–320 characters where a question heading already exists, and insert evidence already in the brief; it adds no question-shaped headings and never stuffs numerals (2026-09-10).
- The MVP paid service ends at a page published on the customer's own domain (2026-09-11).

**Mail** `draft-ready` when a draft enters review (stoppable), `published` with its +24 h checks (stoppable); veto reminders in the retention sequence (§10).

**Done when**
- Following the link in a draft-ready mail stops that page with no session, and the next day's page is unaffected.
- An untouched draft publishes exactly at the end of its window, live on the customer's own domain.
- A published page carries links to the site's own pages and to an earlier published asset in the same cluster.
- No two assets publish on the same date, and the calendar shows at most one page per day.
- An empty day states which kind of empty it is and offers no publish or approve action.

## §8 Complete email system

**User gets**
- Every mail in one shell that says why it arrived and how to stop it.
- A plain-text twin of every mail.
- Three switches for the stoppable kinds, plus one link that stops all follow-up to their address.
- No marketing and no newsletter — mail arrives only on the occasions §10 names.
- A mail that still arrives when there was nothing to report, saying so.

**Screens** `Canvas: Mail shell` · `Canvas: Settings — Notifications` · `Canvas: Opt-out`

**Rules**
- A section with no measured value is absent — no zero, dash or placeholder; a measured zero prints zero.
- No generated prose in any mail: every sentence is an approved registry key, and an unwritten key sends nothing at all.
- Address-wide opt-out and per-kind toggles are two mechanisms and never merge; unstoppable kinds still arrive with every switch off.
- A sequence touch that missed its window is dropped for ever; a re-delivery starts nothing; an opted-out address still receives the page it asked for.
- Opting out stops every remaining touch of the running sequence, and sequences for that address's other domains too.
- A search volume quoted outside the report carries the US-Google-English line.
- An owner-owed key renders the visible `TODO(copy)` marker on a screen, with no exceptions; in mail it sends nothing at all (2026-09-07).
- Mail sends from `hello@reachkit.app` (2026-09-10).

**Mail** All four sequences — the body of this feature is §10.

**Done when**
- Every kind in §10 delivers to a real inbox with a plain-text alternative and a working stop control.
- With all three switches off, the magic link and the account mails still arrive.
- One click on the opt-out link stops every further follow-up for that address.
- No delivered mail contains a sentence that is not an approved copy key.

## §9 Technical site issues

**User gets**
- The technical faults the scan found, in plain words, with a count and a severity — on the report, on the dashboard, and in mail.
- Who fixes each one: themselves in ten minutes, or ReachKit.
- Copyable fix lines for the ones they can do, working whether or not they ever pay.
- The same list re-checked every Monday, so fixed things drop off it.

**Screens** `Canvas: Free report — technical issues` · `Canvas: Overview — needs you` · `Canvas: Mail shell`

**Rules**
- **Scope: the crawled pages** (2026-09-12) — the checks run across the pages the site profile crawled (up to 100, §2), not only the pages the pass already holds; duplicate titles, broken internal links and slow pages are counted over that set and the count names it. This supersedes §12 ruling 5.
- The checked set: missing or duplicate page title · missing or duplicate meta description · `noindex` on a page that should be indexed · no sitemap · slow pages · broken internal links · a layout not usable on a phone · missing structured data · AI readers blocked in `robots.txt`.
- Each issue states a count, one severity word from the closed set (Critical · Worth fixing · Nothing to fix) **and** a who-does-it badge ("Free fix · 10 min" / "ReachKit writes" / "ReachKit rewrites") — the two are one card's two facts, not alternatives.
- The robots fix lines are copyable verbatim and name only the pinned AI-reader list (GPTBot, ClaudeBot, OAI-SearchBot, Claude-SearchBot, PerplexityBot, Google-Extended); they block no general search crawler.
- A home page that tells every reader not to index it is a measured zero for Foundations, not an unmeasured factor.
- An issue ReachKit can fix becomes a Fix opportunity on the calendar and outranks new writing for that cluster.
- A check that could not be run is absent with one line naming why — never reported as "no issues found".
- Nothing here is blurred or payment-locked; the complete method is on the free report.

**Mail** `report` carries the counts; the `weekly` digest carries what changed since last Monday; a site condition that would stop a page from being found rides the `published` mail.

**Done when**
- A site with a `noindex` home page, no sitemap and a blocked AI reader shows all three as separate named issues with counts.
- Each issue names who fixes it and, where the customer does, gives lines that paste in unchanged.
- Fixing an issue removes it from the next Monday's list and from the dashboard.
- A check that could not be run says so instead of reading zero.
- The same issue set appears on the report, on the dashboard and in the weekly mail with the same counts.

## §10 Email system detail

| Sequence | Trigger | Mails (name · when) | Stops when |
|---|---|---|---|
| **Onboarding** | Stripe payment succeeds | `magic-link` · at once on provisioning, and on every sign-in request · `account` (payment received / account not open yet) · when nobody has signed in · `setup-reminder` · +24 h, +72 h, +168 h while setup is unfinished · `draft-ready` · when the first draft enters review | Setup is finished and the first draft is in review; the magic link is never stoppable |
| **Free-scan lead nurture** | A visitor submits an email on the free report | `report` · when the scan finishes and an address is known · `first-page` · as soon as the full draft is written (`first-page-unavailable` if none could be, or writing or delivery failed) · `nurture` 1 / 2 / 3 · +24 h, +72 h, +168 h from capture | The address subscribes, or opts out, or the third mail has sent — capped at three; a touch that missed its window is dropped for ever; a sequence never starts more than 7 days after capture |
| **Weekly digest** | The site's own local Monday re-measure completes | `weekly` · after each Monday pass: score delta, AI-answers delta, page verdicts, next three · `published` · +24 h after each page goes live, with its four checks | The customer turns the weekly or published switch off, or access ends; an unmeasured week still sends, saying there was nothing to report |
| **Retention / win-back** | Any of four: 7 days without a sign-in while pages publish · a draft in review with under 6 h of its window left · Stripe reports a failed payment · the subscription is cancelled | Inactivity nudge · at 7 days idle, once per idle spell · veto reminder · at 6 h left on an unopened draft · payment-failed notice · on each Stripe dunning attempt · cancellation confirmation · at once, naming the exact date access ends · hosting-end reminder · 7 days before and on the day access ends · win-back · +30 days after access ended, once | The customer signs in · the draft resolves · payment succeeds · the subscription resumes. The win-back mail sends once and never repeats; an opted-out address receives none of it. Copy for this sequence does not yet exist in the registry — owner-owed (§12 Q6) |

## §11 Not in the MVP

| Left out | Reason |
|---|---|
| Perplexity as a fourth engine | ~0.56¢ an answer for a verdict ChatGPT, AI Mode and AI Overviews already give. |
| Search Console connection | Owner postponed it until users give feedback; nothing in the nine needs it. |
| Locale derivation (site `lang` + TLD → country) | US Google in English is one constant; deriving locale changes measurement, volumes and rivals. |
| CMS destinations beyond hosted + WordPress (Webflow, Shopify, Ghost, Framer, Notion) | A stranger reaches week-one value on their own domain with these two alone. |
| Multi-site, seats, approval workflows, comments | Shape, not sequence — none is on the value chain of the nine. |
| Settings that tune the engine, feature flags, ~~a crawler or sitemap reader~~ (superseded 2026-09-12: the site profile reads up to 100 pages from the sitemap and internal links, §2) | Caps, cadences, question counts and model choices are code constants, not customer controls. |
| A purpose-built custom-hostname service (multi-tenant TLS at scale) | Custom hostnames go on our own project through the Vercel Domains API; a purpose-built custom-hostname service is the answer when the domain count nears the plan cap (2026-09-12). |
| Accessibility certification pass to WCAG 2.1 AA (axe gate, keyboard walk) | Parked, not closed; the ruled contrast tokens are separate and already approved. |
| Copilot mode | Abolished, not deferred: Autopilot is the product; no screen, mail or price list may say Copilot. |
| Stripe Tax | Accepted compliance debt: €49 is tax-inclusive and country + VAT ID are collected so the records exist. |
| A second score, images in drafts, per-customer hosted templates, the Standing module | Not needed by any of the nine; each is one more reading on a screen that already has enough. |
| A blog, case studies, an about page, a second landing variant, an A/B test, the demo asset | Marketing work outside this specification; the landing renders its written video line instead. |
| Backlinks, local and per-country SERPs, outreach of any kind | Out of the product's shape — every asset is first-party, on the customer's own domain. |
| Authenticated report removal | Reports are `noindex` for ever and in no sitemap; removal is a written request to the named address. |
| AI Keyword Data; a larger model on the draft step | A nicer question derivation and prose nobody has complained about, at real cost. |
| LLM-written UI text or mail prose | Every ReachKit sentence is an owner-approved registry key. |

## §12 Choices made

1. **What targeting chooses each Monday.** *Ruled*: it chooses **clusters**, not keywords — one cluster-day per publishing day, at most one Write target per cluster, and Improve of an owned URL in the cluster preferred over a new page. The alternative — choosing per keyword — publishes several near-identical pages for one topic and is a materially worse product. (2026-09-11)
2. **How many daily actions.** *Ruled*: exactly **one asset a day**, at most eight a week, and an honest empty day when nothing passes readiness. The alternative is relaxing readiness to fill every date, which pads the calendar with work the measurement did not justify. (2026-09-11)
3. **Do updates to existing pages publish automatically, or only after veto?** *Ruled*: the **same 24 h veto window as a new page** — one rule, one mail, one veto link, and the customer's live page never changes unannounced. The alternative (updates publish at once) is faster but silently edits pages they already have. (2026-09-11)
4. **Does onboarding let the customer edit the twelve questions, or only the market category?** *Ruled*: **category editable, the twelve shown read-only** — they are derived from the category and real volumes, and editing them breaks week-over-week comparability. The alternative is letting up to three be removed, which needs a re-derivation and a second measurement baseline. (2026-09-11)
5. ~~**How far does the technical-issues scan look?** *Ruled*: **only pages already held** — home, pricing, and the pages the deep pass measured. Duplicate titles, broken internal links and slow pages need more than one document, and a crawler is explicitly out of scope, so the free report reports these across the pages it read and says so. The alternative is ruling a bounded crawl in, which is a scope addition. (2026-09-11)~~ (superseded 2026-09-12, ruling 9)
6. **Retention / win-back copy does not exist.** *Ruled*: the master drafts the sheet (inactivity, veto reminder, payment failed, cancellation, hosting end, win-back) from the approved copy plus this document, the owner approves it, implementers apply it byte for byte. Until then those mails cannot send at all. (2026-09-11)
7. **What is our own CMS, exactly?** *Ruled*: **content stored on ReachKit, served white-label at `<label>.<customer-domain>` after one customer CNAME** — the Webflow/Ghost custom-domain shape. The customer chooses the label in onboarding step 3; the app adds the hostname through the Vercel Domains API on save, the certificate is automatic, settings reads "live" / "waiting for DNS", and host-based routing serves that tenant. Nothing of ReachKit is visible to visitors or crawlers on those pages. The alternative — a shared ReachKit-branded host — publishes on our domain, not theirs, and the MVP ends at a page on the customer's own domain (§7). (2026-09-12)
8. **What does ReachKit know about the customer's site?** *Ruled*: a **site profile** — up to 100 pages read from the sitemap and internal links on the free scan and refreshed weekly, storing the page inventory with a purpose per page, the site name, products and claims, and a brand-voice summary; confirmed at onboarding with the voice editable, and editable in settings. The alternative — reading only the pages the measurement pass held — cannot link to a real pricing page or write in the customer's voice. (2026-09-12)
9. **How far does the technical-issues scan look?** *Ruled*: **across the crawled pages, up to 100** — not only the pages already held; ruling 5 of 2026-09-11 is superseded. Duplicate titles, broken internal links and slow pages need more than one document, and the site profile's crawl (ruling 8) already reads them inside the free scan's cap. (2026-09-12)

<!--
Sources.
Owner ruling 2026-09-11 (the nine features, "intuitively expanded into the specifics required around them";
  the seven-document corpus rejected; UI is daisyUI + standard libraries; screens from a Claude Design canvas).
Prior drafts, fact-checked 2026-09-11: corpus-drafts/01-product.md §1–§6 (journey, S1–S20, mail kinds, price book,
  non-goals), 02-system.md §1–§5, §7 (stack, modules, thirteen tables, eight jobs, vendors, caps, egress caps),
  05-decisions.md (newest row wins: 2026-09-10 Autopilot-only, readiness, clustering, Improve outranks Write,
  veto 1–7 days, hosted stays content.{domain}, two free-pass ceilings, Supabase Auth; 2026-09-11 approved copy
  incl. calendar.head, nano at Haiku's rate, daisyUI, hero h1 46px, video block stays, MVP ends at a published
  page on the customer's own domain), 06-later.md §1–§5, §7 (deferral reasons and triggers).
Code, origin/main: src/lib/config/constants.ts — CAPS (FREE_C 12, DEEP_C 150, WEEKLY_C 40, DRAFT_C 45,
  DAILY_PRODUCT_C 5000), PRICE_BOOK, TIMING (reportTargetS 40, reportCeilingS 50, platformCeilingS 60,
  progressHeartbeatS 30, deepReleaseMin 10), BATTERY (QUESTIONS 12, COMPETITORS_MAX 5), VETO (defaultHours 24,
  maxDays 7 — minDays still reads 0 in code against the ruled floor of 1 day), RATE_LIMITS (1/day, 8/week),
  NURTURE_H [24,72,168], NURTURE_MAX_TOUCHES 3, SETUP_REMINDER_OFFSETS_H [24,72,168],
  SEQUENCE_START_DEADLINE_DAYS 7, SCORE_BAND_BOUNDS, SCORING, GOAL_VALUES, OVERVIEW_TRAILING_WEEKS 12,
  OVERVIEW_ALERT_CAP 2, SERP_LOCATION, FREE_BOUNDS, FREE_RESCAN_WINDOW_D 7, FAILURE_COOLDOWN_H 24,
  CORRECTION, SEVERITY_THRESHOLDS, AI_READER_AGENTS, WEEKLY_DUE_HOUR_LOCAL 6, DRAFT_DUE_HOUR_LOCAL 18,
  HOSTED_SUBDOMAIN_LABEL "content", OWN_DOCUMENT_MAX_BYTES 6 MB, SIGNIN_LINK_TTL_H 24, GENERATION.regenerations 1.
  src/lib/measure/{score,drivers,parse,partition}.ts — the score composition, Presence's geometric mean, the
  limiting factor, OnPageFacts, the input→factor map. src/lib/opportunities/types.ts — the eight types in
  write/improve/fix. src/lib/publish/destinations/{hosted,wordpress}/** — the two destinations.
  src/lib/mail/kinds.ts — the eleven kinds and which three are toggleable.
  src/lib/presentation/copy/keys/{report,mail,settings,calendar}.ts — every quoted string above.
  supabase/migrations/** (46 files) — the thirteen tables the features read and write.
Expansions in this document that the owner's nine did not spell out, for review: the technical-issue check set
  and its severity/doer pairing (§9); cross-asset and site linking targets (§7) — no such code exists today;
  the retention/win-back sequence's six kinds and their triggers (§10) — no such copy exists today; the three
  asset kinds sharing one veto rule (§7, open question 3); the twelve questions shown read-only at setup
  (§5, open question 4); the bound on how far the technical scan looks (§9, open question 5).
-->
