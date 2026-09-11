# REQ-013 — criteria 2 and 3 rehomed onto REQ-008, 2026-08-31 (merge pass, item 0)

Correction to the 2026-08-30 retirement. That pass executed the owner's ruling
("one line of copy, not a behaviour") and recorded, under rule 4.2, that the
premise held for criterion 1 but not for criteria 2 and 3. The ruling has been
corrected: both are behaviour no surviving requirement makes, and both are now
rehomed onto REQ-008, which owns the Google-presence card and the volumes those
figures sit in. Not a count-rule decision — `blueprints/` and `work-orders/`
hold no artifact, so every id in this pass counts 0.

## What happened

| id | before | after |
|---|---|---|
| REQ-013 | `status: superseded`, criteria 1–3 recorded as retired | `status: superseded` unchanged; retirement note corrected to name both survivors |
| REQ-008 | 6 criteria, `supersedes: []` | 8 criteria, `supersedes: [REQ-013]` |
| JN-001 | step 5 without the US-Google clause | clause restored |

## What moved to REQ-008

REQ-013 criterion 2, verbatim from `requirements/REQ-013.md`:

> 2. Given a domain of any country or site language, when its report renders, then
>    that line is present and unchanged, readable without the visitor acting on
>    anything, and it is never conditional or dismissible.

As REQ-008 criterion 7:

> 7. Given a domain of any country or site language, when its report renders, then
>    the report's line stating that measurement was on US Google in English is
>    present and unchanged, readable without the visitor acting on anything, and it
>    is never conditional or dismissible.

One substitution, forced and recorded rather than made silently: "that line" →
"the report's line stating that measurement was on US Google in English". The
antecedent of "that line" was REQ-013 criterion 1, which stays retired as copy;
left as it stood the criterion would point at nothing and be untestable. The
substituted words are REQ-013 criterion 1's own ("that measurement was on US
Google in English"), not new copy — the same substitution, for the same reason,
that the 2026-08-30 pass made when it moved criterion 4 to REQ-064.

REQ-013 criterion 3 moved verbatim, unchanged, as REQ-008 criterion 8:

> 3. Given any search volume, rival, ranking or AI answer shown on the report,
>    when it renders, then it comes from that same disclosed market, and no part
>    of the report presents a figure as local to another country or language.

"that same disclosed market" resolves against the new criterion 7 that precedes
it, so no substitution was needed.

## Non-goals

REQ-013's three retired non-goals were not carried: REQ-008 already states "No
backlink, local, or per-country ranking data (`BUILD.md` §17)", which is the same
scope line, and the two locale non-goals are now stated positively as criteria 7
and 8 (owner ruling T1 — a promise must not live only in `## Non-goals`).

## JN-001 step 5

The 2026-08-30 pass trimmed the US-Google clause from JN-001 step 5 because it
named a promise with no owner. The promise has an owner again, so the clause is
restored. The trimmed text was not preserved verbatim in any file, so the
restored clause is re-authored to the same substance — "and the standing line
saying every figure here was measured on US Google in English" — not recovered
character-for-character.

## Rule 4.2 — what I still think is worth the owner's eye

1. REQ-013 now carries two supersessors: REQ-064 (`supersedes: [REQ-013]`, from
   criterion 4) and REQ-008 (from criteria 2 and 3). The edge is accurate from
   both sides and the split is recorded here; if the owner wants a single
   supersessor, the edge to drop is REQ-008's, not REQ-064's, since this file
   records the same fact.
2. REQ-008 criterion 8 binds "any search volume, rival, ranking or AI answer
   shown on the report" — wider than REQ-008's own title, since AI answers are
   REQ-006's. It is carried verbatim as instructed rather than narrowed. If the
   owner would rather it stay inside REQ-008's scope, the narrowing is a
   criterion edit, not a merge.
3. REQ-008 now holds 8 criteria, above the three-to-five weight
   `skills/prd-writing/SKILL.md` calls one behaviour. It is still one card and
   one behaviour; noted, not acted on.
