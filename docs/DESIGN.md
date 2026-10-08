# Design

How a screen is built today. Rulings and their history are in git; this page holds only the rule that is current. Where a dated line in `docs/SPEC.md` says what a screen does, that line wins over anything drawn.

## The stack

1. **daisyUI** — one theme, `reachkit`, in `src/ui/tailwind.css`. A screen is daisyUI classes in its route file: `btn`, `card`, `navbar`, `footer`, `input`, `select`, `badge`, `stat`, `table`, `alert`, `toggle`, `tabs`, `collapse`, `progress`, `steps`, `drawer`, `dock`, `skeleton`, `filter`, `timeline`, `list`, `status`, `tooltip`, `toast`, `modal`, `fieldset`, `validator`, `mockup-browser`, `mockup-phone`.
2. **Recharts 3** — every series (line, bar, sparkline), each in a `ResponsiveContainer`, stroked and filled from the theme's chart colours, labelled directly with no legend box. A grid that is not a series (rivals × questions, the week strip, the AI-answers matrix) is CSS grid.
3. **lucide-react** — stroke 1.75, 20px in chrome, 16px in badges. No emoji.

Spacing and type are Tailwind's scale (`p-4`, `text-sm`). Colour is the `reachkit` theme. The owner reviews UI by clicking `dev.reachkit.app`; there is no pixel baseline.

Admitting new UI: a daisyUI class → a daisyUI class plus a theme colour → Recharts → lucide → a library on the list below → stop. A pull request that adds a custom component, a stylesheet, a token, a type scale or an SVG chart where those already cover it is rejected. Do not wrap daisyUI in a `Btn` or `Card`.

## Theme

One `@plugin "daisyui/theme"` named `reachkit`, `themes: false`, in `src/ui/tailwind.css`. Colours have one set of names, daisyUI's slots — `base-100`, `base-200`, `base-300`, `base-content`, `primary`, `success`, `warning`, `error` and their `-content` — and their values live in `src/ui/theme.css`, light and dark (2026-09-25, #1110). Beside them sit only the colours no slot names: `--bg` (the page ground), `--ink-2` and `--ink-3` (muted text), the tints (`--accent-bg`, `--ok-bg`, …), the chart series (`--chart-you`, `--chart-rival`, `--chart-goal`) and the two shadows. A screen reaches them through daisyUI classes and Tailwind utilities (`bg-base-200`, `text-primary`). Every colour spent on text clears 4.5:1 in both themes against the worst ground it is drawn on. Mail carries the same light values in `src/lib/mail/shell/tokens.ts`, because an inbox has no stylesheet; a test holds the two equal.

