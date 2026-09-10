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

## The index — every route, its screen, and what holds it

One row per surface the product serves. **A UI issue names the `S<id>` from
this table**, reads that section of `UI-SPEC.md` first, and cites the REQ
criteria in the column beside it; the archive's `requirements/REQ-*.md` is
where those criteria are written out.

The table is not maintained by hand alone. `tests/ui/design/reference.test.ts`
walks the route tree, reads the `REFERENCE: S<id>` line each route carries in
`tests/ui/layout/routes.ts`, and fails if a route is missing from this table,
carries a different S-id here than there, or names a section `UI-SPEC.md` does
not have (issue #358).

### Screens — the sixteen routes the layout suite renders

| route | S-id | UI-SPEC | REQ criteria | tests that cover it |
|---|---|---|---|---|
| `/` | S1 | §S1 | REQ-099, REQ-001 | `tests/app/scan-address/landing.test.tsx` · `tests/app/chrome/header.test.tsx` |
| `/scan/{domain}` | S2 · states S3 | §S2, §S3 | REQ-004…010, 013, 090, 094 · states REQ-003, REQ-004 c3/c6/c9, REQ-015, REQ-002 | `tests/app/scan-address/report-view.test.tsx` · `report-copy.test.tsx` · `report-tables.test.ts` · `problems.test.ts` · `ai-answers.test.tsx` · `removal.test.tsx` · `tests/ui/layout/report-values.test.ts` |
| `/pricing` | S4 | §S4 | REQ-021 c4, REQ-022 | `tests/app/pricing/pricing.test.tsx` |
| `/privacy` · `/terms` · `/imprint` | S5 | §S5 | *(new in the set)* | `tests/app/middleware.test.ts` (public, no session) · the copy sweeps · the layout sweep |
| `/veto/{token}` | S6 | §S6 | REQ-057, REQ-075 | `tests/app/veto/page.test.tsx` |
| `/opt-out/{token}` | S7 | §S7 | REQ-010 c11 | `tests/app/opt-out/page.test.tsx` |
| `/signin` | S9 | §S9 | REQ-098 | `tests/app/signin/signin.test.tsx` |
| `/setup` | S10 | §S10 | REQ-025…028, REQ-021 c7 | `tests/app/setup/screen.test.tsx` · `page.test.tsx` · `submit.test.ts` · `gate.test.ts` |
| `/setup/waiting` | S11 | §S11 | REQ-029 | `tests/app/setup/waiting.test.tsx` |
| `/app` | S12 · week 0 S13 | §S12, §S13 | REQ-040, 041, 042, 092 · week 0 REQ-040 c7, REQ-021 c11 | `tests/app/overview/*` (13 files) · `tests/ui/layout/values.test.ts` |
| `/app/calendar` | S14 · panel states S15 | §S14, §S15 | REQ-043 · panel REQ-043 c8–c12, REQ-044 | `tests/app/calendar/*` (16 files) · `tests/ui/calendar-css.test.ts` |
| `/app/draft/{draftId}` | S16 · edit S17 | §S16, §S17 | REQ-045, REQ-093 · edit REQ-045 c5–c11 | `tests/app/draft/*` · `tests/ui/draft-columns.test.ts` |
| `/app/settings` | S18 | §S18 | REQ-070…079 | `tests/app/settings/*` · `tests/ui/settings-columns.test.ts` · `tests/ui/layout/settings-field.test.ts` |
| `/hosted-page/{...slug}` | S19 | §S19 | REQ-059 | `tests/hosted/container/*` · `tests/hosted/indexing/*` · `tests/hosted/serving/*` |

Two of the twenty screens are not rows above, because neither is a route of
its own:

| screen | S-id | UI-SPEC | REQ criteria | tests that cover it |
|---|---|---|---|---|
| Not found / error — `src/app/not-found.tsx` (the root screen an unmatched address reaches, in the public chrome; #405), `(public)` and `(account)` `not-found.tsx` / `error.tsx`, `src/app/global-error.tsx`, and `(hosted)/not-found.tsx` | S8 | §S8 | *(new in the set)* | `tests/app/fallback/screens.test.tsx` · `tests/app/middleware.test.ts` · `tests/hosted/container/not-found.test.tsx` · `tests/app/route-groups.test.ts` |
| The mails — one shell, ten kinds (BUILD §12) | S20 | §S20 | BUILD §12, REQ-064, REQ-075 | `tests/mail/shell/*` · `tests/mail/templates/*` (10 kinds) |

### Surfaces with no screen

They answer a request and render nothing a person reads, so `UI-SPEC.md`
describes none of them. They are listed so the table can be checked against
the route tree without an unexplained gap.

| surface | what it is | tests |
|---|---|---|
| `/signin/{token}` | the magic link's redeem-and-redirect | `tests/app/signin/redeem-route.test.ts` |
| `/robots.txt` · `/sitemap.xml` | the indexing policy each host is served — a customer's site, a preview address, and (since #326) ReachKit's own | `tests/hosted/indexing/robots.test.ts` · `sitemap.test.ts` · `tests/app/seo/metadata.test.tsx` |
| `/icon` · `/apple-icon` · `/opengraph-image` · `/manifest.webmanifest` | the favicon set, the share card and the web manifest, drawn from tokens rather than committed as assets (#326) | `tests/app/seo/metadata.test.tsx` · `tests/app/middleware.test.ts` |
| `/hosted-gone` | the 410 an unpublished page answers | `tests/hosted/container/edge.test.ts` |
| `/api/**` (15 routes, BUILD §3) | thin HTTP adapters over the engine | `tests/app/api-adapter.test.ts` and each route's own suite |

Every screen row's baseline images are
`tests/ui/layout/__screenshots__/<route>-<width>-<theme>.png`, three bands ×
two themes, and they are what a PR that moves a pixel regenerates.

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

> Seeded by #364, given its route map by #367, and expanded into the index
> above by #358 — the per-screen citations, the tests that hold each screen,
> and the check that keeps the table and the route tree in step.
> A route added later adds three things in the same PR: its `page.tsx`, its
> `REFERENCE: S<id>` row in `tests/ui/layout/routes.ts`, and its row here.
> `tests/ui/design/reference.test.ts` fails until all three exist.
