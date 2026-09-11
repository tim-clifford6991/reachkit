# REQ-043 — requirement cleanup, 2026-08-31 (app cluster, Merge 3)

Merge decided by the owner, not by the survivor-count rule: `blueprints/` and
`work-orders/` hold no artifact beyond their templates, so the front-matter
`satisfies:`/`implements:` count naming REQ-043 or REQ-044 is 0 for both. The
count rule was inapplicable and the owner's map decided the survivor.

## What merged

| id | before | after |
|---|---|---|
| REQ-043 (survivor) | 6 criteria, `status: draft` | 11 criteria, `status: draft`, `supersedes: [REQ-044]` |
| REQ-044 | 5 criteria | `status: superseded`, retired in place |

11 criteria in, 11 out; nothing collapsed. Grounds recorded by the owner: one
screen (BUILD §4.6) — the month grid and the day panel that opens from it. The
two requirements could not state themselves without naming each other: REQ-044
criterion 5 existed only to repeat REQ-043 criterion 5's account, and both
carried a non-goal routing the empty-day question to the other.

## Title

Was: "The calendar shows one page a day while supply lasts, and is never padded".
Now: "The calendar shows one page a day while supply lasts, is never padded, and
selecting a day says why that page exists".

## Criterion mapping — every criterion carried verbatim

| survivor | from |
|---|---|
| 1 | REQ-043 c1 |
| 2 | REQ-043 c2 |
| 3 | REQ-043 c3 |
| 4 | REQ-043 c4 |
| 5 | REQ-043 c5 |
| 6 | REQ-043 c6 |
| 7 | REQ-044 c1 |
| 8 | REQ-044 c2 |
| 9 | REQ-044 c3 |
| 10 | REQ-044 c4 |
| 11 | REQ-044 c5 ("REQ-043 criterion 5" → "criterion 5", now an internal reference) |

REQ-043's own criteria kept their numbers, so every live citation of them
survives the merge untouched: REQ-071 criterion 11 and REQ-091's non-goal
("REQ-043 criterion 3"), REQ-050 criterion 8, REQ-053 criterion 5, REQ-054 and
REQ-092's non-goal ("REQ-043 criterion 4"), REQ-074 criterion 3 ("REQ-043
criterion 2"). REQ-044 c2 becomes criterion 8, the address REQ-047 criterion 12
now uses.

## Owner ruling T2 — carried verbatim, unchanged

Criterion 3's closing sentence is the ruling and is carried word for word:

> "No date emptied by any other cause, whether or not a requirement names that
> cause, ever carries that line."

Criterion 4 carries its other half verbatim — "or any cause whatever … and that
line says which cause emptied it" — so an unrecognised cause falls to criterion 4
and can never inherit criterion 3's line. Neither criterion was touched by the
merge, and the merged rationale restates the ruling's shape in the requirement's
own words ("a day emptied by any cause other than exhausted supply never reads as
the market having offered nothing, and an unrecognised cause cannot inherit that
line").

## The "one page a day" ruling — carried verbatim

Criterion 1's limb is the ruling and is unchanged: "every date it shows that is
today or later carries a page **while any opportunity a page can be written from
remains that no page has yet been created from** — a date is left empty only
where that supply is exhausted, never because the day was not reached for". The
rationale now says the same in plain words ("while any qualifying opportunity
remains unused, not only when a new measurement produces one"), which is the
distinction the ruling was made to fix against REQ-047 criterion 4's
new-measurement wording.

## Non-goals

Unioned, with two collapses and one death:

- **Collapsed:** REQ-043's "Approval workflows, comments, assignees or shared
  content calendars beyond this view" + REQ-044's "Comments, assignment or
  approval chains" → one line naming all of them.
- **Collapsed:** REQ-043's "Grid track sizing, chip colours, panel widths and
  today's ring — design system" + REQ-044's "Panel width, stickiness, badge tone
  and typography — design system" → one design-system line.
- **Died as a seam:** REQ-044's "Which kinds of empty day exist and which line
  each carries — REQ-043 owns the date's one account; criterion 5 fixes only that
  the panel repeats it and offers no action on it." Its whole content was routing
  to a sibling now inside the same file. The promise it pointed at is survivor
  criterion 11, which states it as behaviour.

No line was promoted under ruling T1. "More than one page on any day" is already
carried as behaviour by criterion 1 ("no date carries more than one page");
"Editing the target search, slug or title of a planned page from this view" and
"Calendar export or subscription feeds" disclaim controls that do not exist, not
behaviour a customer would notice the absence of.

## Front-matter

- `depends-on`: union of [REQ-047, REQ-056] ∪ [REQ-043, REQ-048, REQ-049] =
  [REQ-047, REQ-056]. REQ-044's REQ-043 edge became a self-edge and was dropped;
  its REQ-048 and REQ-049 edges resolve to REQ-047 after Merge 1 and were already
  present. No cycle was broken.
- `rests-on`: REQ-043's time-zone entry carried, `confirmed`. REQ-044 carried
  none.
- `blocked-by`: empty on both.

## Citations repointed (2 files)

- `journeys/JN-003.md` step 2 `exercises`: [REQ-043, REQ-044, REQ-047, REQ-053,
  REQ-092] → [REQ-043, REQ-047, REQ-053, REQ-092]. Step 3 `exercises`: [REQ-044,
  REQ-047] → [REQ-043, REQ-047]. Journey is `status: draft`, so no approval drop.
- `requirements/REQ-047.md` criterion 12 already cites "REQ-043 criterion 8", the
  address REQ-044 criterion 2 took in this merge.

No other live artifact cited REQ-044. Nothing inside `REQ-044.md` was repointed;
it is the record of what it said.

## Placement

JN-003 steps 1, 2 and 3. Rule 5.7 satisfied, and the rationale records the
placement.

## Anchors

No `Implemented by:` / `Pinned by:` lines existed on either. No non-superseded
blueprint satisfies REQ-043 — no blueprint yet, anchors deferred to
`/expand-requirement`.

## REVIEW lines

- **Died:** none — neither carried one.
- **Survived:** none opened by this merge.
