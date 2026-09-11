# Design Tokens

- Status: ready
- Source: `BUILD.md` §2.1 (colour, radius, shadow, ring), §2.3 (type and
  numerals), §2.4 (chart constraints), §2.5 (the meaning rules that bind how a
  token may be used). Values are **transcribed**, not derived, except the six
  rows §2.1 explicitly delegates (see "Derived at a stated rule"), the
  **four rows the owner ruled on 2026-09-02** (see "Ruled, not derived"), the
  **ten rows the design-guardian derived under rule 1.1 on 2026-09-02**
  (see §2b, "Derived under rule 1.1"), and the **six the approved card idiom
  proposes and nobody has ruled** (see §9). Those four sets are kept apart on
  purpose: a value's *authority* is part of the value.
- Owning blueprint: BP-018.

> Rule 7.3: **tokens by name only.** A raw hex or a raw px in UI code is a
> defect, whatever its value. If a surface needs a value this file does not
> name, it does not invent one — it raises the gap (see "What `BUILD.md` does
> not state").

`BUILD.md` §2.1, verbatim: *"Three-state theming: bare `:root` = light;
`@media (prefers-color-scheme: dark)` guarded with
`:root:not([data-theme="light"])`; `:root[data-theme="dark"]` for the explicit
toggle. **Never define a color only inside a dark block.**"*

---

## 1. Colour

Every row below exists in `:root`. A dark cell reading *inherits* means
`BUILD.md` §2.1 states no dark value and the light value stands in both themes.

### Surfaces and ink

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#f6f6f9` | `#0e1116` | Page background |
| `--surface` | `#ffffff` | `#161a21` | Card and panel surface; daisyUI `base-100` |
| `--sunk` | `#efeff4` | `#11151b` | Recessed surface; daisyUI `base-200` |
| `--line` | `#eaeaf1` | `#242a34` | Borders and rules; daisyUI `base-300` |
| `--ink` | `#191925` | `#dde3eb` | Primary text; daisyUI `base-content` |
| `--ink-2` | `#5e5e73` | `#8e99aa` | Secondary text |
| `--ink-3` | `#9695a8` | `#69738a` | Provenance and eyebrow text (§2.5: "always quiet") |

### Accent

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--accent` | `#5b4be0` | `#9bb4ff` | The customer's own colour; daisyUI `primary` |
| `--on-accent` | `#ffffff` | `#0e1116` | Text on an accent fill |
| `--accent-bg` | `#eeecfd` | `rgb(155 180 255/.12)` | Accent-tinted fill |
| `--accent-line` | `#ddd8fa` | `rgb(155 180 255/.28)` | Accent-tinted border |

### State — ok / warn / bad

`Tone` is for **state**. §2.4: *"Status colors (ok/warn/bad) are for state,
never for series."* §2.5: *"Red appears only for the customer's problem being
shown to them (blocked, absent, 0/12)."*

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--ok` | `#1f8a6b` | `#7bd8b0` | daisyUI `success` |
| `--ok-bg` | `#e7f6f0` | *derived — see below* | Success fill |
| `--ok-line` | `#d2ede3` | *derived — see below* | Success border |
| `--warn` | `#b8722a` | `#e6b45a` | daisyUI `warning` |
| `--warn-bg` | `#fff3e6` | *derived — see below* | Warning fill |
| `--warn-line` | `#fbe1c6` | *derived — see below* | Warning border |
| `--bad` | `#c0432b` | `#f0907a` | daisyUI `error` |
| `--bad-bg` | `#fdece8` | *derived — see below* | Error fill |
| `--bad-line` | `#f8d5cd` | *derived — see below* | Error border |

**Derived at a stated rule.** `BUILD.md` §2.1's dark block states the three
hues and then, verbatim: `/* + matching -bg/-line at 12%/28% alpha */`. The six
dark values are therefore that rule applied to those three hues — not
invented, and never carried over from light:

| Token | Dark value |
|---|---|
| `--ok-bg` | `rgb(123 216 176/.12)` |
| `--ok-line` | `rgb(123 216 176/.28)` |
| `--warn-bg` | `rgb(230 180 90/.12)` |
| `--warn-line` | `rgb(230 180 90/.28)` |
| `--bad-bg` | `rgb(240 144 122/.12)` |
| `--bad-line` | `rgb(240 144 122/.28)` |

### Series — the only two chart colours

§2.4, verbatim: *"**Two chart colors only:** `--chart-you` (accent) and
`--chart-rival` (neutral gray). The customer is always the accent; everyone
else is context."*

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--chart-you` | `#5b4be0` | `#5f7ff2` | The customer's series. Always the customer, never a rival |
| `--chart-rival` | `#787790` | `#5c6579` | Every rival series. **Neutral gray, never red** (§2.5) |
| `--chart-goal` | `#b8722a` | `#e6b45a` | The goal marker — dashed goal dots, the "at 400 …" footnote pair |

A third series colour does not exist. A rival never takes `--bad`, `--warn` or
`--ok`; a rival is context, not an alarm.

## 2. Radius, shadow, ring, spacing

`BUILD.md` §2.1 states radius once, in `:root`, and repeats none of it in the
dark block.

| Token | Value | Dark | Used for |
|---|---|---|---|
| `--r-box` | `14px` | inherits | Cards, panels, the day panel |
| `--r-field` | `9px` | inherits | Inputs, buttons, chips |
| `--r-pill` | `999px` | inherits | Badges, verdict chips, stage chips |
| `--shadow-card` | `0 1px 3px rgb(24 24 48/.045)` | `0 1px 3px rgb(0 0 0/.45)` — **ruled**, see below | Card elevation |
| `--ring-accent` | `0 0 0 3px rgb(91 75 224/.18)` | `0 0 0 3px rgb(155 180 255/.18)` — **ruled**, see below | Focus ring; today's ringed cell in the calendar grid |

### Spacing scale

`BUILD.md` names no spacing token at all. This scale is **ruled**, not
transcribed — see below. Seven steps on a 4px base; nothing between them
exists, and a layout that wants a value this table does not name raises the
gap rather than inventing one (rule 7.3).

| Token | Value | Typical use |
|---|---|---|
| `--s-1` | `4px` | Between a line and the line it explains |
| `--s-2` | `8px` | Chip and badge padding; gap inside a row |
| `--s-3` | `12px` | Card inner rhythm; rule margins |
| `--s-4` | `16px` | Card padding; grid gap |
| `--s-5` | `24px` | Between cards; between modules inside a card |
| `--s-6` | `32px` | Between modules |
| `--s-7` | `48px` | Between screen sections |

The cost the owner accepted with this scale, recorded so it is not
re-litigated: seven steps is more choices per layout than a 6- or 8-step
scale offers, and nothing in the scale itself stops two adjacent surfaces
picking differently. **The preview gate holds that line, not the scale** — a
surface sheet is where an inconsistent rhythm is visible, and this file is
where the vocabulary is closed.

### Ruled, not derived

Four values `BUILD.md` does not state were drawn as candidates in
`previews/WO-029.html` §8 and **ruled by the owner on 2026-09-02**. Rule 1.2
cuts both ways: a ruled value must not later read as one the specification
implied. None of the four is derivable from `BUILD.md`, and none may be
changed by re-reading it.

| Token / scale | Ruled value | What it is not |
|---|---|---|
| dark `--shadow-card` | `0 1px 3px rgb(0 0 0/.45)` | Not derived. It is the light *geometry* re-inked — the same construction at a second alpha, the pattern §2.1 already uses for the `-bg`/`-line` pairs. §2.1 states no rule that produces it |
| dark `--ring-accent` | `0 0 0 3px rgb(155 180 255/.18)` | Not derived. It is the light construction (accent at 18%) applied to the dark accent `#9bb4ff`. §2.1 states neither the value nor the rule |
| Heading size scale | ratio **1.25** — `--t-h1` 31px · `--t-h2` 25px · `--t-h3` 20px · `--t-h4` 16px · `--t-num-big` 44px | Not derived. §2.3 fixes heading weight, tracking and wrapping and fixes body at 15px; it names no size for h1…h4 and none for §2.5's "big mono number" |
| Spacing scale | 4px base, 7 steps — `--s-1`…`--s-7` above | Not derived. §2 names no spacing token. The three fixed dimensions in §4 (222px, 290px, the week grid) are transcribed separately and are not part of this scale |

## 2b. Derived under rule 1.1 — the edge-and-size contract

**These are the design-guardian's, not the owner's.** They are separated from
"Ruled, not derived" above because rule 1.2 cuts both ways in the other
direction too: a value an agent chose must not later read as one the owner
ruled. Each is a design **parameter**, each carries its derivation and its
reversal cost, and none of them changes what the product promises (rule 1.1).

**What forced them.** The owner ruled two things on 2026-09-02, verbatim:
*"All containers and components must be sized correctly with caution for
appropirate buffer and edges"* and *"the complete system must cather to all
screen sizes, including mobile."* Neither was enforceable. This file named no
breakpoint, no smallest permitted text size, no minimum cell width and no
border width — so "works at every screen size" had nothing to be checked
against, and "nothing clipped" had no floor to stop a surface shrinking its
way out of the problem. A responsive contract with no breakpoints is not a
weak contract; it is not a contract.

### The four breakpoints

Named for Tailwind's own steps and declared in `previews/app/`'s `@theme`
block, which is the **one home**: `lg:hidden` and `var(--breakpoint-lg)`
resolve from the same declaration, so a token that disagreed with the utility
class beside it in the same file cannot exist (rule 2.4). Each value is the
**smallest Tailwind step that clears one named obligation**, and every
obligation is arithmetic over dimensions this file already holds.

| Token | Value | The obligation it clears |
|---|---|---|
| `--breakpoint-sm` | `640px` | Two-up becomes possible. 2 × `--w-day-panel` (290 — the narrowest measure the product already commits to reading a page of prose in) + `--s-5` + 2 × `--s-4` of page padding = **636** |
| `--breakpoint-md` | `768px` | A seven-across grid reaches `--w-cell-min`. 7 × 96 + 6 × `--s-1` + 2 × `--s-4` = **728**. Below this the calendar and the week strip are not grids |
| `--breakpoint-lg` | `1024px` | The sidebar returns. `--w-sidebar` 222 + 2 × `--s-5` + the 696 a seven-column grid needs = **966**. `BUILD.md` §4.4's *"Mobile: sidebar hidden, top tabs"* is the found rule; this is only the width |
| `--breakpoint-xl` | `1280px` | The day panel sits **beside** the grid, which is §4.6's own word. 222 + 48 + 696 + `--s-4` + `--w-day-panel` 290 = **1272** |

**Why Tailwind's steps and not the derived numbers themselves.** The four
obligations are 636 / 728 / 966 / 1272. Rounding each up to its own multiple
of `--s-4` would give 640 / 736 / 976 / 1280 — a vocabulary that disagrees with
the `sm:` `md:` `lg:` `xl:` prefixes standing next to it in the same
codebase, which is rule 2.4's second copy arriving by a side door. The
alignment is taken deliberately, not stumbled into: each Tailwind step was
checked against its obligation and clears it.

**A media query cannot read a `var()`.** The literal inside an `@media`
prelude is therefore the one raw value the stylesheet still admits, and it
must equal a token named above. Every query in the file is a `min-width`, so
no literal is ever a breakpoint *minus one pixel*. This is a recorded
exemption of the same kind as the `viewBox` one, not a hole.

### The floors

| Token | Value | Derivation | Reversal cost |
|---|---|---|---|
| `--t-floor` | `11px` | **The smallest text in the product, at any viewport.** §2.3 already names 10.5–11px as the smallest *role* the specification has; a floor beneath the smallest named role would be a value `BUILD.md` does not state. 11 rather than 10.5 because 10.5 belongs to `--t-eyebrow-size` alone — an uppercase, letter-spaced, two-word label — and a floor governs running text | one line; but every surface that was fitting by shrinking has to be re-cut |
| `--w-cell-min` | `96px` | **One cell of a seven-across grid.** It must hold a two-digit mono date at `--t-eyebrow-size`, the widest registered stage chip ("Your review", REQ-043 c2), and one line of page label at the floor, with `--s-2` either side. This is the token that decides where a seven-column grid becomes a seven-row list | one line and two media queries |
| `--w-spark-min` | `120px` | **The rendered floor for a sparkline plot.** Its plot is hand-sized at 120×32 (§2.4). Rendered narrower it scales, and a scaled endpoint dot leaves §2.4's own 3.5–5px bound silently. A minimum width is how that bound is held rather than asserted | one line |
| `--border-hair` | `1px` | Every rule, card edge, cell border and input outline. **Named, not changed** — the value was already spent about twenty times as a bare `1px`, the last raw value in the stylesheet | one line |

**The trade-off `--t-floor` and `--w-cell-min` buy, stated rather than
buried.** A calendar day cell at 96px fits a date, a chip and **two clamped
lines** of page title — not a whole title. Something had to give, and there
were exactly three candidates: shrink the type, cut the text, or change the
grid. Shrinking is refused by the floor. So the title is clamped and its full
value rides on the cell's own `title` and `aria-label`, which makes the
truncation *recoverable* rather than a loss — the cell's `label` was already a
required prop, so nothing new is asked of a caller. And where seven cells
cannot each clear 96px at all, the grid changes rather than the type: below
`--breakpoint-md` the month and the week strip are seven **rows**. That last
part is a **proposal, not a derivation** — see §7.

### The eyebrow's tracking — derived under rule 1.1, 2026-09-02

| Token | Value | Derivation | Reversal cost |
|---|---|---|---|
| `--t-eyebrow-track` | `.1em` | §8 recorded this as a gap the variant exploration **found and did not fill**: §2.3 gives an eyebrow a size and a case and **no tracking**, and `previews/app/src/app/globals.css` spent `.09em` on `.eb` as a bare literal — the last unnamed value in the type block, in the one file that claims two recorded exemptions and no others. Named here at the value the approved card idiom draws (§9). The change from `.09` to `.1` is visible nowhere at 11px; what changed is that the value has a name | one declaration and one call site |

### Two content measures

One construction, so a third does not get minted: **the breakpoint above the
content, less 2 × `--s-6` of air.**

| Token | Value | Used for |
|---|---|---|
| `--w-read` | `704px` | A single reading column — `/setup`'s three cards, any one-column form. `--breakpoint-md` − 2 × `--s-6` |
| `--w-wide` | `1216px` | A multi-column content column — the public report's six modules. `--breakpoint-xl` − 2 × `--s-6` |

Reversal cost for both: two lines and their call sites. They replace two raw
values already in use (`44rem` and `72rem`); `--w-read` is that value exactly,
`--w-wide` is 64px wider, a change nobody can see, taken so the number has a
name and a construction.

### The two type steps below body — no longer proposed

`--t-sm` 13px and `--t-xs` 12px were raised by the two surface sheets and sat
as `proposed` because nothing had forced them. The owner's ruling landed on
exactly the text they size — *"the labels e.g. `was 276×` are not sized
correctly"* — so they are **law under rule 1.1**, and they are the
design-guardian's, not the owner's. Their derivation is unchanged: 1.25 down
from the 15px body gives 12, and 13 is the step between. Two only; one more
would be a scale nobody can hold in their head. Reversal cost: two CSS lines
and their call sites. They are listed in §4 with the rest of the type scale.

**Nothing else moved.** The three layout tokens stay `proposed` (§7): their
*values* are `BUILD.md` §4's and only their names are the system's, so what
releases them is WO-033's signature, not a derivation. Rule 1.1 gives an agent
a parameter; it does not give it someone else's signature.

**One heading scale, not two.** The owner was asked whether the public report
(§4.1) and the app shell (§4.4–4.7) should take different scales and ruled
one. Tested against the report in `previews/WO-035.html` §7: the report has no
hero heading to spend an editorial scale on — §4.1's module order opens on the
**header-strip card**, whose largest mark is the score in `--t-num-big`, not an
h1. The single scale stands. Should a later report sheet find otherwise, it
says so here rather than diverging quietly.

## 3. daisyUI 5 slot mapping

`BUILD.md` §2.1, verbatim: *"Map these onto daisyUI's theme slots (`base-100`←
surface, `base-200`←sunk, `base-300`←line, `base-content`←ink, `primary`←accent,
`success/warning/error`←ok/warn/bad) in the Tailwind config so stock daisyUI
classes just work."*

