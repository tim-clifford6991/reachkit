---
name: design-system
description: Apply ReachKit UI rules — daisyUI with the one reachkit theme, Recharts 3, lucide. Use before touching anything under src/app or src/ui that renders.
---

# The ReachKit design system

Read `docs/DESIGN.md`. It is the whole rule. There is no artboard and no canvas.

## Before you write a line

1. Read `docs/DESIGN.md`.
2. Look at the live route on `dev.reachkit.app` (or the existing page in `src/app`). Do not open `docs/archive/`.

## Building it

- daisyUI classes in the route: `btn` (primary · outline · ghost), `card`, `badge`, `stat`, `navbar`, `footer`, `tabs`, `table`, `alert`, `toggle`, `input`, `select`, `collapse`, `progress`, `steps`. One solid primary button per screen.
- Admit new UI: daisyUI class → daisyUI class plus a theme colour → Recharts → lucide → stop.
- Charts: Recharts 3, theme chart tokens, direct labels. Icons: lucide-react, stroke 1.75. No emoji.
- Colour from the `reachkit` theme in `src/ui/tailwind.css` and `src/ui/theme.css`. Spacing and type use Tailwind’s scale (`p-4`, `text-sm`).
- Every sentence is a copy key; an unwritten one is `TODO(copy)`.

## Never

- A custom component, stylesheet, or SVG chart where daisyUI or Recharts covers it.
- Matching, citing, or re-seeding an artboard. `docs/archive/` is frozen.
- A second theme or a Tailwind JS config.
- Wrapping daisyUI in a new `Btn` / `Card`. Existing wrappers are debt; new screens skip them.
