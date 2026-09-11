# Copy owed — every key the owner has still to write

**Generated. Do not type into this file** — `npm run copy:owed` rewrites it and `tests/presentation/copy/owed-sheet.test.ts` fails when it is out of date. Write the sentences in your reply, or straight into `src/lib/presentation/copy/keys/*.ts`, and run the generator again: a key that gains a sentence leaves this sheet by itself.

**0 keys**, across 799 in the registry — **0 empty** (`copy()` throws on these: a mail with one does not send, a screen with one does not render) and **0 `TODO(copy)`** (these render the marker, in public, until they are written).

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
| S10 | Setup | none | 0 |
| S11 | Waiting | none | 0 |
| S12 | Overview | none | 0 |
| S13 | Overview · week 0 | none | 0 |
| S14 | Calendar | none | 0 |
| S15 | Day panel states | none | 0 |
| S16 | Draft | none | 0 |
| S17 | Draft · edit | none | 0 |
| S18 | Settings | none | 0 |
| S19 | Hosted page | none | 0 |
| S20 | Mails | none | 0 |

