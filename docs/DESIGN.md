# Design

The UI is daisyUI, one theme carrying the approved tokens, one chart library, and the screens on the canvas. Nothing custom. Owner ruling 2026-09-11 (#544 ruling 5): "a complete custom system must be avoided at all costs."

## Where the screens live

The **canvas** is the single source of screens: [ReachKit Screens](https://claude.ai/code/artifact/b65ace9b-3016-4321-b28c-3dfd867ef62f) — 21 artboards in three rows (public, app, email), editable in place by the owner. `SPEC.md` names screens by their artboard name (`Canvas: Dashboard`). A PR that changes a screen cites the artboard and shows the render beside it; a screen not on the canvas is drawn there and approved before it is built. The canvas sources are committed under `docs/design/canvas/` so the artboards can be re-seeded.

## Inherited from ReachKit v2

Owner ruling 2026-09-11: ten components keep the design of the previous version (archived repository `reachkitv2`), redrawn with v3 tokens for grounds, ink and accent. Their anatomy is the reference; the canvas carries them.

| Component | Where it lives now |
|---|---|
| LandingHero | landing hero (desktop and mobile): soft radial accent field, one pill form, proof card with gauge |
| CompanyTicker | landing proof row under the hero (logo placeholders until real logos exist) |
| WhySwitch | landing "why" section: one borderless comparison table, own row tinted |
| GalleryGrid | landing "how to start" cards: 18px radius, chip + mono label head row |
| PricingBlock | pricing page and the pay step: accent edge, tinted price box, 42px numeral |
| BrandMark | every navbar, footer and email header |
| ScoreHero | report header, degraded report, dashboard: gauge with band chip and driver bars |
| Kpi | dashboard tiles and report counts: mono uppercase label, mono numeral |
| SignalPanel | report and dashboard panels: mono title, inner 12px-radius tiles |
| Auth Login Page | sign-in: full-bleed split, 384px form column, accent field with a glass score card |

Four v2 colours have no v3 token and are added to the theme: `gradient-violet` (#7056e4 to #4e3fba), `tint-violet` (#f7f5ff with line #ddd8fa), `on-dark-muted` (#b7b4c4), `brand-arc` (#c3b2ff).

## Tokens (the daisyUI theme)

One theme, `reachkit`, declared once in `src/ui/tailwind.css` as a `@plugin "daisyui/theme"` block. Every value below is a token; no literal colour, radius, spacing or size appears anywhere else.

| Group | Tokens |
|---|---|
| Ground | `bg #f6f6f9` · `surface #ffffff` · `sunk #efeff4` · `line #eaeaf1` |
| Ink | `ink #191925` · `ink-2 #5e5e73` · `ink-3 #9695a8` |
| Accent | `accent #5b4be0` · `on-accent #ffffff` · `accent-bg #eeecfd` · `accent-line #ddd8fa` |
| Meaning | `ok #1f8a6b` · `warn #b8722a` · `bad #c0432b`, each with a `-bg` and `-line` |
| Charts | `chart-you #5b4be0` · `chart-rival #787790` · `chart-goal #b8722a` |
| Shape | radius `box 14px` · `field 9px` · `pill 999px` · `shadow-card 0 1px 3px rgb(24 24 48/.045)` |
| Space | `4 8 12 16 24 32 48` |
| Type | Plus Jakarta Sans for UI; JetBrains Mono for every numeral, domain and code. Hero h1 46px; h1 31 · h2 25 · h3 20 · h4 16 · body 15 · sm 13 · xs 12 · eyebrow 11 uppercase 700 `.1em` ink-3 · big number 44 mono 600 |
| Motion | `--motion-fast .18s` |
| Widths | wide 1216 · read 704 · form 420 · sidebar 222 · day panel 290 |

Dark theme: the same token names with the approved dark values (`docs/design/tokens.css`); one mapping serves both.

## Components

daisyUI components, themed, used as they come: `btn` (primary · outline · ghost; pill radius), `card`, `badge`, `stat`, `navbar`, `footer`, `tabs`, `table`, `alert`, `toggle`, `input`, `select`, `collapse`, `progress`, `steps`. Product rule: one solid primary button per screen.

Product components exist only where daisyUI has no equivalent: the ten inherited from v2 above, plus `CalendarGrid`, `DayPanel`, `AiDotMatrix`, `WeekStrip`, `ProblemCard`, `ActionPanel`. Each is a thin wrapper over daisyUI primitives and the theme; none carries its own stylesheet.

Charts: **Recharts 3** for every series (line, bar, sparkline); strokes and fills from the chart tokens; direct labels, no legend boxes. Grids that look like charts (the rivals × questions matrix, the week strip) are CSS grid, not charts.

Icons: **lucide-react**, stroke 1.75, 20px in chrome and 16px in badges. No emoji anywhere in the product.

## Layout

Bands: 1280 (wide) · 1024 (medium) · 768 · 320 (compact floor). Compact navigation stays a row. No section is sized to the viewport; every section is as tall as its content plus 48–64px. Page gutters 24px at compact, 48px from 768.

## States

Every interactive element has hover, focus-visible, disabled and, where it applies, invalid and pressed states, taken from daisyUI's own state selectors with the theme's colours. Loading, empty and error states are drawn on the canvas for every screen that has them; a screen without an empty state on the canvas has none in code.

## Rules and their checks

| Rule | Check |
|---|---|
| No literal colour, radius, spacing, size or breakpoint in `src/` — tokens only | `tests/ui/design/no-bare-literals.test.ts` |
| The 54 token names in `src/ui/theme.css` equal `docs/design/tokens.css` | `tests/ui/design/token-set.test.ts` |
| Only the six product components exist under `src/ui/components/custom/` | `tests/ui/design/component-registry.test.ts` |
| No new stylesheet under `src/ui/`; `idiom.css` only shrinks | unenforced — to add with the reduction issue (#548) |
| Every numeral renders in the mono face | `tests/ui/design/vocabulary.ts` + layout suite |
| A changed screen's PR cites its artboard and shows the render | `pr-hygiene` (body check) |

## What is retired

The custom layer is removed, not extended (#548, #550): the daisyUI re-skins in `idiom.css`, the `rk-*` layout classes (replaced by Tailwind utilities per screen), the hand-rolled chart SVG (replaced by Recharts 3), `OptionCard` (the mode choice is gone), and `tailwind.config.ts` (replaced by the CSS-first theme block). Nothing new joins that layer.

## Admitting new UI

A new element is admitted in this order: an existing daisyUI component → a daisyUI component with a theme variable → a thin wrapper listed above → nothing else. A PR that adds a custom component where daisyUI has one is rejected.
