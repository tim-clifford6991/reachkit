# Component Registry

> Rule 7.3: UI code may use registered components only. A new one enters as
> `proposed` with its data contract and states, and needs sign-off before use.
> A second component overlapping an existing one's purpose is flagged here
> and blocked via a `blocked-by` edge on its owning BP node, reasoning in
> that BP's own body — this table has no body of its own to hold one.

**Status vocabulary.** `proposed` → `approved`. A row goes to `approved` when a
preview carrying that component is signed off, and not before (design-system
skill, step 3). **The fifteen §1 rows are now `approved`; every other row
below is still `proposed`.** (Read *every row below is `proposed`* before the
owner's 2026-09-03 signatures; corrected here.) Six previews now exist (§5)
and three are signed — `WO-029.html`, `WO-268.html` and `WO-002.html`, dated
and sourced in §5 — and a drawn preview is not a signed one on its own: a row
flips on a signature, not on a drawing, and only `WO-268.html`'s signature
touches a §1 row (all fifteen, per §5's table). The owner ruling four token values on
2026-09-02 (`tokens.md` §2) moved no row here either: ruling a value and
signing a sheet are different acts. **Nor did the owner's second 2026-09-02
ruling** — nothing clipped, every screen size — which changed `RivalSparkline`'s
geometry, three surfaces' narrow-viewport behaviour and nine tokens, and moved
no row. A rebuild is a drawing too. **Nor did the owner's third 2026-09-02
ruling**, which approved a card idiom ("A · Six boxes") and is recorded in §7:
endorsing a *shape* is a third kind of act alongside ruling a value and signing
a sheet, and it moves rows exactly as the other two did — not at all.

**Two closed sets, plus their surfaces.** `BUILD.md` §2.2: *"daisyUI components
only — no bespoke widgets."* Custom CSS is admitted for exactly five things:
*"the calendar grid, the day panel, the AI dot-matrix, chart SVGs, and the
sidebar — nothing else."* §2.4 closes the chart inventory at five.

**No component holds copy.** BP-018 decision 2: every label, empty state and
tooltip is a **required prop**. A default string is a product sentence nobody
wrote and nobody can find. "Required" in the contracts below means exactly
that — no fallback, no placeholder, no sensible default.

---

## 1. daisyUI primitives (15) — BP-018

| Component | Status | Data contract | States | Owning BP | Preview |
| --- | --- | --- | --- | --- | --- |
| `Btn` | approved | daisyUI `btn` (+`primary`/`ghost`/`sm`/`block`). `label` required. Also carries the copy-to-clipboard affordance — no separate copy component exists | default · disabled · in-flight (a submit that is disabled while posting) | BP-018 | — |
| `Card` | approved | `card`/`card-body`/`card-title`. Title slot takes a **verdict node**, not a metric label — §2.5: the card leads with the answer | default · degraded (one written line in place of a missing section — never an empty card, never a spinner) | BP-018 | — |
| `Badge` | approved | `badge` (+`primary`/`success`/`warning`/`error`/`ghost`), keyed by `Tone`. **Requires a text child** — a tone alone may never carry meaning | default | BP-018 | — |
| `Alert` | approved | `alert`, four tones. `message` required; no default empty-state sentence | default. **An intended-empty state takes `neutral` or `ok`, never `bad`/`warn`** (§2.5: an empty queue is a success state) | BP-018 | — |
| `Stat` | approved | `stats`/`stat`. Value renders through the mono numeral utility. One headline number per module; every value carries its delta or its goal, never bare | measured · measured-zero (prints `0`) · unmeasured (prints `—` plus one written line naming the reason) | BP-018 | — |
| `Tabs` | approved | `tabs`, boxed + bordered. Every tab label required | default · selected | BP-018 | — |
| `Table` | approved | `table` (+`zebra`), **always inside an `overflow-x-auto` wrap** — the wrap is part of the component, not the caller's job | rows · empty (caller-supplied written line) · **never a skeleton** | BP-018 | — |
| `Progress` | approved | `progress`. **Determinate only** — a caller cannot request an indeterminate bar. This is also the three driver mini-bars of the report's header strip (§4.1); mini-bars are *not* a sixth chart | default | BP-018 | — |
| `Toggle` | approved | `toggle`. Label required; no default on/off wording | on · off · disabled | BP-018 | — |
| `Steps` | approved | `steps`. **Each step's label required** — this is what the scan's named stages render through, so an unlabelled step cannot exist (REQ-003 c1: never an unlabelled spinner) | pending · active · done | BP-018 | — |
| `Join` | approved | `join`. Layout only | — | BP-018 | — |
| `Collapse` | approved | `collapse`. Summary text required. Server-rendered body, not a lazy fetch (REQ-009 c6 is readable without JavaScript) | collapsed · expanded | BP-018 | — |
| `Input` | approved | `input`. Placeholder **and** label required, never defaulted | default · invalid (one written line, value intact) · disabled | BP-018 | — |
| `Divider` | approved | `divider`. Layout only | — | BP-018 | — |
| `Kbd` | approved | `kbd`. Renders through the mono utility — a code-like string under §2.3. **Inline only**; it is not a code block (see §4) | — | BP-018 | — |

## 2. Custom surfaces (4) — BP-018

The only places custom CSS is admitted, alongside chart SVGs.

| Component | Status | Data contract | States | Owning BP |
|---|---|---|---|---|
| `Sidebar` | proposed | Destinations as a **required prop** (the three destinations are BP-037's tuple, not this component's); publishing-state line as a required node. Width `--w-sidebar`. Names no destination and no state wording of its own | default · a destination with a count · a destination with no count (`0` renders no count at all) | BP-018 |
| `AiDotMatrix` | proposed | Cells with a **required label each** and **three cell states, not two** — see §4, gap 1. Row identity (`you` / `rival`) is part of the contract because §4.1 rings the customer's own empty row and fills rivals' gray. No legend-only mode; a written count renders alongside, caller-supplied | cited · not-cited · **muted** (a question with no AI answer — §6.2: *"never as a miss"*) | BP-018 |
| `CalendarGrid` | proposed | One entry per date: `date`, `stage`, `tone`, **`label` required** — a day can never render as a coloured cell alone. Columns `--grid-week`; a cell is never narrower than `--w-cell-min`, and where seven cells cannot each clear it the **grid changes, not the type** (`tokens.md` §2b). Dates render mono. Knows nothing of what a stage means and **performs no padding**: an empty day is an absent entry the caller decides about | filled day · empty day (caller's one written line) · today (ringed accent) · **never a padded placeholder** (§4.6: *"the calendar is never padded"*). **Below `--breakpoint-md`: seven rows, not seven columns — `proposed`, see §4 gap 8.** A CSS rule only; no second markup path, no `narrow` prop, and no cell invented | BP-018 |
| `DayPanel` | proposed | Required heading node, required account node, actions slot, **and a ways-through slot taking an ordered list of routes, each with its own required label, address and a required "leads nowhere" account that renders in place of the route — see §4, gap 7**. Supplies none of them and offers **no default action**. Width `--w-day-panel`; sticky beside the grid, **not a drawer** (§4.6) — at and above `--breakpoint-xl`, which is the width where a 290px column and the grid at its own cell floor both fit | page selected · no page (the date's one account, no publish/approve action) · **a route offered · a route withheld with its account · a route not applicable, rendering as nothing** (REQ-043 c12; the third case added 2026-09-02 from `previews/WO-033.html` §4 — see §4 gap 7). **Below `--breakpoint-xl`: a full-width block following the grid, in flow, not sticky, still not a drawer — `proposed`, see §4 gap 8** | BP-018 |

## 3. The closed chart inventory (5) — BP-018

§2.4: *"The chart inventory is closed … A new chart form is a design-artifact
approval first."* Every chart obeys the §2.4 constraints in `tokens.md` §5:
two series colours, direct labels on every mark, one axis, inline SVG.

| Component | Status | Data contract | States | Owning BP |
|---|---|---|---|---|
| `GrowthLine` | proposed | Weekly points, each with its **own measurement date**. **Must accept a gapped series** — an unmeasured week is a break with that week's own account beside it; never carried forward, never interpolated. Area + line in `--chart-you`, endpoint labelled | series · gapped series · **no-measurement** (one written line carrying the first-due date, in place of the chart) | BP-018 |
| `PresenceBars` | proposed | One bar per domain, direct-labelled with name and value. Customer in `--chart-you`, every rival in `--chart-rival`. No legend-only mode | bars · zero for the customer (`0` is a measurement, rendered, never an error) | BP-018 |
| `AiDotMatrixChart` | proposed | The chart form of `AiDotMatrix` over the **same cell type, imported and never re-declared** (rule 7.1: one capability, one shape). Adds axes, tooltip and the shared primitives | as `AiDotMatrix`, plus dashed goal dots where a goal exists | BP-018 |
| `RivalSparkline` | proposed | Per rival: name, falling series, endpoint. **The props accept no `Tone` at all**, so §2.5's "rival strength is neutral gray, never red" cannot be broken by a prop. Two arms: absolute (rivals' counts beside the customer's own) and ratio. **The endpoint dot is `--chart-you` and that is transcribed, not a slip** — §4.5 reads *"falling sparkline (gray, accent endpoint)"*. It is the one mark on a rival's row carrying the customer's colour; recorded here so nobody later "corrects" it. **Geometry (rebuilt 2026-09-02):** the plot is the hand-sized 120×32 inside a 132×44 viewBox — the twelve extra units are padding on every side, so no mark reaches an edge. The row is a three-area grid, not a flex line, and the plot column is floored at `--w-spark-min` so the endpoint dot cannot scale under §2.4's 3.5–5px | absolute (used while the customer's count is 0 — **never a ratio**, §6.6: a division by zero reads as broken) · ratio (unlocks at ranked ≥ 10) · **gapped series — see §4, gap 6.** The gapped arm's type carries **no `delta` member** and the 2026-09-02 rebuild did not add one | BP-018 |
| `WeekStrip` | proposed | Seven days, each direct-labelled with its date through the mono utility, in the customer's own time zone. Seven days can never become six, so the strip takes the same `--w-cell-min` rule the calendar grid takes | done · today · to-come · **a day with nothing measured renders as a labelled empty mark, never a gap**. **Below `--breakpoint-md`: seven rows, not seven columns — `proposed`, see §4 gap 8.** The state label is never dropped and never shrunk | BP-018 |

## 4. Consumed by a work order, declared by no blueprint

Each row is a gap someone must close before the naming work order's preview can
be drawn. Registered `proposed` so the gap is visible, not so it is settled.
None may be used until approved.

| # | Component / contract | Who consumes it | The gap | Owning BP |
|---|---|---|---|---|
| 1 | `AiDotMatrix` **three-state cell + row identity** | WO-033 declares the cells two-state (`{ label, filled }`) | §4.1 needs three: *"rivals' cited rows filled gray, customer's row empty red-ringed … a no-AI-answer question = muted cell"*, and §6.2 repeats *"render a no-AI-answer question as a muted cell, never as a miss."* A boolean cannot hold three states, and it cannot say whose row it is — so the red ring on the customer's own absent row is unexpressible and a muted cell collapses into a miss. **This is a defect in the contract, not a styling preference** | BP-018 (contract widening, not a new component) |
| 2 | `Textarea` | WO-172 `Editor.tsx` | §4.6 fixes the shape by owner ruling: *"Edit = Markdown textarea with a live preview pane (owner ruling, 28 Aug) … no rich-text editor."* §2.2's set has `input` and no multi-line control, and BP-018's public interface declares none. The draft editor cannot be built from the registered set | none — needs a BP-018 row |
| 3 | Code block (`CodeBlock`) | WO-066 (the robots lines), WO-172 `CopyOut` | §4.1: *"the robots lines verbatim in a code block"*, and REQ-009 c2 requires them verbatim and copyable. `Kbd` is an inline key cap, not a block. §2.2's custom-CSS allowance lists five surfaces and a code block is not among them, so it is neither a registered primitive nor an admitted custom | none — needs a BP-018 row |
| 4 | An indeterminate "still running" affordance | WO-153 `Waiting.tsx` | The waiting frame *"renders **no** elapsed, estimate, countdown, clock or percentage"* — so `Progress` (determinate only, by WO-031's own rule) cannot serve it, and REQ-003 c1 forbids *"an unlabelled spinner or an indeterminate bar alone."* Nothing registered renders motion without a number. `Steps` covers the *scan* progress (named stages); the deep-pass waiting frame has named stages too, so `Steps` **may** be the answer — but that is a decision, not an omission to paper over | none — resolve to `Steps` or add a row |
| 5 | `TabBar` (narrow-viewport nav) | WO-155 | §4.4: *"Mobile: sidebar hidden, top tabs."* BP-018 admits custom CSS for *"the sidebar"* and registers `Tabs`, but declares no tab bar. If `TabBar` is a shell-local composition over registered `Tabs` needing no custom CSS, no row is needed and the boundary should say so; if it needs custom CSS it is a sixth custom surface §2.2 does not admit | none — architect's boundary call |
| 6 | `RivalSparkline` **gapped series** | REQ-071 criterion 13 | REQ-071 c13, verbatim: *"every chart or series that spans that date is broken at it and states that the domain changed on that date, no number, distance or point measured for the previous domain is joined to one measured for the new."* A **rival distance** is named in that clause explicitly. `GrowthLine` already carries `gapped series`; `RivalSparkline` carries `absolute` and `ratio` and no break at all, so the one component that renders a rival distance cannot express the break its own requirement demands. **A defect in the contract, not a styling preference** — the same shape as gap 1. **Drawn 2026-09-02** in `previews/WO-035.html` §2, beside `GrowthLine`'s gapped state, and the drawing produced three parts, not one: (a) the break is a dashed `--ink-3` rule through the plot — **never a series colour**, because a third stroke colour reads as a third series against §2.4's two; (b) the state needs a **required account node beside the row**, because a sparkline whose drawable plot is 120×32 has nowhere to carry the statement criterion 13 also demands — and the 2026-09-02 resize did not change that, since the extra viewBox units are padding and padding carries no sentence — the same shape `GrowthLine`'s gapped state already has; (c) **the state accepts no delta badge at all**. §4.5 pairs each rival with a `was 276×` badge, which is a direction computed over a span; criterion 13 forbids one spanning the change date and forbids restating it over a shorter span. Omitting it by convention is not testable — refusing the prop is | BP-018 (contract widening, not a new component) |
| 7 | `DayPanel` **ways-through slot** | REQ-043 criterion 12 | REQ-043 c12 promises **two routes** to a delivered page, *"offered separately"* — the public address, and for a page on the customer's own WordPress a second whose address is inside that WordPress — plus, where ReachKit's own record says a route leads nowhere, *"the detail says so in place of that way rather than offering it."* The registered contract has one undifferentiated `actions slot`, which can hold neither an ordered pair of routes nor a per-route withheld state. Widened above as `proposed`; **not usable until approved**. **Drawn 2026-09-02** in `previews/WO-033.html` §4, and the drawing found a **third per-route case the widening did not name**: a route can be *offered*, *withheld with its account*, or **not applicable at all**. A page delivered to the hosted blog has no WordPress route to withhold, and rendering a leads-nowhere account for it states a fact about a destination the customer never chose. Not applicable renders as **nothing** and the list is one item long. The distinction is load-bearing because REQ-043 c12's withheld case is a *record ReachKit holds*, and a route that never existed has no record | BP-018 (contract widening, not a new component) |

| 8 | **Narrow-viewport behaviour for three fixed-column surfaces** | `CalendarGrid`, `WeekStrip`, `DayPanel` — and every later surface with a fixed-column grid | The owner ruled on 2026-09-02 that the system must work at every screen size, and `tokens.md` §2b now names the four breakpoints that ruling needs. **What the surfaces do at those widths is still not a found rule.** §4.6 fixes the calendar at `repeat(7,minmax(0,1fr))`, calls the minmax load-bearing, and fixes the day panel at 290px sticky *"beside the grid — not a drawer"*. It states nothing about a viewport too narrow for either, and §4.4's *"Mobile: sidebar hidden, top tabs"* is the only narrow-viewport sentence in §4 at all. Drawn in `previews/app/` and marked `proposed` on every screen that shows one: **(a)** below `--breakpoint-md` the month is seven rows in date order — the same entries, the weekday header suppressed because a one-column list has no columns to head, and an out-of-month cell not drawn because it exists to hold a column position and there are none; **(b)** below `--breakpoint-md` the week strip is seven rows likewise, from the same `--w-cell-min` and the same argument; **(c)** below `--breakpoint-xl` the day panel is a full-width block following the grid, in flow, not sticky, **still not a drawer** — nothing slides over anything and nothing is dismissed. All three are CSS rules over **unchanged contracts**: no second markup path, no `narrow` prop, no new state, and the grid still invents no cell. **That is what makes them cheap to refuse** — a blueprint that rules otherwise changes three media queries and no component | BP-018 / the surface blueprints |

**Not gaps, recorded so three surfaces do not each mint one:**

- *Copy-to-clipboard control* — WO-066, WO-068 (copy link) and WO-172
  (`CopyOut`) each need one. It is `Btn`. No `CopyButton` is registered and none
  should be.
- *Report header driver mini-bars* — §4.1 module 1. `Progress`, not a sixth
  chart form. Registered in the `Progress` row above so a chart is not minted
  for them.
- *Stage chip, verdict chip, band badge, claim badge, source chip* — all
  `Badge`, each with its required text child.
- *Surface compositions* — `MonthGrid`, `StageFilter`, `AlertList`,
  `DayPanelView`, `WhyThisPage`, `ScoreTile`, `AiAnswersTile`,
  `PagesPublishedTile`, `RivalModule`, `GrowthModule`, `SidebarNav`,
  `DomainBlock`, `PublishingCard`, `SetupForm`, `ReportView`, `RemovedView`,
  and the settings panels are **screen compositions over registered
  components**, owned by their own surface blueprints. They are not registry
  rows and must not become any.

## 5. Preview state

**Thirty-six** work orders carry `ui: yes` — counted from the front-matter key
itself, which is the field rule 7.3 is matched on. (The count read
*thirty-three* until the two foundation sheets were drawn, then *thirty-five*;
it was never recounted after WO-268's 2026-09-02 consolidation, which added
one `ui: yes` row to the corpus — WO-268 itself — without removing the field
from either superseded predecessor, WO-031 or WO-032 (`supersedes` retires a
work order's status, not its front-matter). Recounted here: 36.) Each needs a
signed preview before implementation (rule 7.3, step 2–3).

**Six** sheets are drawn and **three are now signed**. (Read *all six are
unsigned* before the owner's act below; corrected here.) The owner signed
three on their published pages, dated 2026-09-03:

| Sheet | Releases | URL |
|---|---|---|
| `previews/WO-029.html` | WO-029, WO-030 | https://claude.ai/code/artifact/907952de-89ab-40c8-b82e-08b200ae4750 |
| `previews/WO-268.html` | WO-268 | https://claude.ai/code/artifact/84aee332-745d-47d0-b69c-1cf06874b76f |
| `previews/WO-002.html` | WO-002 | https://claude.ai/code/artifact/dd46e79b-068e-418b-ab36-baba9ebe5c30 |

`WO-031.html`, `WO-033.html` and `WO-035.html` remain unsigned. (The drawn
count read *four* until two more were drawn on 2026-09-02, after this
section was last written: `WO-002.html`, which WO-002 carries alone, and
`WO-268.html`, which draws all fifteen §1 primitives at their registered
contract for WO-268 — the 2026-09-02 consolidation of WO-031 and WO-032.
Corrected here.) The first two are foundation sheets — every later preview
is read against them, so they were drawn first. The surface and chart
sheets could not be drawn until the spacing and heading scales were ruled,
because a surface is mostly spacing; that ruling landed 2026-09-02 and they
followed. `WO-268.html` also follows that ruling — its own §0b reads
`--breakpoint-lg`/`--breakpoint-xl` off `tokens.md` §2b — so it stands with
the surface and chart sheets on that count, not with the two foundation
sheets. `WO-002.html` needed no ruling to wait on: it draws no surface and
no chart, only the route-group container and two already-registered
components (`Badge`, `Divider`).

| Preview | Carries | What a signature does |
|---|---|---|
| `previews/WO-029.html` | WO-029 **and** WO-030 | Releases both work orders and makes the sheet the specimen every later preview is read against. **Flips no row in this file** — it registers no component. Its four open values are already ruled and no longer wait on it. **Signed 2026-09-03**: https://claude.ai/code/artifact/907952de-89ab-40c8-b82e-08b200ae4750 |
| `previews/WO-031.html` | WO-031 **and** WO-032 | Flips **all fifteen** §1 primitive rows from `proposed` to `approved`, and releases both work orders. **Superseded in this operative role by `previews/WO-268.html`** (ruling below) — WO-031 and WO-032 are themselves `status: superseded`, so a signature here would release two work orders nothing downstream implements. The sheet is not deleted or redrawn and stands unchanged in the record below (§5, "two are now wrong on screen") |
| `previews/WO-033.html` | WO-033 **and** WO-034 | Flips **all four** §2 custom-surface rows; makes the three layout tokens law in `tokens.md`; closes §4 gaps 1 and 7, which are this sheet's own subject; and rules on the two proposals §8 of that sheet raises |
| `previews/WO-035.html` | WO-035 **and** WO-036 | Flips **all five** §3 chart rows; closes §4 gap 6 or refuses it. Adds no sixth chart form — the inventory stays closed at five |
| `previews/WO-002.html` | WO-002 | Releases WO-002 (the route-group skeleton, root layout, font wiring) to implementation. **Flips no row in this file** — it registers no component; `Badge` and `Divider` are already-registered §1 rows this sheet consumes, not defines. **Signed 2026-09-03**: https://claude.ai/code/artifact/dd46e79b-068e-418b-ab36-baba9ebe5c30 |
| `previews/WO-268.html` | WO-268 (`supersedes: [WO-031, WO-032]`) | Flips **all fifteen** §1 primitive rows from `proposed` to `approved`, and releases WO-268. Flips no widening (§7.2), no new row (`ActionPanel`, §7.1), no custom surface and no chart form; rules on no ADR-093 decision and mints no breakpoint token — all stand exactly as this sheet found them, cited and unmoved (its own sign-off text, verbatim). **Becomes the operative preview of record for the fifteen §1 primitives** in place of `previews/WO-031.html` (ruling below). **Signed 2026-09-03**: https://claude.ai/code/artifact/84aee332-745d-47d0-b69c-1cf06874b76f — the fifteen §1 rows above are now `approved` on this signature |

**Ruling: `WO-268.html` extends `previews/WO-031.html`; it does not merely
re-point to it.** WO-268's own body posed the two live options: "`design/previews/WO-031.html`
is the sheet the design-guardian drew for the first eight of these
components. It stands as the preview of record for this order until the
guardian re-points or extends it." `WO-268.html` now exists, and its own
header settles which: "This sheet is a fresh drawing, not a repoint of
`previews/WO-031.html`." A repoint would have left `WO-268.html` undrawn and
simply renamed `WO-031.html` as WO-268's sheet in its `Preview:` bullet — that
is not available here regardless, since `work-orders/` is not this agent's to
edit, but it would also be the wrong call on the merits: `WO-031.html` drew
only the first eight primitives, at WO-031's contract, with no closed-barrel
statement and no band-system read (§0b) — it cannot stand for WO-268's own
scope (all fifteen, the barrel, and the ADR-093 reading) without the second
sheet's coverage. `WO-268.html` is that coverage: the same eight, redrawn at
the identical registered contract, plus the seven `WO-032.html` never drew (no
such file exists), plus the barrel and the band system. That is the extend
case — nothing in WO-031's contract is contradicted, only completed — so
`previews/WO-268.html` is now the sheet a signature acts on for WO-268's
fifteen rows. `previews/WO-031.html` is not edited, redrawn or deleted (design
sheets are drawings of record, never repainted) and keeps its place in the
2026-09-02 staleness assessment below exactly as before; it simply no longer
holds WO-268's own signature.

**A seventh artifact now exists and is not a seventh sheet.** (Read *fifth*
until the two sheets above were added to this section; the count is anchored
to how many sheets precede it, so it moves with them. Corrected here.)
`previews/app/` is a
runnable Next.js preview app on the exact stack `00-project.md` fixes — App
Router, TypeScript, Tailwind 4 + daisyUI 5, `@fontsource` faces, lucide-react,
mock data only. It carries the same four specimens as live code (`/tokens`,
`/primitives`, `/surfaces`, `/charts`) plus five walkthrough routes that
assemble registered components into whole screens. **It flips nothing.** It is
the same four unsigned drawings in a second medium, and the walkthroughs are
not previews of any work order — each says so on itself. Whether a running app
should *replace* the HTML sheet as the medium rule 7.3 is satisfied by on this
project is an owner ruling via `/decide`; until one lands, both stand and
neither supersedes the other.

**An eighth artifact now exists and flips nothing either.** (Read *sixth*
before the correction above; renumbered for the same reason.) `previews/app/`'s
`/variants` routes (2026-09-02) render the overview and the report through
seven independently-settable token axes — `tokens.md` §8. It registers no
component, uses only the rows above, and adds no state to any of them: a
variant is a `--v-*` token set over **unchanged component contracts**, the
same shape §4 gap 8's narrow-viewport proposals take. Two of its positions
spend tokens the registry does not hold (`--r-edge`, `--shadow-lift`) and both
carry a `proposed` mark wherever they appear. **No row here moved.**

**A ninth artifact now exists and flips nothing either.** (Read *seventh*
before the correction above; renumbered for the same reason.) `previews/app/`'s
`/idiom` routes (2026-09-02) draw the card idiom the owner approved on three
screens — the overview as Take A, the sign-in screen `BUILD.md` §4 never
described, and the landing page. Every rule is scoped under `.ci`, so the four
sheets, the five walkthroughs, `/variants` and `/directions` are untouched and
remain the baselines. It proposes **one new row and four widenings** (§7),
spends **six values nobody has ruled** (`tokens.md` §9), raises five questions
it does not answer, and owes twenty-six customer-visible strings. **No row here
moved.**

Drawing it found one thing about a registered component, recorded rather than
fixed: **`Collapse` writes its own radius inline** (`primitives.tsx`,
`style={{ borderRadius: "var(--r-field)" }}`), so no stylesheet can reach it.
The value is right and named; the *placement* means the one primitive whose
corner cannot be re-themed is the one on the public report. Every other
primitive takes its radius from a class. Worth moving into `globals.css` when
`Collapse`'s row is next touched — it is a preview-file defect, not a contract
one, and it does not block a signature.

Three things the running app holds that a sheet could only state, recorded
because they are now properties of the drawing rather than captions on it: an
intended-empty state's tone is a type admitting `neutral | ok` only; a chart's
rival props carry no tone member at all; and `RivalSparkline`'s gapped variant
has no `delta` prop, so REQ-071 c13's forbidden badge cannot be passed. **The
2026-09-02 rebuild of that component did not cost the third one** — the union
is unchanged and the gapped arm still has no `delta` member. It is the thing a
layout change was most likely to lose quietly, so it is checked and said.

### The four sheets after the 2026-09-02 ruling — two are now wrong on screen

Recorded, not redrawn: a sheet is the record of what was drawn and when, and
silently repainting one would destroy exactly that. Where a sheet and
`previews/app/` disagree, the app is the current drawing and the sheet is the
older one. Each claim below is a value read out of the sheet's own stylesheet,
not an impression of it.

| Sheet | Standing | What it would take |
|---|---|---|
| `WO-029.html` | **Sound.** It draws colour, theming, radius, shadow, ring and the two scales, none of which the ruling touched. Its §8 never claimed to be a complete list of open values, and §7 of this file now records four more that closed after it | nothing |
| `WO-031.html` | **Sound on the ruling.** Its own stylesheet sets `white-space: nowrap` in exactly one place — `table.spec td.m`, its specification table's mono column, which is sheet chrome and not a product surface. The fixed-height nowrap badge that cut the `was 276×` label was daisyUI's default reaching the app, not this sheet's drawing | nothing |
| `WO-033.html` | **Wrong in three places.** `.cal-h` at 10px, `.day .d` at 10.5px and `.mlabels` — the dot-matrix column labels — at 8px are all under `--t-floor`, which now refuses them. Its day cells are drawn at `min-height: 44px` against a `.day` rule of 64 — a cell tighter than the sheet's own default, and tighter still than what `--w-cell-min` now asks for. And it draws the day panel beside the grid with no narrow form at all, which §4 gap 8 (c) now proposes | the day cell re-cut at the floor and at `--w-cell-min`, and a narrow form drawn or explicitly deferred |
| `WO-035.html` | **Wrong in two places.** Its `.wday .d` at 10px, `.wday .m` at 9.5px and its four in-SVG label classes at 8–8.5px are all under `--t-floor` — and the in-SVG ones are worse than they read, because `viewBox` text scales with the container (`tokens.md` §7). Its `RivalSparkline` is the pre-rebuild `viewBox="0 0 120 32"` with the endpoint dot on the edge, which is the clipping the owner cited by name. **Its §2 argument about the gapped state's three parts stands unchanged** — that is a contract argument, and the rebuild kept every part of it | the strip re-cut at the floor, the chart labels moved out of coordinate space, and the sparkline redrawn at 132×44 |

**No row in this file moved because of any of it** — the 2026-09-02 ruling
or the staleness found in the table above. (Read *every row is still
`proposed`; nothing is signed; no `Signed-off:` date exists* before the
owner's 2026-09-03 signatures — three sheets are signed now, none of them
`WO-031.html`, `WO-033.html` or `WO-035.html`, the three named in this
table; see §5 above for dates and URLs. Corrected here.) A ruling on a
value and a rebuild of a component are both drawings, and a row flips on a
signature, never on either of these.

A §4 row moves only where the sheet that drew it says so. Gaps 1, 6 and 7 are
contract widenings the surface and chart sheets draw *as their subject*, so a
signature on the drawing sheet closes them. Gaps 2, 3, 4 and 5 are untouched by
all four signatures — a gap is not closed by a signature on a sheet that
deliberately did not draw it.

**Defects outside `design/`, found while drawing and reported not fixed.**
The design-guardian does not edit `work-orders/`.

1. WO-030, WO-034 and WO-036 each carry a `Preview:` bullet pointing at a
   `previews/WO-0XX.html` that does not exist and will not: each is the second
   work order of a pair carried on its partner's sheet. They need repointing at
   WO-029, WO-033 and WO-035 respectively.
2. **WO-034's file plan has not absorbed gap 7.** Its `DayPanel.tsx` row still
   reads *"Takes a required heading node, a required account node and an actions
   slot"* — the pre-widening contract, which is exactly what gap 7 records as
   unable to hold REQ-043 c12. WO-033 amended its own plan when the cell
   contract widened (its `## Log`, 2026-08-31); WO-034 was never amended when
   the panel contract did. Its test plan carries no row for the two ways
   through, so nothing there discriminates. The registry and the work order now
   disagree about the same component's shape.

## 6. State coverage against rule 7.3

Drawing all fifteen primitives is what made this visible; it is recorded, not
filled. Rule 7.3: *"Every data view specifies loading, empty, and error states."*
Six of the fifteen are data views.

| Data view | Loading | Empty | Error / degraded |
|---|---|---|---|
| `Card` | **not registered** | **not registered** | `degraded` |
| `Alert` | n/a | the empty state *is* an `Alert`; `neutral` or `ok` | `warn`/`bad`, message required |
| `Stat` | **not registered** | `measured-zero` — a measurement, not an empty | `unmeasured` |
| `Table` | **not registered**, and *"never a skeleton"* rules out the usual answer without naming a replacement | caller-supplied written line | **not registered** |
| `Progress` | determinate only — an indeterminate bar is refused by contract | n/a | n/a |
| `Steps` | `active`, every stage named | n/a | **a stage that failed has no state** |

**No registered primitive carries a loading state.** `Steps` is the only
registered component that shows work in progress at all, and it does so by
naming stages — the right answer wherever the stages are known. Where they are
not, the registry has nothing, and `Progress` refuses to be it by its own rule.
This is §4 gap 4 seen from the other side: the same hole, reached from the
registry rather than from WO-153.

A state invented in a preview is a contract nobody agreed. These stay open.

### A proposed answer — `proposed`, and in no States cell

Rule 7.3 requires every data view to specify loading, and the surface sheets
could not stay silent about a hole they render into. `previews/WO-033.html` §7
draws one, and it is recorded here rather than written into any component's
`States` cell, because that cell is what a signature moves.

> **A surface that is re-measuring keeps showing the last measurement, and says
> which one it is showing.** The provenance line §2.5 already requires — always
> visible, always quiet — is the carrier, so a surface spends nothing new. Never
> a skeleton (`Table`'s rule, generalised), never a spinner or an indeterminate
> bar (REQ-003 c1 forbids both by name).
>
> Where there is **no** previous measurement there is nothing to keep showing,
> and the rule splits: stages known → `Steps`, every stage named; stages not
> known → one written line and no motion. **The second branch is §4 gap 4
> unchanged.** This proposal narrows the hole; it does not close it.

Two further parts, same status:

- **A failed measurement takes `warn`, never `bad`.** §2.5: *"A measurement that
  failed says so in one written sentence."* Red is reserved for the customer's
  own problem shown to them, and a measurement ReachKit could not take is
  ReachKit's problem. The surface keeps its frame and the failed section is
  absent with one line in its place — §4.1's registered `degraded` behaviour,
  applied to a custom surface.
- **`DayPanel` and `Sidebar` need no loading state at all**, and that is a
  decision, not an omission. Neither measures anything: the panel renders what
  it is handed, and a count the sidebar does not have already renders as no
  count. No chart needs one either — a chart is handed its series; what is
  loading is the module around it.

## 7. The approved card idiom — 2026-09-02

The owner ruled, verbatim: *"This is exactly what we need - 'A · Six boxes'
is my preference and what we should proceed with."* Take A is one card per
module with the three stat tiles broken out — six boxes on the overview.
The idiom itself is in `tokens.md` §9; what it does to **this** file is
below.

> **An approved idiom is not a signed preview, and no row above moved.**
> A row flips on a signature (§5) and none exists. The owner endorsing a
> *shape* is a third kind of act alongside ruling a value and signing a
> sheet, and it moves rows in the same way the other two did: not at all.

Drawn as live code at `/idiom`, `/idiom/overview`, `/idiom/signin` and
`/idiom/landing` in `previews/app/`, every rule scoped under `.ci`. The four
sheets, the five walkthroughs, `/variants` and `/directions` are untouched
and are the baselines these are read against.

### 7.1 One new row — `proposed`

| Component | Status | Data contract | States | Owning BP |
|---|---|---|---|---|
| `ActionPanel` | proposed | The tinted panel every request-to-act renders as. `tone` admits **`accent` and `warn` only** — `--ok`/`--warn`/`--bad` are state colours (§2.5) and a request is not a state, so `ok` and `bad` have **no position to pass**, refused by the type rather than by convention. Required: `icon`, `title` (the owner's), `line` (the owner's — **one** short explanatory line, §2.5's dim line and never a paragraph), and the CTA label. Holds no copy of its own | **default** · **in-flight** (the CTA is disabled while the action posts — never removed, so the panel does not change height under the pointer) · **withheld** (the action cannot be taken right now: **one written line takes the CTA's place**. The variant carries a required account and **has no `cta` member at all**, so a disabled button with no explanation is unbuildable) | BP-018 |

**Why `Alert` is not this.** `Alert` is the nearest registered thing and it
is the wrong one on all four counts: it states a fact where a panel asks for
a decision; it takes four tones where a panel may take two; it has no icon
chip, no bold title and no dim line; and its `message` is one string where a
panel's title and line are two, ranked. Widening `Alert` to hold them would
give one component two purposes, which is rule 7.1 seen from the component
side.

### 7.2 Four widenings — all `proposed`, none usable until approved

| # | Contract | The gap | Owning BP |
|---|---|---|---|
| 1 | `Card` **head slot** | The registered contract takes an `eyebrow` and a `verdict`. The idiom's head is an **icon chip**, the eyebrow, and an **optional right-hand pill**, above the verdict. Three slots the contract does not name | BP-018 (widening) |
| 2 | `Btn` **outline secondary · quiet tertiary · `--r-pill`** | `BUILD.md` §2.2 gives `btn` *"(+primary/ghost/sm/block)"* and the §1 row follows it. The idiom needs **three ranks, not two**, and all three at `--r-pill`. Rank is what makes "one primary action per screen" checkable by looking; with two ranks a secondary and a tertiary are the same button. A fourth arm exists and is not a rank: on an accent ground the solid primary **inverts** to `--on-accent` fill with an `--accent` label — two named tokens, no third value | BP-018 (widening) |
| 3 | `Stat` **label placeable in the head** | `Stat` prints its own eyebrow label. The idiom's card head already carries one, and a tile with two eyebrows states the same claim twice (rule 2.4). **Everything else registered about `Stat` is unchanged and deliberately so** — the mono numeral utility, the `delta`-XOR-`goal` union, and the three `measured`/`measured-zero`/`unmeasured` states. The label stays a required prop and rides the accessible name, so a figure whose label moved into the head is not an unlabelled number to a screen reader | BP-018 (widening) |
| 4 | `Progress` **on-accent skin** | The sign-in glass card needs a determinate bar on an accent ground, where `--sunk` and `--chart-*` have no contrast. Track and fill take `--on-accent` at the two alphas §2.1 already states. It stays **determinate** — `value` and `max` both required, neither nullable — and it is **not** a sixth chart form, the same call the §1 row already makes for the report's driver mini-bars | BP-018 (widening) |

### 7.3 Not registry rows, and must not become any

`IdiomScope`, `CardHead`, `IdiomCard`, `IdiomBtn` and `StatFigure` in
`previews/app/src/app/idiom/parts.tsx` are the **drawings of the four
widenings above**, not five new components. They exist so the owner has
something to rule on. Production UI code names `Card`, `Btn` and `Stat`.
This is §4's own rule about screen compositions, applied to a widening.

### 7.4 What the idiom raises about a component and does not settle

**`GrowthLine`'s labelling.** The idiom says *"only the two endpoints
labelled"*, and `GrowthLine` already labels exactly two **values** — the
endpoint, and the start value in `BUILD.md` §4.5's footnote pair. The marks
under the plot carry a **week tick**, not a value. If the ruling meant the
ticks as well, that is a change to a registered chart's contract rather than
a CSS rule, and §2.4's *"every bar and point direct-labelled"* is on the
other side of it. **Raised, not taken**; the chart is drawn unchanged.

**`Input`'s label, on the sign-in screen.** The §1 row requires a
placeholder **and** a label, never defaulted. The live page the owner
endorsed shows a placeholder and no visible label. Either the owner writes
the label — it is `S1` in the owed-string list on `/idiom` — or `Input`'s row
gains an arm for a visually-hidden one. Both are rulings; the bracketed slot
renders on the screen in the meantime.

### 7.5 Checkout is not ours, and this file has never held one

Checked across `design/` on 2026-09-02: **no row in this file, no token, no
sheet and no preview route renders a payment field, a card number, an
invoice or a price form**, and none is added by the idiom's three screens.
The report's pricing card (§4.1 module 6) carries a start action that is a
**redirect and nothing else**. Checkout, billing, invoicing and every
billing notification are Stripe's entirely — which is why none of it has a
surface here, and why none may be added by a work order without the ruling
below landing first.

> **`BUILD.md` §4.7's Settings `Billing` card is PENDING AN OWNER RULING and
> is not to be built.** §4.7 specifies it as *"plan, next invoice, card,
> invoices link, Update card / Cancel plan + 'cancelling keeps everything
> running until {date}'"*. Several of those are things Stripe owns outright,
> and what survives is the analyst's open question. **It is deliberately not
> redesigned here**: guessing which rows survive would put a second home
> under a fact the analyst is settling (rule 2.4), and a Billing card drawn
> on a guess is the most likely way a payment surface arrives in this
> product by accident. No preview draws it, no row here describes it, and a
> work order that plans it is refused until the ruling lands.