| daisyUI slot | Token |
|---|---|
| `base-100` | `--surface` |
| `base-200` | `--sunk` |
| `base-300` | `--line` |
| `base-content` | `--ink` |
| `primary` | `--accent` |
| `success` | `--ok` |
| `warning` | `--warn` |
| `error` | `--bad` |

A daisyUI slot carrying a literal colour rather than a variable reference is a
second home for a value that already has one (rule 2.4).

## 4. Type and numerals

`BUILD.md` §1 fixes the two families; §2.3 fixes the scale. Both are
self-hosted via `@fontsource` — no third-party font request, because BP-004
renders these same fonts from a customer's own domain.

| Token | Value | Used for |
|---|---|---|
| `--font-ui` | Plus Jakarta Sans | Every non-numeric string |
| `--font-mono` | JetBrains Mono | **Every numeral, date, URL, search query and code-like string**, always with `tabular-nums` |

| Role | Value (§2.3, §2.5) |
|---|---|
| Heading weight | 700–800 |
| Heading letter-spacing | `−0.02em` |
| Heading wrapping | `text-wrap: balance` |
| Body | `15px` / `1.55` |
| Eyebrow (uppercase section label) | `10.5–11px` |
| Explanatory line under a card's answer (§2.5) | `11–12px`, dim (`--ink-3`) |