- 2026-09-25  **Softer ink, tinted ground** (owner, #1104). In light, ink is a dark slate and the ground and its two neighbours a faint cool tint; muted text is `text-base-content/70`, never `/60`, which falls under the floor. Dark is unchanged.

Type is Plus Jakarta Sans (400, 500, 600, 700, 800) with JetBrains Mono for domains, dates, searches and code. Big figures — scores and stat numbers — are Plus Jakarta Sans 600 with `tabular-nums`.

The theme control is a two-state light/dark switch in the public header, the first visit following the system, and a Light / Dark / System `dropdown` in the `/app` shell (`src/app/_theme/ThemeToggle.tsx`). System sets no `data-theme`; Light and Dark set it on `<html>` before paint. Never on hosted pages.

## The calm layer

The current look of every screen, drawn on board [`Calm`](design/boards/R12-0-Calm/R12-0-Calm.dc.html) ([render](design/boards/R12-0-Calm/R12-0-Calm.jpg)).

- **Type.** `word-spacing: .06em` on `body` and `.04em` on headings. Heading tracking tightens with size: −0.015em at 18px, −0.02em at 20–25px, −0.03em from 31px.
- **Buttons.** One solid primary button per section; the public header's *Start free* is outside the count. Secondary actions are `btn-soft` or `btn-ghost`, never an ink `btn-outline`. *Stop* is a ghost in `warning`. Filters are pills, the current one solid ink. Press is `active:scale-[.98]`.
- **Edges and lift.** `--shadow-card` is a 1px ring plus a 1px shadow in both themes. A clickable card lifts 2px on hover and its arrow nudges 3px; a card that does nothing does not move. The deep floating shadow is spent twice only: the landing's *Inside ReachKit* preview and the report's price card.
- **Motion.** One easing, `cubic-bezier(.2,.7,.2,1)`. Press 120ms · hover colour 150ms · lift 200ms · tab underline and chevron 250ms · screen enter 600ms (rise 8px, 60ms stagger) · chart draw 1.4s, once, on first view; a figure is the number, drawn at once · loops: a 2.4s pulse on the *Live* and *Your review* dots, and the landing's *Recently scanned* strip drifting sideways (linear, 80s for half its track, pausing under the pointer and on focus; CSS only, `animate-drift`). The strip's logos are greyscale until hover and light silhouettes in dark. Tailwind utilities (`motion-safe:`, `starting:`) and React 19 `<ViewTransition>`; no animation library. Under `prefers-reduced-motion` nothing moves and the final state is drawn; the layout gate renders that way. Anything new gets at most a 150ms colour ease.
- **Rhythm.** Cards in a row stretch to one height. Empty days, empty lists and zero states are quiet — flat grey cells, a tick and one line — never a white card or a coloured alert per empty thing.

## The shell

- 2026-09-25  `/app` is a daisyUI `drawer` (owner, #1110). From `lg` the sidebar is fixed to the left edge, full viewport height, and only the content scrolls, with a 40px gutter; the sidebar scrolls inside itself only when its own contents are taller than the screen, never horizontally, and the collapsed 72px rail behaves the same. Cards may grow with the screen, while a paragraph or a form keeps its own measure. Below `lg` the drawer and the `dock` stay as they are. `Surface` (`src/ui/layout/`) is the centred column for marketing and quiet pages; it is not the app shell. Settings is daisyUI `tabs` that wrap, or a `select` below `sm`, so all seven tabs are reachable at 390 and 320. No new stylesheet, wrapper or scroller for any of it.

## Busy and done

- 2026-10-02  **One busy pattern for every action that starts work** (owner, #1196). It covers Measure again now, Check connection, Write it again, Skip, Approve, Stop this page, setup's steps, every Save in Settings, and billing.
  1. **Pressed.** The button is disabled at once and shows daisyUI `loading loading-spinner loading-xs` in place of its icon, so a second press cannot happen. The pending state comes from React: `useActionState`, `useFormStatus` or `useTransition`. A screen does not build its own flag for it.
  2. **Background work.** A deep pass or a re-measure is described in one place only: the side panel's status line. That line shows the current step, the time the step started, and then its end, which is *done*, *failed* with its reason, or *stopped* with its cause. It never shows a step from an earlier pass. A press clears the previous pass's state before the new one is drawn. A page being written shows its own *writing* state on the screen that holds it. The press that started the work answers once; it does not leave a second status line behind.
  3. **Done.** The screen that started the work refreshes itself when the work ends. The button becomes active again. A `sonner` toast or one inline line says what changed.
  4. **Failed or refused.** One line beside the control that was pressed says why: a rate limit, a check that could not run, a vendor outage.
  5. **Nothing silent.** Any action that can take longer than about a second shows this pattern. No work runs without a visible state.

  Built from daisyUI `loading`, `alert` and `btn`, lucide icons, and `sonner`, with no wrapper component. *No loading screens* (SPEC §4) still applies to routes, which use skeletons. The spinner appears only inside a pressed button.

## Closed sentences

- 2026-10-07  **A sentence that explains a number starts closed** (owner, #1324; `docs/SPEC.md` §4 of this date). It is a daisyUI `collapse collapse-arrow` on a `details`, with no client code. On a number tile the `summary` is the tile itself: its name, the figure and what the figure is read against. On a card the `summary` is the card's title. There is no separate control and no word for one. The classes are spelled once, in `_overview/present.ts`. The boards for Search, AI answers and Rivals still draw a lead sentence under the screen's name and a sentence on every tile; the screens draw neither open.

- 2026-10-07  **A long section starts closed too** (owner, #1328; `docs/SPEC.md` §2 of this date). On the report the same daisyUI `collapse collapse-arrow` on a `details` closes a list under its own name inside a result card, and closes *What holds you back* and the first page under theirs. The Report boards still draw every section open and the offer last; the screen draws the offer under the two result cards.

## Layout that cannot overflow

- No element is wider than its container and no text is clipped by its card at 390, 768 and 1280 pixels, in light and dark. CI renders every route at those widths and fails on either; `@axe-core/playwright` runs in the same pass.
- A bar gets its own full-width line under its label, never the space left beside one.
- A label that can grow (a title, a domain, a search) is clamped to one or two lines with an ellipsis; a number is never clamped, so the box changes instead.
- A step indicator is daisyUI `steps` with one-word labels.

## Names

The nav label, the heading in the docs and the screen name are the same word. Issues use the screen name, not a board's round id and not a nickname. Routes are not renamed here; old links keep working.

| What the person sees | Route today | Called in docs and issues |
|---|---|---|
| Plan | `/app/calendar` | Plan — not “calendar”, not `F7` |
| The draft | `/app/draft/{draftId}` | Draft. The editor is the editing state of that draft, not a second screen |
| Overview, Search, AI answers, Rivals, Settings | unchanged | those words |

## Boards

- 2026-09-25  **A board says what a screen holds, not how many pixels it is** (owner, #1110). It lists the sections, their order and their wording. Its render is not a done-when and not a merge gate; a difference of pixels is not a defect. Build it with the classes above; never match its pixels or copy its markup.

Each board is `docs/design/boards/<id>/<id>.dc.html` with its `.jpg` render. The files keep their round ids so links hold; the work is named by the screen. Where a board and a dated line in `docs/SPEC.md` disagree, the SPEC line wins and the board is not redrawn — today that is *AI answers*, whose two cards (#1004) sit beneath the grid and whose fourth mark reads *links / names* (#953). Changing a screen's board is an owner decision and a dated SPEC line.

| Screen | Route | Board |
|---|---|---|
| Landing | `/` | [board](design/boards/R12-1-Landing/R12-1-Landing.dc.html) · [render](design/boards/R12-1-Landing/R12-1-Landing.jpg) |
| Landing, phone | `/` at 390 | [board](design/boards/R12-8-Phone-landing/R12-8-Phone-landing.dc.html) · [render](design/boards/R12-8-Phone-landing/R12-8-Phone-landing.jpg) |
| Landing, dark | `/` | [board](design/boards/R12-10-Dark-landing/R12-10-Dark-landing.dc.html) · [render](design/boards/R12-10-Dark-landing/R12-10-Dark-landing.jpg) |
| Pricing | `/pricing` | [board](design/boards/R6-2-Pricing/R6-2-Pricing.dc.html) · [render](design/boards/R6-2-Pricing/R6-2-Pricing.jpg) |
| Scan in progress | `/scan/{domain}` | [board](design/boards/R5-W2-Scanning/R5-W2-Scanning.dc.html) · [render](design/boards/R5-W2-Scanning/R5-W2-Scanning.jpg) |
| Report | `/scan/{domain}` | [board](design/boards/R12-2-Report/R12-2-Report.dc.html) · [render](design/boards/R12-2-Report/R12-2-Report.jpg) |
| Report, phone | `/scan/{domain}` at 390 | [board](design/boards/R6-9-Phone-report/R6-9-Phone-report.dc.html) · [render](design/boards/R6-9-Phone-report/R6-9-Phone-report.jpg) |
| Gallery | `/scans` | [board](design/boards/R12-3-Gallery/R12-3-Gallery.dc.html) · [render](design/boards/R12-3-Gallery/R12-3-Gallery.jpg) |
| Gallery, phone | `/scans` at 390 | [board](design/boards/R12-9-Phone-gallery/R12-9-Phone-gallery.dc.html) · [render](design/boards/R12-9-Phone-gallery/R12-9-Phone-gallery.jpg) |
| Quiet pages | `/opt-out/{token}`, not found, refused | [board](design/boards/R6-6-Quiet/R6-6-Quiet.dc.html) · [render](design/boards/R6-6-Quiet/R6-6-Quiet.jpg) |
| Legal | `/privacy`, `/terms`, `/imprint` | [board](design/boards/R6-7-Legal/R6-7-Legal.dc.html) · [render](design/boards/R6-7-Legal/R6-7-Legal.jpg) |
| Sign in | `/signin` | [board](design/boards/R7-S1-Signin/R7-S1-Signin.dc.html) · [render](design/boards/R7-S1-Signin/R7-S1-Signin.jpg) |
| Sign in, link sent | `/signin` | [board](design/boards/R7-S2-Sent/R7-S2-Sent.dc.html) · [render](design/boards/R7-S2-Sent/R7-S2-Sent.jpg) |
| Sign in, old link | `/signin` | [board](design/boards/R7-S3-Old-link/R7-S3-Old-link.dc.html) · [render](design/boards/R7-S3-Old-link/R7-S3-Old-link.jpg) |
| Stop this page | `/veto/{token}` | [board](design/boards/R7-S4-Stop/R7-S4-Stop.dc.html) · [render](design/boards/R7-S4-Stop/R7-S4-Stop.jpg) |
| Stop this page, stopped | `/veto/{token}` | [board](design/boards/R7-S5-Stopped/R7-S5-Stopped.dc.html) · [render](design/boards/R7-S5-Stopped/R7-S5-Stopped.jpg) |
| Setup | `/setup` | [board](design/boards/R4-01-Onboarding/R4-01-Onboarding.dc.html) · [render](design/boards/R4-01-Onboarding/R4-01-Onboarding.jpg) |
| Setup, your business | `/setup`, step 2 | [board](design/boards/R3-ON-Business/R3-ON-Business.dc.html) · [render](design/boards/R3-ON-Business/R3-ON-Business.jpg) |
| Setup, phone | `/setup` at 390 | [board](design/boards/R5-P1-Onboarding/R5-P1-Onboarding.dc.html) · [render](design/boards/R5-P1-Onboarding/R5-P1-Onboarding.jpg) |
| Connect your blog | `/setup/connect` | [board](design/boards/R4-02-Connect/R4-02-Connect.dc.html) · [render](design/boards/R4-02-Connect/R4-02-Connect.jpg) |
| Overview, first day | `/app` | [board](design/boards/R4-03-FirstDay/R4-03-FirstDay.dc.html) · [render](design/boards/R4-03-FirstDay/R4-03-FirstDay.jpg) |
| Overview | `/app` | [board](design/boards/R12-4-Overview/R12-4-Overview.dc.html) · [render](design/boards/R12-4-Overview/R12-4-Overview.jpg) |
| Overview, phone | `/app` at 390 | [board](design/boards/R12-7-Phone-overview/R12-7-Phone-overview.dc.html) · [render](design/boards/R12-7-Phone-overview/R12-7-Phone-overview.jpg) |
| Overview, dark | `/app` | [board](design/boards/R5-D1-Overview/R5-D1-Overview.dc.html) · [render](design/boards/R5-D1-Overview/R5-D1-Overview.jpg) |
| Search | `/app/search` | [board](design/boards/R4-05-Search/R4-05-Search.dc.html) · [render](design/boards/R4-05-Search/R4-05-Search.jpg) |
| Search, dark | `/app/search` | [board](design/boards/R5-D3-Search/R5-D3-Search.dc.html) · [render](design/boards/R5-D3-Search/R5-D3-Search.jpg) |
| AI answers | `/app/ai-answers` | [board](design/boards/R4-06-AI-answers/R4-06-AI-answers.dc.html) · [render](design/boards/R4-06-AI-answers/R4-06-AI-answers.jpg) |
| Rivals | `/app/rivals` | [board](design/boards/R4-07-Rivals/R4-07-Rivals.dc.html) · [render](design/boards/R4-07-Rivals/R4-07-Rivals.jpg) |
| Plan | `/app/calendar` | [board](design/boards/R12-5-Plan/R12-5-Plan.dc.html) · [render](design/boards/R12-5-Plan/R12-5-Plan.jpg) |
| Plan, day cards | the day cards on Plan | [board](design/boards/R3-DayCards/R3-DayCards.dc.html) · [render](design/boards/R3-DayCards/R3-DayCards.jpg) |
| Plan, phone | `/app/calendar` at 390 | [board](design/boards/R5-P3-Plan/R5-P3-Plan.dc.html) · [render](design/boards/R5-P3-Plan/R5-P3-Plan.jpg) |
| Plan, dark | `/app/calendar` | [board](design/boards/R5-D2-Plan/R5-D2-Plan.dc.html) · [render](design/boards/R5-D2-Plan/R5-D2-Plan.jpg) |
| Draft | `/app/draft/{draftId}` | [board](design/boards/R12-6-Page/R12-6-Page.dc.html) · [render](design/boards/R12-6-Page/R12-6-Page.jpg) |
| Draft, editing | the same address | [board](design/boards/R4-10-Editor/R4-10-Editor.dc.html) · [render](design/boards/R4-10-Editor/R4-10-Editor.jpg) |
| Draft, phone | `/app/draft/{draftId}` at 390 | [board](design/boards/R5-P4-Page/R5-P4-Page.dc.html) · [render](design/boards/R5-P4-Page/R5-P4-Page.jpg) |
| Draft, editing, phone | the same address at 390 | [board](design/boards/R5-P5-Editor/R5-P5-Editor.dc.html) · [render](design/boards/R5-P5-Editor/R5-P5-Editor.jpg) |
| Settings, Your business | `/app/settings` | [board](design/boards/R4-11-Business/R4-11-Business.dc.html) · [render](design/boards/R4-11-Business/R4-11-Business.jpg) |
| Settings, the other six tabs | `/app/settings/{market,publishing,voice,mail,billing,account}` | [board](design/boards/R2-S8-Settings/R2-S8-Settings.dc.html) · [render](design/boards/R2-S8-Settings/R2-S8-Settings.jpg) |
| Hosted article | `<label>.<customer-domain>/{slug}` | [board](design/boards/R13-H1-Hosted-article/R13-H1-Hosted-article.dc.html) · [render](design/boards/R13-H1-Hosted-article/R13-H1-Hosted-article.jpg) |
| Hosted index | `<label>.<customer-domain>/` | [board](design/boards/R13-H2-Hosted-index/R13-H2-Hosted-index.dc.html) · [render](design/boards/R13-H2-Hosted-index/R13-H2-Hosted-index.jpg) |
| Mail: your page is ready | Resend | [board](design/boards/R5-M1-Ready/R5-M1-Ready.dc.html) · [render](design/boards/R5-M1-Ready/R5-M1-Ready.jpg) |
| Mail: what moved this week | Resend | [board](design/boards/R5-M2-Weekly/R5-M2-Weekly.dc.html) · [render](design/boards/R5-M2-Weekly/R5-M2-Weekly.jpg) |
| The mark | everywhere the brand is drawn (`src/app/_brand/Brand.tsx`) | [board](design/boards/R9-L1-Chip/R9-L1-Chip.dc.html) · [render](design/boards/R9-L1-Chip/R9-L1-Chip.jpg) |

- 2026-10-07  **Overview leads with the action** (owner, #1319; `docs/SPEC.md` §4 of this date). The three Overview boards still draw the review card with the reader's view, and the score card. On the screen the page in review is one compact daisyUI `card`: the head, one line for the page, *Read it* and *Stop this page*. Under it the headline numbers are `card` links in one grid, two columns on a phone and one row from `lg`. There is no `mockup-browser` on Overview.
- 2026-09-26  **Brand files** (#1121). The favicon set is `src/app/icon.svg`, `icon.ico` and `apple-icon.png`; the stable addresses for the manifest, mail, Stripe and BIMI are `public/brand/` (`mark-*.png`, `mark-maskable-512.png`, `logo*.png`, `mark.svg`, `mark-bimi.svg`). All of them are generated from `src/lib/brand/mark.ts` by `node scripts/brand/render.mjs`; never edit one by hand.

Older boards, replaced by the rows above and kept only so their links hold — not a reference for any screen: [R11-H4-Week](design/boards/R11-H4-Week/R11-H4-Week.dc.html) ([render](design/boards/R11-H4-Week/R11-H4-Week.jpg)) · [R6-1-Landing](design/boards/R6-1-Landing/R6-1-Landing.dc.html) ([render](design/boards/R6-1-Landing/R6-1-Landing.jpg)) · [R6-8-Phone-landing](design/boards/R6-8-Phone-landing/R6-8-Phone-landing.dc.html) ([render](design/boards/R6-8-Phone-landing/R6-8-Phone-landing.jpg)) · [R5-W3-Report](design/boards/R5-W3-Report/R5-W3-Report.dc.html) ([render](design/boards/R5-W3-Report/R5-W3-Report.jpg)) · [R4-04-Overview](design/boards/R4-04-Overview/R4-04-Overview.dc.html) ([render](design/boards/R4-04-Overview/R4-04-Overview.jpg)) · [R5-P2-Overview](design/boards/R5-P2-Overview/R5-P2-Overview.dc.html) ([render](design/boards/R5-P2-Overview/R5-P2-Overview.jpg)) · [R4-08-Plan](design/boards/R4-08-Plan/R4-08-Plan.dc.html) ([render](design/boards/R4-08-Plan/R4-08-Plan.jpg)) · [R4-09-Page](design/boards/R4-09-Page/R4-09-Page.dc.html) ([render](design/boards/R4-09-Page/R4-09-Page.jpg)).

## Libraries

A dependency is admitted only where it deletes hand-written UI code. This is the whole list; anything else needs an owner ruling. Each is pinned and checked against React 19 and Next 16.

| Library | It replaces |
|---|---|
| `react-day-picker` 9 with `date-fns` and `@date-fns/tz` | A hand-built month grid; the day card goes in its day slot. |
| `@tanstack/react-table` 8 | Sorting, filtering and paging of the Search and Rivals lists, rendered as a daisyUI `table`. |
| `nuqs` | Hand-rolled URL state: month, day, tab, filters, setup step. |
| CodeMirror 6 — `@uiw/react-codemirror`, `@codemirror/lang-markdown`, `@codemirror/lint` | The editor textarea; rule breaks are lint marks in the text. |
| `mdast-util-from-markdown` with the GFM-table and directive extensions | A hand-written Markdown parser. The closed, escape-everything serialiser stays ours. |
| `@tailwindcss/typography` | Hand-kept article classes (`prose` on hosted pages and the preview). |
| `sonner`, drawn with daisyUI `alert` classes | Silent actions: every action answers. |
| `react-email` on Resend | A custom mail block system. The one package; every `@react-email/*` package is deprecated. It renders through its own `render()`, never `react-dom/server`, which the App Router refuses to build. |
| `@axe-core/playwright` | Hand checks of accessibility, run with the no-overflow check. |

Use what is installed before adding anything: daisyUI `drawer` and its `is-drawer-open` / `is-drawer-close` variants, `inngest/realtime` and `inngest/react`, React 19 `useActionState` / `useOptimistic`, Next `after()`, Postgres `pg_trgm` and full-text search.

Not admitted: a second component system (shadcn, Radix, Headless UI), a form, state or animation library, `react-markdown` (the preview is the publishing renderer), a second chart library, Storybook.

## Do not

- Read or edit `docs/archive/`.
- Add a stylesheet under `src/ui/`. `idiom.css` only shrinks, toward deletion.
- Hand-roll an SVG chart. `chart-primitives.ts` survives only for the OG card's two SVG tokens and goes with that card.
- Write a test that transcribes this file, pins a colour's private name, or forbids Tailwind's scale.
