# REQ-056 — status refused, 2026-09-01 (librarian)

`status: approved` → `status: in-review`. Recorded, not enforced (rule 3.3):
this repository has no remote, no CI status check, no branch protection and no
pre-commit hook — `.git/hooks/` holds only the shipped `.sample` files. The
refusal stands until answered; nothing stops a commit past it.

## Clause that failed

**Rule 3.4, final sentence** — "A draft carrying open `REVIEW(...)` lines is not
presented as ready."

REQ-056 carries an unchecked review line in `## Acceptance criteria`, opening:

> `- [ ] REVIEW(conflict with REQ-079 criterion 4): criterion 16 says a WordPress
> page the customer unpublishes is one whose post ReachKit names in their own
> site for them to remove …`

It is a `- [ ]` checkbox, still open, and it was open when the status was set.
The only change in the re-approval was the status line itself — criterion 16's
text is byte-identical to the text the review line objects to.

## Why the ruling did not clear it

ADR-081 (`status: accepted`, 2026-08-31) settled the conflict by scoping, and
says so in its own header:

> "**Binds** REQ-056 criterion 16 and REQ-079 criterion 4. Both requirements
> move to `status: in-review` in the same pass this file is written … This file
> does not rewrite either criterion; the requirements-analyst owns the text and
> the owner owns the approval."

A ruling that scopes a criterion is not the scoping. Approving the unchanged
text re-asserts the promise ADR-081 ruled must state its population, while
BP-045, BP-048, BP-063 and BP-015 build the scoped version — rule 2.4's two
copies, diverged.

## What this approval would have cleared silently

Three work orders are `status: draft` for exactly this reason and name it as
their own blocker: WO-142, WO-239 and (in part) WO-247. WO-239's
`## Self-certification` states what would clear it — "The analyst folds ADR-081
into criterion 16 and criterion 4, **the owner approves both requirements**, and
the two rows are re-extracted." A status flip with no fold satisfies the middle
clause and neither of the other two, and those three drafts would then read as
unblocked against criteria that had not moved.

## What would clear the refusal

1. The requirements-analyst folds ADR-081 Decision 3's scoping into criterion 16
   so it states the never-live population it speaks for.
2. The review line is discharged and deleted (rule 2.1: answered questions are
   deleted once ruled).
3. The owner approves the folded text.
4. WO-142, WO-239 and WO-247 re-extract their inherited rows.

Nothing in this file edits a criterion. The librarian does not own requirement
text (§4).
