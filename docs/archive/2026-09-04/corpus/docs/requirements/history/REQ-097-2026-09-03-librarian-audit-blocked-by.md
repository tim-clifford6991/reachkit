# REQ-097 — librarian audit — 2026-09-03 — blocked-by edge and review gates

## Review gates

Two rounds of review completed:
- Round one folded 2026-09-02 (fourteen `REVIEW(...)` lines, all closed)
- Round two folded 2026-09-03 (seven `REVIEW(...)` lines, all closed)

No open `REVIEW(...)` lines remain. Rule 3.4 conditions satisfied.

## blocked-by edge assessment

**Status: LIVE BLOCK, properly declared per rule 2.3.**

REQ-097 declares `blocked-by: [REQ-076, BP-060, BP-055]`. All three are `approved`. The requirement contradicts what these artifacts promise:

- **REQ-076 criteria 1, 3, 5, 7**: Settings shows billing values; the moment of cancellation confirmation states consequences; the paid-through date and billing details remain readable after the plan lapses
- **BP-060**: `billingSummary` exposes `nextInvoice` and `card`; `cancelSubscription` returns the access-end date
- **BP-055**: `SettingsAction` tuple includes `'invoices'` and `'cancel'`

These are genuine conflicts, not stale bookkeeping. REQ-097 resolves them by moving all five destinations (card, invoices, address, VAT number, cancellation) to Stripe's surface and removing ReachKit's own screens for them.

The conflicts were *examined and reshaped but not resolved* during round two review: criterion 1 was amended to list all control bans; criterion 2 was reworded to align with REQ-076 c2; the `rests-on` row was rescoped to both open legs BP-060 holds. The amendments address the conflicts at the product-promise level but leave the contradiction with the approved artifacts unresolved — the owner must rule which takes precedence.

**Verdict**: The edge is a proper conflict declaration per rule 2.3. Approval is not forbidden by §3 (which forbids `done`, not approval). The conflict stands; the owner rules it.

## Open assumptions

One `rests-on` row carries `disposition: open`: Stripe's billing surface reaches all five destinations, with two unverified (the VAT number and the billing address). This does not block approval (rule 2.3b binds `done`); leave it `open`.

## Verdict

**APPROVED.** All rule 3.4 conditions hold (two rounds, no open REVIEW lines). The blocked-by edge is live and properly declared per rule 2.3; it does not block approval (§3 binds `done`, not approval).
