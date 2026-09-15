# Design

Three rules. Nothing else is UI law.

1. **daisyUI** — one theme, `reachkit`, in `src/ui/tailwind.css`. Screens are daisyUI classes in the route file (`btn`, `card`, `navbar`, `footer`, `input`, `select`, `badge`, `stat`, `table`, `alert`, `toggle`, `tabs`, `collapse`, `progress`, `steps`). One solid primary button per screen.
2. **Recharts 3** — every series (line, bar, sparkline). Strokes and fills from the theme chart tokens. Direct labels, no legend boxes. Grids that are not series (rivals × questions, week strip) are CSS grid.
3. **lucide-react** — stroke 1.75, 20px in chrome, 16px in badges. No emoji.

The owner reviews UI by clicking `dev.reachkit.app`. There is no artboard, no canvas, no pixel baseline as a merge gate, and no custom design system.

## Do not

- Do not read or edit `docs/archive/`. Frozen sketches, including the old canvas HTML. Not a spec. Never match an artboard.
- Do not add a wrapper component where a daisyUI class exists. The old wrappers under `src/ui/components/` were deleted (issue 732).
- Do not add a stylesheet under `src/ui/` except shrinking `idiom.css` toward empty, then deleting it.
- Do not hand-roll SVG charts. `GrowthLine`, `PresenceBars` and `RivalSparkline` are Recharts (#550). The AI-answers matrix is CSS grid in its routes (#730). `chart-primitives.ts` is debt kept only for the OG card's two SVG tokens; delete it with that card. `series.ts` is the Recharts series' colour map.
- Do not invent tokens, colours, or a type scale. Colour comes from the `reachkit` theme. Spacing and type use Tailwind’s scale (`p-4`, `text-sm`), not `p-(--s-4)`.
- Do not write a test that transcribes this file or forbids Tailwind’s scale.

## Theme

One `@plugin "daisyui/theme"` named `reachkit`. Ground, ink, accent, meaning (ok / warn / bad), and chart-you / chart-rival / chart-goal live there. Dark is the same names with dark values. Plus Jakarta Sans for UI; JetBrains Mono for numerals, domains and code.

- 2026-09-14 (#681): Light / Dark / System is the product's theme control — one daisyUI `dropdown` (`src/app/_theme/ThemeToggle.tsx`) in the public header and the `/app` shell, never on hosted pages. System sets no `data-theme`; Light and Dark set `data-theme="light"` / `"dark"` on `<html>`, applied before paint from `localStorage`. Still the one `reachkit` theme with `themes: false`; no second palette.

## Admitting new UI

daisyUI class → daisyUI class plus a theme colour → Recharts → lucide → stop. A PR that adds a custom component or CSS sheet where those already cover it is rejected.
