# ReachKit v3 — UI specification

**Status: approved by the owner, 2026-09-08.** This document is the written form of the approved
screen set (`reachkit-full-screen-set.html`, twenty screens with their states) and is the
reference every UI issue and PR cites. Where this document and BUILD.md §4 differ, this document
wins until the §4 amendment lands (queued on #2). Where this document is silent, the archived
requirements (`archive/sdlc-factory-2026-09-04/corpus/docs/requirements/REQ-*.md`) and decisions
(`decisions/ADR-*.md`) are the detail; the archive's *drawings* are superseded.

Sources, in order of authority: (1) the owner's artifact "ReachKit Screen System"
(`../reachkit-screen-system.html`, tokens in `../tokens.css`); (2) the owner's twelve rulings of
2026-09-08 (§1 below); (3) the approved full set (this directory); (4) REQ/ADR criteria cited per screen.

## 1. Rulings of 2026-09-08 (owner, decision sheet v3, #357)

| # | Ruling | Consequence |
|---|---|---|
| 1b | Report header keeps three driver mini-bars with `n/10` values | REQ-004 c2 and BUILD §4.1 amended: driver values may be shown on the header strip only |
| 2b | Two solid primaries per screen are allowed where the artifact draws them (landing: header CTA + hero CTA; report: Email me + Start) | supersedes master rulings #290/#291; every further CTA on the landing scrolls to the one field (REQ-099 c3) |
| 3a | Public header = brand · Sign in (quiet) · one solid CTA; a minimal footer on every public page (brand, rights line, removal address, Product, Legal) | footer is new; legal routes and the removal address reachable from every public page |
| 4c | Demo video block renders a 16:9 frame with a play control and one written line before the asset exists | REQ-099 c6 amended |
| 5c | The sign-in card (47/100, `+6 pts est.`) and the hero component's figures render as drawn on `example.com`, without a source date or an example line | REQ-098 c5 and REQ-099 c8 / open question 4 amended: reserved-domain specimens are admitted without the written line |
| 6a | "Discoverability Score" is the number's name on every surface that labels it | report head eyebrow, Overview tile, landing component tile, weekly and report mail |
| 7a | Headline numerals are JetBrains Mono (`--font-num: var(--font-mono)`); no sans option | the numerals toggle is removed |
| 8a | Card radius is `--r-box: 14px` everywhere; `--r-card` is removed | |
| 9a | Problem cards carry a severity word from the closed set (Critical · Worth fixing · Nothing to fix) **and** the who-does-it badge (Free fix · 10 min / ReachKit writes / ReachKit rewrites) | REQ-009 c1, c5, c8 |
| 10a | Every literal in the artifact resolves to the token ladder: type 15 / 13 / 12 / 11.5 / 11 (`--t-body --t-sm --t-xs --t-explain --t-eyebrow`), nothing under 11 px; sidebar `--w-sidebar: 222px`; day panel `--w-day-panel: 290px`; breakpoints 640 / 768 / 1024 / 1280; chip `--s-6` square with `--r-field` | ADR-093 d1/d3 hold; the token gate (#349) is strict |
| 11a | The artifact's unbracketed strings are approved copy as written | the copy registry fills those keys from this set; only bracketed strings remain owner-owed |
| 12a | Controls the requirements mandate and the artifact omitted are built in its idiom | §3 marks them **new** |

## 2. Design system

**Tokens.** `../tokens.css` is the source of truth for `src/ui/theme.css` (48 product tokens, three
blocks: light `:root`, guarded dark, explicit dark). Additions under 10a: `--t-body 15px`,
`--t-sm 13px`, `--t-xs 12px`, `--w-form 420px`, `--w-sidebar 222px`, `--w-day-panel 290px`.
Removed: `--r-card`, `--num-weight` stays at 600. No colour, radius, shadow, spacing, type size,
measure or breakpoint may be written as a literal in `src/ui/**` or `src/app/**` (test: #349).

**Type ladder.** h1 31 · h2 25 · h3 20 · h4 16 · body 15 · sm 13 · xs 12 · explain 11.5 · eyebrow 11
(uppercase, `.1em` tracking, `--ink-3`, 700). Numerals, dates, URLs, searches and code: JetBrains Mono
with `tabular-nums`. Big number `--t-num-big 44`, weight 600, `-.03em`.

**Colour meaning.** `--accent` is the product and the customer's own series; `--ok/--warn/--bad`
are state only and never decorative; `--chart-rival` is every rival series. A band is conveyed
in words, never by colour alone.

**Components** (the registered set, BUILD §2.2, as the artifact spends them):

| Component | Artifact class | Contract |
|---|---|---|
| Card | `.card` (`.card-lg`, `.card-accent`) | `--surface`, `--r-box`, `--shadow-card`, padding `--s-5` (`--s-6` large); head = chip + eyebrow + optional right slot |
| Chip (icon) | `.chip` | `--s-6` square, `--r-field`, `--accent-bg` / `--accent`; lucide-style 15px stroke icon |
| Btn | `.pill` `.pill-solid` `.pill-quiet` `.pill-warn` `.pill-lg` `.pill-block` | pill radius; solid = the action; outline (accent) = secondary; quiet = tertiary; warn outline = veto/stop |
| Badge | `.badge .b-ok/.b-warn/.b-bad/.b-neutral/.b-accent` | 11px 700, text required, tone by state |
| Source chip | `.srcchip` | mono 11.5 on `--sunk`, names a source and date |
| Stat | `.stat-l` + `.stat-v` + `.stat-row` | label 13/600, value 44 mono; every value carries its delta or its goal, never bare |
| GrowthLine | `areaChart()` | area fill under an accent line, endpoint dot with surface ring, footnote pair start · goal |
| RivalSparkline | `spark()` in `.rival` rows | name · falling gray line with accent endpoint · `78×` · `was 276×` badge |
| WeekStrip | `.week .day` | seven cells, states done / today / unmeasured / to-come |
| Occupancy bars | `.occ` | rival gray, customer accent, zero row red-ringed, `n/12` direct-labelled |
| AiDotMatrix | `.mx` | rivals' cited cells gray, muted cell = no AI answer, customer row empty red-ringed, `n/m` |
| Question list | `.q` | `n · "question"` · `not you` badge · mono provenance line |
| Table | `table.t` in `.wrapx` | the one table (report, absent searches); scrolls inside its wrap |
| Problem card | `.prob .sev-*` | left border = severity colour; title · severity badge · who-does-it badge · count · optional code block |
| Collapse | `details.col` | summary + body, server-rendered |
| ActionPanel | `.act` (`.act-warn`) | tinted panel: white icon chip · bold title · dim line · one pill |
| Steps | `.steps .step` (setup progress) · `.stage-list .stage` (named stages) | never a bare spinner |
| Option card | `.opt[aria-pressed]` | selectable box; selected = accent ring + `--accent-bg` |
| Tag | `.tag` (`.on`) | mono chip for domains/categories/claims, removable |
| Input | `.input` (`textarea.input`) | mono 13, `--r-field`, focus ring `--accent-bg`; invalid = one written line below |
| Switch | `.switch` (`.off`) | on = accent |
| Calendar grid | `.calgrid .cd` | `repeat(7,minmax(0,1fr))`; cell = date · stage badge · title; today ringed accent; empty = outline only + optional one line |
| Day panel | `.panel` | 290 sticky beside the grid ≥1280, in flow below |
| Sidebar | `.side` | 222; brand · domain block · Workspace nav (3) · autopilot card with switch |
| Public header / footer | `.pubbar` / `.foot` | §1 rule 3a |
| Glass card | `.glass` on `.rightp` | sign-in specimen (5c) |
| Mail shell | `.mail` | brand head · one heading · mono fact rows · one button · mono footer |

## 3. Screens

Legend: **spec** = BUILD/REQ verbatim or approved copy (11a); **new** = required by REQ, not in the
owner's artifact, drawn in its idiom (12a); **owed** = bracketed, owner writes it.
Every screen: no generated prose except the page ReachKit writes (labelled); every empty state is one
written line; one headline number per module.

### S1 Landing `/` — REQ-099, REQ-001
Header (3a). Hero: tagline (spec, verbatim) · subline (owed) · one input + one solid CTA (owed label) ·
"free · no account · permanent link" · the product component = the Overview's own cards in a browser
frame (`reachkit.app/app`): "The gap is closing." + every-week badge, GrowthLine, three tiles
(Discoverability Score 62 ▲8 · AI answers 2/12 · Published 17). Video block (4c): frame + play +
"[demo video — asset not yet produced]" + caption (owed). Sections 01 why-care (owed heading/body)
beside the live AI-answers matrix card ("Every filled row is a rival being recommended. The empty one
is you."); 02 what-it-does beside the This-week card with an ActionPanel; 03 how-to-start: three Step
cards (titles spec, bodies owed) · closing solid CTA (owed) · "Cancel in one click." Footer (3a).
Invalid input: one written line beside the field (S3 malformed). Every further CTA focuses the field.

### S2 Free report `/scan/{domain}` — REQ-004…010, 013, 090, 094
Header: brand · Copy link (quiet). Module 1 header card: domain (mono h3) · "measured {date} ·
[category] · Not your market?" (REQ-094) · right: eyebrow **Discoverability Score** · 62 · band word
badge · one written line naming the driver · three driver bars `[driver n] x/10` (1b).
Module 2, two equal cards: **AI answers** (source chip "Google AI answers · {date}", denominator line,
AiDotMatrix, divider, "The 12 questions" list, "Show all 12", legend chip) · **Google search**
(source chip, occupancy bars, divider, "5 biggest searches you're absent from" table, totals footnote).
Module 3, three problem cards (9a): AI readers blocked (Critical · Free fix · 10 min · count · robots
code block) · Missing pages (Worth fixing · ReachKit writes · count) · Unquotable pages (Critical ·
ReachKit rewrites · count); severity words from the closed set follow the count (REQ-009 c8).
Module 4 "The complete method, free": three collapses (owed). Module 5 first-page card (accent ring):
title · target/beats/format rows · email input + solid "Email me the full page" · "That's page 1 of
N we found for you." Module 6 pricing card (S4's card, solid Start). Last line: removal address.
Footer.

### S3 Report states — REQ-003, REQ-004 c3/c6/c9, REQ-015, REQ-002
scanning: named stages with times, no spinner, "Under a minute. This address is permanent."
degraded: score "—", no band, one line naming what was not measured and why; the unmeasured card
says so with "Retry this part"; measured cards render. cooldown: "did not finish" · one line · "Try
again" (no auto-restart). malformed: field kept, one line beside it. removed: one line, "Scan another
site".

### S4 Pricing `/pricing` — REQ-021 c4, REQ-022 **new**
Header · eyebrow "Start ReachKit" · heading + subline (owed) · the one pricing card: €49 /month, VAT
included · four spec rows (1 page a day … · Weekly re-measure … · Weekly movement email · 24-hour veto
window …) · solid "Start ReachKit €49" · "Cancel in one click." · footnote "No account before payment…"
· footer. Exactly one offer and one checkout control.

### S5 Legal `/privacy` `/terms` `/imprint` **new**
Header · eyebrow Legal · title (owed) · "updated [date]" · one card with the Markdown body (owed) · footer.
One renderer for the three routes.

### S6 Veto page `/veto/{token}` — REQ-057, REQ-075 **new**
ask: card "Publishes {date time}" · page title · search/site rows · solid "Stop this page" · "Or do
nothing and it publishes as planned…". done: "Stopped" · "This page will not publish. Tomorrow's page
is unaffected." · quiet "Open the calendar". Works without a session.

### S7 Opt-out `/opt-out/{token}` — REQ-010 c11 **new**
One card: "Opted out" · the address · "No more follow-up mail will reach … for this domain or any
other. The page you asked for stays yours." · quiet "Back to ReachKit".

### S8 Not found / error **new**
Eyebrow 404 · "There is no page at this address." · "Reports live at reachkit.app/scan/yourdomain.com"
· scan field + solid "Scan it" · footer. The error page is the same shape with one written line.

### S9 Sign in `/signin` — REQ-098
Two panels ≥1024, form first below. Left: brand · "Welcome back" · body (spec verbatim) · email
input · solid "Send my link" · "New to ReachKit? Start a free scan →". States: sent (mail chip ·
owed head/body · "sent to {address}" · quiet resend) · expired (lock chip · owed head/body · solid
"send a new link"). Right: accent gradient · "One number tells you how findable you are." · glass
card: example.com · Discoverability Score · `+6 pts est.` · 47 /100 · bar at 47% · "Hard to find —
and we'll show you the fixes that move it." (5c).

### S10 Setup `/setup` — REQ-025…028, REQ-021 c7
Progress Paid · Setup · First page. Head (owed). report: card "Your site & market" (domain + Change,
category tag + Change). noreport: card "Your site" with an empty input first ("Nothing is taken from
the address you paid with"), market card dimmed until given. Competitors card: tags (chosen on,
removable) · add field · "n of 5" · owed line; degraded: "No rivals could be suggested…" + add field.
Mode + destination card: Autopilot (default) / Copilot option pair · Hosted blog (CNAME code) /
WordPress ("connect later, ask me after the first page"). Solid "Start — first page in ~3 minutes." ·
"You can reach Settings, cancel or export at any time — finishing setup is not required for that."

### S11 Waiting `/setup/waiting` — REQ-029 **new**
Progress with First page current · head (owed) · card of named stages with elapsed times · "About
three minutes… If it finds nothing worth writing, it says so — it never invents a page." · "You can
close this tab; the sign-in link in your mail brings you back."

### S12 Overview `/app` — REQ-040, 041, 042, 092
Sidebar (222): brand · domain block "Week n · re-measured Mon" · Workspace: Overview / Calendar (count)
/ Settings · autopilot card (switch · "Publishing daily" · "next · {day time}"). Head "The gap is
closing." + "▲ every week since you started". GrowthLine card (source chip "re-measured {date}";
footnotes "started at 12" · "At 400 the big category terms unlock."). Three tiles: Discoverability
Score 62 ▲8 band · AI answers 2/12 goal: 6 + dot row with goal dots · Pages published 17 "6 already
ranking" "rest under 3 weeks — too early to judge". Rivals card: sparkline rows · "Every line pointing
down is the gap shrinking." This week: WeekStrip · quiet "Open calendar →". Needs you: ActionPanels
(veto-pending warn, solid "Read it" · needs-you accent, outline "Reconnect").

### S13 Overview, week 0 — REQ-040 c7, REQ-021 c11 **new**
Domain block "not measured yet · first due Mon {date}"; no calendar count; autopilot card "First page
after the deep pass · deep pass running". Head "Your first page is ready to read." + "week 0". Chart
with one point ("starting at 12 · the line begins with the first Monday"). Tiles: "—" with "first
measurement due {date}" · "—" goal: 6 · Pages 0 "first page in review today". Rivals: one line. Needs
you: the first page's ActionPanel.

### S14 Calendar `/app/calendar` — REQ-043
Head "One page a day. Every day." · ← Sep 2026 →. Six filter cards with counts (All · Live · Your
review · Scheduled · Planned · Needs you). Grid Mon–Sun, `repeat(7,minmax(0,1fr))`, cell = date ·
stage badge · title; today ringed; future empty days outline-only, an exhausted-supply day carries
"nothing worth publishing". Footnote (spec). Panel beside the grid (S15).

### S15 Day panel states — REQ-043 c8–c12, REQ-044
review: badge · date · title · "Why this page" rows (search · asked · answered today by · you · done
when) · solid "Read the full page" · Move · Veto (warn outline) · "written {ts} · measured {date}".
live: rows · outline "View live page" (external) · "verified live {ts} · measured {date}". planned:
rows · Move · Skip · "written the evening before". needs: one written cause · solid "Reconnect
WordPress" · "last good delivery {date}". empty: "Empty day" · the date's one account · measured line ·
no action.

### S16 Draft `/app/draft/{id}` — REQ-045, REQ-093
"← Back to calendar". Card: Your review + claim-checked badges · "generated by ReachKit · labelled"
chip · title · "draft written {ts} · ~{n} words" · body with grounded fact marked + source line.
Copy-out card: Markdown · HTML. Panel: Decide · solid Approve · Edit · Veto (warn) · "If you do
nothing" info (owed body · "publishes {date time}") · Checks list (grounded · do-not-claim · near-
duplicate · no invented author).

### S17 Draft edit — REQ-045 c5–c11, BUILD §4.6 **new**
"← Back to the draft" · Your review + state badge (edited · re-check on save / claim check running /
unsaved). Card: title · save line (saving… / saved {time} / "could not save — your text is kept here;
nothing unsaved publishes") · two columns ≥1024, tabbed below: Markdown textarea · Preview · footnote
on autosave, grounding and re-check. Solid "Done editing" · quiet "Discard changes".

### S18 Settings `/app/settings` — REQ-070…079 (**new** rows marked)
Left: Your site & market (domain + Change **new** · market + Edit · rebuild line) · Competitors (5 tags,
removable) · Publishing (Autopilot/Copilot pair + one line on what the pair does · Veto window stepper
in days · Publish time **new** · Time zone **new** · Publishing on/off **new** · destinations with health
and Reconnect · "Fix-type tasks are never automated, whatever the mode.") · How your pages sound
(voice textarea **new** · Never claim tags + add **new** · one line on the hard filter) · Notifications
(Daily draft-ready mail · Published-page mail · Monday movement mail · "Sign-in and account mail cannot
be switched off."). Right: Billing (€49 active · next invoice date · amount · card · Update card /
Invoices / Cancel plan · cancel line) · Account (name · email · owed note · Change email · Sign out) ·
Your content (Pages n · outline "Export everything") · Danger zone (bad ring · Unpublish all · Delete
account · "pages are exported to you first, never silently destroyed"). Nothing that tunes the engine.

### S19 Hosted page `content.{domain}/{slug}` — REQ-059 **new**
*(Host amended 2026-09-10: the set's specimen drew `blog.example.com` as a placeholder; the product's hosted subdomain is `content.` — BUILD §9, `HOSTED_SUBDOMAIN_LABEL`. Found by #413.)*
Customer brand header (their name, dark mark) · category eyebrow · title · "published {date} · by
[customer brand]" · the page body · "Written for {domain}. Canonical … · noindex on *.reachkit.app"
· customer footer line. ReachKit's name appears nowhere the customer did not put it.

### S20 Mails — BUILD §12, REQ-064, REQ-075 **new**
One shell: brand · one heading · one short line · mono fact rows · one solid button · mono footer
(the reason it was sent, the toggle or opt-out where stoppable, imprint line, plain-text alt).
Kinds: magic-link · report · first-page (page in a code block + Markdown/HTML) · draft-ready ("Publishes
tomorrow at 07:00 unless you say no." · "Stop this page") · published · weekly (only measured values;
a missing number omits its row) · nurture (owed, at most three, stops on subscribe). No generated
prose in mail.

## 4. Rules that bind every screen
1. One solid primary is the screen's own action; a second solid only where §1 rule 2b names it.
2. Every numeral in mono with tabular-nums; every value carries its delta, its goal or its denominator.
3. Every empty, degraded or waiting state is one written line; never a spinner, never a blank card.
4. Charts before tables; a table only where BUILD §4.1 names it.
5. No generated text anywhere except the page ReachKit writes, labelled where it appears.
6. Every customer-visible string is a copy key; bracketed strings here are `TODO(copy)` until the
   owner writes them; unbracketed strings are approved (11a).
7. Every UI PR carries the token table and the side-by-side render against this set (screen id).
