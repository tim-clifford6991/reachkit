# Design reference

**The UI specification of record is `docs/design/approved/full-set/UI-SPEC.md`,
and the screens it describes are `docs/design/approved/full-set/reachkit-full-screen-set.html`.**
Every UI issue and PR cites it.

Its **parent** is the owner's artifact `docs/design/approved/reachkit-screen-system.html`
(eight screens, approved 2026-09-08): the full set is derived from that
artifact's own code with the twelve rulings of 2026-09-08 applied. The idiom
and the palette are the artifact's; the set adds the screens it did not draw,
the states, and the rulings' consequences.

| you want | read |
|---|---|
| what a screen must do, and the REQ criteria it satisfies | `full-set/UI-SPEC.md` — §1 first (the twelve rulings), then the screen's section |
| what a screen looks like | `full-set/reachkit-full-screen-set.html` — open it; `current="<key>"; render()` |
| a screen at a glance | `full-set/screens/<key>-{light,dark}.png` |
| what a token is | `docs/design/approved/tokens.css` — the source of truth for `src/ui/theme.css` |
| the eight-screen parent artifact | `docs/design/approved/reachkit-screen-system.html` |
| whether a value has a name yet | `docs/design/approved/literals.md` |
| provenance, and what was changed to land any of it | `docs/design/approved/README.md` |

## Every route, and the screen that specifies it

| route | S-id | key |
|---|---|---|
| `/` | S1 | `landing` |
| `/scan/{domain}` | S2 (states S3) | `report` · `rstates` |
| `/pricing` | S4 | `pricing` |
| `/privacy` · `/terms` · `/imprint` | S5 | `legal` |
| `/veto/{token}` | S6 | `veto` |
| `/opt-out/{token}` | S7 | `optout` |
| *any unmatched route* | S8 | `notfound` |
| `/signin` | S9 | `auth` |
| `/setup` | S10 | `setup` |
| `/setup/waiting` | S11 | `waiting` |
| `/app` | S12 (week 0: S13) | `overview` · `overview0` |
| `/app/calendar` | S14 (states S15) | `calendar` · `cstates` |
| `/app/draft/{id}` | S16 (edit: S17) | `draft` · `draftedit` |
| `/app/settings` | S18 | `settings` |
| `blog.{domain}/{slug}` | S19 | `hosted` |
| *the mails (§12, not a route)* | S20 | `mail` |

## What the archive is, and is not

The approved design — the artifact and the full set together — supersedes the
archive's **design drawings** and nothing else:
`archive/sdlc-factory-2026-09-04/corpus/docs/design/`'s idiom routes, walk
routes, WO sheets and `tokens.md` values are no longer what a screen is
built from, and `tokens.md` is **not** the approved token set (issue #364).

Everything else in the archive is still authoritative and is still read
first for specifics — `requirements/REQ-*.md`, `decisions/ADR-*.md`, the
journeys and the work-orders are the detail behind `BUILD.md`, which is why
every UI issue cites its REQ criteria. The archive stays read-only either
way.

> This file was seeded by #364 and given its route map by #367.
> **Issue #358 owns it** and will expand it into the full reference index —
> the build brief's own pointer, the per-screen citations, and the rule that
> a UI PR names the screen it was built against. What is here is the map and
> the pointers; the index #358 describes is still #358's to write.