### Heading sizes — ruled, not transcribed

Ratio 1.25 from the 15px body, ruled by the owner on 2026-09-02 (see §2,
"Ruled, not derived"). `BUILD.md` states none of these.

| Token | Value | Used for |
|---|---|---|
| `--t-h1` | `31px` | Screen head |
| `--t-h2` | `25px` | Module head |
| `--t-h3` | `20px` | Card head |
| `--t-h4` | `16px` | Sub-head. Deliberately 1px off the 15px body — at h4 15 the two are indistinguishable |
| `--t-num-big` | `44px` | §2.5's "big mono number": the score, a rival distance. Always through the mono numeral utility |

### Below body — derived under rule 1.1, 2026-09-02

See §2b. These are the design-guardian's, and `--t-floor` binds every row in
this section including the ones above it.

| Token | Value | Used for |
|---|---|---|
| `--t-sm` | `13px` | Button and control labels, table cells, day-panel rows — the app shell's most common text |
| `--t-xs` | `12px` | Badges, chips, dense metadata beside a value. The `was 276×` badge is this |
| `--t-floor` | `11px` | **Not a role — a bound.** No text in the product renders below it, at any viewport. A box that cannot fit its text at the floor gets more room, wraps, or clamps with the full value recoverable. It never shrinks |

