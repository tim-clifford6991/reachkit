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

**This document is complete on its own.** A detail found only in the artifact HTML or its JavaScript is
written here before it is built; until it is written here it is not specified (owner, 2026-09-10; §2.7).

## 0. Owner rulings required (2026-09-10)

Every item below is a place where the approved artifacts draw nothing and this document
therefore proposes rather than records. Nothing here is built until it is ruled. Line
references are `docs/design/approved/full-set/reachkit-full-screen-set.html` unless the
parent artifact (`docs/design/approved/reachkit-screen-system.html`) is named.

1. **Btn `:active`.** No pressed feedback is drawn for any rank (`.pill` L153–162 carry
   `:hover` only). Proposed: `:active` = the hover ground with `transform:none`, no shift.
2. **Btn `[disabled]`.** Not drawn anywhere in either artifact. Proposed: `--ink-3` text on
   `--sunk`, border `--line`, `cursor:default`, no hover change.
3. **`.pill-warn:hover`.** L159 gives the warn outline a border and a colour and no hover
   rule, so it alone among the four ranks does not answer the pointer. Proposed:
   `background: var(--warn-bg)`, matching `.pill:hover`'s shape one tone over.
4. **Input `[disabled]` and the dimmed card.** S10 dims a whole card with an inline
   `opacity:.6` (L682) and no field-level disabled style exists. Proposed: a disabled field
   is `--sunk` ground, `--ink-3` text, and the card is not dimmed as a whole.
5. **Invalid field.** Only the written line is drawn (`.invalid` L204); the field itself does
   not change. Proposed: `border-color: var(--bad)` on the field plus the existing line, and
   `aria-invalid` as the hook, so the state is not colour-only (§2 colour meaning).
6. **Switch hover, focus and disabled.** `.switch` L112–115 draws on and off and nothing else.
   Proposed: hover leaves it alone, focus is the global ring, disabled is `--line` at
   `opacity:.5` with the label greyed.
7. **Option card `:active` and `[disabled]`.** L296–298 draw base, hover and pressed only.
   Proposed: no active change; disabled = `--sunk` ground, `--line` border, `cursor:default`.
8. **Tag hover, focus and remove affordance.** `.tag` L301–303 draw base, `.on` and a `.x` at
   `opacity:.6`, with no pointer or keyboard state. Proposed: hover raises `.x` to full
   opacity; the tag itself does not change ground.
9. **Collapse summary hover and focus.** L282–285 draw the marker and its rotation only.
   Proposed: hover = `--sunk` ground on the summary row; focus is the global ring.
10. **Calendar cell focus and "open in the panel".** `.cd` draws hover and `today` (L326–327)
    but nothing for the cell whose day the panel is showing. Proposed: the open cell carries
    the hover ring permanently and `aria-current="date"`; focus is the global ring.
11. **Sidebar nav `:active` and the collapsed band.** Under 1024 the whole Workspace group is
    hidden (L90) and no replacement control is drawn, so Calendar and Settings are
    unreachable in the compact band. Proposed: the three items become a horizontal row inside
    `.side`, labels kept, counts kept.
12. **Footer link hover.** `.linkish` has one (L371); the footer's own anchors (L526–527)
    inherit `.foot nav` (L127) and draw none. Proposed: underline on hover, as `.linkish`.
13. **A motion token.** The set draws exactly one transition — `transition:transform .18s` on
    the collapse marker (L284). Proposed: `--motion-fast: .18s` as the one duration, spent on
    colour, border, box-shadow and transform, and nothing else.
14. **The 1024 boundary is off by one.** `bands.ts` places the compact|medium boundary at 1024
    because "the sidebar returns" there, but the artifact's `@media (max-width:1024px)`
    (L86, L90) collapses the sidebar **at** 1024. The same one-pixel disagreement affects
    `.g2/.g3` (L179), `.filters` (L338), `.editor` (L348), `.split` (L354) and `.hero` (L375).
    The day panel does not have it: L321 is `max-width:1279px`. Proposed: read every
    `max-width:1024px` in the set as `max-width:1023.98px`, so 1024 is the first medium width.
