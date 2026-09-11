# REQ-056, REQ-057, REQ-060 — ADR-084 round-one review folded, 2026-09-01 (requirements-analyst)

Five `REVIEW(...)` lines were open across REQ-056 (one), REQ-057 (one) and
REQ-060 (three). All five are now gone, folded into criterion text or into the
rationale's placement; none became a `blocked-by` edge. No status changed: all
three stay `in-review`. REQ-057's zero-veto-window question is the owner's and
was left standing.

## REQ-056 — one line folded, then deleted

Criterion 6's address arm is scoped rather than criterion 16 narrowed
(ADR-084 Decision 4's warning block, and its Consequences: "the criterion should
not be narrowed to today's population"). The arm now holds where ReachKit made
the page live; where it did not, the record carries one written line saying the
page is not live in place of an address, "and never an address that does not
resolve to that page". Criterion count is unchanged at 16 — the fix replaced
text and appended none. The count still stands against rule 2.1's ~12 soft
budget and is named for `/requirement-cleanup`, not resolved here.

## REQ-057 — one line folded, then deleted

Criterion 9's copilot ambiguity is settled on the **conditional** reading, which
is the only one compatible with criteria 3 and 6 (under copilot, expiry never
publishes and the page may never go live at all). Every telling still names the
site and says publishing puts the page live there, readable by anyone; a telling
that names a date says the page goes live then; a telling that names none,
because the page waits on the customer's approval, says the page goes live there
only once they approve, "and never that it will be published and readable by
anyone whether or not they do". The criterion survives: c1, c7 and c8 name the
page, the reason, the interval and the stop action, and never the destination or
public readability, so deleting it would drop both promises with no home.

## REQ-060 — three lines folded, then deleted

1. **The unreachable case (conflict with REQ-079 criterion 4).** Criterion 2's
   "never shown as live and as unpublished at once" was written when no
   WordPress page was live and the unreachable population was empty. It now
   separates two facts: the page's ReachKit state, and what the surfaces say
   about the post inside the customer's own site, which follows whichever of
   REQ-056 criterion 16's outcomes happened. Where ReachKit did not reach the
   site, every surface says the post may still be live there until a later ask
   succeeds. The old single-fact invariant is kept as consistency across
   surfaces: "no two surfaces say different things about the same page".
2. **The credential that can create but not publish** (ADR-084 Decision 3) is
   now criterion 7 — appended rather than inserted, so that ADR-084's citations
   of criteria 1, 2, 3, 4, 5 and 6 keep their addresses. Behaviour only: the
   destination reads as failing with REQ-074's Reconnect action, a delivery
   against it fails for a reason no repeated attempt can clear so the page rests
   needing the customer (REQ-056 criterion 4), and no post ReachKit reports as
   published is left standing as a draft in that site. `canPublish`, the probe
   and its timing stay in ADR-084 Decision 3 and BP-058. No `rests-on` row was
   added: the criterion holds whether WordPress silently drafts the post or
   refuses the request outright, so ADR-084's own open row is not duplicated
   here (rule 2.4). `depends-on` gains REQ-074.
   The sentence the customer reads is owner-owed and stays owed in ADR-084's
   own Open questions; criterion 7 mints none and leans on REQ-074 criterion 2's
   existing line.
3. **Criterion 6's placement.** Recorded in the rationale, not exempted: the
   criterion is user-facing, so rule 5.7 wants a step, and no step walks it.
   JN-003 step 6 walks criteria 1 to 5 and criterion 7's page side; the step
   that would walk criterion 6 is a new one on JN-004 after step 8, with
   `exercises: [REQ-060, REQ-079]`, an edit that drops JN-004 from `approved`
   to `in-review`. JN-003 and JN-004 were held by another analyst this pass and
   are untouched.
