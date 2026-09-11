# Copy owed — every key the owner has still to write

**Generated. Do not type into this file** — `npm run copy:owed` rewrites it and `tests/presentation/copy/owed-sheet.test.ts` fails when it is out of date. Write the sentences in your reply, or straight into `src/lib/presentation/copy/keys/*.ts`, and run the generator again: a key that gains a sentence leaves this sheet by itself.

**156 keys**, across 798 in the registry — **5 empty** (`copy()` throws on these: a mail with one does not send, a screen with one does not render) and **151 `TODO(copy)`** (these render the marker, in public, until they are written).

**How to read a row.**

- **key** — the registry key, and the partition file it lives in. Both are where the sentence goes when you have written it.
- **standing** — `empty` throws, `marker` renders `TODO(copy)`. Nothing else distinguishes them; both are owed.
- **where** — the part of the screen, the element, and the file of the component that reads the key. Read off the JSX the key sits in, so it says what the reader will see the sentence attached to. Three rows read differently: *composed in the engine* is a sentence a module builds and a screen renders; *document head* is a `<title>` or a `<meta>` description, spoken to a search result rather than to the page; and `—` is a key nothing reads yet, placed on the screen its neighbours are drawn on. No line numbers: a line moves whenever an unrelated edit shifts a file, and this sheet is about sentences.
- **the set says** — the approved set's bracketed hint for this slot, verbatim, where the hint names this key and no other on the screen. Blank is not a licence to invent: the screen's whole hint list is above its table.
- **fixed by** — the REQ criterion or BUILD § that fixes what the sentence must say.
- **max** — a length the layout implies. `set` is the longest string the approved set draws in that same element anywhere; `sibling` is the longest sentence already written in the same group of keys. Blank where the layout implies nothing.

A key with slots (`{value}`, `{date}`) carries them beside its name; the sentence has to spend every one.

## The walk

