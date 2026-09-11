# REQ-098, REQ-099 — librarian audit — 2026-09-03 — blocked-by: [REQ-001] and review gates

## Review gates

Both requirements completed two rounds:
- Round one folded 2026-09-02 (REQ-098: twelve `REVIEW(...)` lines; REQ-099: thirteen lines; all closed)
- Round two folded 2026-09-02 (REQ-098: twelve lines; REQ-099: ten lines; all closed)

No open `REVIEW(...)` lines remain. Rule 3.4 conditions satisfied for both.

## blocked-by edge assessment

**Status: LIVE BLOCK, properly declared per rule 2.3.**

Both requirements declare `blocked-by: [REQ-001]`. REQ-001 is `approved`. The conflict arises from ambiguity in REQ-001 criterion 1:

> "exactly one text input and one submit control and no other input control of any kind — no market, competitor, keyword or country field, selector or toggle, optional or required"

**Two readings:**

1. **Bounded:** The list (market, competitor, keyword, country fields) is the ban; the promise is about the scan form. Video play controls and repeated calls to action on a landing page are neither inputs nor submits and are permitted.

2. **Whole-page:** "of any kind" is the ban, the list illustrates it; the promise is that the landing page carries no control but those two (plus any structure around them). A video's play control and repeated calls to action break an approved promise and must be removed.

**Consequences for downstream artifacts:**
- **REQ-099 criterion 3 and 5** both depend on the bounded reading
- **REQ-098 criterion 5** cites the bounded reading for the sign-in card's play control
- **BP-022** and **BP-001** both publish the contract and move with the answer

This is a genuine open question (REQ-099's first open question, recorded in the evidence file). It is not a stale conflict but a real ambiguity in approved language that downstream requirements cannot resolve independently. The owner must rule.

## Open assumptions

- **REQ-099** carries one `rests-on` row, `disposition: open`: a demo video will exist and be hosted somewhere the page can embed it.
- **REQ-098** carries no `rests-on` rows.

Neither blocks approval (rule 2.3b binds `done`, not approval); leave them `open`.

## Verdict

**APPROVED.** All rule 3.4 conditions hold (two rounds, no open REVIEW lines). The blocked-by edge is live and properly declared per rule 2.3 (a genuine ambiguity in approved text, not a stale conflict); it does not block approval (§3 binds `done`, not approval).