**A third absolute, from the owner's 2026-09-02 ruling.** Two roles here are
*narrower on a narrow viewport* and nothing else in the scale is: `--t-h1`
takes `--t-h2`'s size and `--t-num-big` takes `--t-h1`'s below
`--breakpoint-sm`. No new size is minted, the 1.25 ratio is untouched, and
heads only ever step **down toward the body, never under it** — a 31px screen
head on a 320px viewport wraps to four lines and pushes the card's own answer
below the fold, which is the owner's rule reached from the other end. Form
controls run the other way: `--t-h4` on a narrow viewport, `--t-sm` above
`--breakpoint-sm`, because mobile Safari zooms the viewport when a focused
control's text is under 16px. That is a platform behaviour, not a taste.

Two absolutes, both from §2.3:

- **The numeral rule is mechanical.** One utility applies `--font-mono` *and*
  `tabular-nums` together; a component cannot apply one without the other. A
  numeral rendered in the UI font is a defect.
- **No emoji anywhere in the product.** Not in a component, not in copy, not in
  a chart label.

## 5. Chart constraints (§2.4)

These are bounds, not single values — §2.4 states ranges and they are the law
as ranges. A chart asserts against the bound, not against a token name.

| Constraint | Value |
|---|---|
| Series colours | Exactly two: `--chart-you`, `--chart-rival` |
| Axes | One axis per chart |
| Line weight | `2–2.5px` |
| Endpoint dot | `3.5–5px`, with a `--surface`-coloured ring |
| Gridlines | Faint, at 2–3 values |
| Tooltip | On every mark; fixed-position, ink-on-bg, mono |
| Labelling | Every bar and point **direct-labelled** (name + value). Identity is never colour-alone; no legend-only mode |
| Implementation | Inline SVG, hand-sized viewBoxes. No chart library |
| Inventory | Closed at five — see `components.md`. A sixth form is a design-artifact approval first |

## 6. The meaning rules that bind token use (§2.5)

A palette does not enforce meaning. These four rules bind how the tokens above
may be spent, and two of them are the ones a token table loses:

1. **Every card leads with the answer, not the metric** — a verdict chip, a big
   mono number with its delta badge, or a filled/empty visual. The explanatory
   line is one short written sentence, 11–12px, dim.
2. **Provenance is always visible but always quiet** — `--ink-3`, mono, small.
3. **An empty queue is a success state.** An empty or degraded state is
   designed, never blank, and an intended-empty state does **not** take `--bad`
   or `--warn`. A measurement that failed says so in one written sentence.
4. **Rival strength is neutral gray, never red.** Red is only ever the
   customer's own problem shown to them — blocked, absent, `0/12`.

