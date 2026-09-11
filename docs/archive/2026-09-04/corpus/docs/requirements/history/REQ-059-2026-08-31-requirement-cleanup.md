# REQ-059 criteria 6 and 7 moved to REQ-076, 2026-08-31 (merge pass, move item)

Not a merge — both requirements stay live. The 30-day hosted-serving window and
its two notices are what happens when a customer leaves, not how pages come to be
published, so they move to the requirement that owns billing and cancellation.
No count rule applies; nothing was superseded.

## What happened

| id | before | after |
|---|---|---|
| REQ-059 | 7 criteria, `status: draft` | 5 criteria, `status: draft` |
| REQ-076 | 9 criteria (after merge 2 of this pass) | 11 criteria |
| REQ-079 | one open `REVIEW(conflict with REQ-059)` | line deleted — the move settles it |

Priority: both Must, unchanged.

## The criteria, as moved

REQ-059 c6 → REQ-076 c10. REQ-059 c7 → REQ-076 c11. Two changes to each, both
recorded rather than made silently:

1. Citation repoints. c7's "(REQ-076 criterion 8, "whether or not the
   subscription was cancelled and whether or not its latest renewal was paid")"
   became "(criterion 8)" — the citation is now internal, and the corpus ruling
   retires verbatim quotation of a sibling's prose.
2. The deletion exception, below.

## The REQ-079 conflict, and how it is reconciled

The line deleted from REQ-079, verbatim:

> - [ ] REVIEW(conflict with REQ-059): criterion 6 takes hosted pages down at the
>   moment the account is deleted and leaves no remaining paid access, while
>   REQ-059 criterion 6 goes on serving a customer's hosted pages for 30 days past
>   the paid-through date and criterion 7 promises that no customer's live pages go
>   dark without two written notices having been sent. Neither requirement names
>   deletion as the exception, so it is undecided whether those two notices are
>   sent, suppressed, or addressed to a customer criterion 7 here has just made
>   unreachable.

Ruled as the brief directs: deletion is the customer's own act, taken on a screen
that states what it removes before they confirm (REQ-079 criteria 1 and 3), so
immediate take-down is defensible and REQ-079 criterion 6 keeps the timeline for
that path. The two must not both claim it, so the clause naming deletion as the
exception was written into the moved criteria and **not** into REQ-079, which is
left untouched apart from the deleted line. Added to REQ-076 c10: "— unless the
customer deletes their account, when serving stops at the moment of deletion and
this window never begins (REQ-079 criterion 6)". Added to REQ-076 c11: "— except
where the customer deletes their own account, which takes those pages down at
once and carries no notice of a day the customer chose (REQ-079 criterion 6)".
The second clause also answers the third limb of the review line: the notices are
not addressed to an account the customer has just deleted, because they are not
sent on that path at all.

## Citations repointed

- `requirements/REQ-076.md` criterion 4 ("REQ-059 criterion 6" → "criterion 10")
  and criterion 7 ("(REQ-059 criterion 6)" → "(criterion 10)").
- `requirements/REQ-076.md` rationale: the sentence handing serving duration,
  the visitor's experience after it stops and the mails to REQ-059 was rewritten
  — REQ-059 now keeps only how the pages come to be served.
- `requirements/REQ-076.md` non-goals: two lines replaced by one. "What a visitor
  gets from a hosted page after it stops being served, and the serving behaviour
  itself — REQ-059's" was half wrong after the move (the 410 is criterion 10's),
  and "Which customers are mailed about the end of hosted serving … — REQ-059
  criterion 7's" had become a disclaim ring to a criterion now in the same file.
- `requirements/REQ-059.md` rationale: its closing sentence stating the 30-day
  bound was replaced by a citation of REQ-076 criteria 10 and 11, and a non-goal
  was added handing the end of serving to them.
- `requirements/REQ-064.md` non-goal listing which requirement owns each mail's
  text: REQ-059 removed (it now names no mail occasion); REQ-076 was already in
  the list.
- Placement lines corrected while there: REQ-059 is exercised at JN-003 step 7,
  REQ-076 at JN-004 steps 5 and 9. Both had none stated before.

## Placement of the moved promise

JN-004 step 9 was the only step under which a customer meets the end of hosted
serving, and its wording did not name it — the promise would have been placed on
a step no reader could see it in. The step now reads "Comes back after the plan
has lapsed, signs in with a fresh link, and takes their pages or resumes — having
been told twice beforehand which day the pages ReachKit hosts for them stop being
served". JN-004 is `draft`, so no approval drop applies.
