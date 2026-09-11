# REQ-097 — round-two review folded, 2026-09-03 (requirements-analyst)

Seven `REVIEW(...)` lines were open — three conflicts (REQ-024, REQ-076, BP-060),
two untestable (criteria 4 and 5), one gap, one ambiguity. None remains. All
seven are fixed in the requirement and deleted; none is escalated, because each
had a defensible answer in an approved artifact (rule 1.3) or was a parameter
(rule 1.1), and one premise is refused in part with evidence. Rule 3.4's budget
is spent; whatever still divides author and reviewer is in the two owner
questions below, which are the same two round one left. No status was raised:
REQ-097 stays `draft`. JN-004 was not edited — step 5 already reads "leaving
ReachKit for Stripe's own billing surface to do any of the three, and coming
back still signed in", which criterion 2's return-to-Settings leaves true; it
was already `in-review`.

## REQ-097 — 6 criteria to 6, 7 review lines to 0, 2 owner questions (unchanged), 1 new edge

- **Criterion 4 rewritten as a closed list with named exceptions** (two lines:
  the REQ-024 conflict, the untestable criterion 4). Round one's "occasion's
  producer" test made four mails approved REQ-024 requires — c1's sign-in link,
  c3's double-purchase `account` mail, c5's backstop that "says the payment
  succeeded", c6's 24-hour link — Stripe's by implication, with no `blocked-by`
  and no non-goal. Settled from approved text rather than escalated: REQ-024
  states what ReachKit sends about a completed payment, and REQ-064's approved
  non-goal marks "receipts, failed-payment notices and card-expiry warnings" as
  "not ReachKit speaking". Criterion 4 now lists the Stripe billing events on
  which ReachKit sends nothing, names REQ-024's completed-payment mails and
  REQ-076 criterion 11's clock-driven notices as the only exceptions, and binds
  subject and body to a closed list of withheld values, admitting the one
  payment fact REQ-024 c5 requires. The half about Stripe's own mail ("the mail
  telling them is Stripe's") is deleted — it was an outcome on a surface this
  requirement's non-goal puts out of scope. `depends-on` gains REQ-024.
  **Refused in part, with evidence:** the finding's premise that "nothing here
  fails a build that stays silent" is not the standard for a prohibition — §8's
  mutation test is: adding a receipt send or an amount line to any ReachKit mail
  fails the criterion, and a build that sends no billing mail is exactly what
  the owner's statement asks for. The evidence file records the four candidate
  tests once and states only the one in force.
