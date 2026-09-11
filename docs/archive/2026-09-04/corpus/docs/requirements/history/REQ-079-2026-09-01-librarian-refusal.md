# REQ-079 — status refused, 2026-09-01 (librarian)

`status: approved` → `status: in-review`. Recorded, not enforced (rule 3.3):
no remote, no CI, no branch protection, no pre-commit hook in this repository.

## Clause that failed

**§3's first owner gate, read with rule 2.4** — one claim, one home.

REQ-079 carries no review line of its own; its fault is the other half of the
same conflict. ADR-081 binds it by name:

> "**Binds** REQ-056 criterion 16 and REQ-079 criterion 4. Both requirements
> move to `status: in-review` in the same pass this file is written … This file
> does not rewrite either criterion."

Criterion 4 still reads, unscoped, that on unpublish-everything "a page ReachKit
published to WordPress *is returned to draft there*". ADR-081 Decision 1 holds
that clause true only of the was-live population and Decision 3 gives it its own
union arm (`returned_to_draft`), with `named_for_removal` for the rest. The
criterion the owner approved states the unscoped promise; BP-045's
`made_live_by_us` discriminator, BP-048's adapter and BP-063's `UnpublishAllResult`
implement the scoped one. Two homes, two texts.

The re-approval changed the status line and nothing else — verified against the
working-tree diff at the time of this audit.

## What would clear the refusal

1. The requirements-analyst folds ADR-081 Decision 1 into criterion 4 so it
   names the population it speaks for, per ADR-081 Decision 3 ("the
   requirements-analyst's job on the way back through the gate is to make each
   say which population it speaks for, not to delete either").
2. The owner approves the folded text.
3. WO-142 and WO-239 re-extract their inherited rows and re-certify.

If the owner's intent is instead that criterion 4's WordPress clause be
**withdrawn** rather than scoped, ADR-081's own Consequences fix the route: a
superseding ADR, never an edit to ADR-081 and never a deletion of the
`returned_to_draft` arm.
