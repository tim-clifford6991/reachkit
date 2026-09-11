# Copy owed — every key the owner has still to write

**Generated. Do not type into this file** — `npm run copy:owed` rewrites it and `tests/presentation/copy/owed-sheet.test.ts` fails when it is out of date. Write the sentences in your reply, or straight into `src/lib/presentation/copy/keys/*.ts`, and run the generator again: a key that gains a sentence leaves this sheet by itself.

**296 keys**, across 798 in the registry — **27 empty** (`copy()` throws on these: a mail with one does not send, a screen with one does not render) and **269 `TODO(copy)`** (these render the marker, in public, until they are written).

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
| S2 | [Free report](#s2-free-report-public) | 48 | 4 |
| S3 | Report states | none | 0 |
| S4 | [Pricing](#s4-pricing-public) | 4 | 0 |
| S5 | [Legal](#s5-legal-public) | 12 | 0 |
| S6 | [Veto page](#s6-veto-page-public) | 7 | 0 |
| S7 | [Opt-out](#s7-opt-out-public) | 2 | 0 |
| S8 | [Not found](#s8-not-found-public) | 5 | 0 |
| S9 | [Sign in](#s9-sign-in-join) | 12 | 0 |
| S10 | [Setup](#s10-setup-join) | 26 | 0 |
| S11 | [Waiting](#s11-waiting-join) | 1 | 0 |
| S12 | [Overview](#s12-overview-app) | 35 | 0 |
| S13 | Overview · week 0 | none | 0 |
| S14 | [Calendar](#s14-calendar-app) | 36 | 11 |
| S15 | Day panel states | none | 0 |
| S16 | [Draft](#s16-draft-app) | 14 | 4 |
| S17 | Draft · edit | none | 0 |
| S18 | [Settings](#s18-settings-app) | 59 | 8 |
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
| `generated.page.proposed` `{pageTitle}`<br>`laws.ts` | marker | composed in the engine · `labelFor` · `lib/presentation/generated/text.ts`<br>also on S16, S20 |  | REQ-093 c2 | 32 — sibling `generated.page.written` |
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
| `problem.paste.label`<br>`report.ts` | marker | `<div class="flex flex-col gap-2">` · `app/(public)/scan/[domain]/_problems/cards.tsx` |  | REQ-009 c2 |  |
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

## S10 · Setup — Join

UI-SPEC `§S10` · the set draws it as `current="setup"` (`docs/design/approved/full-set/screens/setup-light.png`).

Every bracketed hint the set draws on this screen: `[competitor-picker line — owner’s]` · `[setup head — owner’s]` · `[autopilot description — owner’s]` · `[copilot description — owner’s]` · `[hosted-blog description — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `setup.address.measured`<br>`setup.ts` | marker | `<p>` · `app/(account)/setup/SetupForm.tsx` |  | REQ-021 c6 | 85 — sibling `setup.address.assurance` |
| `setup.address.missing`<br>`setup.ts` | marker | `SUBMIT_REFUSAL_COPY` · `app/(account)/setup/SetupForm.tsx` |  | REQ-021 c7 | 85 — sibling `setup.address.assurance` |
| `setup.address.refused.not-a-domain`<br>`setup.ts` | marker | `ADDRESS_REFUSAL_COPY` · `app/(account)/setup/SetupForm.tsx` |  | REQ-021 c9 |  |
| `setup.address.refused.unreachable`<br>`setup.ts` | marker | `ADDRESS_REFUSAL_COPY` · `app/(account)/setup/SetupForm.tsx` · +1 more |  | REQ-021 c10 |  |
| `setup.competitors.awaiting-market`<br>`setup.ts` | marker | control · `<p>` · `app/(account)/setup/SetupForm.tsx` |  | REQ-026 c10 | 123 — sibling `setup.competitors.none-found` |
| `setup.competitors.refused.already-present`<br>`setup.ts` | marker | `RIVAL_REFUSAL_COPY` · `app/(account)/setup/SetupForm.tsx` |  | REQ-026 c8 |  |
| `setup.competitors.refused.does-not-resolve`<br>`setup.ts` | marker | `RIVAL_REFUSAL_COPY` · `app/(account)/setup/SetupForm.tsx` |  | REQ-026 c8 |  |
| `setup.competitors.refused.not-a-domain`<br>`setup.ts` | marker | `RIVAL_REFUSAL_COPY` · `app/(account)/setup/SetupForm.tsx` |  | REQ-026 c8 |  |
| `setup.competitors.refused.own-domain`<br>`setup.ts` | marker | `RIVAL_REFUSAL_COPY` · `app/(account)/setup/SetupForm.tsx` |  | REQ-026 c8 |  |
| `setup.competitors.refused.set-full`<br>`setup.ts` | marker | `RIVAL_REFUSAL_COPY` · `app/(account)/setup/SetupForm.tsx` · +1 more |  | REQ-026 c9 |  |
| `setup.competitors.remove` `{rival}`<br>`setup.ts` | marker | `<form class="min-w-0 max-w-full">` · `app/(account)/app/settings/panels/CompetitorsPanel.tsx` · +1 more<br>also on S18 |  | REQ-026 c7 | 123 — sibling `setup.competitors.none-found` |
| `setup.competitors.seeking`<br>`setup.ts` | marker | control · `<p>` · `app/(account)/setup/SetupForm.tsx` |  | REQ-026 c10 | 123 — sibling `setup.competitors.none-found` |
| `setup.destination.dnsPending`<br>`setup.ts` | marker | composed in the engine · `lib/publish/setup/cards.ts` · +1 more |  | REQ-028 c2 | 42 — sibling `setup.destination.wordpress` |
| `setup.destination.dnsRecord`<br>`setup.ts` | marker | control · `<p>` · `app/(account)/setup/SetupForm.tsx` |  | REQ-028 c2 | 42 — sibling `setup.destination.wordpress` |
| `setup.destination.hosted`<br>`setup.ts` | marker | composed in the engine · `lib/publish/setup/cards.ts` · +1 more |  | REQ-028 c2 | 42 — sibling `setup.destination.wordpress` |
| `setup.head`<br>`setup.ts` | marker | heading · `<h1>` · `app/(account)/setup/page.tsx` | `[setup head — owner’s]` | REQ-025 c1 | 33 — set, `<h1 class="h1">` |
| `setup.market.label`<br>`setup.ts` | marker | control · `<div>` · `app/(account)/setup/SetupForm.tsx` |  | REQ-026 c3 | 34 — sibling `setup.market.awaiting-site` |
| `setup.market.missing`<br>`setup.ts` | marker | `SUBMIT_REFUSAL_COPY` · `app/(account)/setup/SetupForm.tsx` |  | REQ-026 c5 | 34 — sibling `setup.market.awaiting-site` |
| `setup.market.placeholder`<br>`setup.ts` | marker | control · `<div>` · `app/(account)/setup/SetupForm.tsx` |  | REQ-026 c3 | 34 — sibling `setup.market.awaiting-site` |
| `setup.market.state-it`<br>`setup.ts` | marker | control · `<p>` · `app/(account)/setup/SetupForm.tsx` |  | REQ-026 c3 | 34 — sibling `setup.market.awaiting-site` |
| `setup.mode.autopilot`<br>`setup.ts` | marker | composed in the engine · `lib/publish/setup/cards.ts` · +1 more |  | REQ-028 c1 | 7 — sibling `setup.mode.default` |
| `setup.mode.copilot`<br>`setup.ts` | marker | composed in the engine · `lib/publish/setup/cards.ts` · +1 more |  | REQ-028 c1 | 7 — sibling `setup.mode.default` |
| `setup.refused.no-access`<br>`setup.ts` | marker | `SUBMIT_REFUSAL_COPY` · `app/(account)/setup/SetupForm.tsx` |  | REQ-025 c5 |  |
| `setup.release.incomplete`<br>`setup.ts` | marker | `releaseNotice` · `lib/scan/deep/notice.ts` |  | REQ-029 c5 |  |
| `setup.release.unmeasured`<br>`setup.ts` | marker | `releaseNotice` · `lib/scan/deep/notice.ts` |  | REQ-029 c3 |  |
| `setup.waiting.degraded`<br>`setup.ts` | marker | — · placed with its group |  | REQ-029 c3 | 175 — sibling `setup.waiting.about` |

## S11 · Waiting — Join

UI-SPEC `§S11` · the set draws it as `current="waiting"` (`docs/design/approved/full-set/screens/waiting-light.png`).

Every bracketed hint the set draws on this screen: `[waiting head — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `setup.waiting.head`<br>`setup.ts` | marker | heading · `<h1>` · `app/(account)/setup/waiting/page.tsx` | `[waiting head — owner’s]` | REQ-029 c1 | 33 — set, `<h1 class="h1">` |

## S12 · Overview — App

UI-SPEC `§S12` · the set draws it as `current="overview"` (`docs/design/approved/full-set/screens/overview-light.png`).

Every bracketed hint the set draws on this screen: `[veto-pending alert — owner’s]` · `[needs-you alert — owner’s]` · `[cause line — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `cause.unrecognised`<br>`calendar.ts` | marker | composed in the engine · `lineFor` · `lib/presentation/place/account.ts`<br>also on S14 |  | REQ-043 c4 |  |
| `next-publish.none-planned`<br>`laws.ts` | marker | composed in the engine · `OTHERWISE_KEY` · `lib/presentation/stopped/statement.ts`<br>also on S14 |  | REQ-040 c4 |  |
| `next-publish.nothing-approved`<br>`laws.ts` | marker | composed in the engine · `OTHERWISE_KEY` · `lib/presentation/stopped/statement.ts`<br>also on S14 |  | REQ-040 c4 |  |
| `next-publish.paused`<br>`laws.ts` | marker | composed in the engine · `OTHERWISE_KEY` · `lib/presentation/stopped/statement.ts`<br>also on S14 |  | REQ-040 c4 |  |
| `next-publish.stopped`<br>`laws.ts` | marker | composed in the engine · `nextPublishStatement` · `lib/presentation/stopped/statement.ts`<br>also on S14 |  | REQ-092 c7 |  |
| `overview.alert.needs-you` `{title}`<br>`overview.ts` | marker | `ALERT_COPY` · `app/(account)/app/_overview/alerts.ts` |  | REQ-041 c5 |  |
| `overview.alert.needs-you.cause`<br>`overview.ts` | marker | `ALERT_COPY` · `app/(account)/app/_overview/alerts.ts` |  | REQ-041 c5 | 9 — sibling `overview.alert.needs-you.action` |
| `overview.alert.overflow` `{remaining}`<br>`overview.ts` | marker | `OVERFLOW_WHERE_KEY` · `app/(account)/app/_overview/alerts.ts` |  | REQ-041 c5 |  |
| `overview.alert.pending-veto` `{title}`<br>`overview.ts` | marker | `ALERT_COPY` · `app/(account)/app/_overview/alerts.ts` | `[veto-pending alert — owner’s]` | REQ-041 c5 |  |
| `overview.alerts.empty`<br>`overview.ts` | marker | `NeedsYouModule` · `app/(account)/app/_overview/NeedsYouModule.tsx` · +1 more |  | REQ-041 c5 |  |
| `overview.change.category`<br>`overview.ts` | marker | `CHANGE_ACCOUNT_KEY` · `app/(account)/app/_overview/changes.ts` |  | REQ-071 c12 |  |
| `overview.change.domain`<br>`overview.ts` | marker | `CHANGE_ACCOUNT_KEY` · `app/(account)/app/_overview/changes.ts` |  | REQ-071 c12 |  |
| `overview.change.rivals`<br>`overview.ts` | marker | `CHANGE_ACCOUNT_KEY` · `app/(account)/app/_overview/changes.ts` |  | REQ-071 c12 |  |
| `overview.comparison.window` `{since}`<br>`overview.ts` | marker | `<div>` · `app/(account)/app/_overview/RivalModule.tsx` |  | REQ-071 c13 |  |
| `overview.head`<br>`overview.ts` | marker | `OVERVIEW_HEAD` · `app/(account)/app/_overview/head.ts` |  | BUILD §4.5 |  |
| `overview.head.falling`<br>`overview.ts` | marker | `OVERVIEW_HEAD` · `app/(account)/app/_overview/head.ts` |  | BUILD §4.5 | 33 — sibling `overview.head.week-zero` |
| `overview.head.flat`<br>`overview.ts` | marker | `OVERVIEW_HEAD` · `app/(account)/app/_overview/head.ts` |  | BUILD §4.5 | 33 — sibling `overview.head.week-zero` |
| `overview.rivals.far.line` `{rival}`<br>`overview.ts` | marker | `Offer` · `app/(account)/app/_overview/RivalModule.tsx` |  | REQ-096 c6 |  |
| `overview.rivals.far.swap`<br>`overview.ts` | marker | `Offer` · `app/(account)/app/_overview/RivalModule.tsx` |  | REQ-096 c6 |  |
| `overview.rivals.line.absolute`<br>`overview.ts` | marker | `ABSOLUTE_LINE_KEY` · `app/(account)/app/_overview/rivals.ts` |  | REQ-041 c9 | 46 — sibling `overview.rivals.line.shrinking` |
| `overview.supply.exhausted`<br>`overview.ts` | marker | `SUPPLY_PRECEDENCE` · `app/(account)/app/_overview/supply.ts` |  | REQ-095 c3 |  |
| `overview.supply.first-arrival`<br>`overview.ts` | marker | `SUPPLY_PRECEDENCE` · `app/(account)/app/_overview/supply.ts` |  | REQ-095 c6 |  |
| `overview.supply.short`<br>`overview.ts` | marker | `SUPPLY_PRECEDENCE` · `app/(account)/app/_overview/supply.ts` |  | REQ-095 c5 |  |
| `overview.tile.ai-answers.means`<br>`overview.ts` | marker | `GOALS` · `app/(account)/app/_overview/goals.ts` |  | REQ-041 c4 | 35 — sibling `overview.tile.ai-answers.first-pass` |
| `overview.tile.ai-answers.window` `{weeks} {of}`<br>`overview.ts` | marker | `TileRow` · `app/(account)/app/_overview/TileRow.tsx` |  | REQ-041 c12 | 35 — sibling `overview.tile.ai-answers.first-pass` |
| `overview.tile.pages.means`<br>`overview.ts` | marker | `GOALS` · `app/(account)/app/_overview/goals.ts` |  | REQ-041 c4 | 26 — sibling `overview.tile.pages.first-review` |
| `overview.tile.score.means` `{goal}`<br>`overview.ts` | marker | `GOALS` · `app/(account)/app/_overview/goals.ts` |  | BUILD §4.5 | 21 — sibling `overview.tile.score.label` |
| `place.calendar.date.page`<br>`calendar.ts` | marker | composed in the engine · `PLACES` · `lib/presentation/place/places.ts`<br>also on S14 |  | REQ-043 c5 |  |
| `place.overview.weekly-presence.chart`<br>`overview.ts` | marker | `GrowthModule` · `app/(account)/app/_overview/GrowthModule.tsx` · +1 more |  | REQ-041 c3 |  |
| `place.overview.weekly-presence.partial-week`<br>`overview.ts` | marker | composed in the engine · `PLACES` · `lib/presentation/place/places.ts`<br>also on S14 |  | REQ-065 c4 |  |
| `place.overview.weekly-presence.week`<br>`overview.ts` | marker | `GrowthModule` · `app/(account)/app/_overview/GrowthModule.tsx` · +1 more |  | REQ-065 c3 |  |
| `shell.publishing.state.copilot`<br>`laws.ts` | marker | `STATE_COPY_KEY` · `app/(account)/app/_shell/PublishingCard.tsx` |  | REQ-040 c3 | 30 — sibling `shell.publishing.state.week-zero` |
| `stopped.work.no-time-promised`<br>`laws.ts` | marker | composed in the engine · `stoppedWorkStatement` · `lib/presentation/stopped/statement.ts`<br>also on S14 |  | REQ-092 c4 | 95 — sibling `stopped.work.line` |
| `stopped.work.partial-pass`<br>`laws.ts` | marker | composed in the engine · `dayAccount` · `lib/presentation/stopped/statement.ts`<br>also on S14 |  | REQ-092 c6 | 95 — sibling `stopped.work.line` |
| `stopped.work.resumes-on` `{date}`<br>`laws.ts` | marker | composed in the engine · `stoppedWorkStatement` · `lib/presentation/stopped/statement.ts`<br>also on S14 |  | REQ-092 c4 | 95 — sibling `stopped.work.line` |

## S14 · Calendar — App

UI-SPEC `§S14` · the set draws it as `current="calendar"` (`docs/design/approved/full-set/screens/calendar-light.png`).

Every bracketed hint the set draws on this screen: `[page title 15]` · `[page title 4]` · `[page title 19]` · `[page title 6]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `calendar.action.regenerate`<br>`calendar.ts` | marker | `RESTART_COPY_KEY` · `app/(account)/app/calendar/actions.ts` |  | BUILD §9 · REQ-043 c9 | 19 — sibling `calendar.action.reconnect` |
| `calendar.done-when.gate-cleared`<br>`calendar.ts` | empty | `doneWhen` · `app/(account)/app/calendar/store.ts` |  | BUILD §7 |  |
| `calendar.done-when.named-on` `{question}`<br>`calendar.ts` | empty | `doneWhen` · `app/(account)/app/calendar/store.ts` |  | BUILD §7 |  |
| `calendar.done-when.top20` `{query}`<br>`calendar.ts` | empty | `doneWhen` · `app/(account)/app/calendar/store.ts` |  | BUILD §7 |  |
| `calendar.empty.change-holds-pages` `{date} {change}`<br>`calendar.ts` | marker | `EMPTY_COPY_KEY` · `app/(account)/app/calendar/empty.ts` |  | REQ-071 c11 | 131 — sibling `calendar.empty.supply-exhausted` |
| `calendar.empty.customer-change-holds-pages`<br>`calendar.ts` | empty | `EMPTY_COPY_KEY` · `app/(account)/app/calendar/empty.ts` |  | REQ-043 c4 | 131 — sibling `calendar.empty.supply-exhausted` |
| `calendar.empty.instruction`<br>`calendar.ts` | empty | `EMPTY_COPY_KEY` · `app/(account)/app/calendar/empty.ts` |  | REQ-043 c5 | 131 — sibling `calendar.empty.supply-exhausted` |
| `calendar.empty.page-cannot-go-live`<br>`calendar.ts` | empty | `EMPTY_COPY_KEY` · `app/(account)/app/calendar/empty.ts` |  | REQ-043 c4 | 131 — sibling `calendar.empty.supply-exhausted` |
| `calendar.empty.page-held`<br>`calendar.ts` | empty | `EMPTY_COPY_KEY` · `app/(account)/app/calendar/empty.ts` |  | REQ-092 c5 | 131 — sibling `calendar.empty.supply-exhausted` |
| `calendar.status.veto-deadline` `{at}`<br>`calendar.ts` | empty | control · `<Btn>` · `app/(account)/app/calendar/DayPanelView.tsx` |  | BUILD §9 |  |
| `calendar.supply.exhausted` `{since}`<br>`calendar.ts` | empty | `supplyLine` · `app/(account)/app/calendar/supply.ts` |  | BUILD §4.6 |  |
| `calendar.supply.first-arrival` `{days}`<br>`calendar.ts` | empty | `supplyLine` · `app/(account)/app/calendar/supply.ts` |  | BUILD §4.6 |  |
| `calendar.supply.short` `{days}`<br>`calendar.ts` | empty | `supplyLine` · `app/(account)/app/calendar/supply.ts` |  | BUILD §4.6 |  |
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
| `settings.market.change.category`<br>`settings.ts` | marker | `CHANGE_COPY_KEY` · `app/(account)/app/calendar/change-line.ts` |  | REQ-071 c1 | 15 — sibling `settings.market.category` |
| `settings.market.change.domain`<br>`settings.ts` | marker | `CHANGE_COPY_KEY` · `app/(account)/app/calendar/change-line.ts` |  | REQ-071 c1 | 6 — sibling `settings.market.domain` |
| `settings.publishing.pair.autopilotWindow`<br>`settings.ts` | marker | composed in the engine · `readPublishingSettings` · `lib/publish/settings/settings.ts` · +1 more<br>also on S18 |  | REQ-073 c2 | 123 — sibling `settings.publishing.pair.note` |
| `settings.publishing.pair.autopilotZero`<br>`settings.ts` | marker | composed in the engine · `readPublishingSettings` · `lib/publish/settings/settings.ts` · +1 more<br>also on S18 |  | REQ-073 c2 | 123 — sibling `settings.publishing.pair.note` |
| `settings.publishing.pair.copilot`<br>`settings.ts` | marker | composed in the engine · `readPublishingSettings` · `lib/publish/settings/settings.ts` · +1 more<br>also on S18 |  | REQ-073 c2 | 123 — sibling `settings.publishing.pair.note` |
| `waythrough.no-admin-address`<br>`calendar.ts` | marker | `REFUSAL_COPY` · `app/(account)/app/calendar/ways.ts` |  | REQ-043 c12 |  |
| `waythrough.page-not-found`<br>`calendar.ts` | marker | `REFUSAL_COPY` · `app/(account)/app/calendar/ways.ts` |  | REQ-043 c12 |  |
| `waythrough.unpublished-by-us`<br>`calendar.ts` | marker | `REFUSAL_COPY` · `app/(account)/app/calendar/ways.ts` |  | REQ-043 c12 |  |

## S16 · Draft — App

UI-SPEC `§S16` · the set draws it as `current="draft"` (`docs/design/approved/full-set/screens/draft-light.png`).

Every bracketed hint the set draws on this screen: `[page title 15]` · `[do-nothing explanation — owner’s]` · `[opening paragraph — generated, labelled below]` · `[section heading]` · `[body paragraph]` · `[grounded fact]` · `[body continues]` · `[source title]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `draft.authorship.edited` `{at}`<br>`draft.ts` | empty | `DraftScreen` · `app/(account)/app/draft/[draftId]/DraftScreen.tsx` |  | REQ-045 c1 | 25 — sibling `draft.edit.state.edited` |
| `draft.claim.failed`<br>`draft.ts` | marker | `CLAIM_COPY_KEY` · `app/(account)/app/draft/[draftId]/claim.ts` |  | REQ-045 c11 | 19 — sibling `draft.claim.outstanding` |
| `draft.claim.matched` `{entry}`<br>`draft.ts` | empty | `DraftScreen` · `app/(account)/app/draft/[draftId]/DraftScreen.tsx` |  | REQ-045 c11 | 19 — sibling `draft.claim.outstanding` |
| `draft.claim.nothing-to-check`<br>`draft.ts` | marker | `CLAIM_COPY_KEY` · `app/(account)/app/draft/[draftId]/claim.ts` |  | REQ-045 c3 | 19 — sibling `draft.claim.outstanding` |
| `draft.do-nothing.autopilot` `{at}`<br>`draft.ts` | empty | `DO_NOTHING_COPY_KEY` · `app/(account)/app/draft/[draftId]/model.ts` |  | REQ-045 c4 | 30 — sibling `draft.do-nothing.title` |
| `draft.do-nothing.copilot`<br>`draft.ts` | empty | `DO_NOTHING_COPY_KEY` · `app/(account)/app/draft/[draftId]/model.ts` |  | REQ-045 c4 | 30 — sibling `draft.do-nothing.title` |
| `draft.grounded.title`<br>`draft.ts` | marker | eyebrow · `<p class="eyebrow rk-daypanel-eyebrow">` · `app/(account)/app/draft/[draftId]/DraftScreen.tsx` |  | REQ-045 c2 | 30 — sibling `draft.do-nothing.title` |
| `draft.not-found`<br>`draft.ts` | marker | `app/(account)/app/draft/[draftId]/page.tsx` |  | REQ-045 c1 |  |
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
| `danger.all-taken-down`<br>`danger.ts` | marker | `matchesConfirmWord` · `app/(account)/app/settings/danger-state.ts` · +2 more |  | REQ-079 c4 |  |
| `danger.confirm-word.delete-account`<br>`danger.ts` | marker | `CONFIRM_WORD_KEY` · `app/(account)/app/settings/danger-state.ts` |  | REQ-079 c2 | 14 — sibling `danger.delete-account` |
| `danger.confirm-word.unpublish-all`<br>`danger.ts` | marker | `CONFIRM_WORD_KEY` · `app/(account)/app/settings/danger-state.ts` |  | REQ-079 c2 | 13 — sibling `danger.unpublish-all` |
| `danger.delete-account.consequence`<br>`danger.ts` | marker | `DANGER` · `app/(account)/app/settings/panels/DangerZone.tsx` · +1 more |  | REQ-079 c1 |  |
| `danger.export-failed`<br>`danger.ts` | marker | `runDangerAction` · `app/(account)/app/settings/danger-actions.ts` · +2 more |  | REQ-079 c3 |  |
| `danger.export-take`<br>`danger.ts` | marker | eyebrow · `<span class="eyebrow opacity-60">` · `app/(account)/app/settings/panels/DangerZone.tsx` |  | REQ-079 c3 |  |
| `danger.export-taken`<br>`danger.ts` | marker | eyebrow · `<span class="eyebrow opacity-60">` · `app/(account)/app/settings/panels/DangerZone.tsx` |  | REQ-079 c3 |  |
| `danger.nothing-changed`<br>`danger.ts` | marker | field · `<p class="text-xs opacity-60 wrap-anywhere">` · `app/(account)/app/settings/panels/DangerZone.tsx` |  | REQ-079 c3 |  |
| `danger.some-still-live`<br>`danger.ts` | marker | `matchesConfirmWord` · `app/(account)/app/settings/danger-state.ts` · +2 more |  | REQ-079 c4 |  |
| `danger.taken-down-count` `{pages}`<br>`danger.ts` | marker | field · `<p class="text-xs opacity-60 wrap-anywhere">` · `app/(account)/app/settings/panels/DangerZone.tsx` |  | REQ-079 c4 · c5 |  |
| `danger.type-to-confirm` `{word}`<br>`danger.ts` | marker | `runDangerAction` · `app/(account)/app/settings/danger-actions.ts` · +2 more |  | REQ-079 c2 |  |
| `danger.unpublish-all.consequence`<br>`danger.ts` | marker | `DANGER` · `app/(account)/app/settings/panels/DangerZone.tsx` · +1 more |  | REQ-079 c1 |  |
| `export.failed`<br>`settings.ts` | marker | composed in the engine · `lib/account/export/archive.ts` · +1 more |  | REQ-078 c5 |  |
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
| `settings.account.cancel-change`<br>`settings.ts` | marker | field · `<form>` · `app/(account)/app/settings/panels/AccountPanel.tsx` |  | REQ-077 c4 | 12 — sibling `settings.account.change-email` |
| `settings.account.email-change-unavailable`<br>`settings.ts` | empty | `NEW_EMAIL_FIELD` · `app/(account)/app/settings/account-state.ts` · +2 more |  | REQ-077 c2 | 12 — sibling `settings.account.change-email` |
| `settings.account.email-in-use`<br>`settings.ts` | empty | `NEW_EMAIL_FIELD` · `app/(account)/app/settings/account-state.ts` · +2 more |  | REQ-077 c2 | 12 — sibling `settings.account.change-email` |
| `settings.account.email-invalid`<br>`settings.ts` | empty | `NEW_EMAIL_FIELD` · `app/(account)/app/settings/account-state.ts` · +2 more |  | REQ-077 c2 | 12 — sibling `settings.account.change-email` |
| `settings.account.email-pending`<br>`settings.ts` | marker | eyebrow · `<span class="eyebrow opacity-60">` · `app/(account)/app/settings/panels/AccountPanel.tsx` |  | REQ-077 c4 | 12 — sibling `settings.account.change-email` |
| `settings.account.email-pending-expires` `{at}`<br>`settings.ts` | marker | field · `<p class="text-xs opacity-60 wrap-anywhere">` · `app/(account)/app/settings/panels/AccountPanel.tsx` |  | REQ-077 c4 | 12 — sibling `settings.account.change-email` |
| `settings.account.invoices-elsewhere`<br>`settings.ts` | empty | composed in the engine · `ACCOUNT_NOTE_KEYS` · `lib/account/identity/notes.ts` |  | REQ-077 c1 | 12 — sibling `settings.account.change-email` |
| `settings.account.magic-link`<br>`settings.ts` | empty | composed in the engine · `ACCOUNT_NOTE_KEYS` · `lib/account/identity/notes.ts` |  | REQ-077 c1 | 12 — sibling `settings.account.change-email` |
| `settings.account.new-email`<br>`settings.ts` | marker | `<form class="flex min-w-0 flex-col gap-1">` · `app/(account)/app/settings/panels/AccountPanel.tsx` |  | REQ-077 c2 | 12 — sibling `settings.account.change-email` |
| `settings.action.not-yet`<br>`settings.ts` | empty | — · placed with its group |  | BUILD §4.7 |  |
| `settings.billing.reach-a-person`<br>`settings.ts` | marker | `UNREACHABLE_BILLING_KEYS` · `app/(account)/app/settings/billing.ts` · +1 more |  | REQ-097 c6 | 12 — sibling `settings.billing.next-invoice` |
| `settings.billing.try-again`<br>`settings.ts` | marker | `UNREACHABLE_BILLING_KEYS` · `app/(account)/app/settings/billing.ts` · +1 more |  | REQ-097 c6 | 12 — sibling `settings.billing.next-invoice` |
| `settings.billing.unreachable`<br>`settings.ts` | marker | `UNREACHABLE_BILLING_KEYS` · `app/(account)/app/settings/billing.ts` · +1 more |  | REQ-097 c6 | 12 — sibling `settings.billing.next-invoice` |
| `settings.cancel-edit`<br>`settings.ts` | marker | `<div class="flex min-w-0 flex-wrap items-center gap-2">` · `app/(account)/app/settings/panels/MarketPanel.tsx` |  | REQ-071 c1 |  |
| `settings.competitors.add-label`<br>`settings.ts` | marker | `<form class="flex min-w-0 flex-col gap-1">` · `app/(account)/app/settings/panels/CompetitorsPanel.tsx` |  | BUILD §4.7 | 11 — sibling `settings.competitors.title` |
| `settings.competitors.none-yet`<br>`settings.ts` | marker | `EmptyLine` · `app/(account)/app/settings/panels/CompetitorsPanel.tsx` |  | REQ-071 c16 | 11 — sibling `settings.competitors.title` |
| `settings.competitors.refused.already-present`<br>`settings.ts` | marker | `RIVAL_REFUSAL_KEY` · `app/(account)/app/settings/market-state.ts` |  | REQ-071 c4 |  |
| `settings.competitors.refused.does-not-resolve`<br>`settings.ts` | marker | `RIVAL_REFUSAL_KEY` · `app/(account)/app/settings/market-state.ts` |  | REQ-071 c4 |  |
| `settings.competitors.refused.not-a-domain`<br>`settings.ts` | marker | `RIVAL_REFUSAL_KEY` · `app/(account)/app/settings/market-state.ts` |  | REQ-071 c4 |  |
| `settings.competitors.refused.own-domain`<br>`settings.ts` | marker | `RIVAL_REFUSAL_KEY` · `app/(account)/app/settings/market-state.ts` |  | REQ-071 c4 |  |
| `settings.competitors.refused.set-full`<br>`settings.ts` | marker | `RIVAL_REFUSAL_KEY` · `app/(account)/app/settings/market-state.ts` |  | REQ-071 c4 |  |
| `settings.destination.app-password`<br>`settings.ts` | marker | control · `<div class="flex min-w-0 flex-col gap-2">` · `app/(account)/app/settings/panels/ConnectDestination.tsx` |  | REQ-060 | 9 — sibling `settings.destination.wordpress` |
| `settings.destination.app-password.help`<br>`settings.ts` | marker | `ConnectDestination` · `app/(account)/app/settings/panels/ConnectDestination.tsx` |  | REQ-060 |  |
| `settings.destination.site-url`<br>`settings.ts` | marker | control · `<div class="flex min-w-0 flex-col gap-2">` · `app/(account)/app/settings/panels/ConnectDestination.tsx` |  | REQ-060 | 9 — sibling `settings.destination.wordpress` |
| `settings.destination.submit`<br>`settings.ts` | marker | control · `<div class="flex min-w-0 flex-col gap-2">` · `app/(account)/app/settings/panels/ConnectDestination.tsx` |  | REQ-060 | 9 — sibling `settings.destination.wordpress` |
| `settings.destination.username`<br>`settings.ts` | marker | control · `<div class="flex min-w-0 flex-col gap-2">` · `app/(account)/app/settings/panels/ConnectDestination.tsx` |  | REQ-060 | 9 — sibling `settings.destination.wordpress` |
| `settings.head`<br>`settings.ts` | empty | `app/(account)/app/settings/page.tsx` |  | BUILD §4.7 |  |
| `settings.market.effectiveOn` `{date}`<br>`settings.ts` | marker | `MarketPanel` · `app/(account)/app/settings/panels/MarketPanel.tsx` |  | REQ-071 c6 | 70 — sibling `settings.market.effect` |
| `settings.market.pending` `{date} {change}`<br>`settings.ts` | marker | `MarketPanel` · `app/(account)/app/settings/panels/MarketPanel.tsx` |  | REQ-071 c1 | 70 — sibling `settings.market.effect` |
| `settings.market.refused.unreachable`<br>`settings.ts` | marker | `DOMAIN_REFUSAL_KEY` · `app/(account)/app/settings/market-state.ts` |  | REQ-071 c9 |  |
| `settings.publishing.connect`<br>`settings.ts` | marker | `ACTION_COPY_KEY` · `app/(account)/app/settings/panels/ConnectDestination.tsx` |  | BUILD §4.7 · REQ-060 | 54 — sibling `settings.publishing.fix-note` |
| `settings.publishing.reconnect-other-account`<br>`settings.ts` | marker | `ACTION_COPY_KEY` · `app/(account)/app/settings/panels/ConnectDestination.tsx` |  | ADR-086 · REQ-060 c7 | 54 — sibling `settings.publishing.fix-note` |
| `settings.publishing.set-dns`<br>`settings.ts` | marker | `ACTION_COPY_KEY` · `app/(account)/app/settings/panels/PublishingPanel.tsx` |  | BUILD §9 · REQ-059 c2 | 54 — sibling `settings.publishing.fix-note` |
| `settings.save`<br>`settings.ts` | marker | `<div class="flex min-w-0 flex-wrap items-center gap-2">` · `app/(account)/app/settings/panels/MarketPanel.tsx` |  | REQ-071 c1 |  |
| `settings.voice.placeholder`<br>`settings.ts` | marker | `VoicePanel` · `app/(account)/app/settings/panels/VoicePanel.tsx` |  | REQ-055 | 97 — sibling `settings.voice.filter-note` |
| `settings.voice.remove-claim` `{claim}`<br>`settings.ts` | marker | `<span class="min-w-0 max-w-full">` · `app/(account)/app/settings/panels/VoicePanel.tsx` |  | REQ-053 | 97 — sibling `settings.voice.filter-note` |