Where the palette alone would let rules 3 and 4 be broken, `components.md`
carries the counter-constraint in the component's own `States` cell. Two are
worth naming here because a token table is exactly where they get lost:

- `Alert` and `Badge` both take a `Tone`, and nothing in the type system stops
  a caller passing `bad` to an empty-queue alert. **The palette permits the
  defect; only a call-site test refuses it.** Every data view's empty state is
  registered with its required tone in `components.md`.
- `--chart-rival` is a token any UI code can name, and a rival series is
  structurally protected (the rival props accept no `Tone` at all) — but a
  rival rendered as a `Badge` or a table cell is *not*. A rival's strength
  outside a chart takes `neutral`, never `bad`.

## 7. What `BUILD.md` does not state

Recorded here rather than filled. A UI work order that needs one of these
raises it; nobody guesses a value (rule 1.2).

**Four of the six were closed by the owner** on 2026-09-02 (dark
`--shadow-card`, dark `--ring-accent`, the heading scale, the spacing scale —
§2 and §4 above). **Four more were closed by the design-guardian** on the same
day, under rule 1.1, because the owner's clipping-and-screen-size ruling could
not be enforced without them: the two type steps, the type floor, the border
width and the breakpoint set (§2b). **One remains open and one has moved from a
missing value to an open layout question.**

| Gap | Standing | Who it bites |
|---|---|---|
| ~~A type step between body and eyebrow~~ | **Closed 2026-09-02, rule 1.1.** `--t-sm` 13px and `--t-xs` 12px are law (§2b, §4). The sub-11px marks the two surface sheets reached for are refused outright by `--t-floor` 11px, which is a bound rather than a role — see the row below for what replaced them | — |
| ~~A border width~~ | **Closed 2026-09-02, rule 1.1.** `--border-hair` `1px` (§2b). The value did not change; it acquired a name. It was the last raw value in `previews/app/src/app/globals.css` | — |
| ~~A breakpoint~~ | **Closed 2026-09-02, rule 1.1.** Four: `--breakpoint-sm` `md` `lg` `xl` (§2b), each the smallest step clearing one named obligation, declared in the app's `@theme` block so the token and the utility prefix are one declaration. Tailwind's vocabulary is no longer *borrowed*; it is derived onto and named | — |
| **Token delivery into email** | **Open, and untouched by any of this.** WO-101/103 require the mail shell and block renderer to use "BP-018's named tokens only", with a test that the frame emits no colour literal. CSS custom properties are not reliably supported by mail clients, so an email that renders correctly needs literal values inline. §2 states no build-time token→literal path. **A contract to settle, not a value to guess** — and a build-path question, outside `design/` | WO-101, WO-102, WO-103, WO-113 |
| **The three layout tokens** | Still `proposed` (below). Their *values* are `BUILD.md`'s; only the names are the system's, so what releases them is WO-033's signature and not a derivation. Rule 1.1 gives an agent a parameter; it does not give it someone else's signature | WO-033, WO-034, WO-155, WO-167, WO-168 |
| **Three narrow-viewport behaviours** | **Proposed, and needing the surface blueprint's word — this is what the sub-11px question turned into.** `BUILD.md` §4.6 fixes the calendar as `repeat(7,minmax(0,1fr))` and the day panel as 290px sticky *"beside the grid — not a drawer"*, and says nothing about a viewport too narrow for either. Drawn in `previews/app/` and marked `proposed` on every screen that shows one: (a) below `--breakpoint-md` the **month** is seven rows, not seven columns; (b) below `--breakpoint-md` the **week strip** is seven rows likewise — same token, same argument, and seven days can never become six; (c) below `--breakpoint-xl` the **day panel** is a full-width block following the grid, in flow, not sticky, and **still not a drawer** — nothing slides over anything and nothing is dismissed. All three are CSS rules over unchanged component contracts: no second markup path, no `narrow` prop, and the calendar still invents no cell | WO-033, WO-034, WO-155, and every surface with a fixed-column grid |

**Text inside an SVG `viewBox` is no longer exempt, because there is none.**
The old exemption said coordinate space is not a design value, which is true
of a coordinate and false of a font size: a `viewBox` scales with its
container, so an 11px axis label inside a 640-wide box rendered in a 300px
column is about 5px — under the floor, and unreadable rather than merely
small. In `previews/app/` every chart mark is SVG and **every chart label is
HTML** at a named size that cannot scale. Strokes carry
`vector-effect: non-scaling-stroke` for the same reason: §2.4's 2–2.5px line
weight is a *rendered* bound, and a scaled stroke leaves it silently. The
exemption now covers coordinates only, which is what it always meant.

### Proposed layout tokens

Status `proposed` — usable once approved (duty 3). The **values** are
transcribed from `BUILD.md` §4; the **names** are the system's (rule 1.1,
internal names). Reversal cost: three CSS lines and their call sites.

| Token | Value | Source | Used for |
|---|---|---|---|
| `--w-sidebar` | `222px` | §4.4: *"Left sidebar (222px, sticky)"* | `Sidebar` width |
| `--w-day-panel` | `290px` | §4.6: *"Day panel (290px, sticky, beside the grid — not a drawer)"* | `DayPanel` width |
| `--grid-week` | `repeat(7, minmax(0, 1fr))` | §4.6: *"Mon–Sun columns (`repeat(7,minmax(0,1fr))` — the minmax is load-bearing)"* | `CalendarGrid` columns |

### The sub-11px question, answered

