# REQ-056, REQ-057, REQ-060 — ADR-084 round-two review folded, 2026-09-01 (requirements-analyst)

Five `REVIEW(...)` lines were open: REQ-056 (one), REQ-057 (one), REQ-060
(three). All five are now deleted. None became a `blocked-by` edge. All three
requirements moved `approved → in-review`: each fold changed a criterion, and a
criterion change is a promise change, so the owner's gate reopens (rule 3.4,
§3's stage-gate vocabulary). This is the second and last round rule 3.4 gives.

Every fix is written under the owner's ruling of 2026-09-01 that ReachKit does
not look at a published page again after its 24-hour check. No criterion below
assumes a later observation; where ReachKit cannot know, the requirement now
says so rather than promising otherwise.

## REQ-056 — criterion 6 rewritten; the guard moved off the empty arm

The old criterion split on whether ReachKit *made* the page live, which is a
fact about the past, and put the guard ("never an address that does not resolve
to that page") and the not-live line in the second arm — the arm ADR-084
Decision 4's table leaves with no members. A page ReachKit published and then
took down (criterion 7, criterion 15's removal, criterion 16's return to draft)
stayed in the first arm and was shown "the address it is publicly readable at",
which REQ-043 criterion 12 keeps openable "for a page published on any earlier
day".

The split is now on the page's current state rather than the past act. While the
page stands `published` the address is offered as the address it is publicly
readable at; from the moment it moves to `unpublished` the same address is
presented as the one the page *was* published at and never as one it is readable
at now, carrying beside it whichever outcome criterion 15 or criterion 16 names
for that page "and no other account of what is at that address". The guard is no
longer a promise to verify resolution — ReachKit cannot verify it — but a ban on
claiming liveness at an address ReachKit itself stopped serving or asked the
customer's site to stop serving.

The never-made-live arm is kept, narrowed to "no address is offered at all",
rather than deleted: ADR-084 Decision 4's warning block and its Consequences
("the criterion should not be narrowed to today's population"). It is now
disjoint from the unpublished case, which is what made it a bug rather than
merely empty.

Criterion count unchanged at 16, still standing against rule 2.1's ~12 soft
budget and still named for `/requirement-cleanup`, not resolved here.

## REQ-057 — criterion 9 gains the arm it had none of

Criterion 9 made every telling say publishing puts the page live at the
customer's site, and REQ-060 criterion 7 puts a site whose credential cannot
publish into the failing state before that telling is sent — where neither
publishing nor approving can make the page live. Criterion 9 now carries a third
arm: where ReachKit already reads that site as one it cannot publish to, the
telling says the page cannot go live there as things stand and what must change.
It does not suppress the date criteria 1, 7 and 8 have it name — the veto window
and the stop action still stand — it only stops the telling asserting the page
goes live there then, or that approving it will make it live.

`depends-on` gains REQ-060, which criterion 9 now names.

The zero-veto-window open question is untouched: it is the owner's, with the
derived default recorded beside it.

## REQ-060 — three lines folded

1. **Criterion 2's unconditional closing sentence.** "No surface says a post is
   no longer live on the customer's site while nothing has been written into it"
   forbade REQ-062 criterion 4's "the page was no longer there when the check
   ran" and REQ-056 criterion 16's third outcome, both of which criterion 2's own
   preceding clause obliges surfaces to name — so it contradicted itself as well
   as its neighbours. The ban is re-cut around what it was for: no surface says
   ReachKit *returned the post to draft or changed it* unless ReachKit wrote that
   into the site. Stating that the post was not in the site is permitted, bounded
   to a look ReachKit actually took, carrying the date it looked, and explicitly
   not a claim about any later day, "because ReachKit does not go back and look
   again". The same sentence's "shown as live until the customer unpublishes it"
   gains the check's second terminus (REQ-062 criterion 4), so the calendar stops
   showing a page as live after ReachKit's own record says it was not found.

2. **Criterion 2 versus REQ-079 criterion 4.** The earlier fold's claim that
   REQ-079 criterion 4 needed no change does not hold, and criterion 2 is not
   weakened to accommodate it: "never another" binds as it reads. REQ-079
   criterion 4's "listed as still live with one written line saying so" asserts a
   liveness ReachKit could not check on the one path where it could not reach the
   site, and needs to name REQ-056 criterion 16's unreachable outcome instead —
   that the post may still be live there and nothing was written into it. REQ-079
   is held by another analyst this pass and is untouched here. If that edit is
   not made, the edge belongs on REQ-079 (`blocked-by: [REQ-060]`), not on
   REQ-060, whose text is now internally consistent.

3. **Criterion 7's import from REQ-074 criterion 2.** The criterion used
   REQ-074's `failing` state correctly but imported the action and the written
   line REQ-074 criterion 2 attaches to expired credentials and held pages.
   Neither holds here: the credential is valid and the page has failed rather
   than been held, so the customer read "pages are being held and nothing has
   been lost" over a page that had already failed, and reconnecting the same
   application password cannot add a role capability. Criterion 7 now keeps the
   state and fixes the occasion for itself: the customer is told the site is
   connected but the account ReachKit uses cannot publish, never that pages are
   held and nothing lost, and the action offered leads to a credential for an
   account that can publish, with re-entering the same one never offered as the
   remedy. The exact sentence stays owner-owed (ADR-084's own Open questions);
   this fold mints none, and a non-goal records that.

   ADR-084 Decision 3 makes the same move criterion 7 inherited — "with the
   Reconnect action criterion 2 already offers. No new destination state and no
   change to REQ-074." Reported, not edited: decisions are the architect's.

   The non-goal that closed the destinations list to REQ-074 criteria 1 and 2 is
   narrowed to criterion 1 accordingly. REQ-074 covers only the
   expired-credential occasion and now owes a criterion for this one; nobody
   holds REQ-074 this pass.

4. **Criterion 6's placement (not a review line, a caution carried in).** The
   rationale quoted the proposed JN-004 step verbatim, which becomes a stale
   second copy the moment the step lands (rule 2.4). It now describes the step
   instead. The placement itself is unchanged: a step owed on JN-004 after step
   8, `exercises: [REQ-060, REQ-079]`, an edit that drops JN-004 from `approved`
   to `in-review`. Neither journey is this pass's to edit.
