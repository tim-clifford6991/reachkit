---
id: BUILD
type: implementation-specification
title: "ReachKit — build specification"
version: 1.2 — living specification, amended by docs PRs
date: 2026-09-09 (first written 2026-08-28)
status: governing — see README.md for what wins where
audience: the agents building it and the owner steering it
sources: MVP.md v2.0 (2026-08-28, pre-repo) · DATA-COSTS.md · the approved screen set docs/design/approved/full-set/ (2026-09-08), which wins over §4 where they differ
---

# ReachKit — build specification

**What this is.** Everything needed to build ReachKit v1, in one file. Product
rules, design system, every screen, every dataset, every formula, the data model,
the jobs, and the build order. Where a judgement call is needed, the ruling is
already written here — build to the ruling, don't re-open it.

**The one-paragraph product.** A founder gives us a URL. We measure how findable
they are — in Google and in AI answers — against competitors they confirm. From
that we derive a ranked list of pages worth publishing, write one per day, and
publish it to a blog on their own domain (or their WordPress) after a 24-hour
veto window. Every Monday we re-measure and show what moved.

---

## 0. How to work on this repo

1. **Design before code, in artifacts.** Any new or visually changed surface is
   first mocked as a Claude artifact (self-contained HTML on the §2 design
   system), approved by the owner, then implemented to match. The approved prototype
   artifact is the visual source of truth for every screen in §4; do not
   re-design what it already settles. The approved prototype is
   `docs/design/approved/full-set/` (UI-SPEC.md, its written form, wins over §4
   where they differ); its parent is the owner's artifact
   `docs/design/approved/reachkit-screen-system.html`. The corpus map is
   `README.md`.
2. **Simplicity is the product.** A person with zero SEO knowledge must
   understand every screen at first glance. If a module needs explaining, it is
   wrong. Meaning over data: every number on screen answers a question the
   customer actually has; anything else is not rendered even if we hold it.
3. **No generated prose in the UI.** LLM output appears in exactly one place:
   draft page content, always labelled. Every sentence in the interface is a
   written string in the codebase. No LLM-written summaries, narrations, or
   insights, anywhere.
4. **Lean data is a law, not a preference.** §6 lists every dataset the product
   is allowed to pull. A vendor call not in that table does not ship. Every call
   goes through the cost seam (§6.5), reads cache first, and respects its
   freshness window. "It's cheap" is not a reason to add a call.
5. **One claim, one home.** Every constant (price, cap, limit, copy string)
   is defined once. Every UI number traces to a stored measurement with a date.

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Matches the existing reachkit.app build |
| Styling | **Tailwind CSS 4 + daisyUI 5** | daisyUI is the component library; theme via §2 tokens |
| Fonts | **Plus Jakarta Sans** (UI) + **JetBrains Mono** (all numerals/data) | `@fontsource`, self-hosted |
| Icons | **lucide-react** | Thin, 2px stroke |
| DB + auth | **Supabase** (Postgres, RLS default-deny, magic-link auth) | `dbAdmin` server-only |
| Payments | **Stripe** Checkout + customer portal + webhook | Pay before account |
| Email | **Resend**, one `sendEmail()` seam, one branded shell | Plain-text alt on every mail |
| Jobs | **Inngest** (or Vercel cron + queue) | Scan runs, daily generation, Monday refresh |
| Search data | **DataForSEO** (Labs, SERP, AI Optimization) | §6 price book |
| Inference | **Anthropic Haiku 4.5** (prose) + a nano-class model (scaffolding) | Behind one `llm()` seam with per-call cost logging |
| Hosting | Vercel; hosted-CMS pages served from an edge route keyed by Host header | §11 |

Repo shape: standard Next.js. `src/lib/` holds the engine (measure, score,
opportunities, generate, publish, costs), `src/app/` the surfaces,
`src/lib/config/constants.ts` **every** pinned number in this document,
`tests/pins.test.ts` asserting them.

**Greenfield (owner ruling, 28 Aug).** Build fresh — this repository, now
`tim-clifford6991/reachkit` (renamed from reachkitv3 on 2026-09-08; v1 and v2
are archived) — exactly to this document. The shipped reachkit.app repo is *reference, not substrate* — its
three-lane plan, day scheduler and score machinery would fight this shape at
every step. Read it for proven patterns (SSRF fetcher, cost seam, Stripe webhook
handling) and reimplement to this spec; copy no file wholesale.

---

## 2. Design system

### 2.1 Tokens

daisyUI 5 theme, expressed as CSS variables. These exact values — they are lifted
from timclifford.dev so the products share a visual family. Three-state theming:
bare `:root` = light; `@media (prefers-color-scheme: dark)` guarded with
`:root:not([data-theme="light"])`; `:root[data-theme="dark"]` for the explicit
toggle. Never define a color only inside a dark block.

```css
:root {            /* light */
  --bg:#f6f6f9; --surface:#ffffff; --sunk:#efeff4; --line:#eaeaf1;
  --ink:#191925; --ink-2:#5e5e73; --ink-3:#9695a8;
  --accent:#5b4be0; --on-accent:#ffffff; --accent-bg:#eeecfd; --accent-line:#ddd8fa;
  --ok:#1f8a6b;  --ok-bg:#e7f6f0;  --ok-line:#d2ede3;
  --warn:#b8722a; --warn-bg:#fff3e6; --warn-line:#fbe1c6;
  --bad:#c0432b;  --bad-bg:#fdece8; --bad-line:#f8d5cd;
  --chart-you:#5b4be0; --chart-rival:#787790; --chart-goal:#b8722a;
  --r-box:14px; --r-field:9px; --r-pill:999px;
  --shadow-card:0 1px 3px rgb(24 24 48/.045);
  --ring-accent:0 0 0 3px rgb(91 75 224/.18);
}
/* dark */
  --bg:#0e1116; --surface:#161a21; --sunk:#11151b; --line:#242a34;
  --ink:#dde3eb; --ink-2:#8e99aa; --ink-3:#69738a;
  --accent:#9bb4ff; --on-accent:#0e1116;
  --accent-bg:rgb(155 180 255/.12); --accent-line:rgb(155 180 255/.28);
  --ok:#7bd8b0; --warn:#e6b45a; --bad:#f0907a;   /* + matching -bg/-line at 12%/28% alpha */
  --chart-you:#5f7ff2; --chart-rival:#5c6579; --chart-goal:#e6b45a;
```

`--r-card` does not exist; every card is `--r-box` 14 (ruling 8a). The token
file of record is `docs/design/approved/tokens.css`; `src/ui/theme.css` carries
exactly it (test). Type ladder below h4: 15 · 13 · 12 · 11.5 · 11 (`--t-body
--t-sm --t-xs --t-explain --t-eyebrow`); nothing renders under 11 px (ADR-093,
ruling 10a). Measures: `--w-read 704 --w-wide 1216 --w-form 420 --w-sidebar 222
--w-day-panel 290`. Breakpoints 640 · 768 · 1024 · 1280.

Map these onto daisyUI's theme slots (`base-100`←surface, `base-200`←sunk,
`base-300`←line, `base-content`←ink, `primary`←accent, `success/warning/error`←
ok/warn/bad) in the Tailwind config so stock daisyUI classes just work.

### 2.2 Components

daisyUI components only — no bespoke widgets. The set the product uses:
`btn` (+primary/ghost/sm/block) · `card`/`card-body`/`card-title` · `badge`
(+primary/success/warning/error/ghost) · `alert` (4 tones) · `stats`/`stat` ·
`tabs` (boxed + bordered) · `table` (+zebra, always inside an `overflow-x-auto`
wrap) · `progress` · `toggle` · `steps` · `join` · `collapse` · `input` ·
`divider` · `kbd`. Custom CSS is allowed only for: the calendar grid, the day
panel, the AI dot-matrix, chart SVGs, and the sidebar — nothing else.

### 2.3 Type and numerals

Headings: Jakarta 700–800, tight letter-spacing (−0.02em), `text-wrap:balance`.
Body 15px/1.55. **Every numeral, date, URL, search query and code-like string is
JetBrains Mono with `tabular-nums`.** Uppercase 10.5–11px eyebrows for section
labels. No emoji anywhere in the product.

### 2.4 Charts

Rules (already validated with a CVD checker — keep these exact pairs):