`previews/WO-033.html`'s calendar day cell and `previews/WO-035.html`'s week
strip both reach below 11px to fit a written label into a cell 54px wide. The
question was recorded as *"either the cell gets more room or the scale gets a
floor."*

**The answer is both, and then a third thing neither option contained.**
`--t-floor` is 11px and refuses the shrink; `--w-cell-min` is 96px and is the
room a cell needs. But seven cells at 96px need 728px including page padding,
which no phone has — so at that width the cell cannot get more room and the
scale will not give, and the only thing left to change is the grid. Below
`--breakpoint-md` the month and the week strip are seven **rows**. The two
tokens are derived and law (§2b); **the reflow is a proposal and needs the
surface blueprint's word** (§7, "Three narrow-viewport behaviours"). The two
HTML sheets are behind on this — see `components.md` §5.

### The buffer rule

The owner's other half — *"sized correctly with caution for appropirate buffer
and edges"* — is a rule, not a token, and it is stated once here rather than
re-argued per surface:

1. **A box never hides its own overflow to make something fit.** `overflow:
   hidden` on a content box is how a stage chip gets cut in half. Where a
   shape genuinely cannot reflow — a wide specification table — it scrolls
   inside its own wrap, and the wrap belongs to the component, not the caller
   (the registered `Table`'s rule, generalised).
2. **A plot's drawable area is inset by more than the largest mark it
   draws.** An endpoint dot of radius 3.5 with a 2-wide ring has an outer
   radius of 5.5, so a viewBox that puts the last point at exactly its own
   edge cuts the dot in half at every width. This is what `RivalSparkline`
   was doing.
3. **A row of a fixed label and a variable value wraps.** It does not
   compress the value into nothing.
4. **A required prop of unknown length is never given a fixed height.** A
   badge, a button and an alert all take an owner's string; all three size to
   their content.

## 8. The variant exploration — `proposed`, and law nowhere

Drawn 2026-09-02 in `previews/app/src/app/variants/` after the owner asked for
"a handful of variants I can choose specific elements from". **Nothing in this
section is law and nothing in it is signed.** It is recorded here so the two
values it spends are visible as proposals rather than as values that arrived by
being drawn.

**The shape, because it is what keeps the ruled values ruled.** A variant is
not a redraw and not a second scale. It is an **application layer** — a set of
`--v-*` tokens, each of which resolves to a token this file already declares.
`--v-card-pad` is always some `var(--s-N)`; `--v-r-card` is always some
`var(--r-*)`. The seven-step ladder and the 1.25 heading scale are untouched;
what varies is **which rung a surface picks**. A variant that redeclared `--s-4`
would be replacing a value the owner ruled, which rule 1.2 forbids in the
direction that matters here.

Seven axes, each independently settable: density · separation · radius · type
contrast · colour application · chrome weight · data presentation. The
vocabulary is `previews/app/src/app/variants/axes.ts`; every value is
`previews/app/src/app/variants/variants.css`, scoped entirely under `.v` so no
other route can see it (rule 2.4 — one home).

### Two tokens the exploration spends and this file does not hold

| Token | Value | Wanted by | Why it is not derivable |
|---|---|---|---|
| `--r-edge` | `4px` | the radius axis's `edge` position | A **fourth** radius under `--r-field`. `BUILD.md` §2.1 states three and calls them *"these exact values"*. This adds one rather than editing one, so it is an addition to a transcribed set — the owner's word, not a parameter. Reversal cost: one line, and the `edge` position disappears with it |
| `--shadow-lift` | light `0 1px 2px rgb(24 24 48/.04), 0 6px 16px rgb(24 24 48/.07)` · dark `0 1px 2px rgb(0 0 0/.5), 0 6px 16px rgb(0 0 0/.5)` | the separation axis's `shadow` position | `--shadow-card` is a 1px hairline shadow and cannot carry a card's edge once the border is removed. Its dark value takes the same construction as the owner's ruled dark `--shadow-card` — the light geometry re-inked at a second alpha — but the light value itself is new and §2.1 states no rule that yields it. Reversal cost: one declaration and one position |

Both are declared **only** inside `.v` and every screen that spends one carries
a visible `proposed` mark, so neither can reach a walkthrough or a specimen
sheet by accident.

### Two gaps the exploration found rather than filled

| Gap | Standing |
|---|---|
| **An eighth spacing step** | The ruled ladder ends at `--s-7` 48px, so the `airy` density position tops out there. A genuinely airier page section wants a 64px step. **Not drawn** — an eighth step is a proposal against the owner's own ruling, not a parameter rule 1.1 gives an agent |
| ~~The eyebrow's letter-spacing~~ | **Closed 2026-09-02, rule 1.1.** `--t-eyebrow-track` `.1em` (§2b), at the value the approved card idiom draws. The bare `.09em` literal is gone from `.eb`. The `--v-eyebrow-track` positions in `variants.css` are unaffected — a variant applying a value differently is what that layer is for |
| **The eyebrow's ink** | §1 above annotates `--ink-3` as *"Provenance and eyebrow text (§2.5: 'always quiet')"*. §2.5's verbatim rule is about **provenance**; the eyebrow pairing is this file's own annotation, not `BUILD.md`'s. The type axis's `loud` position raises the eyebrow to `--ink-2`, which is therefore **an edit to this file** rather than a variant applying it, and is marked as one wherever it is drawn. The explanatory line is *not* in the same position: §4 binds it to `--ink-3` by name and no position moves it |

**The design-guardian's own recommendation spends none of this.** The tuple
drawn at `/variants/guardian` — separation `fill`, radius `crisp`, type
`poised`, chrome `hairline`, figure `rule` — selects only tokens
`globals.css` declares today. It needs a ruling on five positions and on no
value.

**One of its two proposed values has moved out of `.v` and is still
proposed.** See §9: `--shadow-lift` is now spent by an idiom the owner
endorsed, not only by an exploration the owner rejected, so its declaration
moved to `globals.css` §1c — one home (rule 2.4). `.v` inherits it at the
same values in the same three theme states. `--r-edge` did not move and is
still scoped to `.v` alone.

## 9. The approved card idiom — 2026-09-02

The owner rejected the seven-axis `variants/` set and the five `directions/`
set as too structural, was shown three card-density takes on the workspace
overview, and ruled, verbatim: *"This is exactly what we need - 'A · Six
boxes' is my preference and what we should proceed with."*

**What was approved is the idiom, not a preview.** Take A is one card per
module with the three stat tiles broken out as three separate boxes — six
boxes on the overview. The idiom below held constant across all three takes
and is what that ruling endorses. It is drawn as live code at `/idiom`,
`/idiom/overview`, `/idiom/signin` and `/idiom/landing` in
`previews/app/`. **A ruling on an idiom is not a signature on a sheet:** no
row in `components.md` moved, and none may (see that file's own §7).

### 9.1 The idiom, and what it spends

| Rule | What it spends |
|---|---|
| Soft grey `--bg` ground, white `--surface` cards **separated by shadow, never a border** | `--shadow-lift` (`proposed`) — `--shadow-card` is a 1px hairline and cannot carry a card's edge once the border is gone |
| Card head: a rounded-square icon chip in `--accent-bg`/`--accent`, an 11px uppercase eyebrow at `.1em` in `--ink-3`, an optional pill on the right | `--t-eyebrow-track` (below, §2b) and **no size token** — the chip is `--s-6` square. The ladder is closed (§2) and 32 is the rung the drawn 30 lands on; a `30px` token would be a value between two rungs, which the ladder's own rule refuses |
| Card padding `--s-5`, `--s-6` for a larger card | Two rungs of the ruled ladder. **Which card is "larger" is a judgement no token holds** — ADR-093 decision 4 hands exactly that to the preview gate, so it is a caller's opt-in (`pad="lg"`) and never inferred from a column count |
| **Anything asking the customer to act is a tinted panel** — `--accent-bg` or `--warn-bg`, a white icon chip, a bold title, one dim explanatory line, a pill CTA | Existing tone tokens only. It is a **new registry row**, `ActionPanel`, `proposed` — `components.md` §7 |
| Pill buttons throughout: one solid accent primary, an outline secondary, a quiet tertiary | `--r-pill`, already law. It is a **widening of `Btn`**, `proposed`. On an accent ground the solid primary inverts to `--on-accent` fill with an `--accent` label — two named tokens, no third value |
| Growth chart: soft area fill under the accent line, endpoint dot with a `--surface` ring, only the two endpoints labelled | Nothing new. `GrowthLine` already draws all three, and §4.5's footnote pair *is* the second label. See §9.4 for what is raised about it |
| `--ok`/`--warn`/`--bad` reserved for state; the accent is never a state colour | §2.5's law, unchanged. Recorded here because an idiom that spends the accent on every card head is exactly where it gets broken |

### 9.2 The two values the owner did **not** rule

Both are drawn, both are `proposed`, and neither may be read later as
something the ruling implied. Rule 1.2 cuts in this direction too.

| | Standing |
|---|---|
| **Card radius `--r-card: 18px`** | Against the **ruled** `--r-box: 14px`. Kept as a **second variable**, not an edit of the first, so both exist until the owner rules — re-drawing a ruled value is exactly what an idiom must not do by being drawn. Every idiom surface names `--r-card` and nothing else. Reversal cost: one declaration, and every card falls back to 14 |
| **Headline numerals in the sans at 700–800** | Against `BUILD.md` §2.3's flat statement, verbatim: *"Every numeral, date, URL, search query and code-like string is JetBrains Mono with `tabular-nums`."* The owner's two reference screenshots both set the big numbers in a heavy sans, and the take the owner approved used sans; the nine-screen artifact defaulted to mono. **The owner has not ruled.** Built so **one token flips it** — `--t-num-headline-face`, defaulting to `--font-mono`, which is what §2.3 states and therefore what conforms. It reaches the **headline** figure only: a date, a URL, a search query and a provenance line stay mono either way. And `tabular-nums` is never dropped — it comes from the `.num` utility and the face rule cannot reach it, so §2.3's mechanical half survives whichever way the face goes. Reversal cost: one declaration |

### 9.3 The six proposed values, declared once

All six are in `previews/app/src/app/globals.css` §1c, at `:root`, not under
the idiom's scope class — a value with two homes is rule 2.4's second copy,
and `--shadow-lift` already had one.

| Token | Value | Derivation | Reversal cost |
|---|---|---|---|
| `--r-card` | `18px` | §9.2. **Not ruled** | one declaration |
| `--t-num-headline-face` | `var(--font-mono)` | §9.2. **Not ruled** | one declaration |
| `--shadow-lift` | light `0 1px 2px rgb(24 24 48/.04), 0 6px 16px rgb(24 24 48/.07)` · dark the same geometry re-inked at a second alpha | Shadow-only separation is the idiom's first rule and `--shadow-card` cannot serve it. The dark construction is §2.1's own pattern for the `-bg`/`-line` pairs and the one the owner's dark `--shadow-card` ruling took. Raised by §8; moved here when an endorsed idiom started spending it | one declaration and one rule |
| `--grad-accent` | `radial-gradient(circle at 78% 22%, --on-accent at 28%, transparent 62%)` over flat `--accent` | **Derived, not minted.** `design/` has no gradient anywhere and the set has no second accent stop, so the stops are taken from tokens that exist: the ground is `--accent` and the highlight is `--on-accent` at **28%**, which is `BUILD.md` §2.1's own stated alpha — *"+ matching -bg/-line at 12%/28% alpha"*. No colour is invented and no second stop is minted. The three position proportions are geometry inside the element's own box, the same class of value as an SVG coordinate (§7's exemption), and are stated here rather than smuggled | one declaration and two call sites |
| `--on-accent-quiet` | `--on-accent` mixed 72% toward `--accent` | The quiet ink on an accent ground. `--ink-3` is the quiet ink on `--bg` and the set has no on-accent equivalent, so the sign-in panel's mono domain line had nothing to take. Mixed **toward the ground**, not to transparency, because that is the relationship `--ink-3` has to `--ink`; a low alpha to transparent puts running text under any contrast floor | one declaration |
| `--w-form` | `420px` | A **third content measure**. Neither existing one fits a single form column: at the 15px body `--w-read` 704 runs to about 94 characters, outside the 45–75 measure, and 420 runs to about 56, inside it. It is also the column the page the owner endorsed draws | one declaration, two call sites |

**Two values the idiom needs and this file does not add.** The sign-in
panel's glass card is `--on-accent` at **12%** for its fill and **28%** for
its hairline border — the pair `BUILD.md` §2.1 states verbatim, applied to
`--on-accent` instead of to a state hue. That is the same derivation the six
dark `-bg`/`-line` values already take (§1, "Derived at a stated rule"), so
no proportion is invented, no colour is, and no token is added: the two are
named `--glass-fill` and `--glass-line` inside the idiom's own scope, where
the **names** are the system's and the **values** are `BUILD.md`'s. The dark
pill on that panel is `--ink` on `--surface`, two named tokens that invert
with the theme rather than pinning a light-mode colour.

### 9.4 What the idiom raised and this file does not answer

| Question | Standing |
|---|---|
| **Where does the sign-in panel's specimen score come from?** | The right panel shows a Discoverability Score for a named domain to a stranger who has not signed in. A real recent scan, a fixed specimen, or a placeholder — the three are not equivalent. Only the first is a measurement; the second must be labelled as one; the third is a number the product invents and shows to a customer, which is **rule 1.2**. The same question binds the landing hero's component — one question, not two. **Raised, not answered, and neither surface is built until it is ruled** |
| **Did "only the two endpoints labelled" mean the axis ticks too?** | `GrowthLine` already labels exactly two values — the endpoint, and the start value in §4.5's footnote pair. The marks under the plot carry a **week tick**, not a value. If the ruling meant those as well, that is a change to a registered chart's contract, not a CSS rule, and §2.4's *"every bar and point direct-labelled"* is on the other side of it. **Not taken** |
| **The reference screenshot's bar and its figure disagree** | The glass card sets the score at `47/100` and draws its bar at roughly 40%. Two renderings of one fact that disagree are rule 2.4's second copy arriving as a picture, so the drawing puts the bar at the figure and records the deviation. If the 40% is a different measure, it is a second fact and needs its own label |
| **The narrow viewport for the sign-in split** | **Decided (rule 1.1), not deferred.** Below `--breakpoint-lg` the panel does not sit beside the form, does not go above it, and is not dropped: it follows the form in flow, full width, on the same ground. The rule that decides it — the screen has exactly one primary action and it must be the first thing on the screen at every width; the panel carries no action and no route, so following the form costs the customer nothing, while putting it above pushes an email field below the fold on a phone. Dropping it was the other candidate and is refused for a weaker but real reason: ADR-093's whole shape is a designed narrow arm rather than a hidden surface. Reversal cost: one media query and the order of two children. `--breakpoint-lg` is itself derived — two form columns (2 × `--w-form` = 840) plus a generous inset either side (2 × (`--s-7` + `--s-6`) = 160) is 1000, and 1024 is the smallest named step that clears it |
| **The video is a new asset class** | **Decided.** *Absent* (no asset produced): the block does not render at all — no placeholder, no "coming soon", no empty frame; the hero above it does not depend on it and the sections close up behind it. *Loading*: the poster is the video's own first frame and ships with it, so the block renders its final size on the first paint and nothing moves when the player mounts — there is no separate loading state and no spinner (REQ-003 c1's rule, generalised). *Blocked* (a content policy, a tracking blocker, no network): the poster stays and one written line plus the video's own address takes the play control's place, in `warn` and never `bad` — red is the customer's own problem shown to them (§2.5) and a player we could not mount is ours |

### 9.5 Checkout has no surface here, and never had one

Checked across `design/` on 2026-09-02: **no component, token, sheet or
preview route renders a payment field, a card number, an invoice or a price
form**, and none is added. The report's pricing card carries a start action
that is a redirect and nothing else. Checkout, billing, invoicing and every
billing notification are Stripe's entirely, which is why none of it has a
surface in this file. `BUILD.md` §4.7's Settings **Billing** card is
recorded in `components.md` §7 as **pending an owner ruling** — not
redesigned on a guess, and not built in the meantime.