15. **S17's tabs.** §3 S17 says "two columns ≥1024, tabbed below"; the artifact stacks the two
    columns (L348) and draws no tab control. Proposed: below 1024 the two panes stack in the
    drawn order — Markdown, then Preview — and no tab strip is built.
16. **640 and 768 are not photographed.** Seven rules step at 640 (L123, L134, L145, L212,
    L295, L377) and two at 768 (L126, L323), all inside the compact band, and `widths()`
    renders 320 · 1023 · 1024 · 1279 · 1280 — none of them. Proposed: add 640 and 768 to the
    sweep, or rule that the compact band is asserted at 320 alone.

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
| Stat | `.stat-l` + `.stat-v` + `.stat-row` | label 13/600, value 44 mono; every value carries its delta or its goal, never bare — **one exception, the `specimen` arm** (2026-09-11, #488 / PR 500): S1's browser frame is the Overview in miniature and draws two of its three tiles bare (AI answers 2/12, Published 17; L545–547), so the carrier is optional in that arm and nowhere else |
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

## 2.4 Interaction states

Read with §2's component table. Each cell is the token change the artifact's CSS draws, with
its line in the approved set; "not drawn" cells are numbered in the rulings list above and are
not built until ruled. `--pg-*` rules (the preview page's own nav and toggle, L75–L81) are
furniture, not the product, and nothing below derives from them.

**Focus is global and it is one rule.** `:focus-visible{outline:2px solid var(--accent);
outline-offset:2px;border-radius:6px}` (L62; parent artifact ss.html:L73). It is not per
component, it is never removed, and it is the only focus treatment in the set. The one place a
component overrides the browser's own outline is `.input:focus`, which replaces it with a ring
of its own (L202) — that is a `:focus` rule, so it fires on pointer focus too, and the global
`:focus-visible` outline still lands on the same element for keyboard focus.

| Component (artifact class) | hover | focus-visible | active | disabled | selected / pressed | invalid |
|---|---|---|---|---|---|---|
| Btn · outline `.pill` | `--accent-bg` ground, border and text unchanged (L154) | global ring (L62) | not drawn — ruling 1 | not drawn — ruling 2 | n/a | n/a |
| Btn · solid `.pill-solid` | `filter:brightness(1.08)` (L156) | global ring (L62) | not drawn — ruling 1 | not drawn — ruling 2 | n/a | n/a |
| Btn · quiet `.pill-quiet` | `--sunk` ground, text `--ink-2`→`--ink` (L158) | global ring (L62) | not drawn — ruling 1 | not drawn — ruling 2 | n/a | n/a |
| Btn · warn `.pill-warn` | not drawn — ruling 3 | global ring (L62) | not drawn — ruling 1 | not drawn — ruling 2 | n/a | n/a |
| Input `.input` | not drawn | `outline:none`; border `--line`→`--accent`; `box-shadow:0 0 0 3px var(--accent-bg)` (L202) | n/a | not drawn — ruling 4 | n/a | field unchanged; one line below in `--t-sm`/`--bad` (`.invalid`, L204) — ruling 5 |
| Switch `.switch` | not drawn — ruling 6 | global ring (L62) | n/a | not drawn — ruling 6 | on = `--accent` ground, knob right (L112–113); off = `--line` ground, knob left (L114–115) | n/a |
| Option card `.opt` | border `--line`→`--accent-line` (L297) | global ring (L62) | not drawn — ruling 7 | not drawn — ruling 7 | `[aria-pressed="true"]` = border `--accent` + `--accent-bg` ground (L298) | n/a |
| Tag `.tag` | not drawn — ruling 8 | global ring (L62) | n/a | not drawn — ruling 8 | `.on` = `--accent-bg` ground, `--accent` text (L302) | n/a |
| Collapse `details.col > summary` | not drawn — ruling 9 | global ring (L62) | n/a | n/a | `[open]` rotates the marker 45°→−135° (L285) | n/a |
| Calendar cell `.cd` | `--shadow-card` + `0 0 0 1.5px var(--accent-line)` ring (L326) | not drawn — ruling 10 | not drawn | `.empty` = no ground, `inset 0 0 0 1px var(--line)`, `cursor:default`, date at `opacity:.55` (L330–331) | today = `0 0 0 2px var(--accent)` (L327); open-in-panel not drawn — ruling 10 | n/a |
| Sidebar nav `.nav` | `--sunk` ground, text `--ink-2`→`--ink` (L103) | global ring (L62) | not drawn — ruling 11 | n/a | `[aria-current="page"]` = `--accent-bg` ground, `--accent` text, count also `--accent` (L104, L107) | n/a |
| Link `.linkish` | underline (L371) | global ring (L62) | not drawn | n/a | n/a | n/a |
| Link · footer `.foot nav a` | not drawn — ruling 12 | global ring (L62) | not drawn | n/a | n/a | n/a |

**Selected is never colour alone.** Every selected form above changes two things — ground and
text on `.opt`, `.tag` and `.nav`; ring width and colour on `.cd` — and each carries
`aria-pressed` or `aria-current` in the markup that draws it (`.opt` L753, L809; `.switch`
L803; `.nav` L514). The attribute is the state; the tokens are its picture.

**Transition.** The approved set draws exactly one: `transition:transform .18s` on the collapse
marker (L284). Nothing else in either artifact transitions — every hover, focus and pressed
change above is instantaneous as drawn. (The parent artifact's `transition:background .15s,
color .15s` at ss.html:L86 is on `.navbtn`, the preview page's own screen switcher, and is
furniture.) One duration for the product is proposed as ruling 13; until it is ruled, `.18s`
on `transform` is the only motion this document specifies.

**Reduced motion.** `@media (prefers-reduced-motion:reduce){*{animation:none!important;
transition:none!important}}` (L63; parent ss.html:L74). It is universal, it uses
`!important`, and it kills animation as well as transition. Any motion added under ruling 13
inherits this stance without a further rule; nothing in `src/**` may opt out of it.


## 2.5 Responsive behaviour per band

**The three bands** are `BANDS` in `src/ui/layout/bands.ts`, and their floors are `BAND_MIN`:
**compact** 320 · **medium** 1024 · **wide** 1280. `tests/ui/layout/widths.ts` renders every
route at five widths built from those floors — 320 · 1023 · 1024 · 1279 · 1280 — the floor of
each band and each boundary minus one pixel, "which is where the off-by-one lives"
(ADR-093 decision 6). Two of the boundary facts are the bands' own definitions: 1024 is where
the sidebar returns, 1280 is where the day panel sits beside the grid.

The artifact steps at four widths: 640, 768, 1024 and 1279. Only two of those are band
boundaries; 640 and 768 subdivide the compact band and are not among the five widths
(ruling 16). Every `max-width:1024px` rule below fires **at** 1024, one pixel later than the
band it is meant to open (ruling 14).

| Surface | wide ≥1280 | medium 1024–1279 | compact 320–1023 | drawn at |
|---|---|---|---|---|
| Sidebar `.side` / `.frame.app` | grid `var(--w-sidebar) 1fr` — 222 beside the content (L85) | same as wide | one column (L86); `.side` becomes a horizontal flex row, loses its right border for a bottom one, `.side-foot` un-pins, and `.side-group` — the whole Workspace nav — is `display:none` (L90) | L86, L90 |
| Day panel `.panel` / `.calwrap` | grid `1fr var(--w-day-panel)` — 290 beside the grid, `position:sticky; top:var(--s-4)` (L320, L333) | one column: the panel drops below the grid, still sticky (L321) | same as medium | L321 |
| Report module 2, two equal cards `.g2` (and `.g3`) | `repeat(2,minmax(0,1fr))` / `repeat(3,…)` (L177–178) | same as wide | one column (L179) | L179 |
| Calendar grid `.calgrid` | `repeat(7,minmax(0,1fr))`, gap `--s-2` (L322) | same as wide | 7 columns down to 769; at ≤768 `repeat(2,minmax(0,1fr))` and the `.caldow` day-name row is `display:none` (L323) | L323 |
| Calendar filter cards `.filters` | `repeat(6,minmax(0,1fr))` (L337) | same as wide | `repeat(3,minmax(0,1fr))` (L338) | L338 |
| Landing hero `.hero` | `1fr 1fr`, gap `--s-7`, vertically centred (L374) | same as wide | one column, gap `--s-6`, `padding-top:var(--s-6)`; at ≤640 `.hero-h` drops 46px→`--h1` (L375, L377) | L375, L377 |
| Browser frame `.shot` | full width of its hero column; bar + body, no width rule of its own (L379–383) | same as wide | same — it inherits the hero's single column; **no `@media` of its own is drawn** | L379–383 |
| Public header `.pubbar` | one row: brand left, right slot right, `flex-wrap:wrap`, gap `--s-4` (L120) | same as wide | same — it wraps intrinsically; **no `@media` is drawn** (ruling: none proposed; the wrap is the behaviour) | L120 |
| Public footer `.foot-in` | `2fr 1fr 1fr` (L125) | same as wide | 3 columns down to 769; at ≤768 one column (L126) | L126 |
| Content well `.main` | padding `--s-6` (L121) | same as wide | `--s-6` down to 641; at ≤640 padding `--s-4` (L123) | L123 |
| Card `.card` / `.card-lg` | padding `--s-5` / `--s-6` (L132–133) | same as wide | at ≤640 both `--s-4` (L134) | L134 |
| `.h1` | `--h1` (L141) | same as wide | at ≤640 `--h2` (L145) | L145 |
| Tables `table.t` in `.wrapx` | `width:100%`, `min-width:360px`; the wrap is `overflow-x:auto` (L262–263) | same as wide | same — below ~360 the table scrolls **inside its wrap**, the page does not (L262) | L262–263 |
| AI dot-matrix `.mx` | rows `minmax(64px,84px) 1fr auto`, `min-width:320px`, `overflow-x:auto` on `.mx` (L241–242) | same as wide | same — scrolls inside itself, never the page (L241) | L241–242 |
| Rival rows `.rival` | `minmax(64px,1fr) minmax(110px,2.2fr) auto` (L210) | same as wide | at ≤640 `1fr auto` and the sparkline moves to its own full-width row, `order:3` (L212) | L212 |
| Sign-in split `.split` | `1fr 1fr` (L353); `.leftp-in` gets `margin-right:var(--s-7)` at ≥1024 (L357) | same as wide | one column and `.rightp` — the gradient panel with the glass specimen — is `display:none`, so the form is what remains (L354) | L354, L357 |
| Draft editor `.editor` | `1fr 1fr` (L347) | same as wide | one column (L348); no tab strip is drawn — ruling 15 | L348 |
| Setup option pair `.pick` | `repeat(2,minmax(0,1fr))` (L294) | same as wide | at ≤640 one column (L295) | L295 |
| ActionPanels `.acts` | `repeat(auto-fit,minmax(280px,1fr))` (L180) | same as wide | same — intrinsic, no `@media`; falls to one column below ~576 | L180 |

Two rules of the set are worth stating as behaviour rather than geometry. First, **nothing
scrolls the page sideways**: the two surfaces that can exceed their column — the report's one
table and the dot-matrix — each carry their own `overflow-x:auto` (L262, L241) and their own
`min-width` (L263, L242). Second, **no surface is deleted to fit except one**: the sign-in
gradient panel at ≤1024 (L354), which is a specimen and not a control, and the sidebar's
Workspace group (L90), which is a control and is ruling 11.


## 2.6 Icon vocabulary

Every icon in the set comes from one map — `I` at L466–489 — rendered by
`ico(k,w)` (L490), which emits `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
stroke-width="(w||1.8)" stroke-linecap="round" stroke-linejoin="round">`. Default stroke is
**1.8**; `w` overrides it. Colour is always inherited, never set on the glyph.

| Artifact name | lucide-react | Where it is spent (screen · element) | Size · stroke |
|---|---|---|---|
| `trend` | `TrendingUp` ✓ | brand mark, every screen (L512) · sidebar Overview item (L518) · card head "Searches you appear in" S1 L543, S12 L714, S13 L728 | 15 in brand mark (L93) and nav (L105), 15 in chip (L138) · stroke 2 in the mark (L512), else 1.8 |
| `spark` | `Sparkles` ✓ | S10 card head "Mode + destination" (L691) · S18 card head "Publishing" (L809) | 15 · 1.8 |
| `users` | `Users` ✓ | S10/S18 card head "Competitors" (L685, L686, L808) · S12/S13 card head "How far ahead each rival is" (L716, L730) | 15 · 1.8 |
| `cal` | `Calendar` ✓ | sidebar Calendar item (L518) · card head "This week" S1 L557, S12 L717 | 15 · 1.8 |
| `file` | `FileText` ✓ | ActionPanel icon on the veto-pending panel S1 L558, S12 L718, S13 L731 · card head "Your first page" S2 L590 · card head "Your content" S18 L820 | 14 in `.act-ico` (L185), 15 in chip (L138) · 1.8 |
| `bell` | `Bell` ✓ | card head "Needs you" S12 L718, S13 L731 · card head "Notifications" S18 L816 | 15 · 1.8 |
| `plug` | `Plug` ✓ | ActionPanel icon on the reconnect panel S12 L719 | 14 (L185) · 1.8 |
| `check` | `Check` ✓ | pricing spec rows S4 (L535) · completed `.step` bead S10 L689, S11 L700 | 15 in `.spec`, coloured `--ok` (L291); 9 in `.step .b` (L307) · stroke 2.4 in specs (L535), 3 in beads (L689, L700) |
| `mail` | `Mail` ✓ | S9 sign-in, link-sent state, 44px chip (L666) | 15 · 1.8 |
| `search` | `Search` ✓ | card head "Google search" S2 L582, S3 degraded L609 | 15 · 1.8 |
| `bot` | `Bot` ✓ | card head "AI answers" S1 L556, S2 L578, S3 L608 | 15 · 1.8 |
| `lock` | `Lock` ✓ | S9 link-expired state, 44px warn chip (L668) · card head "Account" S18 L819 | 15 · 1.8 |
| `card` | `CreditCard` ✓ | card head "Billing" S18 L817 | 15 · 1.8 |
| `gear` | `Settings` — not yet used in `src` | sidebar Settings item (L518) | 15 (L105) · 1.8 |
| `globe` | `Globe` ✓ | card head "Your site" / "Your site & market" S10 L681–683, S18 L807 · S19 the customer's own brand mark, tinted `--ink` (L826) | 15 · 1.8, and 2 in the S19 mark (L826) |
| `shield` | `Shield` ✓ | S18 "Danger zone" chip, `--bad-bg`/`--bad` (L821) | 15 · 1.8 |
| `pen` | `PenLine` ✓ | card head "How your pages sound" S18 L814 | 15 · 1.8 |
| `ban` | `Ban` — not yet used in `src` | S6 veto card head "Stopped" (L641) | 15 · 1.8 |
| `clock` | `Clock` ✓ | S6 veto card head "Publishes {date time}" (L639) | 15 · 1.8 |
| `play` | `Play` ✓ | S1 demo-video control inside `.play` (L554) | 24 (L386) · **filled, not stroked** — the glyph declares `fill="currentColor" stroke="none"` (L486), so its stroke width is inert |
| `copy` | `Copy` ✓ | "Copy link" pill S2 L577, S3 L620 · card head "Copy it out" S16 L780 · the Markdown and HTML pills S16 L780 | 14 in pills (L162), 15 in chip (L138) · 1.8 |
| `ext` | `ExternalLink` — not yet used in `src` | S15 day panel, live state, "View live page" pill (L743) | 14 (L162) · 1.8 |

✓ = already imported somewhere under `src/**`. The nineteen ticked names are exactly the
lucide-react imports the product writes today (`CreditCard`, `Shield`, `PenLine` and `Copy`
ticked 2026-09-11 by #486, PR 498); the three unticked are the icons the set spends that no
built screen has reached yet.

**The brand mark.** It is the `trend` glyph at stroke 2 inside a 26px `--r-field` square with
an `--accent` ground and `--on-accent` ink, beside the word ReachKit at `--t-body`/800
(`.brand` L91–94, `brand()` L512). There is no separate logo asset. S19 reuses the same mark
shape for the **customer's** brand with the `globe` glyph on an `--ink` ground (L826) —
ReachKit's own mark never appears on a hosted page.

**The rule.**

1. A stroke icon inside an `--s-6` chip renders at **15px** (`.chip svg` L138), and so does one
   in a sidebar nav item (`.nav svg` L105) and a pricing spec row (`.spec svg` L291).
2. An icon **inline in a pill** renders at **14px** (`.pill svg` L162), and so does one in an
   ActionPanel's 28px icon square (`.act-ico svg` L185).
3. The bead icons are smaller because their beads are: 9px in a 16px `.step` bead (L306–307),
   10px in an 18px `.stage` bead (L313–314).
4. Stroke is 1.8 unless the set says otherwise, and it says otherwise four times: 2 for the two
   brand marks (L512, L826), 2.4 for the pricing check (L535), 3 for the step bead check
   (L689, L700).
5. **Names come only from this table.** An icon the product needs that is not here is an
   artifact gap, and it is ruled by the owner before it is imported — the same bar §2.7 sets
   for a component.


## 2.7 Admitting a component or surface

The registry is closed, in three places at once, and `tests/ui/design/component-registry.test.ts`
is what closes it. The **fifteen** daisyUI registers are BUILD §2.2's own backticked list and
the barrel's exports, pinned against each other in both directions — "every class name §2.2
backticks is registered" and "every registered name is one §2.2 backticks", with "the barrel
exports exactly the fifteen §2.2 registers" as the third pin — and a sixteenth daisyUI
component reached by writing its class by hand fails
`unregisteredDaisyClasses`. The **idiom** (`src/ui/idiom/idiom.css`) is not a sixteenth
component: it is the owner's 2026-09-02 card idiom, and it widens `Card`'s head, `Btn`'s ranks
and `Progress`'s ground rather than adding a widget. The **five** custom-CSS surfaces are
§2.2's — the calendar grid, the day panel, the AI dot-matrix, chart SVGs and the sidebar — and
they are asserted by path glob over the whole tree, not against a list of known files, so a
stylesheet nobody declared still fails. Everything else in this document is drawn from those
sets and nothing else.

A sixteenth component, or a sixth custom surface, is admitted only by all four of:

1. **An artifact element that no registered component renders.** Not a convenience, not a
   variant: an element the owner's approved set draws that the fifteen plus the idiom cannot
   produce. Where a registered component's markup is needed outside `src/ui/components/**`,
   the answer is a `HAND_WRITTEN` row in the registry test — which is still one of the fifteen,
   and is friction on purpose — not a new component.
2. **A row in the §2 table above**, with its artifact class and its contract written in the
   same voice as the rows beside it, and its interaction states in §2.4 and its band behaviour
   in §2.5 written at the same time.
3. **Registration in `tests/ui/design/component-registry.test.ts`** — a `REGISTERED` entry
   naming the daisyUI stylesheet that defines its class, or an `ALLOWED_CSS` entry with the
   clause that admits it. An entry with no clause fails the test that reads the clauses.
4. **An owner ruling recorded in `DECISIONS.md`**, dated, in the form §1's twelve rulings take.
   The §2.2 paragraph in BUILD.md is amended in the same change, because the test asserts that
   paragraph verbatim and the fifteen are read out of it.

**The completeness rule.**

> This document is complete on its own. A detail found only in the artifact HTML or its
> JavaScript is written here before it is built; until it is written here it is not specified.

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