- **Two chart colors only:** `--chart-you` (accent) and `--chart-rival` (neutral gray). The customer is always the accent; everyone else is context. Status colors (ok/warn/bad) are for state, never for series.
- Every bar/point is **direct-labelled** (name + value) — identity is never color-alone.
- One axis per chart, thin 2–2.5px lines, 3.5–5px endpoint dots with a surface-colored ring, faint gridlines at 2–3 values, hover tooltip on every mark (fixed-position, ink-on-bg, mono).
- Inline SVG, hand-sized viewBoxes — no chart library.
- The chart inventory is closed: growth line (Overview), presence bars (report), AI dot-matrix (report + Overview), rival-gap sparklines (Overview), 7-day week strip (Overview). A new chart form is a design-artifact approval first.
- Headline numerals are JetBrains Mono like every numeral (ruling 7a). Below 640 px the h1 takes the h2 size.

### 2.5 The meaning rules

- Every card leads with **the answer**, not the metric: a verdict chip (`You: 0/12`), a big mono number with its delta badge, or a filled/empty visual. Explanatory text is one short written line, 11–12px, dim.
- Provenance is always visible but always quiet: `measured 28 Aug`, `from: appcues alternative · 1,900/mo` — mono, dim, small.
- Empty/degraded states are designed, never blank: a measurement that failed says so in one written sentence; an empty queue is a success state ("Nothing worth publishing today").
- Red appears only for *the customer's problem being shown to them* (blocked, absent, 0/12). Rival strength is neutral gray, never red — rivals are context, not alarms.
- The number is called **Discoverability Score** wherever it carries a label (ruling 6a).

---

## 3. User journey

Follows the shipped reachkit.app journey — public scan URL, pay-before-account,
magic link — with the publishing product on the paid side.

```
/                     Landing (§4.0, S1)
   ↓ scan
/scan/{domain}        FREE REPORT (public, permanent, shareable; §4.1)
                      · arriving on a shared link starts a scan client-side on
                        first frame; never during server render
   ↓ "Email me the full page"  →  lead captured, full draft emailed (§4.2)
   ↓ "Start ReachKit €49"
Stripe Checkout       No account, no form before payment
   ↓ webhook          provision user + site, queue deep pass, send magic link
/setup                THREE DECISIONS (§4.3): market · competitors · mode+destination
   ↓                  deep pass finishes → opportunities → first draft generated
/app                  Sidebar: Overview · Calendar · Settings (§4.4–4.7)
                      Daily loop: 1 page/day, veto window, publish, verify
                      Monday: full re-measure, movement email
```

