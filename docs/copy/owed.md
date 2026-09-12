# Copy owed — every key the owner has still to write

**Generated. Do not type into this file** — `npm run copy:owed` rewrites it and `tests/presentation/copy/owed-sheet.test.ts` fails when it is out of date. Write the sentences in your reply, or straight into `src/lib/presentation/copy/keys/*.ts`, and run the generator again: a key that gains a sentence leaves this sheet by itself.

**2 keys**, across 793 in the registry — **2 empty** (`copy()` throws on these: a mail with one does not send, a screen with one does not render) and **0 `TODO(copy)`** (these render the marker, in public, until they are written).

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
| S6 | [Veto page](#s6-veto-page-public) | 1 | 1 |
| S7 | Opt-out | none | 0 |
| S8 | Not found | none | 0 |
| S9 | Sign in | none | 0 |
| S10 | Setup | none | 0 |
| S11 | Waiting | none | 0 |
| S12 | Overview | none | 0 |
| S13 | Overview · week 0 | none | 0 |
| S14 | Calendar | none | 0 |
| S15 | Day panel states | none | 0 |
| S16 | [Draft](#s16-draft-app) | 1 | 1 |
| S17 | Draft · edit | none | 0 |
| S18 | Settings | none | 0 |
| S19 | Hosted page | none | 0 |
| S20 | Mails | none | 0 |

## S6 · Veto page — Public

Screen `S6` · the set draws it as `current="veto"` (`docs/archive/2026-09-11/approved/full-set/screens/veto-light.png`).

Every bracketed hint the set draws on this screen: `[page title 15]` · `[rights line — owner’s]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `mail.draftReady.copilot`<br>`mail.ts` | empty | composed in the engine · `lib/publish/publishable/telling.ts` · +1 more<br>also on S20 |  | REQ-057 c1 · §7 | 46 — sibling `mail.draftReady.body` |

## S16 · Draft — App

Screen `S16` · the set draws it as `current="draft"` (`docs/archive/2026-09-11/approved/full-set/screens/draft-light.png`).

Every bracketed hint the set draws on this screen: `[page title 15]` · `[do-nothing explanation — owner’s]` · `[opening paragraph — generated, labelled below]` · `[section heading]` · `[body paragraph]` · `[grounded fact]` · `[body continues]` · `[source title]`

| key | standing | where | the set says | fixed by | max |
|---|---|---|---|---|---|
| `draft.do-nothing.copilot`<br>`draft.ts` | empty | `DO_NOTHING_COPY_KEY` · `app/(account)/app/draft/[draftId]/model.ts` |  | REQ-045 c4 · §7 | 30 — sibling `draft.do-nothing.title` |

