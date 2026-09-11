# REQ-023 + REQ-022 — merged, criterion 4 moved to REQ-076, 2026-08-31 (merge pass, merge 2)

## Survivor by count

Grep of front-matter `satisfies:`/`implements:` lines in `blueprints/` and
`work-orders/`: **REQ-022 — 0. REQ-023 — 0.** Both directories hold no artifact
but their templates. A tie, so the survivor is the lower id: **REQ-022**. No
reason to overrule.

Why one requirement: `BUILD.md` §13 is a single ruling — what the price is, what
it includes, and what checkout records — and REQ-023 could not state its own
scope without deferring the amount to REQ-022 ("the amount payable is REQ-022's",
"The amount payable and whether tax is inside it — REQ-022 criteria 1 and 4 state
both"), while REQ-022 deferred the record to REQ-023 ("what is recorded for tax
purposes is REQ-023's"). Two files, one behaviour at checkout.

## What happened

| id | before | after |
|---|---|---|
| REQ-022 | 4 criteria, `status: draft`, title "€49 a month, VAT included, one price, nothing added" | 7 criteria, `status: draft`, `supersedes: [REQ-023]`, retitled "€49 a month, VAT included, one price, and what checkout records" |
| REQ-023 | 4 criteria, `status: draft` | `status: superseded`, retired in place, file kept |
| REQ-076 | 8 criteria | 9 criteria — REQ-023 c4 carried in verbatim |

Priority: all Must before and after. No priority change.

## Criterion provenance — every criterion carried verbatim

| destination | from | change |
|---|---|---|
| REQ-022 c1–c4 | REQ-022 c1–c4 | none |
| REQ-022 c5 | REQ-023 c1 | none |
| REQ-022 c6 | REQ-023 c2 | none |
| REQ-022 c7 | REQ-023 c3 | none |
| REQ-076 c9 | REQ-023 c4 | "on the surface REQ-076 criterion 2 sends them to" → "on the surface criterion 2 sends them to" — the citation is now internal |

Nothing collapsed: REQ-022 c4 (tax is inside the €49) and REQ-023 c2 (the VAT
number is recorded and reaches the invoice) are two facts, not one.

REQ-023 c4 went to REQ-076, not into the survivor, by owner ruling T3: the VAT
field lives in Stripe's customer portal, which REQ-076 criterion 2 owns. It was
appended as REQ-076's criterion 9 rather than inserted beside criterion 2, so
that no existing citation of REQ-076 criteria 3 to 8 anywhere in the corpus is
invalidated by a renumbering.

## The `rests-on` rows

REQ-023 carried two. They were split with the criteria they underpin:

- "Stripe Checkout collects and stores the billing-address country on every
  purchase without extra configuration (BUILD §13)", `open` — carried to REQ-022,
  which now holds criterion 5.
- The Stripe-portal tax-ID row (`open`) — **not** carried to REQ-022, because the
  criterion it underpins moved to REQ-076. REQ-076 already carries an equivalent
  row, `disposition: open`, naming the same gap: BUILD §13 says only "Portal for
  card/cancel" and puts "VAT ID field on" at Checkout, so nothing in the corpus
  establishes that Stripe's portal can edit a tax ID; the route was placed there
  by owner ruling from outside the corpus and the vendor capability is unverified
  in-corpus (rule 1.2). Per the brief, that existing row was left exactly as it
  stood rather than duplicated. REQ-023's own wording of the same claim is
  preserved in its retired file.

## Front-matter

- REQ-022 `depends-on`: [] ∪ [REQ-022, REQ-076] = [REQ-076], self-edge dropped.
  No cycle: REQ-076's transitive `depends-on` (REQ-057, REQ-059, REQ-064,
  REQ-065, REQ-078, and through them REQ-056, REQ-070) never reaches REQ-022.
- **One edge deliberately not added:** REQ-076 → REQ-022. REQ-076 criteria 2 and
  9 now cite REQ-022 criteria 5 and 6, which would ordinarily justify the edge,
  but REQ-022 → REQ-076 already exists and the pair would be a cycle. The
  citation stands; the edge does not.
- REQ-022 `supersedes: [REQ-023]`.

## Non-goals

Union of both lists, with three moves and no promotion:

- REQ-023's "The amount payable and whether tax is inside it — REQ-022 criteria 1
  and 4 state both" — dropped as the disclaim ring: it routed to criteria now in
  the same file.
- REQ-022's "Calculating, displaying or remitting VAT … what is recorded for tax
  purposes is REQ-023's" and REQ-023's "Calculating, charging, displaying or
  remitting VAT" — collapsed into one line whose tail now cites criteria 5 to 7
  instead of a superseded id.
- REQ-023's "Where the customer corrects the number … Criterion 4 states only
  that the correction is the customer's to make; it claims no surface of its own
  and adds no field to Settings" — the criterion it described has left the file,
  so the line is kept only as the plain routing of every billing control to
  REQ-076.
- Owner ruling T1, checked line by line: no unioned non-goal states a promise a
  customer would notice the absence of. The two candidates — "no country is
  refused" and "no registry check can block a purchase" — are already criteria 5
  and 7, not non-goals. No promotion was needed.

## Citations repointed

- `journeys/JN-002.md` step 1 `exercises` → `[REQ-021, REQ-020, REQ-022]`.
- `requirements/REQ-020.md` criterion 6: "REQ-023 criteria 1 and 2" → "REQ-022
  criteria 5 and 6".
- `requirements/REQ-076.md` criterion 2: "REQ-023 criteria 1 and 2" → "REQ-022
  criteria 5 and 6"; its tax non-goal now reads "Criteria 2 and 9".
- `requirements/REQ-025.md` ("REQ-022 criterion 2") and `requirements/REQ-021.md`
  ("REQ-022 criterion 1", "REQ-022 criterion 3") were checked and need no change:
  REQ-022 criteria 1 to 4 kept their numbers.

## Placement

REQ-023's only journey placement was JN-002 step 1, where REQ-022 already
stands, so the merged behaviour keeps its step. REQ-076 criterion 9 is exercised
wherever REQ-076 already is; adding a portal step to a journey for the VAT
correction alone was considered and rejected — it is one control inside the
billing surface a step already names.
