# REQ-097, REQ-098, REQ-099 — round-one review folded, 2026-09-02 (requirements-analyst)

Thirty-nine `REVIEW(...)` lines were open — REQ-097 fourteen, REQ-098 twelve,
REQ-099 thirteen. None remains in any of the three files. One is refused with
evidence (REQ-098, BP-032's oracle scope); one is deferred by instruction
(REQ-098, `design/previews/app/src/app/idiom/copy.ts`, concurrent design work);
one became an owner question with a new `blocked-by` edge (REQ-099 / REQ-001).
No status was raised: all three stay `draft`. JN-001 and JN-004 were already
`in-review`, so no approval was reopened by the two journey edits below.

## REQ-097 — 6 criteria to 5, 14 review lines to 0, 2 owner questions

- **Criterion 5 deleted, folded into criterion 1.** Both it and criterion 4 split
  into an outcome on Stripe's surfaces — which this requirement's own non-goal
  puts out of scope — and a negative about ReachKit, so both passed on a product
  with no billing route. Criterion 1 now carries every control ban including the
  cancellation control, the confirmation step and the consequence screen;
  criterion 4 gains the positive consequence that criterion 1's control is
  offered where the customer looked.
- **Criterion 6 deleted outright.** It restated REQ-076 criteria 7 and 11 (rule
  2.4), named no mail kind, no stoppability and no moment, and asserted as settled
  the two facts open question 2 puts to the owner. REQ-076 criterion 11 keeps
  both notices; a non-goal now points at it.
- **One boundary rule, not two.** The old criteria 3 and 6 classified by two
  different tests that disagreed on REQ-076 criterion 3's access-end date.
  Criterion 3 now classifies by the mail's **subject** — the payment itself is
  Stripe's; the account or what ReachKit does for the customer is ReachKit's,
  whatever payment prompted it. That decides REQ-024 criterion 3 (ReachKit's) and
  REQ-076 criteria 3 and 11 (ReachKit's), the two cases that split the old tests.
  Derivation in `registry/evidence/REQ-097.md`.
- **Criterion 3's untestable clause struck.** "Every mail ReachKit sends is a kind
  REQ-064 admits" could not fail: the admitted set is open by construction and the
  rest tested a constant.
- **REQ-076 criterion 5 was mis-recorded as Untouched.** It is contradicted twice
  — the billing details, and the way to resume. Resuming is now named in criterion
  1's list; the evidence backward pass carries the correction and the rule 1.1
  derivation (the promise of REQ-076 criterion 6 is unchanged; only the surface
  moves).
- **New criterion 5**: what the customer gets when the one control cannot be
  produced. The product sells on "Cancel in one click" and criterion 1 permits no
  ReachKit fallback, so the failure had to be stated rather than left.
- **Criterion 2's start named.** "Every step from that control" had no antecedent;
  it is now the report's pricing card or any other price surface (REQ-021), which
  is also added to `depends-on`.
- **Mail-register attribution corrected and then removed.** The register is not
  REQ-064's — REQ-064's non-goal assigns it to the mail blueprint and BP-016
  decision 1 makes it a typed constant — and REQ-064 names eight, not nine; the
  ninth, `first-page-unavailable`, is BP-016 decision 2's. REQ-097 now states
  neither the count nor the list anywhere. The check itself lives once, in the
  evidence file.
- **The price, derived not asked.** Criterion 4 enumerated "those four values" over
  five things and dropped the price. It now names three, and a non-goal records
  that €49/mo is a public product fact (REQ-021, REQ-022 criterion 1), not a value
  Stripe holds about one customer. The reviewer marked this `owner: user`; it is
  derivable from approved artifacts, so it is derived (rule 1.3).
- **The `rests-on` gap is answered in the `rests-on` row, not as a criterion.** The
  row now names what a refutation costs — REQ-076 criteria 9 and 6 lose their
  surface — which is where rule 2.3 puts the reasoning for an assumption.
- **The backward pass listed no blueprint at all.** It now carries eight rows
  across BP-060 (`billingSummary`, `cancelSubscription`, `resumeSubscription`,
  `PORTAL_FEATURES`, and its note that the Settings billing card is BP-001's),
  BP-017 (`portalLink`, `users.vat_number`, `users.billing_country`), BP-055 (the
  `SettingsAction` tuple's `'invoices'`, `'cancel'`, `'resume'`) and BP-016
  (`MAIL_KINDS`). "No implementation exists to touch" is true of code and false of
  the graph.

## REQ-098 — 6 criteria to 8, 12 review lines to 0, 3 owner questions

- **Criteria 2 and 4 rekeyed from "the side" to "the screen."** On a one-column
  viewport there are no sides, and the old Given let an implementation satisfy
  criterion 4 vacuously by dropping the panel. A non-goal now states that both
  sets of strings are carried at every one of ADR-093's three bands.
- **Criterion 4's list closed for figures**, and its non-string items ("a domain",
  "a numeral", "a progress bar") separated from the verbatim strings.
- **Criterion 5 rewritten.** Both branches are now observable: branch one requires
  the domain and the scan date; branch two requires a reserved example domain that
  resolves to no real site plus a written line saying it is an example. A third
  clause forbids any identifiable customer's domain, score or band on a screen
  that renders with no session — derived from REQ-020 criterion 5, closing the
  leak the old wording permitted.
- **"+6 pts est." is the open question, not an omission.** An estimated gain is
  neither a stored measurement nor fiction, and REQ-004 criterion 12 forbids the
  first. Open question 2 is now decision-shaped: a real scan costs the pill; an
  example costs the transcribed domain and one more written line.
- **Criterion 3 — one finding refused, one accepted.** Accepted: the guard covered
  only the state before a submission. It now also fixes that the answer takes the
  same time and allows the same number of requests whichever address it was.
  **Refused (rule 4.2, stated once):** the finding's premise is that no observable
  difference may distinguish an address with an account from one without. REQ-020
  criterion 4 is approved and requires exactly that distinction — "no link is sent
  … one written line answers … that there is no ReachKit account for that
  address, with the way to buy". BP-032's sentence "a timing or wording difference
  is an account-existence oracle" is scoped, in its own paragraph, to the two
  **no-account** branches (`payment_held_account_opening` and `no_account`), and
  WO-127's assertion is over "the three branches … the same round trips". The
  wording distinction stands; the timing and rate-limit guarantee is what this
  requirement carries.
- **New criterion 7** — a dead link (expired, spent, unknown) lands on this screen
  with one line, indistinguishable across the three reasons. BP-061 states the
  behaviour (`redeemLink`, `lineKey: 'signin.link_dead'`); WO-136 pushed the
  sentence out of its own scope; no requirement owned it.
- **New criterion 8** — a newer request spends the older link (BP-061), so the
  person who pressed twice and opened the first mail is answered rather than left
  guessing. The old non-goal deferring these to nobody is replaced by one that
  keeps only expiry, request limits and abuse controls out of scope.
- **Criterion 2's destination endorsed, not asserted.** The transcription records
  only "the second half an accent link"; the landing page as the destination is
  this analyst's derivation under rule 1.1 — REQ-001 criterion 1 puts the only
  field that starts a free scan there — and it is recorded as such in the evidence
  file rather than presented as the owner's.
- **New open question 3**: the six written lines this screen owes, two of them
  already booked by WO-127 against BP-019's keys.
- **Evidence corrected**: `00-project.md` standing law 5 was quoted with bold
  added inside the quotation marks. It now carries the source's own emphasis and
  no other.
- **`design/previews/app/src/app/idiom/copy.ts` left alone**, per instruction: a
  design-guardian is writing it concurrently, so it is not evidence that the
  strings were already homed elsewhere. The evidence file records that the home of
  a copy string in this corpus is BP-019's registry and that the rule 2.4 question
  is for once both land.
- **The graph reach** replaces "No implementation exists to touch": BP-032,
  BP-061, BP-001 (whose public route table declares no sign-in route), BP-019,
  WO-127 and WO-136.

## REQ-099 — 7 criteria to 8, 13 review lines to 0, 3 owner questions, 1 new edge

- **`blocked-by: [REQ-001]` added, and the second rule-1.1 resolution withdrawn.**
  REQ-001 criterion 1's operative clause is "no other input control of any kind",
  with the dash-list as illustration. Whether the ban is bounded by that list or
  reaches every control on the page is not a parameter — it is whether "one field,
  one button" was promised about the scan form or the whole page — so it goes to
  the owner as question 1, with both readings stated in a line each and the
  consequence for BP-022 and BP-001 named.
- **Criterion 1 rewritten against ADR-093.** "On any device" becomes "320 CSS px
  and up", the floor Decision 2 chooses and the literal reading it refuses in
  terms. The four items are named as the tagline, the subline, and REQ-001's one
  text input **with** its submit control — the ambiguity about whether a stranger
  can type without scrolling is resolved in favour of the field being there — plus
  the product component. **The component is the item that yields at `compact`**,
  derived from Decision 3 (never shrink the type; render a different registered
  state) and Decision 4 (the value is rigid, the decoration is flexible).
  Downstream: ADR-093 Decision 6's suite renders five widths and asserts nothing
  about height, so it gains a height assertion — the architect's, recorded in the
  evidence file.
- **Criterion 3 given an observable.** "Brings the visitor to that one field" now
  means scrolled into view, cursor in it, no page load.
- **Criterion 5 given a failing case** — not a title card, a logo animation, a
  stock clip or a sequence of stills — the discrimination criterion 4 already had
  and it lacked.
- **Criterion 7's Given repaired.** "The page below the video" had no referent when
  the video was never produced. It is now "the page below the first screen", the
  order holds at all three bands, and the video's position within that order is
  stated for both cases. Criterion 6 gains "never produced" and the written line
  that stands in the video's place.
- **New criterion 8** — every number, score, band word, domain or brand name inside
  the product component or the video either traces to a stored measurement with
  its scan date (REQ-093 criterion 4, `00-project.md` standing law 5) or is a
  declared example on a reserved domain. The old criterion 4 forbade only figures
  "about the visitor's own site", which left invented scores about someone else's
  — the false-public-claim failure §8 names. Publisher of record derived in the
  evidence file: `BUILD.md` §14 point 6 assigns it for a customer's own domain;
  the landing page is ReachKit's own, so ReachKit is.
- **The REQ-093-reaches-video question withdrawn rather than asked.** REQ-093
  criterion 1 binds "every text the product renders or sends, on every surface it
  speaks on … including surfaces added after this requirement" — captions,
  on-screen text and narration are inside it. REQ-093 stays the single home; the
  non-goal names the reach and REQ-099 states no criterion of its own (rule 2.4).
  The evidence file's "itself unruled" sentence is withdrawn.
- **Owed strings extended from 8 items to 11**: the repeated call-to-action labels
  (criterion 3), the line where the video will not play (criterion 6), the
  interface copy the product component carries onto a public page, and the
  example line criterion 8's second branch needs.
- **The rationale no longer argues.** The whole rule-1.1 argument moved, in full,
  to `registry/evidence/REQ-099.md` (rule 2.1, rule 2.4); the rationale cites it,
  as REQ-098's does.
- **Title changed**: "above the fold" → "the first screen", since the phrase was
  the untestable one.

## Journeys

- **JN-001 step 1** reworded so the step stays true at `compact`, where the
  product component sits below the first screen, and where no video exists.
- **JN-004 gains one step** for REQ-098 criteria 7 and 8 — the customer who clicks
  a link that no longer works (rule 5.7).

Both journeys were already `in-review`. No journey approval was reopened.
