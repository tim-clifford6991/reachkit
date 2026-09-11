# REQ-098, REQ-099 — round-two review folded, 2026-09-02 (requirements-analyst)

Twenty-two `REVIEW(...)` lines were open — REQ-098 twelve, REQ-099 ten. None
remains in either file. Nineteen are fixed in the requirement and deleted; three
became, or were merged into, owner questions — one new question (REQ-099's
fourth) that both requirements rest on, and one existing question (REQ-098's
second) reshaped as the choice dependent on it. No line is routed as a seam: the
two conflicts the orchestrator named as candidates (BP-001, BP-061) closed once
the text that collided was removed rather than reworded, and neither pair of
artifacts needs the other to state itself. Rule 3.4's budget is spent; whatever
still divides author and reviewer is in the owner questions below. No status was
raised: both stay `draft`. JN-001 and JN-004 were not edited — no fix changed a
step either exercises; both were already `in-review`.

## REQ-098 — 8 criteria to 7, 12 review lines to 0, 3 owner questions, 1 new edge

- **Criterion 3's timing-and-allowance clause withdrawn** (three lines: the
  WO-127 conflict, the colon ambiguity, the untestable tolerance). Round one
  added it; round two showed it could not be stated testably, and the reason is
  that it protects nothing. REQ-020 criterion 4 is approved and requires the
  three answers to differ in words, so whoever submits an address already reads
  whether it has an account; post-submission parity is BP-032's mechanism with
  no customer promise under it (prd-writing's altitude bar). What the customer
  is promised stays: the three written answers, nothing revealed before a
  submission (REQ-020 criterion 5), abuse controls a declared non-goal.
  **Downstream impact, not fixed here:** WO-127's "neither latency nor wording
  distinguishes them" contradicts REQ-020 criterion 4 and WO-127's own three
  `lineKey`s — the planner's, via the backward pass. Recorded in the evidence
  file.
- **Criterion 4 admits the scan date** where criterion 5's first case holds; the
  closed figure list had no room for it.
- **Criterion 5 now cites REQ-099 criterion 8 as the one home of the
  example-figure rule** (two lines: the REQ-099 conflict, the untestable
  register). The register is RFC 2606's reserved names, a property of the string;
  "resolves to no real site" is withdrawn (`example.com` resolves). Placement and
  content of the example line are fixed in REQ-099 criterion 8, closing the
  proximity gap. `depends-on` gains REQ-099.
- **The REQ-093 criterion 4 conflict is the owner's**, not a wording fix: standing
  law 5 and REQ-093 criterion 4 admit no example as written, and whether one may
  stand on a public page is a public claim. It is asked once, as REQ-099's fourth
  open question; REQ-098's second question is reshaped as the dependent choice
  for this card — real scan (the pill goes) or declared example (only if the
  ruling admits one).
- **Criterion 1 neutral on redirect versus in-place** (the BP-001 conflict). The
  owner endorsed a screen with its own address; whether a signed-out `/app`
  request is redirected to it or shows it in place is structure and BP-001's.
  BP-001's route table gains the route on expansion — an addition, not a
  conflict. A non-goal records the boundary.
- **Criterion 8 deleted** (the BP-061 conflict and the gap). The "newest link
  works" promise is already homed at REQ-024 criterion 4 by WO-136's own
  test-plan reading — restating it was the second copy rule 2.4 forbids — and
  BP-061's one-live-token rule is the shape under that promise, not a promise of
  its own. What this screen says about the older link is criterion 7's.
- **Criterion 7's causes closed** (the "already used" ambiguity): expired; spent —
  used once, or replaced by a later link they asked for; or never issued. The
  parity clause now reads "whatever the reason", so BP-061's single
  `reason: 'spent'` is covered however it arose. JN-004's step already reads
  "the older of two they asked for"; no journey edit.
- **Non-goals**: "criteria 7 and 8" become criterion 7; which of several links
  works is named as REQ-024 criterion 4's; redirect-or-in-place is named as the
  blueprint's.

## REQ-099 — 8 criteria, 10 review lines to 0, 4 owner questions (1 new)

- **Criterion 1 measured at a floor viewport, 320 × 480 CSS px** (the untestable
  height). Chosen the way ADR-093 Decision 2 chose 320 — the conventional
  shortest CSS viewport, the smallest of the three common phone viewports — and
  recorded as a parameter with its reversal cost in the evidence file. Holds at
  the floor and every wider or taller viewport. ADR-093 Decision 6's suite gains
  the height; the architect's, recorded as downstream impact.
- **Decision 3 citation and "moved, dropped or made smaller" struck** (the
  ADR-093 conflict). Criterion 1 asks that the three items be present and
  readable; Decision 3's registered narrower state is how the design makes them
  so, not something the criterion forbids.
- **"The one of the four that yields" restated as a promise per band** (the
  non-goal conflict): at `compact` the three are within the viewport and the
  component follows directly below. That is what the customer is promised at a
  small screen — the criterion ADR-093's Consequences say the analyst owes —
  derived from Decision 4 and recorded in the evidence file; which registered
  variant renders at each band stays the design system's, and the non-goal now
  says so.
- **The rejected-submission state added to criterion 1** (the Given gap): after
  REQ-001 criterion 3 rejects a value, the line is beside the field and both are
  within the viewport. The criterion does not promise the tagline stays.
- **Criterion 5 conditioned on the video existing** (the c5/c6/c7 conflict): a
  page shipped before the asset exists meets criteria 6 and 7 and is not failed
  by criterion 5.
- **Criteria 3 and 5 mark their contingency on open question 1** (the REQ-001
  conflict) in their own text, so approving as written no longer rules the
  question for the bounded reading by default.
- **Criterion 4 binds the component's words to the product's own registered
  strings** (the c4/c8 gap) — derived from REQ-093 criterion 1 and the owner's
  "immediate feel for what the app is". Owed-strings item 10 narrowed to those
  strings; its "new copy on a public page" half is moot.
- **Criterion 8 disambiguated** (the "says so" ambiguity): the line says both
  that the figures are an example and that they measure no site, sits on the
  same component or frame, and renders wherever and whenever the figure does.
  Register fixed as RFC 2606's reserved names. This criterion is the one home;
  REQ-098 criterion 5 cites it.
- **The REQ-093 criterion 4 conflict is the new fourth owner question**, asked
  once for both requirements, decision-shaped: admit a declared example (REQ-093
  criterion 4 gains the exemption as its home) or refuse it (every figure is a
  stored measurement; both second branches go, and REQ-098's "+6 pts est." with
  them).
- **Owed strings gain item 12** (the owed-strings gap): the video's on-screen
  text and narration script. The non-goal on producing the video no longer reads
  as covering its words.

## Journeys

Neither JN-001 nor JN-004 was edited. JN-001 step 1 already reads "with a look at
the running product beside it, or just below on a small screen; watches the demo,
or reads the page unbroken where there is none", which criterion 1's per-band
promise and criterion 5's condition leave true. JN-004's dead-link step already
names "the older of two they asked for", which criterion 7's closed cause list
carries. Both stay `in-review`.

## What stands for the owner

- REQ-097: two questions, unchanged — REQ-076 criterion 1's four Settings values,
  and the three statements at the moment of cancellation.
- REQ-098: three — the score's name; what the card is once the example ruling is
  given; the six owed lines.
- REQ-099: four — REQ-001 criterion 1's reading; the video's home; the twelve
  owed strings; whether a declared example figure may stand on a public surface.
