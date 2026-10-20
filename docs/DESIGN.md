# Design

How a screen is built today. Rulings and their history are in git; this page holds only the rule that is current. Where a dated line in `docs/SPEC.md` says what a screen does, that line wins over anything drawn.

## The stack

1. **daisyUI** — one theme, `reachkit`, in `src/ui/tailwind.css`. A screen is daisyUI classes in its route file: `btn`, `card`, `navbar`, `footer`, `input`, `select`, `badge`, `stat`, `table`, `alert`, `toggle`, `tabs`, `collapse`, `progress`, `steps`, `drawer`, `dock`, `skeleton`, `filter`, `timeline`, `list`, `status`, `tooltip`, `toast`, `modal`, `fieldset`, `validator`, `mockup-browser`, `mockup-phone`.
2. **Recharts 3** — every series (line, bar, sparkline), each in a `ResponsiveContainer`, stroked and filled from the theme's chart colours, labelled directly with no legend box. A grid that is not a series (rivals × questions, the week strip, the AI-answers matrix) is CSS grid.
3. **lucide-react** — stroke 1.75, 20px in chrome, 16px in badges. No emoji.

Spacing and type are Tailwind's scale (`p-4`, `text-sm`). Colour is the `reachkit` theme. There is no pixel baseline. The gates check the strategy in this page. The owner looks at `dev.reachkit.app` for taste.

Admitting new UI: a daisyUI class → a daisyUI class plus a theme colour → Recharts → lucide → a library on the list below → stop. A pull request that adds a custom component, a stylesheet, a token, a type scale or an SVG chart where those already cover it is rejected. Do not wrap daisyUI in a `Btn` or `Card`.

## Theme

One `@plugin "daisyui/theme"` named `reachkit`, `themes: false`, in `src/ui/tailwind.css`. Colours have one set of names, daisyUI's slots — `base-100`, `base-200`, `base-300`, `base-content`, `primary`, `success`, `warning`, `error` and their `-content` — and their values live in `src/ui/theme.css`, light and dark (2026-09-25, #1110). Beside them sit only the colours no slot names: `--bg` (the page ground), `--ink-2` and `--ink-3` (muted text), the tints (`--accent-bg`, `--ok-bg`, …), the chart series (`--chart-you`, `--chart-rival`, `--chart-goal`) and the two shadows. A screen reaches them through daisyUI classes and Tailwind utilities (`bg-base-200`, `text-primary`). Every colour spent on text clears 4.5:1 in both themes against the worst ground it is drawn on. Mail carries the same light values in `src/lib/mail/shell/tokens.ts`, because an inbox has no stylesheet; a test holds the two equal.

