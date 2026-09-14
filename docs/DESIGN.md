# Design

Three rules. Nothing else is UI law.

1. **daisyUI** — one theme, `reachkit`, in `src/ui/tailwind.css`. Screens are daisyUI classes in the route file (`btn`, `card`, `navbar`, `footer`, `input`, `select`, `badge`, `stat`, `table`, `alert`, `toggle`, `tabs`, `collapse`, `progress`, `steps`). One solid primary button per screen.
2. **Recharts 3** — every series (line, bar, sparkline). Strokes and fills from the theme chart tokens. Direct labels, no legend boxes. Grids that are not series (rivals × questions, week strip) are CSS grid.
3. **lucide-react** — stroke 1.75, 20px in chrome, 16px in badges. No emoji.

The owner reviews UI by clicking `dev.reachkit.app`. There is no artboard, no canvas, no pixel baseline as a merge gate, and no custom design system.

## Do not

- Do not read or edit `docs/design/canvas/` or `docs/archive/`. Those files are frozen sketches. They are not a spec. Never open a task to “match the artboard.”
- Do not add a wrapper component where a daisyUI class exists. Existing wrappers under `src/ui/components/` are debt: new screens skip them; a follow-up PR deletes them.
- Do not add a stylesheet under `src/ui/` except shrinking `idiom.css` toward empty, then deleting it.
- Do not hand-roll SVG charts. `GrowthLine`, `PresenceBars`, `RivalSparkline` and `chart-primitives.ts` are debt: replace with Recharts, then delete.
- Do not invent tokens, colours, or a type scale. Colour comes from the `reachkit` theme. Spacing and type use Tailwind’s scale (`p-4`, `text-sm`), not `p-(--s-4)`.
- Do not write a test that transcribes this file or forbids Tailwind’s scale.

## Theme

One `@plugin "daisyui/theme"` named `reachkit`. Ground, ink, accent, meaning (ok / warn / bad), and chart-you / chart-rival / chart-goal live there. Dark is the same names with dark values. Plus Jakarta Sans for UI; JetBrains Mono for numerals, domains and code.

## Admitting new UI

daisyUI class → daisyUI class plus a theme colour → Recharts → lucide → stop. A PR that adds a custom component or CSS sheet where those already cover it is rejected.
