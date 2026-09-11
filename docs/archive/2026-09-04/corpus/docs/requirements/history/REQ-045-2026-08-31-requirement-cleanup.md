# REQ-045 — requirement cleanup, 2026-08-31 (app cluster, Merge 2)

Merge decided by the owner, not by the survivor-count rule: `blueprints/` and
`work-orders/` hold no artifact beyond their templates, so the front-matter
`satisfies:`/`implements:` count naming REQ-045, REQ-046 or REQ-061 is 0 for each.
The count rule was inapplicable and the owner's map decided the survivor.

## What merged

| id | before | after |
|---|---|---|
| REQ-045 (survivor) | 4 criteria, `status: draft` | 12 criteria, `status: draft`, `supersedes: [REQ-046, REQ-061]` |
| REQ-046 | 7 criteria | `status: superseded`, retired in place |
| REQ-061 | 5 criteria — criterion 2 only came here | `status: superseded`, retired in place (see `REQ-061-2026-08-31-requirement-cleanup.md`) |

12 criteria in, 12 out; nothing collapsed. Grounds recorded by the owner: one
draft view — what the customer reads, how they edit it, and what the labelling
promises — plus REQ-061 criterion 2, the copy-as-Markdown/HTML path for a
destination ReachKit does not serve, which is a thing the customer does in that
same view.

## Title

Was: "The customer reads the whole page, its grounded fact and its claim check
before it goes out". Now: "The customer reads the whole page, edits it as
Markdown, and can copy it out for any destination".

## Criterion mapping — every criterion carried verbatim

| survivor | from |
|---|---|
| 1 | REQ-045 c1 (two REQ-093 quotations converted to citations — below) |
| 2 | REQ-045 c2 |
| 3 | REQ-045 c3 |
| 4 | REQ-045 c4 |
| 5 | REQ-046 c1 |
| 6 | REQ-046 c2 |
| 7 | REQ-046 c3 |
| 8 | REQ-046 c4 |
| 9 | REQ-046 c5 |
| 10 | REQ-046 c6 |
| 11 | REQ-046 c7 |
| 12 | REQ-061 c2 |

REQ-045's own criteria kept their numbers, so the merge left every live citation
of them addressing what it addressed. Neither REQ-046 nor REQ-061 c2 carried an
internal criterion reference, so no renumbering was needed inside the carried
text; REQ-046 c6 and c7's references are to REQ-057 criterion 2, which is
external to this merge and unchanged.

## Verbatim cross-file quotations converted to citations

Required by the corpus ruling in force. Only the quoted sibling prose was
removed; the promise text is unchanged.

- criterion 1: REQ-093 criterion 2's "it appears as that page's content,
  identified as the page it belongs to" → the criterion now cites REQ-093
  criterion 2 alone; REQ-093's non-goal "Text the customer writes themselves …
  which is theirs" → "(REQ-093's non-goal on text the customer writes
  themselves)".

BUILD.md quotes in the rationale were left in place as evidence, per the same
ruling; the merged rationale carries §4.6's draft-view and editor clauses and
§9's "Everything else = copy as Markdown/HTML (always shown)", which is
REQ-061 criterion 2's source.

## Non-goals

Unioned, with three collapses of pairs that stated one thing:

- REQ-045's "Images in drafts" + REQ-046's "Inserting images or media" → "Images
  or media in a draft, inserted by ReachKit or by the customer."
- REQ-045's "Comments, suggestions or multi-person approval" + REQ-046's
  "Simultaneous editing by more than one person, comments, or suggestion mode" →
  one line naming all four.
- REQ-045's "Typography, highlight styling and badge tone — design system" +
  REQ-046's "Two-column versus tabbed layout — design system" → one design-system
  line.

No line died as a seam: REQ-045's and REQ-046's non-goals routed to REQ-060,
REQ-057 and the design system, all outside this file. REQ-046's routing of the
publishable rule to REQ-057 survives inside criteria 10 and 11 rather than as a
non-goal.

No line was promoted under ruling T1. The two candidates were checked and
rejected: "A rich-text or WYSIWYG editor" is already carried as behaviour by
criterion 5 ("they edit its Markdown"), and "Merging two concurrent edits of the
same draft" by criterion 6 ("the most recently saved version is the draft").
"Publishing directly from this view to a destination the customer has not
connected" disclaims a control this view does not offer, not a behaviour the
customer would notice the absence of, so it stays a non-goal.

REQ-061's own non-goals did not come here — they belong to the four criteria that
went elsewhere, and are accounted for in REQ-061's history entry.

## Front-matter

- `depends-on`: union of [REQ-050, REQ-053, REQ-093] ∪ [REQ-045, REQ-053,
  REQ-057] ∪ [] = [REQ-050, REQ-053, REQ-057, REQ-093]. REQ-046's REQ-045 edge
  became a self-edge and was dropped. No cycle was broken.
- `rests-on`: none on any of the three.
- `blocked-by`: empty on all three.

## Citations repointed (5 files)

- `journeys/JN-003.md` step 5 `exercises`: [REQ-046, REQ-053] → [REQ-045,
  REQ-053]. Step 7 `exercises`: [REQ-046, REQ-056, REQ-057, REQ-059, REQ-060] →
  [REQ-045, …]. Journey is `status: draft`, so no approval drop. Step 9 is
  repointed in REQ-061's entry.
- `requirements/REQ-053.md` non-goal: "(REQ-046)" → "(REQ-045 criterion 11)",
  now naming the criterion that carries the promise.
- `requirements/REQ-093.md` non-goal: "(REQ-046, REQ-055)" → "(REQ-045,
  REQ-055)".
- `requirements/REQ-078.md` non-goal: "which is the calendar's and the publishing
  path's" → "REQ-045 criterion 12". The BUILD §4.6/§9 citation was left.
- `requirements/REQ-063.md` `depends-on`: REQ-061 dropped — see REQ-061's entry.

Nothing inside `REQ-046.md` was repointed; it is the record of what it said.

## Placement

JN-003 steps 4 (reads the draft), 5 (edits it), 7 (finds what held it) and 9
(copies a page out). Rule 5.7 satisfied, and the rationale records the placement.

## Anchors

No `Implemented by:` / `Pinned by:` lines existed on any of the three. No
non-superseded blueprint satisfies REQ-045 — no blueprint yet, anchors deferred
to `/expand-requirement`.

## REVIEW lines

- **Died:** none — none of the three carried one.
- **Survived:** none opened by this merge.