- 2026-09-25  **Softer ink, tinted ground** (owner, #1104). In light, ink is a dark slate and the ground and its two neighbours a faint cool tint; muted text is `text-base-content/70`, never `/60`, which falls under the floor. Dark is unchanged.

Type is Plus Jakarta Sans (400, 500, 600, 700, 800) with JetBrains Mono for domains, dates, searches and code. Big figures — scores and stat numbers — are Plus Jakarta Sans 600 with `tabular-nums`.

The theme control is a two-state light/dark switch in the public header, the first visit following the system, and a Light / Dark / System `dropdown` in the `/app` shell (`src/app/_theme/ThemeToggle.tsx`). System sets no `data-theme`; Light and Dark set it on `<html>` before paint. Never on hosted pages.

## The calm layer

The current look of every screen, drawn on board [`Calm`](design/boards/R12-0-Calm/R12-0-Calm.dc.html) ([render](design/boards/R12-0-Calm/R12-0-Calm.jpg)).

- **Type.** `word-spacing: .06em` on `body` and `.04em` on headings. Heading tracking tightens with size: −0.015em at 18px, −0.02em at 20–25px, −0.03em from 31px.
- **Buttons.** One solid primary button per section; the public header's *Free scan* is outside the count (2026-10-19, owner, #1581; the code says *Start free* until #1582 changes it). Secondary actions are `btn-soft` or `btn-ghost`, never an ink `btn-outline`. *Stop* is a ghost in `warning`. Filters are pills, the current one solid ink. Press is `active:scale-[.98]`.
- **Edges and lift.** `--shadow-card` is a 1px ring plus a 1px shadow in both themes. A clickable card lifts 2px on hover and its arrow nudges 3px; a card that does nothing does not move. The deep floating shadow is spent twice only: the landing's hero storyboard card and the report's price card. 2026-10-19: it moves there from the *Inside ReachKit* preview (owner, landing ruling, #1581); the landing keeps it on the preview until the landing is rebuilt in Phase B's public copy.
- **Motion.** One easing, `cubic-bezier(.2,.7,.2,1)`. Press 120ms · hover colour 150ms · lift 200ms · tab underline and chevron 250ms · screen enter 600ms (rise 8px, 60ms stagger) · chart draw 1.4s, once, on first view; a figure is the number, drawn at once · loops: a 2.4s pulse on the *Live* and *Your review* dots. 2026-10-19: there is no *Recently scanned* strip at launch (owner, A5, #1581); the landing still draws it, with its `animate-drift` loop, until the landing is rebuilt in Phase B's public copy, and both go then. Tailwind utilities (`motion-safe:`, `starting:`) and React 19 `<ViewTransition>`; no animation library. Under `prefers-reduced-motion` nothing moves and the final state is drawn; the layout gate renders that way. Anything new gets at most a 150ms colour ease.
- **Rhythm.** Cards in a row stretch to one height. Empty days, empty lists and zero states are quiet — flat grey cells, a tick and one line — never a white card or a coloured alert per empty thing.

## The shell

- 2026-09-25  `/app` is a daisyUI `drawer` (owner, #1110). From `lg` the sidebar is fixed to the left edge, full viewport height, and only the content scrolls, with a 40px gutter; the sidebar scrolls inside itself only when its own contents are taller than the screen, never horizontally, and the collapsed 72px rail behaves the same. Cards may grow with the screen, while a paragraph or a form keeps its own measure. Below `lg` there is no drawer (owner, 2026-10-08, #1339; `docs/SPEC.md` §4 of that date): the `dock` is the navigation, and a daisyUI `navbar` sticks to the top of the viewport with the brand, the domain, the theme control and the publishing line. Settings' and Overview's `tabs` stick directly under it, and a running pass's status line sits under the bar. The `drawer` applies from `lg` only. `Surface` (`src/ui/layout/`) is the centred column for marketing and quiet pages; it is not the app shell. Settings is daisyUI `tabs` that wrap, or a `select` below `sm`, so all seven tabs are reachable at 390 and 320. No new stylesheet, wrapper or scroller for any of it.

## Busy and done

- 2026-10-02  **One busy pattern for every action that starts work** (owner, #1196). It covers Measure again now, Check connection, Write it again, Skip, Stop this page, setup's steps, every Save in Settings, and billing.
  1. **Pressed.** The button is disabled at once and shows daisyUI `loading loading-spinner loading-xs` in place of its icon, so a second press cannot happen. The pending state comes from React: `useActionState`, `useFormStatus` or `useTransition`. A screen does not build its own flag for it.
  2. **Background work.** A deep pass or a re-measure is described in one place only: the side panel's status line. That line shows the current step, the time the step started, and then its end, which is *done*, *failed* with its reason, or *stopped* with its cause. It never shows a step from an earlier pass. A press clears the previous pass's state before the new one is drawn. A page being written shows its own *writing* state on the screen that holds it. The press that started the work answers once; it does not leave a second status line behind.
  3. **Done.** The screen that started the work refreshes itself when the work ends. The button becomes active again. A `sonner` toast or one inline line says what changed.
  4. **Failed or refused.** One line beside the control that was pressed says why: a rate limit, a check that could not run, a vendor outage.
  5. **Nothing silent.** Any action that can take longer than about a second shows this pattern. No work runs without a visible state.

  Built from daisyUI `loading`, `alert` and `btn`, lucide icons, and `sonner`, with no wrapper component. *No loading screens* (SPEC §4) still applies to routes, which use skeletons. The spinner appears only inside a pressed button.

## Closed sentences

- 2026-10-07  **A sentence that explains a number starts closed** (owner, #1324; `docs/SPEC.md` §4 of this date). It is a daisyUI `collapse collapse-arrow` on a `details`, with no client code. On a number tile the `summary` is the tile itself: its name, the figure and what the figure is read against. On a card the `summary` is the card's title. There is no separate control and no word for one. The classes are spelled once, in `_overview/present.ts`. The boards for Search, AI answers and Rivals still draw a lead sentence under the screen's name and a sentence on every tile; the screens draw neither open.
- 2026-10-07  **A note under the page starts closed** (owner, #1325; `docs/SPEC.md` §7 of this date). On the review screen each card under the article is the same `collapse collapse-arrow` on a `details`, with the card's title as its `summary`, and the same classes from `_overview/present.ts`. The board `R12-6-Page` still draws those cards open, and *What this page is for* and *In search results* as two halves of one card; the screen draws each as its own closed line.

- 2026-10-07  **A long section starts closed too** (owner, #1328; `docs/SPEC.md` §2 of this date). On the report the same daisyUI `collapse collapse-arrow` on a `details` closes a list under its own name inside a result card, and closes *What holds you back* and the first page under theirs. The Report boards still draw every section open and the offer last; the screen draws the offer under the two result cards.

## Layout that cannot overflow

- No element is wider than its container and no text is clipped by its card at 390, 768 and 1280 pixels, in light and dark. CI renders every route at those widths and fails on either; `@axe-core/playwright` runs in the same pass.
- A bar gets its own full-width line under its label, never the space left beside one.
- A label that can grow (a title, a domain, a search) is clamped to one or two lines with an ellipsis; a number is never clamped, so the box changes instead.
- 2026-10-15  **A URL wraps** (owner, issue 1456). A page address — a link or a line that shows one — is `font-mono break-all` in a `min-w-0` box: it keeps the mono face and breaks anywhere, never `.num` (which cannot break) and never a sideways scroller. Found on Settings at 390: a long link scrolled the whole page. The reserved account's Settings fixtures carry an address longer than a phone is wide, so the gate measures one.
- A step indicator is daisyUI `steps` with one-word labels.

## Names

The nav label, the heading in the docs and the screen name are the same word. Issues use the screen name, not a board's round id and not a nickname. Routes are not renamed here; old links keep working.

| What the person sees | Route today | Called in docs and issues |
|---|---|---|
| Plan | `/app/calendar` | Plan — not “calendar”, not `F7` |
| The draft | `/app/draft/{draftId}` | Draft. The editor is the editing state of that draft, not a second screen |
| Overview, Settings | unchanged | those words |
| Google | `/app/search` | Google. “Search” was its label until 2026-10-15 (#1444); the route keeps the old word |
| AI | `/app/ai-answers` | AI. “AI answers” until 2026-10-09 (#1363), then “AI Visibility” until 2026-10-15 (#1444); the route keeps the old word |
| Competitors | `/app/rivals` | Competitors. “Rivals” was its label until 2026-10-15 (#1444); the route keeps the old word |

- 2026-10-15  **Section, tab and mail names equal the bar names** (owner, #1444). The free report's verdict draws four bars — Readiness, Content, Google, AI — and its two sections are “Google” and “AI”; the app tabs and the mail sections carry the same words. A title is at most six words, one idea, no em-dash; a number is the figure and its explanation one line under it (`docs/SPEC.md` §0, 2026-10-15).

## Strategy the gate checks

2026-10-15  **Every code change re-checks the strategy** (owner, #1463). `no overflow · axe` renders every `(public)` and `(account)` screen at 390, 768 and 1280, in light and dark. `tests/ui/design/strategy.test.ts` runs in `typecheck · lint · unit` on the same change. A screen is not done because it was looked at.

The test holds two rules from the names above. A copy key ending in `.title`, `.heading` or `.subject` is at most six words, not counting a trailing `· ReachKit`, and it contains no em-dash. Customer-visible text does not use a retired name: `AI Visibility`, `Measure again`, `re-measure`, `top ten`, `top 20`, and the names `docs/SPEC.md` §0 retired on 2026-10-15 — `Discoverability Score`, `findability`, `Foundations`, `Answerability`, `rival(s)`. It reads the copy registry, the text written into JSX, and the sentences of the mail code (#1484). Lint holds two more: app and mail code do not import `copyIn` (#1443), and a link to an `/app` screen is `next/link`, not a plain `<a>` (#1341). The layout gate also opens `/app`, `/app/calendar` and `/setup` at 390 and 1280 with the skeleton on screen and again once the screen arrives, and fails where a region's columns or rows differ; each skeleton is drawn from its screen's `frame.ts`. It sweeps every `/app` screen at 1023 as well, the widest phone shell (#1484). The stack, the one theme, the calm layer, emoji and the heading scale stay on the design tests and the layout gate that already cover them.

The owner looks at `dev.reachkit.app` for taste: voice, and an asset only the owner holds. A rule this page states is a gate.

## Boards

- 2026-09-25  **A board says what a screen holds, not how many pixels it is** (owner, #1110). It lists the sections, their order and their wording. Its render is not a done-when and not a merge gate; a difference of pixels is not a defect. Build it with the classes above; never match its pixels or copy its markup.

- 2026-10-19  **The signed-off canvas replaces the round boards** (owner: *"The UI on design canvas Version 19 is signed off"*, #1581; `docs/spec/decisions/2026-10-19-1581.md`). Each board is a file in `docs/design/boards/canvas/`, copied unchanged from the canvas project, with its `.jpg` render in `renders/` at the width `canvas.json` gives it. `canvas.json` holds each board's title and width, and the files keep their cross-links. The files are published Version 22: Version 19 plus the trust-check wording and the sizing pass of the same day. The canvas is the owner's signed-off copy and is not edited by hand. Where a board and a dated line in `docs/SPEC.md` or a decision file disagree, the SPEC line still wins and the board is not redrawn. Changing a screen's board is an owner decision, written as a file under `docs/spec/decisions/`.
- 2026-10-19  **The AI legend reads *Links to this page · Mentions you, no link · Mentions someone else · No answer*** (owner, #1581), the canvas wording. It replaces *links / names* (#953).

| Screen | Route | Board |
|---|---|---|
| Landing | `/` | [board](design/boards/canvas/PubLanding.dc.html) · [render](design/boards/canvas/renders/PubLanding.jpg) |
| Landing on a phone | `/` at 390 | [board](design/boards/canvas/PubLandingPhone.dc.html) · [render](design/boards/canvas/renders/PubLandingPhone.jpg) |
| How it works | `/how-it-works` | [board](design/boards/canvas/PubHowItWorks.dc.html) · [render](design/boards/canvas/renders/PubHowItWorks.jpg) |
| Pricing | `/pricing` | [board](design/boards/canvas/Pricing.dc.html) · [render](design/boards/canvas/renders/Pricing.jpg) |
| Free scan in progress | `/scan/{domain}` | [board](design/boards/canvas/PubScanning.dc.html) · [render](design/boards/canvas/renders/PubScanning.jpg) |
| Free report and the paid offer | `/scan/{domain}` | [board](design/boards/canvas/PubReport.dc.html) · [render](design/boards/canvas/renders/PubReport.jpg) |
| About | `/about` | [board](design/boards/canvas/PubAbout.dc.html) · [render](design/boards/canvas/renders/PubAbout.jpg) |
| Compare index | `/compare` | [board](design/boards/canvas/PubCompare.dc.html) · [render](design/boards/canvas/renders/PubCompare.jpg) |
| Compare: ReachKit vs ChatGPT | `/compare/{tool}` | [board](design/boards/canvas/PubCompareTool.dc.html) · [render](design/boards/canvas/renders/PubCompareTool.jpg) |
| Teardowns index | `/teardowns` | [board](design/boards/canvas/PubTeardowns.dc.html) · [render](design/boards/canvas/renders/PubTeardowns.jpg) |
| A teardown | `/teardowns/{site}` | [board](design/boards/canvas/PubTeardown.dc.html) · [render](design/boards/canvas/renders/PubTeardown.jpg) |
| An answer page | `/answers/{question}` | [board](design/boards/canvas/PubAnswer.dc.html) · [render](design/boards/canvas/renders/PubAnswer.jpg) |
| Free tools | `/tools` | [board](design/boards/canvas/PubTools.dc.html) · [render](design/boards/canvas/renders/PubTools.jpg) |
| Tool: meta preview | `/tools/meta-preview` | [board](design/boards/canvas/PubToolMeta.dc.html) · [render](design/boards/canvas/renders/PubToolMeta.jpg) |
| Tool: on-page check | `/tools/on-page-check` | [board](design/boards/canvas/PubToolOnPage.dc.html) · [render](design/boards/canvas/renders/PubToolOnPage.jpg) |
| Recent free scans (the gallery) | `/scans` | [board](design/boards/canvas/PubScans.dc.html) · [render](design/boards/canvas/renders/PubScans.jpg) |
| Sign in | `/signin` | [board](design/boards/canvas/AuthSignIn.dc.html) · [render](design/boards/canvas/renders/AuthSignIn.jpg) |
| Check your email | `/signin` | [board](design/boards/canvas/AuthCheckEmail.dc.html) · [render](design/boards/canvas/renders/AuthCheckEmail.jpg) |
| Link expired | `/signin` | [board](design/boards/canvas/AuthExpired.dc.html) · [render](design/boards/canvas/renders/AuthExpired.jpg) |
| Setup 1 of 3: Site, phone | `/setup` | [board](design/boards/canvas/Setup1.dc.html) · [render](design/boards/canvas/renders/Setup1.jpg) |
| Setup 2 of 3: Check, phone | `/setup` | [board](design/boards/canvas/Setup2.dc.html) · [render](design/boards/canvas/renders/Setup2.jpg) |
| Setup 3 of 3: Connect, phone (E11; the board's title still says *Publish*) | `/setup`, `/setup/connect` | [board](design/boards/canvas/Setup.dc.html) · [render](design/boards/canvas/renders/Setup.jpg) |
| Time zone, phone | `/setup/zone` | [board](design/boards/canvas/SetupZone.dc.html) · [render](design/boards/canvas/renders/SetupZone.jpg) |
| Stop a page from the mail, and stopped | `/veto/{token}` | [board](design/boards/canvas/Veto.dc.html) · [render](design/boards/canvas/renders/Veto.jpg) |
| Unsubscribe | `/opt-out/{token}` | [board](design/boards/canvas/OptOut.dc.html) · [render](design/boards/canvas/renders/OptOut.jpg) |
| Legal (drawn as Privacy) | `/privacy`, `/terms`, `/imprint` | [board](design/boards/canvas/Legal.dc.html) · [render](design/boards/canvas/renders/Legal.jpg) |
| Overview | `/app` | [board](design/boards/canvas/Main.dc.html) · [render](design/boards/canvas/renders/Main.jpg) |
| Overview: domain not connected | `/app` | [board](design/boards/canvas/OverviewDNS.dc.html) · [render](design/boards/canvas/renders/OverviewDNS.jpg) |
| Google | `/app/search` | [board](design/boards/canvas/AppGoogle.dc.html) · [render](design/boards/canvas/renders/AppGoogle.jpg) |
| AI | `/app/ai-answers` | [board](design/boards/canvas/AppAI.dc.html) · [render](design/boards/canvas/renders/AppAI.jpg) |
| Competitors | `/app/rivals` | [board](design/boards/canvas/AppCompetitors.dc.html) · [render](design/boards/canvas/renders/AppCompetitors.jpg) |
| Plan: this week's 7 | `/app/calendar` | [board](design/boards/canvas/Plan.dc.html) · [render](design/boards/canvas/renders/Plan.jpg) |
| A live page | `/app/draft/{draftId}` | [board](design/boards/canvas/PageDetail.dc.html) · [render](design/boards/canvas/renders/PageDetail.jpg) |
| Draft: a page in review, and editing | `/app/draft/{draftId}` | [board](design/boards/canvas/AppDraft.dc.html) · [render](design/boards/canvas/renders/AppDraft.jpg) |
| Technical issues | `/app/issues` | [board](design/boards/canvas/AppIssues.dc.html) · [render](design/boards/canvas/renders/AppIssues.jpg) |
| Costs (owner only) | `/app/costs` | [board](design/boards/canvas/AppCosts.dc.html) · [render](design/boards/canvas/renders/AppCosts.jpg) |
| Review (owner only) | not built | [board](design/boards/canvas/Review.dc.html) · [render](design/boards/canvas/renders/Review.jpg) |
| Settings, Your business | `/app/settings` | [board](design/boards/canvas/SettingsIndex.dc.html) · [render](design/boards/canvas/renders/SettingsIndex.jpg) |
| Settings, Market and competitors | `/app/settings/market` | [board](design/boards/canvas/SettingsMarket.dc.html) · [render](design/boards/canvas/renders/SettingsMarket.jpg) |
| Settings, Publishing | `/app/settings/publishing` | [board](design/boards/canvas/SettingsPublishing.dc.html) · [render](design/boards/canvas/renders/SettingsPublishing.jpg) |
| Settings, Your voice | `/app/settings/voice` | [board](design/boards/canvas/SettingsVoice.dc.html) · [render](design/boards/canvas/renders/SettingsVoice.jpg) |
| Settings, Mail | `/app/settings/mail` | [board](design/boards/canvas/SettingsMail.dc.html) · [render](design/boards/canvas/renders/SettingsMail.jpg) |
| Settings, Billing | `/app/settings/billing` | [board](design/boards/canvas/SettingsBilling.dc.html) · [render](design/boards/canvas/renders/SettingsBilling.jpg) |
| Settings, Account | `/app/settings/account` | [board](design/boards/canvas/SettingsAccount.dc.html) · [render](design/boards/canvas/renders/SettingsAccount.jpg) |
| Mail: Monday, phone | Resend | [board](design/boards/canvas/MondayMail.dc.html) · [render](design/boards/canvas/renders/MondayMail.jpg) |
| Hosted index | `<label>.<customer-domain>/` | [board](design/boards/canvas/HostedIndex.dc.html) · [render](design/boards/canvas/renders/HostedIndex.jpg) |
| Hosted article (a guide) | `<label>.<customer-domain>/{slug}` | [board](design/boards/canvas/HostedArticle.dc.html) · [render](design/boards/canvas/renders/HostedArticle.jpg) |
| Hosted service page | `<label>.<customer-domain>/{slug}` | [board](design/boards/canvas/HostedService.dc.html) · [render](design/boards/canvas/renders/HostedService.jpg) |
| Hosted page removed (410) | `<label>.<customer-domain>/{slug}` | [board](design/boards/canvas/HostedGone.dc.html) · [render](design/boards/canvas/renders/HostedGone.jpg) |
| Mail: your page is ready | Resend | [board](design/boards/R5-M1-Ready/R5-M1-Ready.dc.html) · [render](design/boards/R5-M1-Ready/R5-M1-Ready.jpg), a round board: the canvas draws no such mail |
| The mark | everywhere the brand is drawn (`src/app/_brand/Brand.tsx`) | [board](design/boards/R9-L1-Chip/R9-L1-Chip.dc.html) · [render](design/boards/R9-L1-Chip/R9-L1-Chip.jpg), a round board: the canvas draws no mark board |

- 2026-10-07  **Overview leads with the action** (owner, #1319; reversed for Overview on 2026-10-19, below; `docs/SPEC.md` §4 of this date). The three Overview boards still draw the review card with the reader's view, and the score card. On the screen the page in review is one compact daisyUI `card`: the head, one line for the page, *Read or edit* (2026-10-09, #1362; it was *Read it*) and *Stop this page*. The head is the line that says what autopilot is doing; with no page in review it stands alone, with its quiet lines under it. Under it the headline numbers are `card` links in one grid, two columns on a phone and one row from `lg`. There is no `mockup-browser` on Overview.
- 2026-10-09  **Every app screen opens with its numbers** (owner, #1364; reversed for Overview on 2026-10-19, below; `docs/SPEC.md` §4 and §7 of this date). The Overview boards still draw the head above the headline numbers; the screen draws the numbers first and the head under them. The AI Visibility board draws *AI engines on your blog* last; the screen draws it under the two number tiles. The Plan and Draft boards draw no row of numbers; Plan opens with four counts and a page written for a search with two, as daisyUI `card` cells on the Overview tiles' grid.
- 2026-10-19  **Overview leads with today's page, then the ladder** (owner, E4, #1581). This reverses #1319 and #1364 for Overview only: the page going live today comes first, then how far the pages have got, as the canvas board *Overview* draws it. Google, AI, Competitors, Plan and Draft keep their numbers first. The screen keeps #1364's order until Overview is rebuilt in Phase B's app work.
- 2026-09-26  **Brand files** (#1121). The favicon set is `src/app/icon.svg`, `icon.ico` and `apple-icon.png`; the stable addresses for the manifest, mail, Stripe and BIMI are `public/brand/` (`mark-*.png`, `mark-maskable-512.png`, `logo*.png`, `mark.svg`, `mark-bimi.svg`). All of them are generated from `src/lib/brand/mark.ts` by `node scripts/brand/render.mjs`; never edit one by hand.

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

- Add a stylesheet under `src/ui/`. `idiom.css` only shrinks, toward deletion.
- Hand-roll an SVG chart. `chart-primitives.ts` survives only for the OG card's two SVG tokens and goes with that card.
- Write a test that transcribes this file, pins a colour's private name, or forbids Tailwind's scale.
