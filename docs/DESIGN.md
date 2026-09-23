# Design

Three rules. Nothing else is UI law.

1. **daisyUI** — one theme, `reachkit`, in `src/ui/tailwind.css`. Screens are daisyUI classes in the route file (`btn`, `card`, `navbar`, `footer`, `input`, `select`, `badge`, `stat`, `table`, `alert`, `toggle`, `tabs`, `collapse`, `progress`, `steps`, and from 2026-09-20 `drawer`, `dock`, `skeleton`, `filter`, `timeline`, `list`, `status`, `tooltip`, `toast`, `modal`, `fieldset`, `validator`, `mockup-browser`, `mockup-phone`). One solid primary button per screen.
2. **Recharts 3** — every series (line, bar, sparkline). Strokes and fills from the theme chart tokens. Direct labels, no legend boxes. Grids that are not series (rivals × questions, week strip) are CSS grid.
3. **lucide-react** — stroke 1.75, 20px in chrome, 16px in badges. No emoji.

The owner reviews UI by clicking `dev.reachkit.app`. There is no pixel baseline as a merge gate and no custom design system.

- 2026-09-20 (#908): the owner-approved redesign canvas — https://claude.ai/artifact/3H3ioc84tbpo9Q5Bybug5d (pages “Round 4” and “Round 5”) — is the **structural reference**: what is on each screen, in what order, with what wording. It is drawn with daisyUI classes on the `reachkit` theme. Implement it with those classes; never match its pixels, never copy its markup, and never treat a difference of a few pixels as a defect. `docs/archive/` stays frozen and unread.

## Each screen and its decided board (owner, 2026-09-23, #1026)

A screen is built to the board named on its row and to nothing else. The boards are the owner’s files, `<board>.dc.html` beside its `.jpg`, under `/root/ops/reachkit/design/<round>/`. A board says what the screen holds, in what order, with what wording — never its pixels and never its markup; the three rules above still say how it looks, and the canvas line above still governs how a board is read. **A change of board is an owner decision: it needs a new dated line in `docs/SPEC.md` and a new board, not an edit here.**

The addresses are this repository’s, which is not always what the ledger calls a screen: *Plan* is served at `/app/calendar` (the screen is called Plan, the ruling of 2026-09-20 on #914), *the page* at `/app/draft/{draftId}`, and the editor is an arm of that same address rather than one of its own.

| Screen | Route | Board | Ruled |
|---|---|---|---|
| Landing — the hero | `/` | `R11-H4-Week` | 2026-09-21 hero (#935); the sections below it follow `R6-1-Landing` |
| Landing — the sections | `/` | `R6-1-Landing` | 2026-09-20 (#936, #935); its own hero is superseded by `R11-H4-Week` |
| Pricing | `/pricing` | `R6-2-Pricing` | 2026-09-20 (#937) |
| Free scan in progress | `/scan/{domain}` | `R5-W2-Scanning` | 2026-09-20 (#908, SPEC §2) |
| Free scan report | `/scan/{domain}` | `R5-W3-Report` | 2026-09-20 (#935); report facts 2026-09-22 (#715) |
| Quiet pages | `/opt-out/{token}`, the not-found and refused arms | `R6-6-Quiet` | 2026-09-20 (#936) |
| Legal pages | `/privacy`, `/terms`, `/imprint` | `R6-7-Legal` | 2026-09-20 (#936); the bodies are owner-owed (#335) |
| Phone: landing | `/` at 390 | `R6-8-Phone-landing` | 2026-09-20 (#936, #910) |
| Phone: report | `/scan/{domain}` at 390 | `R6-9-Phone-report` | 2026-09-20 (#910) |
| Sign in | `/signin` | `R7-S1-Signin` | 2026-09-20 (#937); built by #1025 |
| Sign in: link sent | `/signin` | `R7-S2-Sent` | 2026-09-20 (#937); built by #1025 |
| Sign in: old link | `/signin` | `R7-S3-Old-link` | 2026-09-20 (#937); built by #1025 |
| Stop this page | `/veto/{token}` | `R7-S4-Stop` | 2026-09-20 (#937); wording 2026-09-20 (#914) |
| Stop this page: stopped | `/veto/{token}` | `R7-S5-Stopped` | 2026-09-20 (#937); built by #1025 |
| Setup, five steps | `/setup` | `R4-01-Onboarding` | 2026-09-20 (SPEC §5) |
| Connect your blog | `/setup/connect` | `R4-02-Connect` | 2026-09-20, reversing #757; eyebrow 2026-09-21 (#972) |
| Overview, first day | `/app` | `R4-03-FirstDay` | 2026-09-20 no loading screens (SPEC §4) |
| Overview | `/app` | `R4-04-Overview` | 2026-09-20 (SPEC §4) |
| Overview › Search | `/app/search` | `R4-05-Search` | 2026-09-20 (SPEC §4) |
| Overview › AI answers | `/app/ai-answers` | `R4-06-AI-answers` | 2026-09-20 measures; names-you 2026-09-21 (#953); weekly LLM Mentions 2026-09-22 |
| Overview › Rivals | `/app/rivals` | `R4-07-Rivals` | 2026-09-20 (SPEC §4); leaders line 2026-09-21 (#983) |
| Plan | `/app/calendar` | `R4-08-Plan` | 2026-09-20 (SPEC §7); opens on today 2026-09-21 (#961) |
| Day-card states | the day cards on `/app/calendar` | `R3-DayCards` | 2026-09-20, Round 3 |
| The page as it publishes | `/app/draft/{draftId}` | `R4-09-Page` | 2026-09-20 (SPEC §7) |
| The editor | the editing arm of `/app/draft/{draftId}` | `R4-10-Editor` | 2026-09-20 (SPEC §7); tab title 2026-09-21 (#984) |
| Settings › Your business | `/app/settings` | `R4-11-Business` | 2026-09-20; “new” marks 2026-09-21 (#969) |
| Settings, the other six tabs | `/app/settings/{market,publishing,voice,mail,billing,account}` | `R2-S8-Settings` | 2026-09-20 (SPEC §4) |
| Phone: setup | `/setup` at 390 | `R5-P1-Onboarding` | 2026-09-20 |
| Phone: overview | `/app` at 390 | `R5-P2-Overview` | 2026-09-20 |
| Phone: plan | `/app/calendar` at 390 | `R5-P3-Plan` | 2026-09-20; sheet closed at rest 2026-09-21 (#961) |
| Phone: the page | `/app/draft/{draftId}` at 390 | `R5-P4-Page` | 2026-09-20 |
| Phone: editor | the editing arm at 390 | `R5-P5-Editor` | 2026-09-20 |
| Mail: your page is ready | Resend | `R5-M1-Ready` | 2026-09-20 |
| Mail: what moved this week | Resend | `R5-M2-Weekly` | 2026-09-20 |
| Dark: overview | `/app`, dark | `R5-D1-Overview` | 2026-09-20 dark pass; contrast 2026-09-21 (#946) |
| Dark: plan | `/app/calendar`, dark | `R5-D2-Plan` | 2026-09-20 |
| Dark: search | `/app/search`, dark | `R5-D3-Search` | 2026-09-20 |
| The mark | everywhere the brand is drawn (`src/app/_brand/Brand.tsx`) | `R9-L1-Chip` | 2026-09-21 (#982) |

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