`/` Landing — hero with the tagline *"See what AI tells buyers about your market — and write your way in."*, a subline, one field and one solid CTA, beside the product component (the Overview's own cards in a browser frame, on example figures — ruling 5c); then the demo-video block (a frame with a play control and one written line until the asset exists — 4c); then three numbered sections: why-care (with the live AI-answers matrix card), what-it-does (with the This-week card), how-to-start (three Step cards, closing CTA, "Cancel in one click."). Every further CTA focuses the one field (REQ-099 c3).

**Public chrome (ruling 3a).** Header = brand · Sign in (quiet) · one solid CTA (on `/scan/{domain}` the right slot is *Copy link*). Footer on every public page = brand · rights line · removal address · Product (Pricing · Sign in) · Legal (Privacy · Terms · Imprint). Two solid primaries are allowed where the approved set draws them (2b). Public routes: `/` · `/scan/{domain}` · `/pricing` · `/signin` · `/signin/{token}` · `/privacy` · `/terms` · `/imprint` · `/veto/{token}` · `/opt-out/{token}` · `/robots.txt` · `/sitemap.xml` · the 404 and error pages. API routes: `/api/scan` · `/api/scan/{scanId}/progress` · `/api/report/{domain}/correct` · `/api/lead` · `/api/setup` · `/api/setup/domain` · `/api/setup/progress` · `/api/stripe/webhook` · `/api/jobs/{...slug}` · `/api/drafts/{id}/approve` · `/api/drafts/{id}/skip` · `/api/drafts/{id}/veto` · `/api/report/{domain}/removed` · `/api/export` · `/api/danger/{action}`. Account routes: `/setup` · `/setup/waiting` · `/app` · `/app/calendar` · `/app/draft/{draftId}` · `/app/settings`. Hosted: `/hosted-page/{...slug}` · `/hosted-gone`.

The `/scan/{domain}` path and the report → checkout → magic-link → setup order are kept from v2. **Sign-in is Supabase Auth (owner ruling 2026-09-10, #468):** the product mints the link with the admin `generateLink` call and mails it through its own shell (§12); the link lands on `/auth/confirm`, which verifies the one-time token (`verifyOtp`) and sets the Supabase session; account routes are gated by a server-verified `getUser()`. There is no `/signin/{token}` route and no product-minted secret.

---

## 4. Screens

The approved screen set is `docs/design/approved/full-set/` (UI-SPEC.md is its written form; S-ids below refer to it). Match it. Where this section and UI-SPEC.md differ, UI-SPEC.md wins. Per screen: purpose, modules in order, and states.

### 4.1 Free report `/scan/{domain}` — public

Purpose: a stranger sees, in under a minute, that AI recommends rivals and not
them — and leaves with a finished page. Order:

1. **Header strip** (card, S2): domain · date · category · *Not your market?* · eyebrow **Discoverability Score** · score (big mono) · band word badge · one written line naming the driver holding the score down · three driver mini-bars with `n/10` values (ruling 1b; REQ-004 c2 amended) · *Copy link* in the header bar.
2. **Two equal cards, side by side** — never stacked in importance:
   - **AI answers** (source chip: *Google AI answers · {date}*): denominator line ("AI answers appear on {m} of your 12 biggest searches"), dot matrix over those m (rivals' cited rows filled gray, customer's row empty red-ringed, `n/{m}` per row; a no-AI-answer question = muted cell) · divider · **"The 12 questions"** list — each row: `n · "question"` + `not you` badge + provenance line `from: {search} · {vol}/mo · named: {brands}`. First 4 shown, "Show all 12". Method stated as one chip: *"= your market's 12 biggest searches, asked as a buyer asks AI."*
   - **Google search** (source chip: *your market's 12 biggest searches*): occupancy bars — top-10 appearances /12 per rival (gray) and the customer (accent), direct-labelled · divider · "5 biggest searches you're absent from" table (search · /mo · holds #1) · footnote from F4: "Your market's search set totals {N}/mo — you currently appear in {n}." Rivals on this card come from §6.6's derivation, never from `competitors_domain`.
3. **Three problem cards** (grid): each carries its count, a severity word from the closed set (Critical · Worth fixing · Nothing to fix) **and** the who-does-it badge (*Free fix · 10 min* with the robots lines verbatim in a code block · *ReachKit writes* · *ReachKit rewrites*). Left border colour = severity, never the only carrier (ruling 9a; REQ-009 c1/c5/c8).
4. **DIY collapses** (3): the complete method, free. Instructional text is allowed here.
5. **Free page card** (accent ring): title of page 1 of N · target/beats/format rows · email input + solid **Email me the full page** · "That's page 1 of N we found for you." (2b: solid, beside the pricing card's solid Start).
6. **Pricing card**: €49/mo + four spec rows (1/day · weekly · weekly · 24h veto) + Start button + "Cancel in one click."

States: scanning (named stages with elapsed times, no spinner) · degraded (score "—", no band, one line per REQ-004 c3/c6/c9; the unmeasured card says so and offers *Retry this part*) · cooldown (one line, *Try again*, no auto-restart) · malformed (field kept, one line beside it) · removed (one line, *Scan another site*). S3.

### 4.2 The giveaway email

Capture = the trade for the finished page. The full draft is generated **only
after** the email is submitted (~7¢ spent on identified leads only). Email
contains the page in a copy-ready block (Markdown + HTML buttons), the target
search + volume, and one line: "That's page 1 of {N} we found for you." Nurture:
max 3 mails (24h/72h/168h), stops on conversion.

The report ends with the removal line (§14) and the public footer.

### 4.3 Setup `/setup` — post-payment, once

Three cards, one submit. (1) **Your market** — inferred category chip, Change.
(2) **Competitors** — suggested chips from `competitors_domain`, up to 5 selected.
(3) **Destination** — *Hosted blog* (chosen, shows the CNAME record) vs *WordPress —
connect later, ask me after the first page*. **There is no mode pair**: Autopilot is
the product, setup offers no Autopilot-vs-Copilot choice, and no setup radio, pricing
bullet or mail subject says Copilot (2026-09-10, brief §1.1; see §9 for the internal
transition that keeps the name). Footer: "Start — first page in ~3 minutes." No other
configuration exists at setup.

While the deep pass runs: progress screen; on completion straight to the app with
the first draft already in the calendar. A degraded pass still releases setup
(zero proposals is legal, never faked).

The footer control reads **"Start — first page in ~3 minutes."** (C1: the body of
#2 dropped the duration per REQ-025 c1; the approved set S10 states it. The
approved string stands — ruling 11a, owner approval 2026-09-08 — and REQ-025 c1
is amended to allow a stated estimate. Owner may strike.)

Arms: from a report (domain confirmed, category tag) · without a report (site
address asked first, nothing pre-filled — REQ-021 c7) · degraded (no suggested
rivals, add field). Below the submit: "You can reach Settings, cancel or export
at any time — finishing setup is not required for that." Then `/setup/waiting`
(S11): named stages with elapsed times; a degraded pass still releases into the
app (REQ-029).

### 4.4 App shell

Left sidebar (`--w-sidebar` 222, sticky): brand · domain block (accent dot, domain, `Week n · re-measured Mon`; before the first measurement `not measured yet · first due Mon {date}` — REQ-040 c7) · **Workspace**: Overview · Calendar (waiting count) · Settings · footer autopilot card (switch · state line · next publish). Routes `/app` · `/app/calendar` · `/app/settings` · `/app/draft/{id}`. Below 1024 the sidebar becomes a top band. No other navigation.

### 4.5 Overview (default view)

1. Head: "The gap is closing." + `▲ every week since you started`; week 0 (S13): "Your first page is ready to read." + `week 0`.
2. **Growth chart**: searches-you-appear-in, weekly points, area+line in `--chart-you`, endpoint labelled, footnote pair: start value · "At 400 the big category terms unlock." Hover tooltips.
3. **Three stat tiles**: **Discoverability Score** (mono + ▲delta + band word) · AI answers `n/12` (dot row incl. goal dots + "goal: 6") · Pages published (n + "m already ranking" + "rest under 3 weeks — too early to judge"); before the first measurement the tiles read "—" with their one line.
4. **How far ahead each rival is**: per rival — name · falling sparkline (gray, accent endpoint) · `78×` big mono · `was 276×` success badge. One dim line: "Every line pointing down is the gap shrinking."
5. **This week**: 7-day strip (done/today/next) + "Open calendar →" + up to two alerts (today's page pending veto → "Read it"; a needs-you item → action button).

Data rules: max one headline number per module; every value carries its delta or
its goal, never bare.

### 4.6 Calendar (with day panel)

- Head: "One page a day. Every day." + month switcher. **Headline note (2026-09-10):** the string is owner-owed for rewriting (`calendar.head`, S14) to a key that does not promise a filled grid — the service publishes when something passes readiness (§7), at most once a day. The grid is filled only by readiness; an empty day means the system looked and nothing passed readiness or supply, and the copy says so as competence, never as an outage or a stop unless an account-level stop is true (ADR-011 precedence holds). The "if you do nothing" line states that the draft publishes when the veto window ends and that veto is available until then. Owner writes the words; `TODO(copy)` until then. — brief `docs/briefs/autopilot-quality-2026-09-10.md` §8, §1.9.
- **Stage filter cards** (All/Live/Your review/Scheduled/Planned/Needs you) with counts; clicking filters the grid.
- **Grid**: Mon–Sun columns (`repeat(7,minmax(0,1fr))` — the minmax is load-bearing), one event per day, every day filled while *ready* supply lasts (§7 readiness — 2026-09-10), weekends included. Stage = chip color. Today ringed accent.
- **Day panel** (`--w-day-panel` 290, sticky, beside the grid — not a drawer): **today selected on open**. Stage-appropriate actions (S15): review → solid *Read the full page* + Move · Veto; live → *View live page* + verified line; planned → Move · Skip; needs you → one cause + solid *Reconnect*; empty → the date's one account, no action.
- "Read the full page" opens the **draft view** (full page render, grounded-fact highlight with its source line, claim-check badge, Approve/Edit/Veto, and the "what happens if you do nothing" info box). Back link returns to the calendar.
- **Edit = Markdown textarea with a live preview pane** (owner ruling, 28 Aug) — two columns on desktop, tabbed on mobile, autosaved, no rich-text editor. An edited draft keeps its grounding highlight if the fact survives the edit and drops the claim-check badge until the check re-runs (one nano call) on save. Edit (S17) = Markdown textarea + live preview, two columns ≥1024 and tabbed below, autosaved (saving… / saved {time} / could-not-save line — nothing unsaved publishes); the claim check re-runs on save. Every draft offers Markdown and HTML copy-out (REQ-045 c12). The Decide panel carries Approve (solid) · Edit · Veto (warn outline) · *If you do nothing* · Checks.
- Footnote: planned pages are written the evening before from Monday's measurements. **Supply rule:** when opportunities run out, future days are empty and the empty state says so — the calendar is never padded. Supply means *ready* supply: an opportunity that fails `opportunityReady()` (§7) is not fillable, and a week is never filled by lowering a gate. — brief §3.5 (2026-09-10).

### 4.7 Settings

Two-column cards (S18). Left: **Your site & market** (domain + Change · category + Edit · rebuild line) · **Competitors** (5 removable tags) · **Publishing** (no mode control — Autopilot is the product (2026-09-10, brief §1.1); veto window stepper 1–7 days, default 1 day (0 is removed by the setup/settings issue #476, and the pin and this sentence move together when it lands) · publish time · time zone · publishing on/off · destinations with health + Reconnect · "Fix-type tasks are never automated, whatever the mode.") · **How your pages sound** (voice field · *Never claim* list + add) · **Notifications** (Daily draft-ready mail · Published-page mail · Monday movement mail). Right: **Billing** · **Account** · **Your content** · **Danger zone** as before.

C2 — the #2 body (2026-09-06, #34) drops "next invoice" and "card" per REQ-097; the approved set (S18) shows plan · price · active · next invoice date and amount · card •••• 4242 · Update card / Invoices / Cancel plan, and REQ-076 c1 requires exactly those values. Resolution: the approved set stands; REQ-097 is read as "ReachKit edits no billing value and sends no billing mail — it displays Stripe's values read-only". Owner may strike.

Settings holds the three product answers plus account admin, and **nothing that
tunes the engine** — caps, cadences, question counts, model choices are code
constants.

---

## 5. Scoring

```
Foundations    = access gates + clarity signals, 0–100
                 (generic noindex on the home document ⇒ 0, and score ⇒ 0)
Answerability  = shape of the home + measured pages, 0–100, floored at 1
                 shape = (questionShaped + directAnswers + evidenceDensity) / 3
SearchPresence = min(100, 25 × log10(ranked + 1)) × (0.55 + 0.45 × min(1, top10share × 4))
AIPresence     = max(1, (0.4 × mentionRate + 0.6 × citationRate) × 100)
Presence       = max(1, √(SearchPresence × AIPresence))

Score = round( ∛(Foundations × Answerability × Presence) )
Bands: 0–24 Invisible · 25–49 Hard to find · 50–74 Findable · 75–100 Dominant
```

Sub-measures: `questionShaped` = question-shaped headings ÷ all headings × 100
(question-shaped = ends `?` or opens with how/what/why/when/where/which/who/can/
do/does/is/are); `directAnswers` = question headings whose first block is 40–320
visible chars ÷ all headings × 100; `evidenceDensity` = saturating log curve over
(numerals + dates + outbound citations per 1k chars). Empty denominators read 0,
never null. A driver that **could not be measured** is `null` and nulls the score
(rendered "—" + one written line); a **measured 0 is a 0**. Identical free/paid;
no tier parameter. All measurement over raw fetched HTML — no JS execution, fully
deterministic.

---

## 6. Data layer

### 6.1 Price book (pin in `constants.ts`, assert in `tests/pins.test.ts`)

| Constant | Value |
|---|---|
| `RANKED_FREE_ROWS / COST` | 50 rows · 1.8¢ |
| `RANKED_PAID_ROWS / COST` | 300 rows · 4.8¢ |
| `RANKED_RIVAL_ROWS / COST` | 100 rows · 2.4¢ |
| `COMPETITORS_DOMAIN_COST` | 1.5¢ |
| `SUGGESTIONS_COST` | 1.8¢ / call @ 50 rows |
| `SERP_LIVE / SERP_STD` | 0.2¢ · 0.06¢ |
| `CHATGPT_SCRAPE_STD` | 0.12¢ (paid battery only — never on the free path) |
| `AI_MODE_LIVE / STD` | 0.4¢ · 0.12¢ (DATA-COSTS 2026-09-03 re-check) |
| `QUESTIONS` | 12 |
| `TARGET_SERPS_MAX` | 13 |
| `MEASURED_PAGES_MAX` | 25 |
| `COMPETITORS_MAX` | 5 |
| `CAP_FREE / CAP_DEEP / CAP_WEEKLY / CAP_DRAFT` | 12¢ · 150¢ · 40¢ · 45¢ |
| `PLATFORM_DOMAINS` | reddit, quora, youtube, wikipedia, g2, capterra, medium, linkedin, producthunt, stackoverflow, … (closed list) |
| `RIVAL_SCORE` | top10Appearances + 2×aiCitations (§6.6) |
| `SERP_LOCATION` | Google US · en (MVP; §6.3a) |

### 6.2 The AI-visibility ruling (the lean answer)

We do **no own inference** for AI visibility — all AI-answer data is DataForSEO
data, three tiers, and the MVP uses the cheap two plus a free one:

| Tier | What it is | Cost | MVP use |
|---|---|---|---|
| **AI Overviews** | `ai_overview` item + per-domain `references`, returned **inside** organic SERPs we already buy | **0¢ extra** | **The free report's AI matrix** (12 question-SERPs) and every paid target SERP. Never set `load_async_ai_overview` |
| **Google AI Mode** | Google's AI answer surface, own SERP endpoint, cited sources | 0.12¢ std / 0.4¢ live | Paid battery, engine 2 |
| **ChatGPT (LLM Scraper)** | The actual ChatGPT product's answer, scraped | 0.12¢ std / 0.4¢ live | **Paid only** — battery engine 1 (std) |
| Perplexity (LLM Responses) | API answer, model cost dominates | ~0.56¢ | **Deferred to v1.1** — 70% of the old battery cost for a duplicate verdict |

Free report battery (owner ruling, 28 Aug): **12 organic SERPs live = 2.4¢**,
reading each SERP's `ai_overview` + cited domains for free — the matrix is
"Google's AI answers", not engine-specific, and the same SERPs supply the
"holds #1" column. The free path makes **zero** AI Optimization API calls.
An AI Overview does not appear on every query: state the denominator
("AI answers appear on 9 of your 12 biggest searches — you are cited in none"),
and render a no-AI-answer question as a muted cell, never as a miss.
Paid weekly battery: **ChatGPT std + AI Mode std + AI-Overview piggyback =
2.2¢/week**, rendered as three answer columns.

### 6.3 Datasets — the closed list

**Free scan** (total ~6.3¢, cap 12¢): own fetches (home, detected pricing page,
robots.txt) → Foundations/Answerability · nano ×1 over the **homepage text** →
business profile in buyer vocabulary (§6.7, never over rankings) · `keyword_suggestions` seeded from
those terms → market set + denominator + the 12 questions ·
`ranked_keywords`@50 → the customer's own presence (0 rows is a legal result) ·
**12 organic SERPs live** → top-10 holders, the AI-Overview matrix, **and the
rivals themselves** (§6.6). No `competitors_domain` on the free path. Brand
mentions/citations = string match over references.

**Paid deep scan** (~30¢ live at onboarding; **weekly refresh ~8¢** standard):
adds `ranked_keywords`@300 (user) · @100 ×rivals (**monthly**) ·
`competitors_domain` (**monthly**) · `suggestions` ×2 (**monthly**) · ≤13 target
SERPs (weekly, std) · own fetches of ≤25 ranking pages + rival home/robots ·
battery per §6.2 · Haiku ×~4 for opportunity typing.

**One day of content**: ~6.5¢ (nano brief/outline/claim-check + Haiku draft +
answerability pass + retry allowance). `CAP_DRAFT` 45¢ is enforced headroom.

**Monthly per customer ≈ $2.71 ≈ €2.50 → ~95% gross margin at €49.**

### 6.3a Locale (owner ruling, 28 Aug)

**MVP is US-English only.** Every SERP, suggestion and volume uses Google US /
`en` — one location constant (`SERP_LOCATION`), never per-customer derivation.
Consequences stated, not hidden: volumes and rivals will be wrong for non-US
markets; the free report footer carries one written line — *"Measured on US
Google. More countries soon."* Locale derivation (site `lang` + TLD → country) is
the designed v1.1 upgrade and changes no other part of the pipeline.

### 6.4 Redundancy rules — the never-pull list

- Nothing is fetched that no rendered surface reads (a dataset ships only with its screen).
- Cache windows: own domain 7d · rivals 30d · SERPs 30d (except the weekly target re-check, `serpWeeklyRecheck = 7`) · suggestions 30d. Cache is keyed source+key+policy-version; an empty payload is always a miss; **no negative cache**.
- Never: SERP depth >10 · search operators (`site:` = 5×) · clickstream flags · `load_async_ai_overview` except on the free report's first pass (ADR-094 sets it there; never on a market-correction re-run, 2026-09-03) · Labs historical endpoints · per-rival `ranked_keywords` on the free path · a 4th engine · per-draft re-probing · AI Keyword Data (v1.1 candidate only).
- Live mode only where a human is waiting (free scan, onboarding pass). Everything scheduled = standard queue.
- **A free re-scan of the same domain within 7 days serves the stored report** — no new spend. The report shows its measurement date; a "Re-scan" affordance appears only after the window. (Failure cooldown stays 24h as specced.)
- **A free scan's data is reused by the paid deep pass** within its cache windows — the questions, market set, and 12 SERPs from a <7-day-old free scan carry over, so onboarding is faster and cheaper than the headline 30¢ when the customer converts promptly (the common case).
- Every fetch of user-supplied URLs goes through one SSRF-guarded, DNS-pinned, size-capped fetcher; robots.txt respected; no crawling — the page set is only URLs we already hold from ranking data or construct by name.
- **The fetcher has two size caps (2026-09-10, #479).** The customer's own documents are read with `OWN_DOCUMENT_MAX_BYTES` 6 MB, passed by `src/lib/measure/own-fetch.ts`; vendor and rival reads keep the fetcher's 2 MB default. Above its cap a read is refused and never truncated, because a truncated document would mis-measure answerability. A refusal is a ledger row (`{refusal, status, bytes: 0, host}`, 0 ¢), never a null payload, and it is a cache miss like any empty payload. A pass whose home document was refused reads and buys nothing after it and ends **`site_unreadable`**, the fifth `scans.stopped_reason` (migration `scans_stopped_reason`). Its report is stored `complete: false` with status `degraded`, it keeps REQ-001 c14's re-scan offer, and the page says so (`notice.site-unreadable`); a ceiling that fired first still outranks it (ADR-021). Found by M3 run 5 (cal.com's 2.16 MB home, §16 row 3); pinned in `constants.ts` by PR 503 (merged 2026-09-11).

### 6.5 The cost seam

Every vendor/LLM call runs inside a per-scan cost context: `recordFetch{scanId,
source, cacheKey, costCents, payload}` — one `fetches` table is ledger + cache +
raw store. Caps degrade (skip remaining optional work, mark scan `degraded`),
never throw; money already spent is always ledgered. `capHit()` is re-checked
between calls in any multi-call step.

**Latency budget (2026-09-10, #452/#455).** `INFERENCE_TIMEOUT_MS` bounds one whole
`llm()` call, attempts included — `nano` 15 s per call (pending the first live
measurement of a completed call, #317), `haiku` 20 s. The vendor SDK's own retries are
off (`INFERENCE_MAX_RETRIES = 0`): the seam's "retried at most once" is the only retry
policy, so the wall clock a caller reads is the wall clock it gets. The free pass's two
nano calls (§6.7 steps 1 and 4) are therefore 30 s of the 60 the platform allows the
invocation (§11), and `tests/llm/budget.test.ts` is that arithmetic.

**Structured output (2026-09-11, #512, PR 518).** `llm()` asks for structured output:
every object-shaped call site sends its schema as one forced tool (`input_schema` from
Zod's `z.toJSONSchema`, `tool_choice` naming it, the tool name being the site with `.` →
`_`, e.g. `generate.brief` → `generate_brief`) and reads the `tool_use` block's `input` as
the value; Zod's `safeParse` stays the gate. `question-phrasing`, the one array-shaped
site, is wrapped as `{questions:[…]}` and unwrapped after parsing, so every site takes the
one path. A text answer (a schema with no object form goes out without a tool) is read
tolerantly: the whole text, then the inside of a surrounding fence, then the first
balanced top-level object or array that parses; nothing is coerced. A `json` miss logs
`textStart` (the first character's class) and `textLength` only, never the text. Found by
M3 run 6 (§16 row 3).

### 6.6 Rival derivation, and the cold-start law

**The cold-start law: every derivation in the product must work for a domain that
ranks for nothing.** Cold start is the default customer — the product exists to
build their foundation — so no dataset, module, or sentence may assume presence.
Anything keyed on the customer's own rankings is a warm-start *supplement*, never
a dependency.

**Rivals** are therefore derived from the *market*, not from the customer:

```
rivalDomains = for each of the 12 question-SERPs (F7):
                 take the organic top-10 domains + the ai_overview reference domains
  → strip the customer's own domain
  → partition against PLATFORM_DOMAINS (reddit, quora, youtube, wikipedia,
    g2.com, capterra, medium, linkedin, producthunt, stackoverflow, …):
      platform hits  → the "sources" list (stored in the report blob; not rendered in MVP — a v1.1 Standing module)
      product domains → rival candidates
  → score = top10Appearances + 2 × aiCitations   (cited-by-AI weighs double)
  → top 5 by score = suggested rivals
```

Zero extra cost — it counts over SERPs already bought — and the output is
identical whether the customer ranks for 10,000 searches or none. At setup the
suggested chips come from this list, `competitors_domain` adds candidates only
when the customer has presence (warm-start supplement), and **the customer can
always type a rival manually** — a cold-start founder knows their competitors
even when no dataset does.

**Cold-start rules per surface** (the pipeline never branches; only rendering
guards):

- Free report contrast = *share of the market's 12 biggest searches* (top-10 appearances /12, AI citations /m) — meaningful at zero. Global ranked-count contrast (12,400 vs 25) is a paid reveal.
- "You appear in N searches" renders N=0 as a measurement, never an error; the header strip's footnote line comes from F4 either way.
- Score: SearchPresence 0 → Presence floors at 1 → a clean cold-start site scores ~10–15, Invisible. Honest, and the reason the product was bought.
- Overview "how far ahead" ratios: when the customer's count is 0, render the rivals' absolute numbers with `you: 0` — **never a ratio** (division by zero renders as ∞× and reads as broken). The ratio module unlocks at ranked ≥ 10 with copy "now comparable".
- Growth chart starts at 0 and that is the story: the line leaving the floor.
- Opportunities: all Write-family at first (nothing to Improve yet); winnability `max(500, 5×ranked)` keeps winnable targets non-empty at ranked = 0; Improve types appear naturally as pages start ranking.
- Every empty-at-cold-start module states what fills it: "appears after your first pages rank", never a blank.

### 6.7 From a URL to the 12 questions

The 12 questions are the product's foundation — they drive the free report, the
rival derivation, and (once confirmed) the paid tracking set. The chain is five
steps; **selection is deterministic and auditable end to end — the LLM touches
vocabulary, never selection.**

**Step 1 — Business profile (nano, ~0.3¢).** From the fetched home + pricing
pages, extract a structured profile: category phrase **in buyer vocabulary**
(the prompt asks "what would a buyer type into Google", not the site's marketing
language — "product adoption platform" also yields "user onboarding software"),
the job it does, offering type, 2–4 audience/use-case terms, rivals the site
itself names, locale. A wrong guess here self-corrects at step 2: a bad seed
returns off-market suggestions that die in the relevance guard.

**Step 2 — Measured market (1.8¢).** `keyword_suggestions` on the primary seed →
~50 real searches with real volumes. This converts guessed language into measured
language: if the market says "onboarding tool", the volumes say so.

**Step 3 — Select the 12.** Score every suggestion:

```
score = intentWeight × log10(volume + 1)          volume floor: 50/mo

intentWeight (deterministic keyword-shape patterns, no LLM):
  3  decision      best X · X vs Y · X alternatives · top X tools
  3  solution      {category} software|tool|app|platform
  2  problem       how to {job} · {pain phrase}
  1  informational what is X
  drop  own-brand  contains the customer's name (measures nothing about discovery)

relevance guard (kills seed drift): every non-generic token must be
  supported by the profile's vocabulary — "employee onboarding checklist HR"
  dies here for a user-onboarding SaaS.

composition constraints on the final 12 (a portfolio, not a leaderboard):
  ≥4 decision · ≥3 solution · ≤3 rival-brand · ≤2 how-to
  near-duplicates collapse (same content-token stem set → keep highest volume),
  so the 12 SERPs are 12 different questions — a leanness rule as much as a
  quality one.
```

*What makes one search more critical than another:* *decision and solution intent
beat raw volume* — a 1,900/mo "appcues alternative" outranks a 24,000/mo
informational query, because it is where buyers choose and where AI answers
recommend lists. Volume enters log-scaled so it breaks ties inside an intent
class rather than steamrolling across classes.

**Step 4 — Phrase as questions (nano, a second call — `phrase.ts`, after step 1's
`profile.ts`; the free pass issues exactly these two nano calls).** Template-first
("best X" → "What's the best X?"; "X vs Y" → "X or Y — which should I pick?");
the LLM only words the question. **Phrasing never changes which searches were
selected**, and each question renders with its source search + volume — the
provenance line the report already shows.

**Step 5 — Coherence check + correction (0¢ + bounded).** After the 12 SERPs
return: if no domain appears in ≥3 of the 12 top-10s, the market set is likely
wrong (disjoint SERPs = incoherent market). The report then leads the header with
the category chip and **"Not your market? Correct it"** — one correction per free
scan re-runs steps 2–5 (~4.2¢; worst case 10.5¢, still under the 12¢ cap). On the
paid side the customer confirms the category at setup, may edit it in Settings,
and the question set **freezes after confirmation** so week-on-week movement is
comparable; it re-derives only when the category changes.

---

## 7. Opportunities

Derived mechanically — **no LLM decides what an opportunity is** (Haiku only
labels/classifies). Types, closed enum:

| Family | Type | Trigger |
|---|---|---|
| **Write** | `answer_page` | AI answer for a question names rivals, not customer |
| | `keyword_page` | Rival top-20 for a query ≥10/mo; customer absent — **residual** (2026-09-10): the ≥10/mo trigger is discovery input only; the type is *ready* only when the six gates below all pass, volume ≥ `KEYWORD_PAGE_MIN_VOLUME` (50) among them |
| | `comparison_page` | Gap query names a rival or contains vs/alternative |
| | `format_page` | Rivals have a page type customer lacks entirely — **narrowed** (2026-09-10) to the closed demand-bearing formats `FORMAT_PAGE_ALLOWED`: comparison, alternative, integration, template. Glossary, changelog, "blog" and "resources hub" never qualify |
| **Improve** | `expand_page` | Customer ranks 4–30, page thin |
| | `answerable_page` | Page has search value, low answerability |
| | `refresh_page` | Ranking page stale vs rivals' |
| **Earn** (2026-09-10) | `listed_page` | A `PLATFORM_DOMAINS` host or a measured citing domain names a rival on a market-set query and does not name the customer. Evidence: citing URL, rival named, query, the first-party asset to write (usually a comparison table, integration page or original-data page). Acceptance: "named on question P or customer URL cited on the same host within 8 weeks" — one stable string. The action is first-party only: a citable asset on the customer's domain. **Autopilot never sends outreach mail** |
| **Fix** | `unblock` | Any access gate fails — **instruction only, never generated, never automated** |

Every opportunity: trigger · evidence (query, volume, rival, URL, position) ·
target (URL or proposed slug+title) · demand · effort · **acceptance test**
("top 20 for Q" / "named on question P" / "gate passes").

**Winnability (right-sizing):** a Write target qualifies only if its top-10
contains at least one domain whose ranked count ≤ max(500, 5× customer's). Bands
(Winnable/Reach/Not-yet) power the report's "picked because" line and the
Standing scope module. Ranking: `demand × intent × (1−effort) × fit`, one list.
**Supply is the cap:** never invent an opportunity to fill a day.

**Parent-topic clustering (2026-09-10).** Opportunities are clustered before
ranking; the calendar unit is one cluster-day, not one keyword-day. `clusterKey(opportunity) → string`
is mechanical, no LLM: (1) an opportunity with a target URL on the customer's domain →
the canonical customer URL; (2) else a query containing vs / versus / alternative or a
confirmed rival hostname or brand from `deriveRivals()` → `compare:{customer}|{rival}`
(one cluster per rival); (3) else the query that sends the most estimated traffic to
the current #1 URL for that query among the measured SERPs (the parent-topic
approximation) — if that #1 is a `PLATFORM_DOMAINS` host, fall through to the
highest-volume non-platform URL; if none, the normalized query string. After
derivation one opportunity survives per `clusterKey`: the highest rank after the
precedence sort below. The losers are stored on the survivor as `absorbed_queries[]`
(read by the outline and by Monday's tests) and get no calendar day of their own.
The only pinned number here is `CLUSTER_SUPPRESS_WEEKS` (4). — brief §3.2, §1.4.

**Precedence — Improve outranks Write (2026-09-10).** The one list keeps the
formula above; a stable sort key is applied before the score: (1) family order
Fix (shown, never scheduled) → Improve → Earn → Write; (2) inside Write
`comparison_page` → `answer_page` → `format_page` → `keyword_page`; (3) the
numeric formula; (4) the cluster collapse. So, after clustering, an
`expand_page` / `answerable_page` / `refresh_page` on an owned URL in the
cluster always beats a new `keyword_page` or `format_page` for that cluster.
`fit` rises when the brief can attach ≥1 live-page fact from measure or the
fetched customer HTML; with no fact attachable, readiness fails. Winnability
bands are unchanged; Not-yet never fills a day. — brief §3.4, §1.3.

**`keyword_page` gates (2026-09-10).** Ready only when all six hold: (1) the
winnability bar above; (2) the customer has no owned URL in this `clusterKey`
(otherwise emit Improve on that URL, not Write); (3) volume ≥
`KEYWORD_PAGE_MIN_VOLUME` (50); (4) intent is comparison, alternative,
commercial-investigational, or a how-to the customer's live pages already
evidence — informational commodity ("what is {category}", "{category} in 2026",
"{category} tips") fails; (5) the current #1 is not a thin listicle we would
only clone: #1 under `THIN_RIVAL_WORDS` (400) words with no table or FAQ in the
fetched HTML fails; (6) the proposed slug/title would pass the 85% near-duplicate
gate against the published set. A row that fails may stay in the table as
rejected/unready for debugging, but `supplyDepth()` and `next.ts` never count it
as fillable supply. — brief §3.3, §1.5.

**Readiness — `opportunityReady()` (2026-09-10).** One exported predicate in
`src/lib/opportunities/`; `next.ts` may only return an opportunity where it is
true, and an unready opportunity never enters `planned`. All must pass: (1) the
type-specific gates; (2) Winnable or Reach, never Not-yet; (3) evidence fields
present — query, rival or citing URL, target slug+title or target URL; (4) at
least one grounding candidate: a fact extracted from the customer's fetched HTML
(price, limit, integration name, feature string, dated claim already on their
site); (5) for `comparison_page`, a table skeleton with ≥3 rows whose cells can
be filled from the customer's and the rival's fetched HTML — a cell that would
need invention fails readiness and the day stays empty; (6) not in a cluster
suppressed by a Monday Not working (`CLUSTER_SUPPRESS_WEEKS`); (7) not a
near-duplicate of a published or in-flight draft; (8) `unblock` is never ready
for generate. When ready supply is zero, `supplyDepth()` reports zero and the
calendar shows the empty-competence line (§4.6). Gates are never lowered to fill
a week. — brief §3.5, §1.2.

**Cadence (2026-09-10).** The hard ceilings stay §9's `RATE_LIMITS`
(≤1 publish/day, ≤8/week). Beside them one operating preference, pinned:
`AUTOPILOT_WRITE_MAX_PER_WEEK` (4) — Autopilot schedules at most four
Write-family publishes in a site-local week; the remaining slots may be Improve
or Earn. Weekends stay eligible, Saturday is not special-cased; emptiness handles
rest. The day's page is still generated the evening before (§8). — brief §3.6.

---

## 8. Generation

Pipeline per draft: **brief (nano) → outline (nano) → grounded draft (Haiku) →
answerability+SEO pass (Haiku) → claim check (nano)**. Hard rules, enforced in
code, not prompts:

1. **Grounded**: ≥1 verifiable fact from the customer's own live pages, carried with its source URL + read date, rendered as the highlight in the draft view. The record's shape is one and named: `drafts.grounded_fact` = `{passage, url, readAt}` (`src/lib/generate/fact.ts` `RecordedFact`, written by the pipeline, read by the draft store and the hosted renderer through one reader — #415); the claim-check verdict lives in `drafts.claim_check` and the rule battery's result in `drafts.rule_failures` (an empty array = a battery ran and found nothing; `src/lib/generate/record.ts` — #424); `drafts.meta` carries only the save path's keys. A screen never infers a pass or a fact from `meta`.
2. **No invented people**: no generated bylines/bios/personas. Customer identity or none.
3. **Not a doorway**: answers the target question before naming the product (checked: first 300 chars contain no brand mention).
4. **Do-not-claim list**: hard output filter (string/semantic match), failure = regenerate, twice = needs-attention.
5. **Near-duplicate gate**: ≥85% similarity vs the customer's published set = never queued.
6. No rival metrics invented; every rival claim links its public source.
7. Brand voice = one free-text field appended to the draft prompt. Nothing learned.
8. **No invented tests** ("we tried 14 tools", "our team used X for 6 months") unless that sentence already exists on a customer live URL in the brief facts. (2026-09-10)
9. **No fake author, no `datePublished` of experience, no stock case study.** (2026-09-10)
10. **The answerability pass adds no question-shaped headings**: its output may not raise the count of question-shaped headings by more than `ANSWERABILITY_MAX_NEW_QUESTIONS` (pin 0) — reordering only. It may shorten a first block into 40–320 chars where a question heading already exists and insert customer-sourced evidence already present in the brief; numeral stuffing to lift `evidenceDensity` is a hard-rule failure. (2026-09-10)
11. **Evidence added in the pass is traceable to brief facts**: a numeral not present in the brief facts is a claim-check failure. (2026-09-10)
12. **The first 40–320 character block after the first heading answers the target question.** Rule 3 still holds — no brand in the first 300 chars. (2026-09-10)

Rules 8–11 are enforced by extending `claimCheck()` and `runHardRules()`, never
by a second model judge. — brief `docs/briefs/autopilot-quality-2026-09-10.md` §4.2, §1.11.

**What the brief may carry (2026-09-10).** The brief (nano) contains only:
`clusterKey`, type, target query + `absorbed_queries`; rival evidence URLs;
extracted facts from the customer's HTML (and the rival's, for comparisons), each
with source URL + read date; the do-not-claim list; the brand-voice free text;
the acceptance-test string. If extracted facts are empty, Haiku is not called:
the opportunity is marked unready, the day is skipped, and nothing is ledgered
toward `CAP_DRAFT` except the nano brief if it already ran. Fail before Haiku.
— brief §4.1.

**Type skeletons at the outline stage (2026-09-10).** The outline (nano) follows
a closed skeleton per type; Haiku never picks a blog-post shape:
`comparison_page` — H1 question → 40–80 word answer → comparison table (≥3 rows
from the brief) → "who should pick whom" → source lines, no "what is {category}"
preamble · `answer_page` — H1 = the question the AI answer ranked → direct answer
→ evidence from customer pages → the one section the rivals were cited for,
answered with customer facts · `expand_page` / `answerable_page` / `refresh_page`
— operate on the existing URL's outline, add or replace sections, never a new
slug · `keyword_page` (rare) — as `answer_page`, plus absorbed queries as H2s only
where each can be answered from brief facts · `format_page` — only the
comparison / alternative / integration / template skeletons · `listed_page` — one
citable object (table, numbered spec, dated stat with methodology), a short page;
the object is the point. Customer identity or none; never "ReachKit editorial".
— brief §4.3.

Timing: the day's page is generated the evening before its publish date from the
freshest scan. `CAP_DRAFT` enforced before the pipeline runs.

---

## 9. Publishing and autopilot

**State machine** (exact, idempotent):

```
planned → generating → in_review → approved → publishing → published
                          ↓ veto                  ↓ fail
                       skipped            failed → retry ×3 → needs_attention
published → unpublished (always available)
```

- **Draft-by-default everywhere.** Autopilot = auto-approve when the veto window (default 24h, settable 0–7d) expires without a veto. **2026-09-10 (brief §1.8):** becomes 1–7 days — 0 is removed by the setup/settings issue (#476); the pin and this sentence move together when it lands. **Autopilot is the product (2026-09-10):** setup offers no Autopilot-vs-Copilot choice, and no setup radio, pricing bullet or mail subject says Copilot. Copilot (explicit approve) remains an *internal* transition in the state machine, used only when a draft is in `needs_attention` or when the customer sets the veto window to 7 days and acts; where a control must remain for a `needs_attention` draft its verb is "Publish now" / "Veto", never "switch to Copilot". `in_review → approved` on veto expiry is the set-and-forget path and is unchanged. — brief §2, §1.1.
- **Veto window (2026-09-10):** 1–7 days, default 24h, pinned `VETO_WINDOW_MIN_DAYS` 1 · `VETO_WINDOW_MAX_DAYS` 7 · `VETO_WINDOW_DEFAULT_HOURS` 24 (house names may differ; the pins test asserts them). **0 days is removed** so a draft always has a veto path; a stored value below one day is clamped to one in one place (constants + the publish settings parser). Pause stays one click and instant. — brief §2, §1.8.
- Autopilot hard limits regardless of settings: ≤1 publish/day, ≤8/week; the Write-family preference `AUTOPILOT_WRITE_MAX_PER_WEEK` (4) sits beside them (§7 cadence); **Fix never automates**; pause is one click and instant.
- Publishing idempotent by `(draft_id, destination)` — a retry can never create a second post.
- Failed publish: back in the queue with a written reason; expired credential is a **state** (reconnect prompt, queue holds), not an error loop.
- Every published page records: opportunity id, target query, measurement date, approved-vs-autopilot, live URL, and (2026-09-10) its `clusterKey` — read by Monday's suppression below. — brief §6.
- **Monday consequences (2026-09-10).** A Not working verdict on a cluster suppresses new Write opportunities in that cluster for `CLUSTER_SUPPRESS_WEEKS` (4); Improve of the live URL in that cluster stays allowed. Two consecutive Not working verdicts on an Improve of the same URL stop scheduling that URL, surfaced as one Settings line through the existing `HealthReason` / needs-you patterns — not a new health state. The digest never counts pages published as success; movement copy names the score band, the acceptance tests that moved, and empty days as planned when supply was zero. — brief §6, §1.10.

**Hosted CMS:** `content.{customer-domain}` by CNAME → our edge route serves
static-rendered pages by Host header. Sitemap, canonical, `FAQPage` schema where
FAQ exists, and a robots.txt **we serve** that allows GPTBot, ClaudeBot,
OAI-SearchBot, Claude-SearchBot, PerplexityBot, Google-Extended. Preview at
`{slug}.reachkit.app` is `noindex` **forever** (site-reputation-abuse guardrail —
customer content never ranks on our domain). Published pages render through **one** clean typographic template (the §2 design
system, light-only is acceptable), customisable later — never per-customer
templates in MVP. Export = Markdown + assets zip, always available. **WordPress:** REST + application password, posts as draft +
Yoast/RankMath meta when detected; credentials encrypted at rest, never logged,
revoked on disconnect. Everything else = copy as Markdown/HTML (always shown).

**Verification:** publish +24h → fetch the live URL, confirm reachable/indexable/
in-sitemap/AI-readable (chips in the day panel). Monday → full re-measure; each
published page gets Working / Too early / Not working against its acceptance
test. A regression is shown, never hidden.

---

## 10. Data model (Supabase, RLS default-deny)

| Table | Key columns |
|---|---|
| `users` | id, email, plan_status(active/past_due/canceled), stripe_customer_id, created_at |
| `sites` | id, user_id, domain, category, competitors jsonb[≤5], mode(autopilot/copilot), veto_hours, publish_time, voice_text, do_not_claim jsonb, created_at |
| `scans` | id, site_id(null for free), domain, tier(free/deep/weekly), status(running/done/degraded), score, drivers jsonb, report jsonb(versioned blob: measurements, questions, answers, market set), cost_cents, created_at |
| `opportunities` | id, site_id, scan_id, type, family, target_query, volume, evidence jsonb, proposed_slug, title, effort, fit_band, acceptance jsonb, status(open/queued/done/dismissed), created_at · **amended 2026-09-10 (migrated by the deriver issues):** `cluster_key` text, `absorbed_queries` jsonb[] (the collapsed losers), and the readiness fields `opportunityReady()` records — ready boolean plus the failing gate(s), so an unready row can stay for debugging and never count as supply (§7) |
| `drafts` | id, opportunity_id, site_id, state(§9 enum), title, body_md, meta jsonb, grounded_fact jsonb, cost_cents, scheduled_for date, veto_deadline, created_at |
| `publications` | id, draft_id, site_id, destination, live_url, published_at, mode(approved/autopilot), verify jsonb(reachable/indexable/sitemap/ai_readable/checked_at), verdict(working/too_early/not_working), unpublished_at · **amended 2026-09-10 (migrated by the verdicts issue):** `cluster_key` text, persisted at publish so Monday's suppression (§9) reads the publication, not the opportunity |
| `destinations` | id, site_id, kind(hosted/wordpress), config jsonb(encrypted creds), health(ok/expired/error), created_at |
| `fetches` | id, scan_id, source, cache_key, policy_version, cost_cents, payload jsonb, created_at — **ledger + cache + raw store in one** |
| `leads` | id, scan_id, email(lowercased), consented_at, converted_at, draft_sent_at |
| `page_verdicts` | id, publication_id, site_id, week_start date (the site-local Monday), verdict(working/too_early/not_working/not_judgeable), cause (REQ-063 c6's five, on `not_judgeable` only), measured_at, scan_id, measured jsonb, movement jsonb, created_at — Monday's verdict per publication (§9) |
| `domain_blocks` | id, domain (lowercase, unique), blocked_at, note (the written request it was granted against) — v1 report removal, ADR-002; `dbAdmin()`-only |
| `email_suppressions` | email (lowercase, pk), cause(opt_out/subscribed), at — `dbAdmin()`-only |
| `danger_tickets` | ticket (pk), site_id, action(unpublish_all/delete_account), created_at, taken_at, spent_at, expires_at — the Danger zone's confirmation, spent once |

One report blob per scan, no per-section tables. The table above is every table in `public` — thirteen, rows for `page_verdicts`,
`domain_blocks`, `email_suppressions` and `danger_tickets` added 2026-09-11. A 14th table needs a rendered
surface that reads it, specified first. **Identity (2026-09-10, #468):** `users.id` **is** `auth.users.id` (FK); sign-in and email-change tokens are Supabase Auth's, so there is no `auth_links` table and no `users.sessions_valid_from` — sign-out everywhere is the admin global sign-out, erasure deletes the `auth.users` row last.

---

## 11. Jobs

| Job | Schedule | Does |
|---|---|---|
| `scan/run` | on demand | The one pipeline; tier is a parameter. Free ≈60s live; deep live; weekly standard |
| `draft/generate` | daily, evening | Next opportunity → pipeline → `in_review`, veto clock starts, daily email |
| `publish/execute` | on approve/expiry | State machine → destination |
| `publish/verify` | +24h | Liveness checks |
| `weekly/refresh` | hourly tick, gated on each site's local Monday (ADR-060) | Weekly scan per active site → re-derive → verdicts → movement email |
| `lead/nurture` | hourly cron | advanceSequences(now) over next_touch_at |
| `publish/retry` | hourly cron | inside the kill-switch scope, claims failed pages whose retry is due |

Jobs run on Inngest; the app registers at `/api/jobs/[[...slug]]` with
`INNGEST_SIGNING_KEY` / `INNGEST_EVENT_KEY` (§15).

Bounds: 5 free scans/IP/h · 1 in-flight/IP · 200 free scans/day · kill switch env
var stops scan+generate+publish · scan limiter fails open, lead capture fails
closed.

The free pass runs inside the `POST /api/scan` invocation and has **two ceilings**
(2026-09-10, #438/#443, ordered by #456): its own, `TIMING.reportCeilingS` in
`constants.ts`, and the platform's, `export const maxDuration` on the route (60 s on
Hobby, pinned beside it as `TIMING.platformCeilingS`). **The design ceiling is below
the platform's by rule** — 50 s under 60 — so the pass always fires its own ending
and stores the partial report ADR-021 promises before the platform can freeze it;
`TIMING.reportTargetS` 40 s is the p95 it aims at, ten seconds under the ceiling as the
ceiling is under the platform's. The row above's "Free ≈60s live" is the platform's
outer bound the reader waits inside, not the pass's target. The pass is registered with
`after()` so it outlives the response, and it is the platform bound that can still
freeze it. A free scan left `running` past **the platform bound plus
`TIMING.sweepMarginS`** (60 + 30 s — never the design ceiling, since a row at 50 s is
storing its report, not stuck) is swept to `failed` by `account/maintenance` (its
seventh obligation), so §6.4's in-flight bound never holds a network on a ghost.
REQ-003 c5's 90 s is superseded on the pin; no plan upgrade. Every merged migration is
applied to production by the master the same hour (PROCESS §3).

## 12. Emails (Resend, one shell, plain-text alt, no LLM prose)

`magic-link` · `report` (free scan summary) · `first-page` (the giveaway draft)
· `draft-ready` (daily: title, why-data, *publishes tomorrow 09:00 unless you say
no*, one veto link) · `published` (live URL + 24h checks) · `weekly` (score
delta, AI answers delta, pages verdicts, next 3 — all values conditional: a
missing number omits its section, never prints 0).

One shell (S20): brand · one heading · one short line · mono fact rows · one
solid button · footer naming why it was sent and how to stop it (toggle or
opt-out), the imprint line, plain-text twin. Kinds: magic-link · report ·
first-page · first-page-unavailable · nurture (≤3, stops on subscribe) ·
draft-ready · published · weekly · setup-reminder · account. The report and
weekly mails name the **Discoverability Score**.

## 13. Payments

Stripe Checkout from the report (scan id in metadata) or any price surface
(scanless — no fabricated scan id). €49/mo flat. **Tax handling is deferred
(owner ruling, 28 Aug): no Stripe Tax at launch** — charge €49, collect the
buyer's country (Stripe does automatically) and VAT ID field on, so the records
exist when registration is set up. This is a known, accepted compliance debt from
customer one; revisit before meaningful EU B2C volume. Webhook
(signature-verified, the only provisioning path): upsert user, create site
(domain null if scanless — asked at setup), stamp lead converted, queue deep
pass, send magic link → `/setup`. Portal for card/cancel; cancel keeps access to
period end; export always.

## 14. Compliance guardrails (build as features)

1. Volume follows supply (§7) — the anti-scaled-content-abuse control.
2. No invented authors (§8).
3. Near-duplicate gate before queueing (§8).
4. No doorway pages (§8).
5. Grounding (§8).
6. Customer is publisher of record: their domain, their identity; `*.reachkit.app` noindex forever (§9).
7. Autopilot rate limits independent of the monthly cap (§9).

We make pages **structurally citable**; we never engineer content to steer what
an assistant recommends (May-2026 spam policy line — no prompt-shaped tricks, no
hidden instructions, in any generated page).

## 15. Env

`SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET STRIPE_PRICE_ID RESEND_API_KEY MAIL_FROM DATAFORSEO_LOGIN
DATAFORSEO_PASSWORD ANTHROPIC_API_KEY NANO_API_KEY (optional, defaults to
ANTHROPIC_API_KEY) INNGEST_SIGNING_KEY INNGEST_EVENT_KEY IP_HASH_SALT
KILL_SWITCH OWNER_EMAILS HOSTED_EDGE_CNAME_TARGET NEXT_PUBLIC_APP_URL`;
`DATABASE_URL` is required only by migration tooling. Where each lives, and
which are owner-pasted, is `docs/DEPLOYMENT.md`. `RK_FIXED_NOW` is a test
fixture and is never set in a deployment.

## 16. Build order

Each milestone ends with a check; a milestone that can't pass its check isn't
done. **Any new surface gets its design artifact approved before its milestone
starts.**

| # | Milestone | Done when |
|---|---|---|
| 1 | Design system + app shell + all §4 screens on fixture data | Every screen pixel-matches the approved artifact, both themes |
| 2 | Measurement engine: fetcher, parsers, drivers, score | Same HTML twice → byte-identical; fixture suite for every driver. **Verify against the live API**: whether Labs `ranked_keywords` on the root domain includes `content.{domain}` subdomain rows (it must, or hosted pages' wins would be invisible to the growth chart — if not, query with subdomain inclusion or add the subdomain as a second tracked target) |
| 3 | Free scan pipeline + report + share + cooldown | Real domain → real report <60s, ≤12¢ ledgered. *Live 2026-09-10 (#317), runs 1–6 on production: run 1 never ran the pass (#443), run 2 ledgered nothing (#450), run 3 15.3 s / 1.8 ¢, run 4 served the stored report inside the §6.4 window, run 4b (hey.com) 17.0 s / 1.97 ¢ with presence measured, run 5 (cal.com) 0.6 s with nothing measured — the 2.16 MB home was refused `too_large` under the 2 MB cap, the refusal was ledgered as a null payload, and the pass ended `complete` (#479: the own-document cap and the `site_unreadable` ending, §6.4), run 6 (2026-09-11) plausible.io 7.6 s / 1.96 ¢ and cal.com 10.0 s / 2.30 ¢ with the 2.16 MB home read, both sites measured and both profiles unparseable on every attempt (#512, PR 518: structured output, §6.5). Time and spend pass; **not complete** until the profile/market half returns a profile (#462, then #512) and the score is measured.* |
| 4 | Questions + AI-Overview matrix + giveaway email + lead capture | 12 SERPs stored with their `ai_overview` references; draft only after email |
| 5 | Stripe + provisioning + setup | Pay → magic link → 3 decisions → deep pass queued |
| 6 | Deep scan + opportunities + calendar (fixture-free) | Real supply fills the calendar; empty days honest |
| 7 | Generation pipeline + draft view + veto | Draft passes all 5 hard rules; ≤45¢ enforced |
| 8 | Hosted CMS + publish state machine + verify | CNAME domain serves a published page; retry never duplicates |
| 9 | Autopilot + daily/weekly jobs + emails | A week runs hands-off; Monday email correct with missing values omitted |
| 10 | WordPress + settings/billing complete | Connect → draft lands with meta; token expiry = state not error |

**Sellable at the end of M4** (free funnel complete) **and chargeable at M7**
(paid loop minus publishing = review + copy). Ship the beta there if draft
quality needs proving before M8–M10.

Beyond M10 the work is tracked as GitHub milestones: M11 live verification +
environments (each §16 check that needs a real vendor or database), M12 go-live
readiness (SEO, error pages, accessibility, spend guards, observability,
security, performance, runbook, cutover), M13 copy (owner), M14 UI fidelity to
the approved set (one issue per screen).

## 17. Non-goals — do not build

Settings that tune the engine · feature flags · a crawler or sitemap reader ·
LLM-written UI text or emails · a second score · multi-site · approval workflows
/ comments / content calendars beyond §4.6 · images in drafts · backlinks, local,
per-country SERPs · Perplexity (v1.1) · Webflow/Shopify/Ghost/Framer/Notion
(v1.1) · community outreach of any kind.
