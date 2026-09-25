# Design

Three rules. Nothing else is UI law.

1. **daisyUI** — one theme, `reachkit`, in `src/ui/tailwind.css`. Screens are daisyUI classes in the route file (`btn`, `card`, `navbar`, `footer`, `input`, `select`, `badge`, `stat`, `table`, `alert`, `toggle`, `tabs`, `collapse`, `progress`, `steps`, and from 2026-09-20 `drawer`, `dock`, `skeleton`, `filter`, `timeline`, `list`, `status`, `tooltip`, `toast`, `modal`, `fieldset`, `validator`, `mockup-browser`, `mockup-phone`). One solid primary button per screen.
2. **Recharts 3** — every series (line, bar, sparkline). Strokes and fills from the theme chart tokens. Direct labels, no legend boxes. Grids that are not series (rivals × questions, week strip) are CSS grid.
3. **lucide-react** — stroke 1.75, 20px in chrome, 16px in badges. No emoji.

The owner reviews UI by clicking `dev.reachkit.app`. There is no pixel baseline as a merge gate and no custom design system.

- 2026-09-20 (#908): the owner-approved redesign canvas — https://claude.ai/artifact/3H3ioc84tbpo9Q5Bybug5d (pages “Round 4” and “Round 5”) — is the **structural reference**: what is on each screen, in what order, with what wording. It is drawn with daisyUI classes on the `reachkit` theme. Implement it with those classes; never match its pixels, never copy its markup, and never treat a difference of a few pixels as a defect. `docs/archive/` stays frozen and unread.

## Each screen and its decided board (owner, 2026-09-23, #1026)

A screen is built to the board named on its row and to nothing else. Each board is two files in this repository — `docs/design/boards/<board-id>/<board-id>.dc.html`, the source, and its `.jpg` render — linked from the row. A board says what the screen holds, in what order, with what wording — never its pixels and never its markup; the three rules above still say how it looks, and the canvas line above still governs how a board is read. **A change of board is an owner decision: it needs a new dated line in `docs/SPEC.md` and a new board, not an edit here.**

The addresses are this repository’s, which is not always what the ledger calls a screen: *Plan* is served at `/app/calendar` (the screen is called Plan, the ruling of 2026-09-20 on #914), *the page* at `/app/draft/{draftId}`, and the editor is an arm of that same address rather than one of its own.

| Screen | Route | Board | Ruled |
|---|---|---|---|
| Landing | `/` | [`R12-1-Landing`](design/boards/R12-1-Landing/R12-1-Landing.dc.html) · [render](design/boards/R12-1-Landing/R12-1-Landing.jpg) | 2026-09-24 (#1059): banner, header, hero with *Inside ReachKit*, logo strip (ships, #1058), video on the fold, why, next, closing band; supersedes `R11-H4-Week` and `R6-1-Landing` |
| Pricing | `/pricing` | [`R6-2-Pricing`](design/boards/R6-2-Pricing/R6-2-Pricing.dc.html) · [render](design/boards/R6-2-Pricing/R6-2-Pricing.jpg) | 2026-09-20 (#937) |
| Free scan in progress | `/scan/{domain}` | [`R5-W2-Scanning`](design/boards/R5-W2-Scanning/R5-W2-Scanning.dc.html) · [render](design/boards/R5-W2-Scanning/R5-W2-Scanning.jpg) | 2026-09-20 (#908, SPEC §2) |
| Free scan report | `/scan/{domain}` | [`R12-2-Report`](design/boards/R12-2-Report/R12-2-Report.dc.html) · [render](design/boards/R12-2-Report/R12-2-Report.jpg) | 2026-09-24 (#1059), supersedes `R5-W3-Report`; report facts 2026-09-22 (#715) |
| Free scans gallery | `/scans` | [`R12-3-Gallery`](design/boards/R12-3-Gallery/R12-3-Gallery.dc.html) · [render](design/boards/R12-3-Gallery/R12-3-Gallery.jpg) | 2026-09-24 (#1059); listed unless removed, page indexed, reports `noindex` (#1058) |
| Phone: free scans gallery | `/scans` at 390 | [`R12-9-Phone-gallery`](design/boards/R12-9-Phone-gallery/R12-9-Phone-gallery.dc.html) · [render](design/boards/R12-9-Phone-gallery/R12-9-Phone-gallery.jpg) | 2026-09-24 (#1059); #1058 as above |
| Quiet pages | `/opt-out/{token}`, the not-found and refused arms | [`R6-6-Quiet`](design/boards/R6-6-Quiet/R6-6-Quiet.dc.html) · [render](design/boards/R6-6-Quiet/R6-6-Quiet.jpg) | 2026-09-20 (#936) |
| Legal pages | `/privacy`, `/terms`, `/imprint` | [`R6-7-Legal`](design/boards/R6-7-Legal/R6-7-Legal.dc.html) · [render](design/boards/R6-7-Legal/R6-7-Legal.jpg) | 2026-09-20 (#936); the bodies are owner-owed (#335) |
| Phone: landing | `/` at 390 | [`R12-8-Phone-landing`](design/boards/R12-8-Phone-landing/R12-8-Phone-landing.dc.html) · [render](design/boards/R12-8-Phone-landing/R12-8-Phone-landing.jpg) | 2026-09-24 (#1059), supersedes `R6-8-Phone-landing` |
| Phone: report | `/scan/{domain}` at 390 | [`R6-9-Phone-report`](design/boards/R6-9-Phone-report/R6-9-Phone-report.dc.html) · [render](design/boards/R6-9-Phone-report/R6-9-Phone-report.jpg) | 2026-09-20 (#910) |
| Sign in | `/signin` | [`R7-S1-Signin`](design/boards/R7-S1-Signin/R7-S1-Signin.dc.html) · [render](design/boards/R7-S1-Signin/R7-S1-Signin.jpg) | 2026-09-20 (#937); built by #1025 |
| Sign in: link sent | `/signin` | [`R7-S2-Sent`](design/boards/R7-S2-Sent/R7-S2-Sent.dc.html) · [render](design/boards/R7-S2-Sent/R7-S2-Sent.jpg) | 2026-09-20 (#937); built by #1025 |
| Sign in: old link | `/signin` | [`R7-S3-Old-link`](design/boards/R7-S3-Old-link/R7-S3-Old-link.dc.html) · [render](design/boards/R7-S3-Old-link/R7-S3-Old-link.jpg) | 2026-09-20 (#937); built by #1025 |
| Stop this page | `/veto/{token}` | [`R7-S4-Stop`](design/boards/R7-S4-Stop/R7-S4-Stop.dc.html) · [render](design/boards/R7-S4-Stop/R7-S4-Stop.jpg) | 2026-09-20 (#937); wording 2026-09-20 (#914) |
| Stop this page: stopped | `/veto/{token}` | [`R7-S5-Stopped`](design/boards/R7-S5-Stopped/R7-S5-Stopped.dc.html) · [render](design/boards/R7-S5-Stopped/R7-S5-Stopped.jpg) | 2026-09-20 (#937); built by #1025 |
| Setup, five steps | `/setup` | [`R4-01-Onboarding`](design/boards/R4-01-Onboarding/R4-01-Onboarding.dc.html) · [render](design/boards/R4-01-Onboarding/R4-01-Onboarding.jpg) | 2026-09-20 (SPEC §5) |
| Setup, step two: your business | `/setup`, step 2 | [`R3-ON-Business`](design/boards/R3-ON-Business/R3-ON-Business.dc.html) · [render](design/boards/R3-ON-Business/R3-ON-Business.jpg) | 2026-09-20, Round 3 |
| Connect your blog | `/setup/connect` | [`R4-02-Connect`](design/boards/R4-02-Connect/R4-02-Connect.dc.html) · [render](design/boards/R4-02-Connect/R4-02-Connect.jpg) | 2026-09-20, reversing #757; eyebrow 2026-09-21 (#972) |
| Overview, first day | `/app` | [`R4-03-FirstDay`](design/boards/R4-03-FirstDay/R4-03-FirstDay.dc.html) · [render](design/boards/R4-03-FirstDay/R4-03-FirstDay.jpg) | 2026-09-20 no loading screens (SPEC §4) |
| Overview | `/app` | [`R12-4-Overview`](design/boards/R12-4-Overview/R12-4-Overview.dc.html) · [render](design/boards/R12-4-Overview/R12-4-Overview.jpg) | 2026-09-24 (#1059), supersedes `R4-04-Overview` (SPEC §4) |
| Overview › Search | `/app/search` | [`R4-05-Search`](design/boards/R4-05-Search/R4-05-Search.dc.html) · [render](design/boards/R4-05-Search/R4-05-Search.jpg) | 2026-09-20 (SPEC §4) |
| Overview › AI answers | `/app/ai-answers` | [`R4-06-AI-answers`](design/boards/R4-06-AI-answers/R4-06-AI-answers.dc.html) · [render](design/boards/R4-06-AI-answers/R4-06-AI-answers.jpg) † | 2026-09-20 measures; names-you 2026-09-21 (#953); weekly LLM Mentions 2026-09-22 |
| Overview › Rivals | `/app/rivals` | [`R4-07-Rivals`](design/boards/R4-07-Rivals/R4-07-Rivals.dc.html) · [render](design/boards/R4-07-Rivals/R4-07-Rivals.jpg) | 2026-09-20 (SPEC §4); leaders line 2026-09-21 (#983) |
| Plan | `/app/calendar` | [`R12-5-Plan`](design/boards/R12-5-Plan/R12-5-Plan.dc.html) · [render](design/boards/R12-5-Plan/R12-5-Plan.jpg) | 2026-09-24 (#1059), supersedes `R4-08-Plan`; opens on today 2026-09-21 (#961) |
| Day-card states | the day cards on `/app/calendar` | [`R3-DayCards`](design/boards/R3-DayCards/R3-DayCards.dc.html) · [render](design/boards/R3-DayCards/R3-DayCards.jpg) | 2026-09-20, Round 3 |
| The page as it publishes | `/app/draft/{draftId}` | [`R12-6-Page`](design/boards/R12-6-Page/R12-6-Page.dc.html) · [render](design/boards/R12-6-Page/R12-6-Page.jpg) | 2026-09-24 (#1059), supersedes `R4-09-Page` (SPEC §7) |
| The editor | the editing arm of `/app/draft/{draftId}` | [`R4-10-Editor`](design/boards/R4-10-Editor/R4-10-Editor.dc.html) · [render](design/boards/R4-10-Editor/R4-10-Editor.jpg) | 2026-09-20 (SPEC §7); tab title 2026-09-21 (#984) |
| Settings › Your business | `/app/settings` | [`R4-11-Business`](design/boards/R4-11-Business/R4-11-Business.dc.html) · [render](design/boards/R4-11-Business/R4-11-Business.jpg) | 2026-09-20; “new” marks 2026-09-21 (#969) |
| Settings, the other six tabs | `/app/settings/{market,publishing,voice,mail,billing,account}` | [`R2-S8-Settings`](design/boards/R2-S8-Settings/R2-S8-Settings.dc.html) · [render](design/boards/R2-S8-Settings/R2-S8-Settings.jpg) | 2026-09-20 (SPEC §4) |
| Phone: setup | `/setup` at 390 | [`R5-P1-Onboarding`](design/boards/R5-P1-Onboarding/R5-P1-Onboarding.dc.html) · [render](design/boards/R5-P1-Onboarding/R5-P1-Onboarding.jpg) | 2026-09-20 |
| Phone: overview | `/app` at 390 | [`R12-7-Phone-overview`](design/boards/R12-7-Phone-overview/R12-7-Phone-overview.dc.html) · [render](design/boards/R12-7-Phone-overview/R12-7-Phone-overview.jpg) | 2026-09-24 (#1059), supersedes `R5-P2-Overview` |
| Phone: plan | `/app/calendar` at 390 | [`R5-P3-Plan`](design/boards/R5-P3-Plan/R5-P3-Plan.dc.html) · [render](design/boards/R5-P3-Plan/R5-P3-Plan.jpg) | 2026-09-20; sheet closed at rest 2026-09-21 (#961) |
| Phone: the page | `/app/draft/{draftId}` at 390 | [`R5-P4-Page`](design/boards/R5-P4-Page/R5-P4-Page.dc.html) · [render](design/boards/R5-P4-Page/R5-P4-Page.jpg) | 2026-09-20 |
| Phone: editor | the editing arm at 390 | [`R5-P5-Editor`](design/boards/R5-P5-Editor/R5-P5-Editor.dc.html) · [render](design/boards/R5-P5-Editor/R5-P5-Editor.jpg) | 2026-09-20 |
| Mail: your page is ready | Resend | [`R5-M1-Ready`](design/boards/R5-M1-Ready/R5-M1-Ready.dc.html) · [render](design/boards/R5-M1-Ready/R5-M1-Ready.jpg) | 2026-09-20 |
| Mail: what moved this week | Resend | [`R5-M2-Weekly`](design/boards/R5-M2-Weekly/R5-M2-Weekly.dc.html) · [render](design/boards/R5-M2-Weekly/R5-M2-Weekly.jpg) | 2026-09-20 |
| Dark: overview | `/app`, dark | [`R5-D1-Overview`](design/boards/R5-D1-Overview/R5-D1-Overview.dc.html) · [render](design/boards/R5-D1-Overview/R5-D1-Overview.jpg) | 2026-09-20 dark pass; contrast 2026-09-21 (#946) |
| Dark: plan | `/app/calendar`, dark | [`R5-D2-Plan`](design/boards/R5-D2-Plan/R5-D2-Plan.dc.html) · [render](design/boards/R5-D2-Plan/R5-D2-Plan.jpg) | 2026-09-20 |
| Dark: search | `/app/search`, dark | [`R5-D3-Search`](design/boards/R5-D3-Search/R5-D3-Search.dc.html) · [render](design/boards/R5-D3-Search/R5-D3-Search.jpg) | 2026-09-20 |
| Dark: landing | `/`, dark | [`R12-10-Dark-landing`](design/boards/R12-10-Dark-landing/R12-10-Dark-landing.dc.html) · [render](design/boards/R12-10-Dark-landing/R12-10-Dark-landing.jpg) | 2026-09-24 (#1059): the banner on the dark accent, dark logos as light silhouettes |
| The mark | everywhere the brand is drawn (`src/app/_brand/Brand.tsx`) | [`R9-L1-Chip`](design/boards/R9-L1-Chip/R9-L1-Chip.dc.html) · [render](design/boards/R9-L1-Chip/R9-L1-Chip.jpg) | 2026-09-21 (#982) |
| The calm layer | every screen | [`R12-0-Calm`](design/boards/R12-0-Calm/R12-0-Calm.dc.html) · [render](design/boards/R12-0-Calm/R12-0-Calm.jpg) | 2026-09-24 (#1059): the rules in *The calm layer* below, drawn and live |
† **Where a board predates a later dated line in `docs/SPEC.md`, the dated line wins and the board is kept as history** — it is not redrawn, and it is not evidence against the screen. `R4-06-AI-answers` is the one row that carries this today: the two cards ruled on 2026-09-22 (#1004) sit *beneath* the grid, and the fourth mark reads *links / names*, the ruling of 2026-09-21 on #953, not the board's *Names a rival*.


**Superseded on 2026-09-24 (#1059), kept as history** — not redrawn, and not evidence against a screen: [`R11-H4-Week`](design/boards/R11-H4-Week/R11-H4-Week.dc.html) ([render](design/boards/R11-H4-Week/R11-H4-Week.jpg)) · [`R6-1-Landing`](design/boards/R6-1-Landing/R6-1-Landing.dc.html) ([render](design/boards/R6-1-Landing/R6-1-Landing.jpg)) · [`R5-W3-Report`](design/boards/R5-W3-Report/R5-W3-Report.dc.html) ([render](design/boards/R5-W3-Report/R5-W3-Report.jpg)) · [`R6-8-Phone-landing`](design/boards/R6-8-Phone-landing/R6-8-Phone-landing.dc.html) ([render](design/boards/R6-8-Phone-landing/R6-8-Phone-landing.jpg)) · [`R4-04-Overview`](design/boards/R4-04-Overview/R4-04-Overview.dc.html) ([render](design/boards/R4-04-Overview/R4-04-Overview.jpg)) · [`R4-08-Plan`](design/boards/R4-08-Plan/R4-08-Plan.dc.html) ([render](design/boards/R4-08-Plan/R4-08-Plan.jpg)) · [`R4-09-Page`](design/boards/R4-09-Page/R4-09-Page.dc.html) ([render](design/boards/R4-09-Page/R4-09-Page.jpg)) · [`R5-P2-Overview`](design/boards/R5-P2-Overview/R5-P2-Overview.dc.html) ([render](design/boards/R5-P2-Overview/R5-P2-Overview.jpg)).

## The calm layer (owner, 2026-09-24, #1059)

Board [`R12-0-Calm`](design/boards/R12-0-Calm/R12-0-Calm.dc.html). Same structure, same theme; these amend the rules above where they meet.

- 2026-09-24  **Type.** `word-spacing: .06em` on `body` (Plus Jakarta Sans ships a 0.17em space) and `.04em` on headings. Plus Jakarta Sans loads 500 and 600 beside 400/700/800, so `font-medium` and `font-semibold` render as themselves. Heading tracking tightens with size: −0.015em at 18px, −0.02em at 20–25px, −0.03em from 31px. **Big figures** — scores and stat numbers — are Plus Jakarta Sans 600 with `tabular-nums`; JetBrains Mono stays for domains, dates, searches and code. This amends the Theme section's "JetBrains Mono for numerals" (#1062).
- 2026-09-24  **One loud button per section.** Rule 1's "one solid primary button per screen" becomes one per section; the public header's *Start free* is outside the count. Secondary actions are `btn-soft` or `btn-ghost`; an ink `btn-outline` is not used; *Stop* is a ghost in `warning`; filters are pills with the current one solid ink. Press is `active:scale-[.98]` (#1063).
- 2026-09-24  **Edges and lift.** `--shadow-card` is a 1px ring plus a 1px shadow in both themes. A clickable card lifts 2px on hover and its arrow nudges 3px; a card that does nothing does not move. The deep floating shadow is spent in two places only: the landing's *Inside ReachKit* preview and the report's price card (#1064).
- 2026-09-24  **Motion.** One easing, `cubic-bezier(.2,.7,.2,1)`. Press 120ms · hover colour 150ms · lift 200ms · tab underline and chevron 250ms · screen enter 600ms (rise 8px, 60ms stagger) · chart draw and figure count-up 1.4s, once, on first view · one loop only, a 2.4s pulse on *Live* and *Your review* dots. Tailwind utilities (`motion-safe:`, `starting:`) and React 19 `<ViewTransition>` for Suspense reveals — the "no animation library" line below stands. Under `prefers-reduced-motion` nothing moves and the final state is drawn; the layout gate renders that way (#1065).
- 2026-09-24  **Theme control on public pages** is a two-state light/dark switch in the header, the first visit following the system; the `/app` shell keeps the 2026-09-14 dropdown. Still one `reachkit` theme (#1066).
- 2026-09-24  **Rhythm.** A 40px content gutter beside the `/app` sidebar. Cards in a row stretch to one height. Empty days, empty lists and zero states are quiet — flat grey cells, a tick and one line — never a white card or a coloured alert per empty thing.
- 2026-09-25  **The `/app` shell is full width** (owner, #1100). From `lg` the sidebar is fixed to the screen's left edge, top to bottom — no inset, no rounded card, the full viewport height. Only the content area on the right scrolls; the sidebar scrolls vertically inside itself only when its own contents are taller than the screen, and never horizontally. The content fills the width beside the sidebar with the 40px gutter; a reading block (a paragraph, a form) keeps its own measure and a grid of cards grows with the screen. The collapsed 72px rail behaves the same; below `lg` the drawer and dock are unchanged.

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
| `react-email` on Resend | The custom mail block system. Landed #934. |
| `@axe-core/playwright` | Hand checks of accessibility, run with the no-overflow check below. |

Already installed and to be used before anything new: daisyUI `drawer` with its `is-drawer-open` / `is-drawer-close` variants (the collapsible side panel, no script), `inngest/realtime` and `inngest/react` (the pass’s current step, in place of polling), React 19 `useActionState` / `useOptimistic`, Next `after()`, Postgres `pg_trgm` and full-text search (the known-content check).

- 2026-09-22 (#934): `react-email` is installed, and it is the whole of it. Since v6 the components ship from the `react-email` package itself and every `@react-email/*` component package — `components`, `tailwind` and each single-element one — is deprecated on npm, so the row above names the only package there is to install. It is a runtime dependency, because the mail seam renders with it — through the package's own `render()`, never `react-dom/server`, which the App Router refuses to build when one of our files imports it; `email dev` (`npm run mail:preview`) is that same package's CLI. The three rules at the top of this file do not reach a mail: an inbox has no daisyUI, no Recharts and no lucide, and `src/lib/mail/shell/tokens.ts` is where the theme's values are carried in for one.

Not admitted: a second component system (shadcn, Radix, Headless UI), a form, state or animation library, `react-markdown` for the preview (the preview is the publishing renderer), a second chart library, Storybook.

## Layout that cannot overflow (owner, 2026-09-20, #908)

- No element is wider than its container and no text is clipped by its card at 390, 768 and 1280 pixels, in light and dark. CI renders every route at those widths and fails on either; `@axe-core/playwright` runs in the same pass.
- Every Recharts series sits in a `ResponsiveContainer`. A bar gets its own full-width line under its label, never the space left beside one.
- A label that can grow (a title, a domain, a search) is clamped to one or two lines with an ellipsis; a number is never clamped, so the box changes instead.
- A step indicator is daisyUI `steps` with one-word labels.

## Admitting new UI

daisyUI class → daisyUI class plus a theme colour → Recharts → lucide → a library on the list above → stop. A PR that adds a custom component or CSS sheet where those already cover it is rejected.
