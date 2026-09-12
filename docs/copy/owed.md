# Copy owed — every key the owner has still to write

**Generated. Do not type into this file** — `npm run copy:owed` rewrites it and `tests/presentation/copy/owed-sheet.test.ts` fails when it is out of date. Write the sentences in your reply, or straight into `src/lib/presentation/copy/keys/*.ts`, and run the generator again: a key that gains a sentence leaves this sheet by itself.

**15 keys**, across 814 in the registry — **0 empty** (`copy()` throws on these: a mail with one does not send, a screen with one does not render) and **15 `TODO(copy)`** (these render the marker, in public, until they are written).

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
| S2 | Free report | none | 0 |
| S3 | Report states | none | 0 |
| S4 | Pricing | none | 0 |
| S5 | Legal | none | 0 |
| S6 | Veto page | none | 0 |
| S7 | Opt-out | none | 0 |
| S8 | Not found | none | 0 |
| S9 | Sign in | none | 0 |
| S10 | [Setup](#s10-setup-join) | 14 | 0 |
| S11 | Waiting | none | 0 |
| S12 | Overview | none | 0 |
| S13 | Overview · week 0 | none | 0 |
| S14 | Calendar | none | 0 |
| S15 | Day panel states | none | 0 |
| S16 | Draft | none | 0 |
| S17 | Draft · edit | none | 0 |
| S18 | [Settings](#s18-settings-app) | 1 | 0 |
| S19 | Hosted page | none | 0 |
| S20 | Mails | none | 0 |

## S10 · Setup — Join

Screen `S10` · the set draws it as `current="setup"` (`docs/archive/2026-09-11/approved/full-set/screens/setup-light.png`).

Every bracketed hint the set draws on this screen: `[competitor-picker line — owner’s]` · `[setup head — owner’s]` · `[autopilot description — owner’s]` · `[copilot description — owner’s]` · `[hosted-blog description — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `setup.profile.pages-read` `{pages}`<br>`setup.ts` | marker | badge · `<span class="num">` · `app/(account)/setup/SetupForm.tsx` |  | SPEC.md §5 (2026-09-12) |  |
| `setup.profile.purpose.about`<br>`setup.ts` | marker | `<div class="flex flex-wrap items-center gap-2">` · `app/(account)/setup/SetupForm.tsx` |  | SPEC.md §2 (2026-09-12) | 175 — sibling `setup.waiting.about` |
| `setup.profile.purpose.blog`<br>`setup.ts` | marker | `<div class="flex flex-wrap items-center gap-2">` · `app/(account)/setup/SetupForm.tsx` |  | SPEC.md §2 (2026-09-12) |  |
| `setup.profile.purpose.contact`<br>`setup.ts` | marker | `<div class="flex flex-wrap items-center gap-2">` · `app/(account)/setup/SetupForm.tsx` |  | SPEC.md §2 (2026-09-12) |  |
| `setup.profile.purpose.features`<br>`setup.ts` | marker | `<div class="flex flex-wrap items-center gap-2">` · `app/(account)/setup/SetupForm.tsx` |  | SPEC.md §2 (2026-09-12) |  |
| `setup.profile.purpose.legal`<br>`setup.ts` | marker | `<div class="flex flex-wrap items-center gap-2">` · `app/(account)/setup/SetupForm.tsx` |  | SPEC.md §2 (2026-09-12) |  |
| `setup.profile.purpose.other`<br>`setup.ts` | marker | `<div class="flex flex-wrap items-center gap-2">` · `app/(account)/setup/SetupForm.tsx` |  | SPEC.md §2 (2026-09-12) |  |
| `setup.profile.purpose.pricing`<br>`setup.ts` | marker | `<div class="flex flex-wrap items-center gap-2">` · `app/(account)/setup/SetupForm.tsx` |  | SPEC.md §2 (2026-09-12) |  |
| `setup.profile.purpose.product`<br>`setup.ts` | marker | `<div class="flex flex-wrap items-center gap-2">` · `app/(account)/setup/SetupForm.tsx` |  | SPEC.md §2 (2026-09-12) |  |
| `setup.profile.purposes`<br>`setup.ts` | marker | control · `<p class="rk-quiet">` · `app/(account)/setup/SetupForm.tsx` |  | SPEC.md §5 (2026-09-12) |  |
| `setup.profile.site-name`<br>`setup.ts` | marker | — · placed with its group |  | SPEC.md §5 (2026-09-12) |  |
| `setup.profile.title`<br>`setup.ts` | marker | control · `<Btn>` · `app/(account)/setup/SetupForm.tsx` |  | SPEC.md §5 (2026-09-12) | 18 — sibling `setup.site-and-market.title` |
| `setup.profile.voice.label`<br>`setup.ts` | marker | control · `<Btn>` · `app/(account)/setup/SetupForm.tsx` |  | SPEC.md §5 (2026-09-12) | 26 — sibling `setup.market.label` |
| `setup.profile.voice.later`<br>`setup.ts` | marker | control · `<p class="rk-quiet">` · `app/(account)/setup/SetupForm.tsx` |  | SPEC.md §5 (2026-09-12) |  |

## S18 · Settings — App

Screen `S18` · the set draws it as `current="settings"` (`docs/archive/2026-09-11/approved/full-set/screens/settings-light.png`).

Every bracketed hint the set draws on this screen: `[voice description — the customer writes this; one field, nothing is learned about them]` · `[claim 1]` · `[claim 2]` · `[magic-link note — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `settings.voice.save`<br>`settings.ts` | marker | `<span>` · `app/(account)/app/settings/panels/VoicePanel.tsx` |  | SPEC.md §5 (2026-09-12) | 97 — sibling `settings.voice.filter-note` |

