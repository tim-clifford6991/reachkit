# Design

Three rules. Nothing else is UI law.

1. **daisyUI** — one theme, `reachkit`, in `src/ui/tailwind.css`. Screens are daisyUI classes in the route file (`btn`, `card`, `navbar`, `footer`, `input`, `select`, `badge`, `stat`, `table`, `alert`, `toggle`, `tabs`, `collapse`, `progress`, `steps`, and from 2026-09-20 `drawer`, `dock`, `skeleton`, `filter`, `timeline`, `list`, `status`, `tooltip`, `toast`, `modal`, `fieldset`, `validator`, `mockup-browser`, `mockup-phone`). One solid primary button per screen.
2. **Recharts 3** — every series (line, bar, sparkline). Strokes and fills from the theme chart tokens. Direct labels, no legend boxes. Grids that are not series (rivals × questions, week strip) are CSS grid.
3. **lucide-react** — stroke 1.75, 20px in chrome, 16px in badges. No emoji.

The owner reviews UI by clicking `dev.reachkit.app`. There is no pixel baseline as a merge gate and no custom design system.

- 2026-09-20 (#908): the owner-approved redesign canvas — https://claude.ai/artifact/3H3ioc84tbpo9Q5Bybug5d (pages “Round 4” and “Round 5”) — is the **structural reference**: what is on each screen, in what order, with what wording. It is drawn with daisyUI classes on the `reachkit` theme. Implement it with those classes; never match its pixels, never copy its markup, and never treat a difference of a few pixels as a defect. `docs/archive/` stays frozen and unread.

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

## Libraries (owner, 2026-09-20, #908)

A dependency is admitted only where it deletes hand-written UI code. This is the whole list; anything else needs an owner ruling. Each is installed by the first issue that uses it, pinned, after checking it against React 19 and Next 16.

| Library | It replaces |
|---|---|
| `react-day-picker` 9 with `date-fns` and `@date-fns/tz` | The hand-built month grid. daisyUI ships its styles; the day card goes in its day slot. |
| `@tanstack/react-table` 8 | Sorting, filtering and paging of the Search and Rivals lists, rendered as a daisyUI `table`. |
| `nuqs` | Hand-rolled URL state: month, day, tab, filters, setup step. |
| CodeMirror 6 — `@uiw/react-codemirror`, `@codemirror/lang-markdown`, `@codemirror/lint` | The editor textarea; rule breaks are lint marks in the text. |
| `mdast-util-from-markdown` with the GFM-table and directive extensions | The hand-written Markdown parser. The closed, escape-everything serialiser stays ours. |
| `@tailwindcss/typography` | The hand-kept article class tables (`prose` on hosted pages and the preview). |
| `sonner`, drawn with daisyUI `alert` classes | Silent actions: every action now answers. |
| `react-email` on Resend | The custom mail block system (its own issue; may land last). |
| `@axe-core/playwright` | Hand checks of accessibility, run with the no-overflow check below. |

Already installed and to be used before anything new: daisyUI `drawer` with its `is-drawer-open` / `is-drawer-close` variants (the collapsible side panel, no script), `inngest/realtime` and `inngest/react` (the pass’s current step, in place of polling), React 19 `useActionState` / `useOptimistic`, Next `after()`, Postgres `pg_trgm` and full-text search (the known-content check).

Not admitted: a second component system (shadcn, Radix, Headless UI), a form, state or animation library, `react-markdown` for the preview (the preview is the publishing renderer), a second chart library, Storybook.

## Layout that cannot overflow (owner, 2026-09-20, #908)

- No element is wider than its container and no text is clipped by its card at 390, 768 and 1280 pixels, in light and dark. CI renders every route at those widths and fails on either; `@axe-core/playwright` runs in the same pass.
- Every Recharts series sits in a `ResponsiveContainer`. A bar gets its own full-width line under its label, never the space left beside one.
- A label that can grow (a title, a domain, a search) is clamped to one or two lines with an ellipsis; a number is never clamped, so the box changes instead.
- A step indicator is daisyUI `steps` with one-word labels.

## Admitting new UI

daisyUI class → daisyUI class plus a theme colour → Recharts → lucide → a library on the list above → stop. A PR that adds a custom component or CSS sheet where those already cover it is rejected.
