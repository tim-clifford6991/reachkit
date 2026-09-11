# The approved design — ReachKit Screen System

This directory is **the** design reference for every screen in the product.
It is the Claude artifact *ReachKit Screen System*, approved by the owner on
**2026-09-08** and supplied as the final design. It supersedes the archive's
**design drawings** — the idiom routes, the walk routes, the WO sheets and
`tokens.md`'s values under
`archive/sdlc-factory-2026-09-04/corpus/docs/design/` — and nothing else:
the archive's `requirements/REQ-*.md`, `decisions/ADR-*.md`, journeys and
work-orders remain the authoritative detail behind `BUILD.md` and are still
read first for specifics, which is why every UI issue cites its REQ criteria
(issue #364).

| file | what it is |
|---|---|
| `reachkit-screen-system.html` | the artifact itself — one page, eight screens rendered from its own JavaScript |
| `tokens.css` | its three token blocks, verbatim: the source of truth for `src/ui/theme.css` |
| `literals.md` | every length and colour it spends *outside* those blocks, with selector and count — the list the owner rules on |
| `screens/*.png` | each screen at 1280, light and dark |

## Viewing it

Open `reachkit-screen-system.html` in a browser. It needs no server and no
build: the only thing it fetches is the Google Fonts stylesheet for Plus
Jakarta Sans and JetBrains Mono, so the type is wrong offline and nothing
else is.

The page opens on the landing screen. Two ways to reach the others:

- **the nav** across the top — Landing · Free report · Sign in · Setup ·
  Overview · Calendar · Draft · Settings, grouped PUBLIC / JOIN / APP;
- **the console**, which is what the issue's own instructions use:

  ```js
  current = "report"; render()
  ```

  The eight keys are exactly
  `landing`, `report`, `auth`, `setup`, `overview`, `calendar`, `draft`,
  `settings` — note that the nav labels *Free report* and *Sign in* are the
  keys `report` and `auth`.

Two toggles sit at the right of the nav: **Dark / Light**, and **Numerals:
mono / sans**. The numerals toggle is the open question `tokens.md` §9.2
recorded — whether a headline figure is set in the mono face or a heavy
sans — drawn both ways so the owner can rule by looking.

## What was changed to land it

Two edits, and nothing else. The file is otherwise byte-for-byte the
artifact as saved.

1. **The artifact viewer's frame shell was removed** — the inline
   `<!-- frame-runtime -->…<!-- /frame-runtime -->` block. It posts messages
   to a parent window and imports `/_runtime/*`, neither of which exists
   when the file is opened on its own, so leaving it in would have meant a
   reference that does not open. A comment marks where it was.
2. **The fonts link points at Google Fonts** rather than the sibling `css2`
   file the browser saved beside it. The families and weights are the ones
   that file carries: JetBrains Mono 400/500/600 and Plus Jakarta Sans
   400/500/600/700/800.

The screenshots in `screens/` are the owner's own renders, copied
unmodified.

## The full set (approved 2026-09-08)

`full-set/` is the **complete** screen set — twenty screens with their
states — and it is the UI specification of record. Where the owner's
artifact above drew eight screens, this covers every essential surface of
the product, and `full-set/UI-SPEC.md` is its written form: the twelve
rulings of 2026-09-08, the design system, and a section per screen with the
REQ criteria it satisfies.

**How it relates to the artifact above.** The artifact is its parent: the
set is derived from the artifact's own code, with the twelve rulings applied
on top. So the idiom, the palette and the type ladder are the artifact's;
what the set adds is the twelve screens the artifact did not draw, the
states, and the rulings' consequences — the removal of `--r-card` (8a), the
six tokens added under 10a, and the approval of the set's own unbracketed
strings as copy (11a).

**Reading order for a UI issue:** `UI-SPEC.md` §1 (the twelve rulings), then
the screen's own section, then the REQ criteria it cites. The archive's
requirements and decisions are still the detail behind all of it; only the
archive's drawings are superseded.

### Opening a screen

Open `full-set/reachkit-full-screen-set.html` — no server, no build. The nav
across the top carries every screen; or, in the console:

```js
current = "report"; render()
```

| S-id | key | screen | route |
|---|---|---|---|
| S1 | `landing` | Landing | `/` |
| S2 | `report` | Free report | `/scan/{domain}` |
| S3 | `rstates` | Report states | *(states of S2)* |
| S4 | `pricing` | Pricing | `/pricing` |
| S5 | `legal` | Legal | `/privacy` · `/terms` · `/imprint` |
| S6 | `veto` | Veto page | `/veto/{token}` |
| S7 | `optout` | Opt-out | `/opt-out/{token}` |
| S8 | `notfound` | Not found / error | *(any unmatched route)* |
| S9 | `auth` | Sign in | `/signin` |
| S10 | `setup` | Setup | `/setup` |
| S11 | `waiting` | Waiting | `/setup/waiting` |
| S12 | `overview` | Overview | `/app` |
| S13 | `overview0` | Overview, week 0 | *(first-week state of S12)* |
| S14 | `calendar` | Calendar | `/app/calendar` |
| S15 | `cstates` | Day panel states | *(states of S14)* |
| S16 | `draft` | Draft | `/app/draft/{id}` |
| S17 | `draftedit` | Draft edit | *(edit state of S16)* |
| S18 | `settings` | Settings | `/app/settings` |
| S19 | `hosted` | Hosted page | `blog.{domain}/{slug}` |
| S20 | `mail` | Mails | *(§12 — not a route)* |

`screens/` holds the renders: twenty light and four dark, at 1280.

> **One thing the page says that its own contents do not.** The intro
> paragraph reads "Twenty-two screens … approve per screen by its id
> (`S1…S22`)". There is no S21 or S22 — the page carries S1 to S20, and
> `UI-SPEC.md` documents exactly those twenty. The file is landed verbatim,
> so the line stands as the owner approved it; the count to trust is the one
> in the table above. Worth correcting in the next artifact.

## Using it

- A screen's layout, spacing, ranks and states come from here, not from
  taste and not from the archive.
- `tokens.css` is what `src/ui/theme.css` must equal. Where they differ
  today, `theme.css` is wrong.
- `literals.md` is not a defect list. A literal in an approved design is
  approved — it is simply not *named* yet, and until the owner rules on a
  row the product cannot spend that value by name either.
- Do not edit anything in this directory by hand. It is re-lifted when the
  owner approves a new artifact.
