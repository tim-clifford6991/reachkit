# Copy owed — every key the owner has still to write

**Generated. Do not type into this file** — `npm run copy:owed` rewrites it and `tests/presentation/copy/owed-sheet.test.ts` fails when it is out of date. Write the sentences in your reply, or straight into `src/lib/presentation/copy/keys/*.ts`, and run the generator again: a key that gains a sentence leaves this sheet by itself.

**142 keys**, across 797 in the registry — **22 empty** (`copy()` throws on these: a mail with one does not send, a screen with one does not render) and **120 `TODO(copy)`** (these render the marker, in public, until they are written).

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
| S1 | Landing | none | 0 |
| S2 | [Free report](#s2-free-report-public) | 2 | 0 |
| S3 | Report states | none | 0 |
| S4 | Pricing | none | 0 |
| S5 | Legal | none | 0 |
| S6 | Veto page | none | 0 |
| S7 | Opt-out | none | 0 |
| S8 | Not found | none | 0 |
| S9 | Sign in | none | 0 |
| S10 | [Setup](#s10-setup-join) | 26 | 0 |
| S11 | [Waiting](#s11-waiting-join) | 1 | 0 |
| S12 | [Overview](#s12-overview-app) | 35 | 0 |
| S13 | Overview · week 0 | none | 0 |
| S14 | [Calendar](#s14-calendar-app) | 22 | 11 |
| S15 | Day panel states | none | 0 |
| S16 | [Draft](#s16-draft-app) | 8 | 4 |
| S17 | Draft · edit | none | 0 |
| S18 | [Settings](#s18-settings-app) | 48 | 7 |
| S19 | Hosted page | none | 0 |
| S20 | Mails | none | 0 |

## S2 · Free report — Public

UI-SPEC `§S2` · the set draws it as `current="report"` (`docs/design/approved/full-set/screens/report-light.png`).

Every bracketed hint the set draws on this screen: `[robots lines — verbatim, REQ-009 c2]` · `[DIY instructional body — owner’s]` · `[page 1 title]` · `[rights line — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `generated.page.proposed` `{pageTitle}`<br>`laws.ts` | marker | composed in the engine · `labelFor` · `lib/presentation/generated/text.ts`<br>also on S16, S20 |  | REQ-093 c2 | 32 — sibling `generated.page.written` |
| `notice.site-unreadable`<br>`report.ts` | marker | component · `<Alert>` · `app/(public)/scan/[domain]/_address/report-view.tsx` |  | REQ-004 c6 |  |

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
| `setup.competitors.remove` `{rival}`<br>`setup.ts` | marker | control · `<div class="flex flex-wrap items-center gap-2">` · `app/(account)/setup/SetupForm.tsx` |  | REQ-026 c7 | 123 — sibling `setup.competitors.none-found` |
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
| `record.verification.never.noLiveAddress`<br>`publish.ts` | marker | composed in the engine · `VERIFICATION_COPY` · `lib/publish/record/lines.ts`<br>also on S16 |  | REQ-062 c7 | 27 — sibling `record.verification.never.takenDownFirst` |
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

