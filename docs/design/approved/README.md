# The approved design — ReachKit Screen System

This directory is **the** design reference for every screen in the product.
It is the Claude artifact *ReachKit Screen System*, approved by the owner on
**2026-09-08** and supplied as the final design; it supersedes the archived
idiom routes and sheets under
`archive/sdlc-factory-2026-09-04/corpus/docs/design/`, which are no longer a
reference for anything (issue #364).

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
