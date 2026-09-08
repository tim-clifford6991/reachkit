# Design reference

**The approved design is `docs/design/approved/`.** Every screen in the
product is built against it.

| you want | read |
|---|---|
| what a screen looks like | `docs/design/approved/reachkit-screen-system.html` — open it; eight screens, both themes |
| a screen at a glance | `docs/design/approved/screens/<screen>-{light,dark}.png` |
| what a token is | `docs/design/approved/tokens.css` — the source of truth for `src/ui/theme.css` |
| whether a value has a name yet | `docs/design/approved/literals.md` |
| how it got here, and what was changed to land it | `docs/design/approved/README.md` |

The eight screens are `landing`, `report`, `auth`, `setup`, `overview`,
`calendar`, `draft`, `settings`.

## What is no longer a reference

`archive/sdlc-factory-2026-09-04/corpus/docs/design/` — the idiom routes,
the preview sheets and `tokens.md`. The owner approved the ReachKit Screen
System artifact on 2026-09-08 as the final design, and it supersedes all of
it (issue #364). The archive stays where it is, read-only, as the record of
how the product got here; it is not what a screen is built from, and
`tokens.md` is **not** the approved token set.

> This file was seeded by #364 so that the approved artifact has something
> pointing at it the day it lands. **Issue #358 owns it** and will expand it
> into the full reference index — the build brief's own pointer, the
> per-screen citations, and the rule that a UI PR names the screen it was
> built against. Anything beyond the table above is #358's to write.