- **The evidence file's contradiction resolved.** "The boundary criterion 4
  draws, and why it is drawn by occasion" stated the occasion test as in force
  and the subject test as superseded; "The mail register, checked" still
  reasoned by "criterion 3's subject test". Both sections now reason by the
  closed list and its two named exceptions; the subject test and the broad
  occasion test are recorded as refuted, each with the approved case that
  refuted it, and neither is stated as a rule anywhere in the file. The
  backward-pass rows round one left stale — REQ-076 c5 and c6 ("its surface
  moves"), REQ-070 c2 ("three of the six"), BP-060 `resumeSubscription`
  ("contradicted by criterion 1"), `PORTAL_FEATURES`, BP-055 ("three of its
  members") — are corrected to match the "Resuming: removed from criterion 1"
  section the same file already carried.
- **Criterion 1 places the control on Settings** (the untestable criterion 5).
  "The screen where they looked for them" named no screen; the screen is
  derivable — REQ-076 c1 "Given a customer on Settings, when they open billing",
  REQ-070 c2, BP-060's "the Settings billing card is BP-001's surface", BUILD
  §4.7's Billing card — so criterion 1's first Given is now "a customer on
  Settings, when they open billing", and criterion 5's positive clause reads
  "Settings offers criterion 1's control in their place". A build offering the
  control only on a deep sub-page fails criterion 1.
- **Criterion 2 returns the customer to Settings** (the REQ-076 conflict). With
  the control homed on Settings, "the screen they left from" and REQ-076 c2's
  "return to Settings afterwards still signed in" coincide; criterion 2 now
  carries c2's destination verbatim and adds only cancelling to the acts. The
  rationale's list of contradicted REQ-076 criteria (1, 3, 5, 7) was right not
  to include c2 and stands.
- **The `rests-on` row rescoped to both legs BP-060 holds open** (the BP-060
  conflict). The row named `tax_id` as "the one leg this corpus has not
  verified"; BP-060 carries a second open row, the billing address invoices are
  sent to, which is another of criterion 1's five destinations. The row now
  names both, prices either refutation (REQ-076 criterion 9; REQ-076 criterion
  2) and stops restating `PORTAL_FEATURES` key by key (rules 2.4, 2.5).
  Disposition stays `open` — both legs are dischargeable by the first portal
  work order's validator (rule 2.3b), so `undischargeable` would be false.
- **Criterion 3 reaches a resume's payment** (the gap). BP-060's
  `resumeSubscription` "creates a new Stripe subscription against the existing
  customer"; nothing forbade taking that payment on a ReachKit-rendered form.
  Criterion 3's Given gains "or a cancelled customer resuming (REQ-076
  criterion 6)" and its Then is reworded so a resume charged to the card on
  file (nothing asked of the customer) passes and a resume needing a new card
  goes to Stripe's surface. Derived from the owner's "nothing we should build";
  the resume control and promise stay REQ-076 c6's, and the non-goal says so.
- **Criterion 6 covers a session refused for any reason** (the ambiguity).
  BP-060's `portalLink` refuses on `'no_customer' | 'vendor'`; the narrow
  reading covered only the second. The Given now reads "Stripe unreachable, or
  a session refused for any other reason", and because "try again" cannot clear
  the first ground the customer is also given one way to reach a person —
  REQ-024 c3 and c5's approved pattern. Rule 1.1; recorded in the evidence file.
- **Non-goals**: resuming names criterion 3's one addition; the hosting-notice
  line says criterion 4 names them only to place them; the refunds line reads
  "criterion 4 states only that ReachKit sends no mail on them"; the register
  line drops "origin test". Open question 2 gains one parenthesis so that
  approving criterion 4 as written does not rule it by default: an `account`
  mail after cancellation "would then [be named] as a further exception".

## Refused, and on what evidence

- Part of `REVIEW(untestable: criterion 4)` — the premise that a criterion is
  untestable if a silent build passes it. Evidence: constitution §8, "Mutation
  testing inside validation. A test that survives deletion of its feature is
  vacuous" — the feature here is the *absence* of a send, and a mutation adding
  one fails; `skills/prd-writing/SKILL.md`, "A criterion earns its place by what
  breaks for the user if it stops being true" — what breaks is a ReachKit
  receipt beside Stripe's. The part of the finding about Stripe's own mail was
  accepted and that half deleted.

## Not escalated, and why

- Which mails ReachKit may send about a payment: REQ-024 (approved) states
  them; REQ-064's non-goal (approved) states Stripe's side. Derived (rule 1.3).
- The screen the control sits on: REQ-076 c1, REQ-070 c2, BP-060 and BUILD
  §4.7 all say Settings. Derived (rule 1.3).
- The `rests-on` disposition, criterion 6's second ground and criterion 3's
  resume clause: parameters and wording, chosen and recorded (rule 1.1).

## What stands for the owner

- REQ-076 criterion 1's four Settings values — Settings reads Stripe and shows
  the next invoice date and the card, or shows the plan, the price and the
  control and nothing else. (Unchanged from round one.)
- The three statements at the moment of cancellation — stated on a ReachKit
  screen before the handoff, in an `account` mail afterwards (a further
  criterion 4 exception), or the BUILD §4.7 line goes. (Unchanged in substance;
  the criterion 4 consequence of the middle option is now named.)
