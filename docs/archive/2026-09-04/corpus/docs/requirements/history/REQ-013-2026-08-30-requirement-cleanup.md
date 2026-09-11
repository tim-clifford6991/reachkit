# REQ-013 — retirement, 2026-08-30 (free-funnel merge map, item 7)

Owner ruling: "one line of copy, not a behaviour. Its criterion 4 moves to
REQ-064 as one criterion." Not a count-rule decision — `blueprints/` and
`work-orders/` hold no artifact, so REQ-013's count is 0 like every other id in
this pass.

## What happened

| id | before | after |
|---|---|---|
| REQ-013 | 4 criteria, `status: draft` | `status: superseded`, retired in place; nothing remains live in this file |
| REQ-064 | 7 criteria | 8 criteria, `supersedes: [REQ-013]` |

## What moved to REQ-064

REQ-013 criterion 4, verbatim:

> 4. Given a search volume sent outside the report — in the giveaway email
>    (REQ-010) or any follow-up (REQ-011) — when it is shown, then the same
>    disclosure accompanies it, so no measured figure travels without it.

As REQ-064 criterion 8:

> 8. Given a search volume sent outside the report — in the giveaway email or any
>    follow-up (REQ-010) — when it is shown, then one written line states that
>    measurement was on US Google in English, so no measured figure travels
>    without that disclosure.

Two changes, both forced, both recorded here rather than made silently:

1. "(REQ-010) or any follow-up (REQ-011)" → "(REQ-010)" — REQ-011 was superseded
   by REQ-010 in merge 6 of this same pass, and no citation may name a superseded
   id.
2. "the same disclosure" → "one written line states that measurement was on US
   Google in English" — the antecedent of "the same" was REQ-013 criterion 1,
   which this retirement deletes. Left as it stood, the criterion would have
   pointed at nothing and been untestable. The substituted words are REQ-013
   criterion 1's own ("that measurement was on US Google in English"), not new
   copy.

Nothing else on REQ-064 was touched: its three open `REVIEW(...)` lines stand
unedited, and the one other edit to that file — "REQ-010, REQ-011, …" → "REQ-010,
…" in its non-goals — is the same superseded-id repoint as (1) above, required by
merge 6.

## What was retired, verbatim — criteria 1 to 3

> 1. Given any free report, when it renders, then it carries one written line
>    stating that measurement was on US Google in English.
> 2. Given a domain of any country or site language, when its report renders, then
>    that line is present and unchanged, readable without the visitor acting on
>    anything, and it is never conditional or dismissible.
> 3. Given any search volume, rival, ranking or AI answer shown on the report,
>    when it renders, then it comes from that same disclosed market, and no part
>    of the report presents a figure as local to another country or language.

And its non-goals, retired with it:

> - No per-customer or per-domain locale derivation in this version
>   (`BUILD.md` §6.3a, "the designed v1.1 upgrade").
> - No country or language selector on the landing page or the report.
> - No translated report or per-country search data (`BUILD.md` §17,
>   "per-country SERPs").

## Rule 4.2 — what I think is wrong with this item

Criterion 1 is copy, and the ruling is right about it: what the line says is a
customer-visible string, which §1 makes the owner's to write, and a REQ that only
says "this string appears" adds nothing a test could not read off the string.

Criteria 2 and 3 are not copy. Each states a testable promise that no surviving
requirement makes:

- criterion 2 — the line is never conditional or dismissible, and never varies
  by the scanned domain's country or site language;
- criterion 3 — no figure anywhere on the report is presented as local to another
  country or language.

A build could satisfy REQ-064 criterion 8 and every other surviving requirement
while showing a dismissible banner, or while labelling a US volume as local to a
founder's own country. I executed the retirement as instructed and did not invent
an eighth merge to save them. My recommendation, for the owner to rule on: rehome
criterion 3 onto REQ-008 (which owns the volumes, rivals and rankings the
criterion binds) and criterion 2 onto REQ-008 or REQ-004 with it, or accept the
loss explicitly. JN-001 step 5's wording was trimmed in the same pass because it
named a promise that no longer had an owner — that trim is the visible cost of
this item and reverses cleanly if the criteria come back.
