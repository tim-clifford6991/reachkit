# ReachKit preview app

**Preview artifact — design-system skill step 2 (the "React prototype" arm).
Not production code. Nothing in it is signed.**

Every row in `../../components.md` is `proposed`. Running this app moves none
of them, and no `Signed-off:` date follows from reading it. A row flips on a
signature, not on a drawing — and a running drawing is still a drawing.

## Run it

```
cd sdlc-factory/docs/design/previews/app
npm install
npm run dev
```

Then open **http://localhost:4300**.

Versions are pinned at the minor level rather than the patch, deliberately: a
patch pin that does not resolve fails `npm install` for a reason that has
nothing to do with design. If a floor ever drifts, `npm install` is the whole
fix.

## What is inside

The stack is the charter's, exactly — `00-project.md` "Stack" and `BUILD.md`
§1: Next.js App Router + TypeScript, Tailwind CSS 4 + daisyUI 5, Plus Jakarta
Sans and JetBrains Mono self-hosted through `@fontsource`, lucide-react.

**No network call, no vendor SDK, no database.** Every value on every screen
comes from `src/mock/data.ts`. The fonts are on disk. Nothing here reaches the
outside.

| Route | Shows |
|---|---|
| `/` | Index: every route, one line on what it shows and what is unsigned about it |
| `/tokens` | The WO-029 specimen as live code — tokens read back out of the running document, the four ruled values, type roles at their real letterforms, the numeral rule, the chart bounds |
| `/primitives` | The WO-031 sheet — all 15 registered daisyUI primitives, every state `components.md` records, and the three it records as *not* registered |
| `/surfaces` | The WO-033 sheet — `Sidebar`, `CalendarGrid`, `DayPanel`, `AiDotMatrix`; the ways-through slot in all three route cases; the never-padded grid with its four empty-day accounts |
| `/charts` | The WO-035 sheet — the five closed chart forms, the gapped pair drawn together, the three-state cell with the ring on the customer's own absent row |
| `/walk/report` | BUILD §4.1's six modules, in order |
| `/walk/setup` | BUILD §4.3's three decisions and one submit |
| `/walk/app/overview` | BUILD §4.5, inside §4.4's shell |
| `/walk/app/calendar` | BUILD §4.6, with the day panel open |
| `/walk/draft` | The draft view behind "Read the full page" |

The five `/walk/*` routes are **assembled from registered components for
review — not a signed preview of any work order**. Each says so on itself, in
the page, above the fold.

## Where the values live

`src/app/globals.css` is the only place a design value is written down. It
transcribes `../../tokens.md`, which transcribes `BUILD.md` §2 and — since
2026-09-02 — carries nine values derived under rule 1.1 in its §2b. There is
no hex and no px anywhere in `src/**/*.tsx`.

Two raw values survive in the stylesheet and both are recorded exemptions
(`tokens.md` §2b, §7):

- **A coordinate inside an SVG `viewBox`.** Coordinate space, not a design
  value. This no longer covers *text*: a `viewBox` scales with its container,
  so an 11px label inside one renders at whatever the scale makes it. Every
  chart mark is SVG and **every chart label is HTML** at a named size.
- **The literal inside an `@media` prelude.** CSS cannot read a `var()`
  there. Every query in the file is a `min-width` and every literal equals a
  token named in `@theme` — never a breakpoint minus one pixel.

## Responsive, and what is found versus proposed

The four breakpoints are declared in the `@theme` block and nowhere else, so
`lg:hidden` and `var(--breakpoint-lg)` resolve from one declaration.

| Width | What happens | Standing |
|---|---|---|
| `--breakpoint-sm` 640 | Two-up layouts; heads step up to the full scale; controls step down to `--t-sm` | derived (rule 1.1) |
| `--breakpoint-md` 768 | The month and the week strip become seven columns rather than seven rows | **proposed** — §4 gap 8 |
| `--breakpoint-lg` 1024 | The sidebar returns and the top tabs go | **found** — §4.4's own sentence; only the width is derived |
| `--breakpoint-xl` 1280 | The day panel returns to 290px sticky beside the grid; the draft editor becomes two columns | **proposed** (panel) · **found** (editor — §4.6's owner ruling, 28 Aug; only the width is derived) |

The theme control in the chrome has **three** positions, because `BUILD.md`
§2.1's theming has three states: no `data-theme` attribute (follow the OS),
`data-theme="light"`, `data-theme="dark"`. A two-position toggle leaves the
media-guarded branch untestable.

`--pv-*` is the preview app's own furniture and is never a product token.
Everything a reviewer reads *about* a screen is drawn in `--pv-*`; everything
that *is* the screen is drawn in product tokens.

## Proposed, not registered

Marked on screen wherever it appears, never passed off as registered:

- `Textarea` — `components.md` §4 gap 2
- `CodeBlock` — §4 gap 3
- `TabBar` — §4 gap 5, built as a composition over registered `Tabs`
- the loading rule and the failed-measurement tone — `components.md` §6
- `--w-sidebar`, `--w-day-panel`, `--grid-week` — `tokens.md` §7
- the three narrow-viewport reflows — `components.md` §4 gap 8

`--t-sm` and `--t-xs` are **no longer proposed**: they are law under rule 1.1
(`tokens.md` §2b) and carry no mark anywhere in this app.

§4 gap 4 — the indeterminate "still running" affordance — is **not built**.
Resolving it to `Steps` or adding a row is a decision, and drawing a fourth
option would paper over it.

## The four HTML sheets stand — and two are now behind

`../WO-029.html`, `../WO-031.html`, `../WO-033.html`, `../WO-035.html` are the
record of what was drawn and why, and this app supersedes none of them. They
are **not silently repainted**: WO-033 and WO-035 both draw text under
`--t-floor` and WO-035 draws the pre-rebuild sparkline, and
`components.md` §5 states exactly where and what it would take. Whether the
running app should *replace* them as the medium rule 7.3 is satisfied by is a
change to how the gate works here — an owner ruling via `/decide`.