| screen | | owed | empty |
|---|---|---:|---:|
| S1 | [Landing](#s1-landing-public) | 35 | 0 |
| S2 | [Free report](#s2-free-report-public) | 47 | 4 |
| S3 | Report states | none | 0 |
| S4 | [Pricing](#s4-pricing-public) | 4 | 0 |
| S5 | [Legal](#s5-legal-public) | 12 | 0 |
| S6 | [Veto page](#s6-veto-page-public) | 7 | 0 |
| S7 | [Opt-out](#s7-opt-out-public) | 2 | 0 |
| S8 | [Not found](#s8-not-found-public) | 5 | 0 |
| S9 | [Sign in](#s9-sign-in-join) | 12 | 0 |
| S10 | Setup | none | 0 |
| S11 | Waiting | none | 0 |
| S12 | Overview | none | 0 |
| S13 | Overview · week 0 | none | 0 |
| S14 | [Calendar](#s14-calendar-app) | 15 | 0 |
| S15 | Day panel states | none | 0 |
| S16 | [Draft](#s16-draft-app) | 6 | 0 |
| S17 | Draft · edit | none | 0 |
| S18 | [Settings](#s18-settings-app) | 11 | 1 |
| S19 | Hosted page | none | 0 |
| S20 | Mails | none | 0 |

## S1 · Landing — Public

UI-SPEC `§S1` · the set draws it as `current="landing"` (`docs/design/approved/full-set/screens/landing-light.png`).

Every bracketed hint the set draws on this screen: `[step 1 body — owner’s]` · `[step 2 body — owner’s]` · `[step 3 body — owner’s]` · `[subline — owner’s]` · `[CTA — owner’s]` · `[demo video — asset not yet produced]` · `[video caption — owner’s]` · `[why-care heading — owner’s]` · `[why-care body — owner’s]` · `[page title]` · `[what-it-does heading — owner’s]` · `[what-it-does body — owner’s]` · `[how-to-start heading — owner’s]` · `[how-to-start body — owner’s]` · `[closing CTA — owner’s]` · `[nav CTA — owner’s]` · `[rights line — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `chrome.cta.scan`<br>`chrome.ts` | marker | `Action` · `app/(public)/_chrome/Header.tsx` |  | issue 266 |  |
| `chrome.footer.rights`<br>`chrome.ts` | marker | `<p class="rk-chrome-fine">` · `app/(public)/_chrome/Footer.tsx` | `[rights line — owner’s]` | issue 266 | 75 — set, `<p class="fine">` |
| `chrome.nav.menu`<br>`chrome.ts` | marker | — · placed with its group |  | issue 266 | 7 — sibling `chrome.nav.pricing` |
| `landing.does.body`<br>`report.ts` | marker | `<p class="rk-sec-s">` · `app/(public)/page.tsx` |  | approved set S1 |  |
| `landing.does.eyebrow`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L14 |  |
| `landing.does.heading`<br>`report.ts` | marker | heading · `<h2 class="rk-sec-h">` · `app/(public)/page.tsx` |  | issue 266 · L15 |  |
| `landing.does.item-1.line`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L17 | 68 — sibling `landing.why.matrix.line` |
| `landing.does.item-1.title`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L16 | 28 — sibling `landing.step.3.title` |
| `landing.does.item-2.line`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L19 | 68 — sibling `landing.why.matrix.line` |
| `landing.does.item-2.title`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L18 | 28 — sibling `landing.step.3.title` |
| `landing.does.item-3.line`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L21 | 68 — sibling `landing.why.matrix.line` |
| `landing.does.item-3.title`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L20 | 28 — sibling `landing.step.3.title` |
| `landing.hero.specimen.caption`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L6 |  |
| `landing.hero.specimen.label`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L5 | 12 — sibling `landing.field.label` |
| `landing.start.body`<br>`report.ts` | marker | `<p class="rk-sec-s">` · `app/(public)/page.tsx` |  | issue 266 · L24 | 20 — sibling `landing.start.cancel` |
| `landing.start.cta`<br>`report.ts` | marker | `<div class="rk-center rk-close">` · `app/(public)/page.tsx` |  | issue 266 · L25 | 20 — sibling `landing.start.cancel` |
| `landing.start.eyebrow`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L22 | 20 — sibling `landing.start.cancel` |
| `landing.start.heading`<br>`report.ts` | marker | heading · `<h2 class="rk-sec-h">` · `app/(public)/page.tsx` |  | issue 266 · L23 | 20 — sibling `landing.start.cancel` |
| `landing.step.1.body`<br>`report.ts` | marker | `STEPS` · `app/(public)/page.tsx` | `[step 1 body — owner’s]` | approved set S1 | 16 — sibling `landing.step.1.title` |
| `landing.step.2.body`<br>`report.ts` | marker | `STEPS` · `app/(public)/page.tsx` | `[step 2 body — owner’s]` | approved set S1 | 27 — sibling `landing.step.2.title` |
| `landing.step.3.body`<br>`report.ts` | marker | `STEPS` · `app/(public)/page.tsx` | `[step 3 body — owner’s]` | approved set S1 | 28 — sibling `landing.step.3.title` |
| `landing.subline`<br>`report.ts` | marker | `<p class="rk-hero-s">` · `app/(public)/page.tsx` | `[subline — owner’s]` | issue 266 · L1 |  |
| `landing.video.blocked`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L9 |  |
| `landing.video.caption`<br>`report.ts` | marker | explain line · `<p class="rk-explain rk-center">` · `app/(public)/page.tsx` | `[video caption — owner’s]` | approved set S1 · 4c | 175 — set, `<p class="explain">` |
| `landing.video.eyebrow`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L7 |  |
| `landing.video.heading`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L8 |  |
| `landing.video.line`<br>`report.ts` | marker | `<span class="rk-video-line">` · `app/(public)/page.tsx` |  | approved set S1 · 4c | 68 — sibling `landing.why.matrix.line` |
| `landing.video.open`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L10 |  |
| `landing.week.page.title`<br>`report.ts` | marker | `WeekCard` · `app/(public)/_landing/WeekCard.tsx` | `[page title]` | approved set S1 | 46 — sibling `landing.week.page.line` |
| `landing.why.body`<br>`report.ts` | marker | `<p class="rk-sec-s">` · `app/(public)/page.tsx` |  | issue 266 · L13 |  |
| `landing.why.eyebrow`<br>`report.ts` | marker | — · placed with its group |  | issue 266 · L11 |  |
| `landing.why.heading`<br>`report.ts` | marker | heading · `<h2 class="rk-sec-h">` · `app/(public)/page.tsx` |  | issue 266 · L12 |  |
| `meta.landing.description`<br>`meta.ts` | marker | `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` · +1 more |  | issue 326 |  |
| `meta.landing.title`<br>`meta.ts` | marker | document head · `/` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `meta.og.alt`<br>`meta.ts` | marker | `alt` · `app/(public)/opengraph-image.tsx` |  | issue 326 |  |

## S2 · Free report — Public

UI-SPEC `§S2` · the set draws it as `current="report"` (`docs/design/approved/full-set/screens/report-light.png`).

Every bracketed hint the set draws on this screen: `[robots lines — verbatim, REQ-009 c2]` · `[DIY instructional body — owner’s]` · `[page 1 title]` · `[rights line — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `ai-answers.absent`<br>`report.ts` | marker | table · `<Table>` · `app/(public)/scan/[domain]/_modules/ai-answers.tsx` |  | REQ-004 c10 |  |
| `ai-answers.customer-citations` `{cited} {answered}`<br>`report.ts` | marker | — · placed with its group |  | REQ-006 c1 |  |
| `ai-answers.engine.ai-mode`<br>`report.ts` | marker | `ENGINE_LABEL` · `app/(public)/scan/[domain]/_modules/ai-answers.tsx` |  | BUILD §6.2 |  |
| `ai-answers.engine.ai-overview`<br>`report.ts` | marker | `ENGINE_LABEL` · `app/(public)/scan/[domain]/_modules/ai-answers.tsx` |  | BUILD §6.2 |  |
| `ai-answers.engine.cell.cited`<br>`report.ts` | marker | badge · `<Badge>` · `app/(public)/scan/[domain]/_modules/ai-answers.tsx` |  | BUILD §6.2 |  |
| `ai-answers.engine.chatgpt`<br>`report.ts` | marker | `ENGINE_LABEL` · `app/(public)/scan/[domain]/_modules/ai-answers.tsx` |  | BUILD §6.2 |  |
| `ai-answers.engine.column.question`<br>`report.ts` | marker | `AnswerColumns` · `app/(public)/scan/[domain]/_modules/ai-answers.tsx` |  | BUILD §6.2 |  |
| `ai-answers.engine.not-measured`<br>`report.ts` | marker | badge · `<Badge>` · `app/(public)/scan/[domain]/_modules/ai-answers.tsx` · +2 more |  | BUILD §6.2 |  |
| `ai-answers.legend`<br>`report.ts` | marker | — · placed with its group |  | REQ-006 c1 |  |
| `ai-answers.matrix.column.cited`<br>`report.ts` | marker | — · placed with its group |  | REQ-006 c1 |  |
| `ai-answers.matrix.column.domain`<br>`report.ts` | marker | — · placed with its group |  | REQ-006 c1 |  |
| `ai-answers.matrix.empty`<br>`report.ts` | marker | — · placed with its group |  | REQ-006 c1 |  |
| `ai-answers.question.no-answer`<br>`report.ts` | marker | badge · `<Badge>` · `app/(public)/scan/[domain]/_modules/ai-answers.tsx` |  | REQ-006 c1 | 7 — sibling `ai-answers.question.not-you` |
| `free-page.absent`<br>`report.ts` | marker | `FreePageAbsent` · `app/(public)/scan/[domain]/_modules/free-page.tsx` |  | REQ-004 c10 |  |
| `free-page.target.value` `{keyword} {volume}`<br>`report.ts` | marker | `<Num>` · `app/(public)/scan/[domain]/_modules/free-page.tsx` |  | REQ-010 c1 |  |
| `meta.report.description` `{domain}`<br>`meta.ts` | marker | document head · `/scan/{domain}` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `meta.report.og.alt`<br>`meta.ts` | marker | `alt` · `app/(public)/scan/[domain]/opengraph-image.tsx` |  | issue 326 |  |
| `meta.report.title` `{domain}`<br>`meta.ts` | marker | document head · `/scan/{domain}` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `method.blocked-readers.body`<br>`report.ts` | marker | `METHOD_COPY` · `app/(public)/scan/[domain]/_problems/method.tsx` |  | REQ-009 c6 |  |
| `method.blocked-readers.title`<br>`report.ts` | marker | `METHOD_COPY` · `app/(public)/scan/[domain]/_problems/method.tsx` |  | REQ-009 c6 | 25 — sibling `method.title` |
| `method.missing-pages.body`<br>`report.ts` | marker | `METHOD_COPY` · `app/(public)/scan/[domain]/_problems/method.tsx` |  | REQ-009 c6 |  |
| `method.missing-pages.title`<br>`report.ts` | marker | `METHOD_COPY` · `app/(public)/scan/[domain]/_problems/method.tsx` |  | REQ-009 c6 | 25 — sibling `method.title` |
| `method.unquotable-pages.body`<br>`report.ts` | marker | `METHOD_COPY` · `app/(public)/scan/[domain]/_problems/method.tsx` |  | REQ-009 c6 |  |
| `method.unquotable-pages.title`<br>`report.ts` | marker | `METHOD_COPY` · `app/(public)/scan/[domain]/_problems/method.tsx` |  | REQ-009 c6 | 25 — sibling `method.title` |
| `notice.refused.stopped`<br>`report.ts` | marker | `REFUSAL_KEY` · `app/(public)/scan/[domain]/_address/refusal.ts` |  | REQ-003 c12 |  |
| `notice.site-unreadable`<br>`report.ts` | marker | component · `<Alert>` · `app/(public)/scan/[domain]/_address/report-view.tsx` |  | REQ-004 c6 |  |
| `offer.cadence.measure.value`<br>`offer.ts` | marker | `TERM_LINES` · `app/(public)/scan/[domain]/_modules/pricing.tsx` |  | REQ-021 c2 |  |
| `offer.cadence.movement.value`<br>`offer.ts` | marker | `TERM_LINES` · `app/(public)/scan/[domain]/_modules/pricing.tsx` |  | REQ-021 c2 |  |
| `offer.cadence.page.value`<br>`offer.ts` | marker | `TERM_LINES` · `app/(public)/scan/[domain]/_modules/pricing.tsx` |  | REQ-021 c2 |  |
| `offer.veto.window.value` `{hours}`<br>`offer.ts` | marker | `TERM_LINES` · `app/(public)/scan/[domain]/_modules/pricing.tsx` |  | REQ-021 c2 |  |
| `presence.absent`<br>`report.ts` | marker | `<div class="min-w-0 overflow-x-auto">` · `app/(public)/scan/[domain]/_modules/google-presence.tsx` |  | REQ-004 c10 |  |
| `presence.absent-from.empty`<br>`report.ts` | marker | table · `<Table>` · `app/(public)/scan/[domain]/_modules/google-presence.tsx` |  | REQ-008 c4 | 37 — sibling `presence.absent-from.title` |
| `presence.legend`<br>`report.ts` | marker | — · placed with its group |  | REQ-008 c2 |  |
| `presence.no-rivals`<br>`report.ts` | marker | `<p>` · `app/(public)/scan/[domain]/_modules/google-presence.tsx` |  | REQ-008 c6 |  |
| `presence.occupancy` `{you} {measured}`<br>`report.ts` | marker | — · placed with its group |  | REQ-008 c1 |  |
| `presence.occupancy.column.count`<br>`report.ts` | marker | — · placed with its group |  | REQ-008 c1 |  |
| `presence.occupancy.column.domain`<br>`report.ts` | marker | — · placed with its group |  | REQ-008 c1 |  |
| `problem.paste.label`<br>`report.ts` | marker | `FixBody` · `app/(public)/scan/[domain]/_problems/cards.tsx` |  | REQ-009 c2 |  |
| `report.wait.minutes` `{minutes}`<br>`report.ts` | marker | `formatWait` · `app/(public)/scan/[domain]/_address/refusal.ts` |  | REQ-003 c6 |  |
| `stage.reading_access_rules`<br>`report.ts` | marker | `STAGE_KEY` · `app/(public)/scan/[domain]/_address/progress.tsx` |  | REQ-003 c1 |  |
| `verdict.factor.answerability`<br>`report.ts` | marker | `FACTOR_NAME_KEY` · `app/(public)/scan/[domain]/_address/report-view.tsx` · +1 more |  | REQ-004 c3 | 110 — sibling `verdict.limiting.answerability` |
| `verdict.factor.foundations`<br>`report.ts` | marker | `FACTOR_NAME_KEY` · `app/(public)/scan/[domain]/_address/report-view.tsx` · +1 more |  | REQ-004 c3 | 104 — sibling `verdict.limiting.foundations` |
| `verdict.factor.presence`<br>`report.ts` | marker | `FACTOR_NAME_KEY` · `app/(public)/scan/[domain]/_address/report-view.tsx` · +1 more |  | REQ-004 c3 | 112 — sibling `verdict.limiting.presence` |
| `verdict.page.not_judgeable`<br>`publish.ts` | empty | composed in the engine · `PAGE_VERDICTS` · `lib/presentation/bands.ts`<br>also on S12, S14, S20 |  | REQ-063 c6 |  |
| `verdict.page.not_working`<br>`publish.ts` | empty | composed in the engine · `PAGE_VERDICTS` · `lib/presentation/bands.ts`<br>also on S12, S14, S20 |  | REQ-063 c1 |  |
| `verdict.page.too_early`<br>`publish.ts` | empty | composed in the engine · `PAGE_VERDICTS` · `lib/presentation/bands.ts`<br>also on S12, S14, S20 |  | REQ-063 c2 |  |
| `verdict.page.working`<br>`publish.ts` | empty | composed in the engine · `PAGE_VERDICTS` · `lib/presentation/bands.ts`<br>also on S12, S14, S20 |  | REQ-063 c1 |  |

## S4 · Pricing — Public

UI-SPEC `§S4` · the set draws it as `current="pricing"` (`docs/design/approved/full-set/screens/pricing-light.png`).

Every bracketed hint the set draws on this screen: `[pricing heading — owner’s]` · `[pricing subline — owner’s]` · `[nav CTA — owner’s]` · `[rights line — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `meta.pricing.description`<br>`meta.ts` | marker | document head · `/pricing` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `meta.pricing.title`<br>`meta.ts` | marker | document head · `/pricing` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `pricing.heading`<br>`chrome.ts` | marker | heading · `<h1>` · `app/(public)/pricing/page.tsx` | `[pricing heading — owner’s]` | REQ-021 c4 | 33 — set, `<h1 class="h1">` |
| `pricing.subline`<br>`chrome.ts` | marker | `<p class="rk-quiet">` · `app/(public)/pricing/page.tsx` | `[pricing subline — owner’s]` | REQ-021 c4 | 135 — set, `<p class="body">` |

## S5 · Legal — Public

UI-SPEC `§S5` · the set draws it as `current="legal"` (`docs/design/approved/full-set/screens/legal-light.png`).

Every bracketed hint the set draws on this screen: `[Privacy — owner’s title]` · `[legal body — owner’s, Markdown. One renderer for Privacy, Terms and Imprint; processors named: Supabase, Vercel, Stripe, Resend, DataForSEO, Anthropic.]` · `[nav CTA — owner’s]` · `[rights line — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `legal.imprint.body`<br>`chrome.ts` | marker | `IMPRINT` · `app/(public)/_legal/documents.ts` |  | issue 266 | 7 — sibling `legal.imprint.title` |
| `legal.imprint.updated`<br>`chrome.ts` | marker | `IMPRINT` · `app/(public)/_legal/documents.ts` |  | UI-SPEC S5 | 7 — sibling `legal.imprint.title` |
| `legal.privacy.body`<br>`chrome.ts` | marker | `PRIVACY` · `app/(public)/_legal/documents.ts` |  | issue 266 | 7 — sibling `legal.privacy.title` |
| `legal.privacy.updated`<br>`chrome.ts` | marker | `PRIVACY` · `app/(public)/_legal/documents.ts` |  | UI-SPEC S5 | 7 — sibling `legal.privacy.title` |
| `legal.terms.body`<br>`chrome.ts` | marker | `TERMS` · `app/(public)/_legal/documents.ts` |  | issue 266 | 5 — sibling `legal.terms.title` |
| `legal.terms.updated`<br>`chrome.ts` | marker | `TERMS` · `app/(public)/_legal/documents.ts` |  | UI-SPEC S5 | 5 — sibling `legal.terms.title` |
| `meta.imprint.description`<br>`meta.ts` | marker | document head · `/imprint` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `meta.imprint.title`<br>`meta.ts` | marker | document head · `/imprint` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `meta.privacy.description`<br>`meta.ts` | marker | document head · `/privacy` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `meta.privacy.title`<br>`meta.ts` | marker | document head · `/privacy` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `meta.terms.description`<br>`meta.ts` | marker | document head · `/terms` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `meta.terms.title`<br>`meta.ts` | marker | document head · `/terms` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |

## S6 · Veto page — Public

UI-SPEC `§S6` · the set draws it as `current="veto"` (`docs/design/approved/full-set/screens/veto-light.png`).

Every bracketed hint the set draws on this screen: `[page title 15]` · `[rights line — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `meta.veto.description`<br>`meta.ts` | marker | document head · `/veto/{token}` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `meta.veto.title`<br>`meta.ts` | marker | document head · `/veto/{token}` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `publish.action.refused.guard` `{state}`<br>`publish.ts` | marker | `draftAction` · `app/api/drafts/[id]/_action.ts` |  | REQ-056 c2 |  |
| `publish.action.refused.notATransition` `{state}`<br>`publish.ts` | marker | `draftAction` · `app/api/drafts/[id]/_action.ts` |  | REQ-056 c2 |  |
| `publish.veto.alreadyUsed`<br>`publish.ts` | marker | `refusalLine` · `app/(public)/veto/[token]/page.tsx` |  | REQ-057 c1 | 58 — sibling `publish.veto.stopped` |
| `publish.veto.expired`<br>`publish.ts` | marker | `refusalLine` · `app/(public)/veto/[token]/page.tsx` |  | REQ-057 c1 | 58 — sibling `publish.veto.stopped` |
| `publish.veto.unknown`<br>`publish.ts` | marker | `refusalLine` · `app/(public)/veto/[token]/page.tsx` |  | REQ-057 c1 | 58 — sibling `publish.veto.stopped` |

## S7 · Opt-out — Public

UI-SPEC `§S7` · the set draws it as `current="optout"` (`docs/design/approved/full-set/screens/optout-light.png`).

Every bracketed hint the set draws on this screen: `[rights line — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `meta.optout.description`<br>`meta.ts` | marker | document head · `/opt-out/{token}` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `meta.optout.title`<br>`meta.ts` | marker | document head · `/opt-out/{token}` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |

## S8 · Not found — Public

UI-SPEC `§S8` · the set draws it as `current="notfound"` (`docs/design/approved/full-set/screens/notfound-light.png`).

Every bracketed hint the set draws on this screen: `[nav CTA — owner’s]` · `[rights line — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `chrome.error.eyebrow`<br>`chrome.ts` | marker | `HEAD` · `app/_fallback/Fallback.tsx` |  | UI-SPEC S8 (12a) | 3 — sibling `chrome.notfound.eyebrow` |
| `chrome.error.heading`<br>`chrome.ts` | marker | `HEAD` · `app/_fallback/Fallback.tsx` · +1 more |  | UI-SPEC S8 (12a) | 33 — sibling `chrome.notfound.heading` |
| `chrome.error.line`<br>`chrome.ts` | marker | `LINE` · `app/(account)/error.tsx` · +2 more |  | UI-SPEC S8 (12a) |  |
| `chrome.loading.line`<br>`chrome.ts` | marker | `LINE` · `app/_fallback/Waiting.tsx` |  | UI-SPEC §4 rule 3 (12a) |  |
| `chrome.notfound.line.app`<br>`chrome.ts` | marker | `LINE` · `app/(account)/not-found.tsx` |  | UI-SPEC S8 (12a) |  |

## S9 · Sign in — Join

UI-SPEC `§S9` · the set draws it as `current="auth"` (`docs/design/approved/full-set/screens/auth-light.png`).

Every bracketed hint the set draws on this screen: `[link-sent head — owner’s]` · `[link-sent body — owner’s]` · `[resend — owner’s]` · `[link-expired head — owner’s]` · `[link-expired body — owner’s]` · `[send a new link — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `meta.signin.description`<br>`meta.ts` | marker | document head · `/signin` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `meta.signin.title`<br>`meta.ts` | marker | document head · `/signin` · `PUBLIC_ROUTE_SEO` · `app/(public)/_seo/routes.ts` |  | issue 326 |  |
| `signin.address.invalid`<br>`signin.ts` | marker | `ANSWER_COPY_KEY` · `app/(public)/signin/page.tsx` |  | REQ-098 c6 |  |
| `signin.expired.head`<br>`signin.ts` | marker | heading · `<h1>` · `app/(public)/signin/page.tsx` |  | REQ-098 c7 |  |
| `signin.expired.submit`<br>`signin.ts` | marker | `<div class="rk-form-col">` · `app/(public)/signin/page.tsx` |  | REQ-098 c7 |  |
| `signin.link_dead`<br>`signin.ts` | marker | `<p class="rk-quiet">` · `app/(public)/signin/page.tsx` · +1 more |  | REQ-098 c7 |  |
| `signin.link_sent`<br>`signin.ts` | marker | `ANSWER_COPY_KEY` · `app/(public)/signin/page.tsx` |  | REQ-098 c3 |  |
| `signin.no_account`<br>`signin.ts` | marker | `ANSWER_COPY_KEY` · `app/(public)/signin/page.tsx` · +2 more |  | REQ-020 c4 |  |
| `signin.panel.specimen`<br>`signin.ts` | marker | — · placed with its group |  | issue 266 · tokens.md §9.4 | 57 — sibling `signin.panel.line` |
| `signin.payment_held`<br>`signin.ts` | marker | `ANSWER_COPY_KEY` · `app/(public)/signin/page.tsx` · +2 more |  | REQ-020 c4 |  |
| `signin.sent.head`<br>`signin.ts` | marker | heading · `<h1>` · `app/(public)/signin/page.tsx` |  | REQ-098 c3 |  |
| `signin.sent.resend`<br>`signin.ts` | marker | `<div class="rk-form-col">` · `app/(public)/signin/page.tsx` | `[resend — owner’s]` | REQ-098 c3 | 19 — set, `<button class="pill pill-quiet">` |

## S14 · Calendar — App

UI-SPEC `§S14` · the set draws it as `current="calendar"` (`docs/design/approved/full-set/screens/calendar-light.png`).

Every bracketed hint the set draws on this screen: `[page title 15]` · `[page title 4]` · `[page title 19]` · `[page title 6]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `publish.wordpress.namedForRemoval`<br>`publish.ts` | marker | — · placed with its group |  | ADR-084 d4 · REQ-056 c16 |  |
| `publish.wordpress.noSeoPlugin`<br>`publish.ts` | marker | composed in the engine · `NO_SEO_PLUGIN_LINE` · `lib/publish/destinations/wordpress/seo.ts` · +1 more<br>also on S16, S18 |  | REQ-060 c4 |  |
| `record.address.wasPublishedAt`<br>`publish.ts` | marker | composed in the engine · `lib/publish/record/index.ts` · +1 more<br>also on S16 |  | REQ-056 c6 |  |
| `record.unpublished.alreadyGone`<br>`publish.ts` | marker | composed in the engine · `UNPUBLISHED_COPY` · `lib/publish/record/lines.ts`<br>also on S16 |  | REQ-056 c15 |  |
| `record.unpublished.namedForRemoval`<br>`publish.ts` | marker | composed in the engine · `UNPUBLISHED_COPY` · `lib/publish/record/lines.ts`<br>also on S16 |  | REQ-056 c16 |  |
| `record.unpublished.removed`<br>`publish.ts` | marker | composed in the engine · `UNPUBLISHED_COPY` · `lib/publish/record/lines.ts`<br>also on S16 |  | REQ-056 c15 |  |
| `record.unpublished.returnedToDraft`<br>`publish.ts` | marker | composed in the engine · `UNPUBLISHED_COPY` · `lib/publish/record/lines.ts`<br>also on S16 |  | REQ-056 c15 |  |
| `record.unpublished.unreachable`<br>`publish.ts` | marker | composed in the engine · `UNPUBLISHED_COPY` · `lib/publish/record/lines.ts`<br>also on S16 |  | REQ-056 c15 |  |
| `record.verification.couldNotConfirm`<br>`publish.ts` | marker | composed in the engine · `VERIFICATION_COPY` · `lib/publish/record/lines.ts`<br>also on S16 |  | REQ-062 c7 |  |
| `record.verification.due`<br>`publish.ts` | marker | composed in the engine · `VERIFICATION_COPY` · `lib/publish/record/lines.ts`<br>also on S16 |  | REQ-062 c7 |  |
| `record.verification.found`<br>`publish.ts` | marker | composed in the engine · `VERIFICATION_COPY` · `lib/publish/record/lines.ts`<br>also on S16 |  | REQ-062 c7 |  |
| `record.verification.never.noLiveAddress`<br>`publish.ts` | marker | composed in the engine · `VERIFICATION_COPY` · `lib/publish/record/lines.ts`<br>also on S16 |  | REQ-062 c7 |  |
| `record.verification.never.takenDownFirst`<br>`publish.ts` | marker | composed in the engine · `VERIFICATION_COPY` · `lib/publish/record/lines.ts`<br>also on S16 |  | REQ-062 c7 |  |
| `record.verification.notYet`<br>`publish.ts` | marker | composed in the engine · `VERIFICATION_COPY` · `lib/publish/record/lines.ts`<br>also on S16 |  | REQ-062 c7 |  |
| `record.verification.pageNotFound`<br>`publish.ts` | marker | composed in the engine · `VERIFICATION_COPY` · `lib/publish/record/lines.ts`<br>also on S16 |  | REQ-062 c7 |  |

## S16 · Draft — App

UI-SPEC `§S16` · the set draws it as `current="draft"` (`docs/design/approved/full-set/screens/draft-light.png`).

Every bracketed hint the set draws on this screen: `[page title 15]` · `[do-nothing explanation — owner’s]` · `[opening paragraph — generated, labelled below]` · `[section heading]` · `[body paragraph]` · `[grounded fact]` · `[body continues]` · `[source title]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `record.address.neverMadeLive`<br>`publish.ts` | marker | `NOT_DELIVERED` · `app/(account)/app/draft/[draftId]/fixture.ts` · +2 more |  | REQ-056 c6 |  |
| `record.address.publiclyReadableAt`<br>`publish.ts` | marker | `DELIVERED` · `app/(account)/app/draft/[draftId]/fixture.ts` · +2 more |  | REQ-056 c6 |  |
| `record.label.address`<br>`publish.ts` | marker | `PageRecordBlock` · `app/(account)/app/draft/[draftId]/PageRecordBlock.tsx` |  | REQ-056 c6 |  |
| `record.label.checked`<br>`publish.ts` | marker | `PageRecordBlock` · `app/(account)/app/draft/[draftId]/PageRecordBlock.tsx` |  | REQ-062 c7 |  |
| `record.label.taken-down`<br>`publish.ts` | marker | `PageRecordBlock` · `app/(account)/app/draft/[draftId]/PageRecordBlock.tsx` |  | REQ-056 c15 |  |
| `record.title`<br>`publish.ts` | marker | `PageRecordBlock` · `app/(account)/app/draft/[draftId]/PageRecordBlock.tsx` |  | REQ-056 c6 |  |

## S18 · Settings — App

UI-SPEC `§S18` · the set draws it as `current="settings"` (`docs/design/approved/full-set/screens/settings-light.png`).

Every bracketed hint the set draws on this screen: `[voice description — the customer writes this; one field, nothing is learned about them]` · `[claim 1]` · `[claim 2]` · `[magic-link note — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `plan.single`<br>`offer.ts` | marker | `PLAN_KEY` · `app/(account)/app/settings/billing.ts` · +2 more |  | REQ-022 c1 |  |
| `price.vat_included`<br>`offer.ts` | empty | composed in the engine · `PRICE_COPY_KEYS` · `lib/account/checkout/copy-keys.ts` |  | REQ-022 c1 |  |
| `publish.destination.line.cannot-publish`<br>`publish.ts` | marker | composed in the engine · `LINE_KEY` · `lib/publish/destinations/view.ts` |  | ADR-086 · REQ-060 c7 |  |
| `publish.destination.line.credentials-expired`<br>`publish.ts` | marker | composed in the engine · `LINE_KEY` · `lib/publish/destinations/view.ts` |  | §9 · REQ-074 c2 |  |
| `publish.destination.line.credentials-invalid`<br>`publish.ts` | marker | composed in the engine · `LINE_KEY` · `lib/publish/destinations/view.ts` |  | §9 · REQ-074 c2 |  |
| `publish.destination.line.destination-rejected`<br>`publish.ts` | marker | composed in the engine · `LINE_KEY` · `lib/publish/destinations/view.ts` |  | §9 · REQ-074 c2 |  |
| `publish.destination.line.dns-elsewhere`<br>`publish.ts` | marker | composed in the engine · `LINE_KEY` · `lib/publish/destinations/view.ts` |  | §9 · REQ-059 c2 |  |
| `publish.destination.line.dns-unset`<br>`publish.ts` | marker | composed in the engine · `LINE_KEY` · `lib/publish/destinations/view.ts` |  | §9 · REQ-059 c2 |  |
| `publish.destination.line.never-connected`<br>`publish.ts` | marker | composed in the engine · `LINE_KEY` · `lib/publish/destinations/view.ts` |  | §9 · REQ-028 c5 |  |
| `publish.destination.line.unreachable`<br>`publish.ts` | marker | composed in the engine · `LINE_KEY` · `lib/publish/destinations/view.ts` |  | §9 · REQ-074 c2 |  |
| `settings.voice.remove-claim` `{claim}`<br>`settings.ts` | marker | `<span class="min-w-0 max-w-full">` · `app/(account)/app/settings/panels/VoicePanel.tsx` |  | REQ-053 | 97 — sibling `settings.voice.filter-note` |

