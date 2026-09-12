---
name: design-system
description: Apply the ReachKit design system to any screen, component or style change — daisyUI with the one `reachkit` theme, Recharts 3, and the canvas artboard. Use before touching anything under src/app or src/ui that renders.
---

# The ReachKit design system

The UI is daisyUI, one theme carrying the approved tokens, one chart library,
and the screens on the canvas. Nothing custom — owner ruling 2026-09-11: "a
complete custom system must be avoided at all costs."

## Before you write a line

1. Read `docs/DESIGN.md`, whole. It is short, and it is the rule.
2. Find the screen's artboard. `SPEC.md` names it (`Canvas: Dashboard`);
   `docs/design/canvas/canvas.json` lists every artboard with its file, and
   the file is `docs/design/canvas/<Name>.dc.html`. That artboard is what the
   screen must look like. A screen with no artboard is drawn on the canvas and
   approved before it is built — never designed in code.
3. For the anatomy of a daisyUI component as the canvas draws it (heights,
   paddings, radius, which token), read `docs/design/canvas/RECIPE.md`. For the
   ten components inherited from v2 (LandingHero, CompanyTicker, WhySwitch,
   GalleryGrid, PricingBlock, BrandMark, ScoreHero, Kpi, SignalPanel, Auth Login
   Page), DESIGN.md's table says where each lives; their artboards carry the
   anatomy, and RECIPE.md the tokens they are drawn in.

## Building it

- Use daisyUI's components as they come, with the theme's classes:
  `btn` (primary · outline · ghost), `card`, `badge`, `stat`, `navbar`,
  `footer`, `tabs`, `table`, `alert`, `toggle`, `input`, `select`, `collapse`,
  `progress`, `steps`. One solid primary button per screen.
- Admit new UI in this order, and stop at the first that serves: an existing
  daisyUI component → a daisyUI component with a theme variable → a thin
  wrapper DESIGN.md lists → nothing else.
- Lay out with Tailwind utilities. Charts are Recharts 3 with the chart tokens
  and direct labels. Icons are lucide-react, stroke 1.75. No emoji.
- Every colour, radius, spacing, size and breakpoint is a token: `var(--…)` on
  a name in `src/ui/theme.css` (the 54 approved) or in the `reachkit` theme
  block in `src/ui/tailwind.css` (daisyUI's slots and the four v2 colours).
  Every numeral is JetBrains Mono.
- Every sentence is a copy key; an unwritten one is `TODO(copy)`.

## Never

- A custom component, a new stylesheet, or a new token where daisyUI or the
  theme already has one. `idiom.css` and the `rk-*` classes only shrink.
- A literal value in `src/`, or a second theme, or a Tailwind JS config.
- A value copied from v2 or from the archive's drawings; the canvas wins.

## Checks that hold you to it

`tests/ui/design/no-bare-literals.test.ts` · `token-set.test.ts` ·
`theme-slots.test.ts` · `component-registry.test.ts` · the layout suite in CI.
A PR that moves a screen names its routes on a `Renders:` line.
