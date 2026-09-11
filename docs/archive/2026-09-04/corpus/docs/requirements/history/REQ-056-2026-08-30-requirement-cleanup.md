# REQ-056 — requirement cleanup, 2026-08-30 (Merge C)

Merge decided by the owner, not by the survivor-count rule: `blueprints/` and
`work-orders/` carry no front-matter `satisfies:`/`implements:` line naming
REQ-056 or REQ-058 — both counts are 0, so the count rule was inapplicable and
the owner's map decided the survivor.

## What merged

| id | before | after |
|---|---|---|
| REQ-056 (survivor) | 7 criteria, `status: draft` | 14 criteria, `status: draft`, `supersedes: [REQ-058]` |
| REQ-058 | 6 criteria | `status: superseded`, retired in place |

13 criteria in, 14 out — one criterion was added by a T1 promotion (below); no
two criteria collapsed. Grounds recorded by the owner: one behaviour.

## Title

Was: "A page moves through defined publish states, and a retry never publishes
twice". Now: "A page moves through defined publish states, a retry never
publishes twice, and stopping is instant" (the owner's proposal, unchanged).

## Criterion mapping — every criterion carried verbatim

| survivor | from |
|---|---|
| 1–3 | REQ-056 c1–c3, unchanged |
| 4 | REQ-056 c4 (cross-reference "(REQ-058 criterion 3)" → "(criterion 11)") |
| 5–7 | REQ-056 c5–c7, unchanged |
| 8 | REQ-058 c1 |
| 9 | REQ-058 c2 (forward reference "criteria 3 and 4" → "criteria 11 and 12") |
| 10 | **new** — T1 promotion, see below |
| 11 | REQ-058 c3 ("criterion 5" → "criterion 13"; "(REQ-056 criterion 4)" → "(criterion 4)") |
| 12 | REQ-058 c4 ("REQ-056 criterion 6" → "criterion 6") |
| 13 | REQ-058 c5 ("ceilings in criterion 1" → "criterion 8") |
| 14 | REQ-058 c6 |

## The T1 promotion (criterion 10) — the disclaim ring this merge closes

Three non-goals pointed in a circle and left one promise homeless:

- REQ-070's non-goal: "What switching publishing off does to pages already in
  flight, and how quickly it takes effect — REQ-058's."
- REQ-079's non-goal: "What switching publishing off does to pages already in
  flight, and how quickly — REQ-058's."
- REQ-058's own non-goal, pointing back: "Which state a held page occupies while
  publishing is off, and the transitions open to it — REQ-056; criteria 3 and 4
  here fix only that no attempt starts, that nothing is dropped, and that the
  customer is told what the one attempt in flight did."

Nothing derives a test from a non-goal (ruling T1), so the merge is where the
promise lands. REQ-058's non-goal died as a disclaim-ring line and its content
became survivor criterion 10: a page held by the switch stays in the state it
holds, the move to `publishing` is not taken for it, and it is never skipped,
discarded or moved to `needs_attention` on account of publishing being off.
REQ-070's and REQ-079's non-goals now cite REQ-056 criteria 9 to 13 rather than a
requirement that did not carry the promise.

Ruling T2 was checked against this merge's stop behaviour and needed no new text:
a day emptied because the customer switched publishing off is already covered by
REQ-043 criterion 4 ("a change the customer saved that holds pages back … that
line says which cause emptied it"), and REQ-043 criterion 3 already bars any
other cause from wearing the exhausted-supply line. Restating either here would
have been the second copy rule 2.4 forbids.

## Non-goals

Unioned; internal criterion references renumbered ("criterion 1" → "criterion 8",
"criterion 5" → "criterion 13"). Two lines changed beyond renumbering:

- REQ-056's "Scheduling rules and limits — those live in REQ-057 and REQ-058" was
  half disclaim-ring: the limits half is now criterion 8 of this requirement. It
  reads "When a page is published, the veto window and the publish time —
  REQ-057's; criterion 8's ceilings hold whatever those say."
- REQ-058's "Which state a held page occupies while publishing is off" — dropped,
  promoted (above).

## Front-matter

- `depends-on`: REQ-056 carried none; REQ-058 carried [REQ-057, REQ-070]. The
  union would have been [REQ-057, REQ-070], but REQ-057's own `depends-on` names
  REQ-056, so carrying REQ-057 here would have created the circular dependency
  §7 forbids — the merge's equivalent of a self-edge. REQ-057 is dropped and the
  edge keeps its existing direction, REQ-057 → REQ-056; no surviving criterion
  cites REQ-057. Result: `depends-on: [REQ-070]`, which criterion 9 uses.
- `rests-on`: neither requirement carried one. Criterion 8 counts "in the time
  zone the customer set" without an assumption row; that was true of REQ-058
  before the merge and is left as it stood rather than invented here.

## Evidence displaced

The inline `BUILD.md` §9, §14.7 and §4.6 quotations from both rationales moved to
`registry/evidence/REQ-056.md`, cited once from the rewritten rationale (rule
2.1). The state names themselves stay in criterion 1 — they are the
customer-visible contract, not evidence.

## Citations repointed (8 files)

- `journeys/JN-003.md` step 6 `exercises`: [REQ-057, REQ-058, REQ-056] →
  [REQ-057, REQ-056]. Step 7 already named REQ-056 only. Journey is
  `status: draft`, so no approval drop.
- `requirements/REQ-057.md` non-goal: "REQ-058" → "REQ-056 criterion 8".
- `requirements/REQ-070.md` non-goal: "REQ-058's" → "REQ-056 criteria 9 to 13".
- `requirements/REQ-073.md` two non-goals: "behaving as REQ-058 describes" →
  "behaving as REQ-056 criteria 9 to 14 describe"; "REQ-058 criterion 1" →
  "REQ-056 criterion 8". The verbatim quotation of REQ-070 criterion 1 in the
  first was converted to a citation under the corpus ruling.
- `requirements/REQ-074.md` non-goal: "(REQ-058)" → "(REQ-056 criteria 8 and
  13)".
- `requirements/REQ-079.md` non-goal: "REQ-058's" → "REQ-056 criteria 9 to 13".
- `requirements/REQ-092.md`: `depends-on` REQ-058 → REQ-056; criterion 5's
  "REQ-058 criterion 1" → "REQ-056 criterion 8".
- Unchanged because their criterion numbers did not move: REQ-043 (REQ-056
  criterion 1), REQ-053 (REQ-056 criterion 2), REQ-057 (REQ-056 criterion 7),
  REQ-074 criterion 5 (REQ-056 criterion 4), REQ-059, REQ-060, REQ-062.

## Anchors

No `Implemented by:` / `Pinned by:` lines existed on either. No non-superseded
blueprint satisfies REQ-056 — no blueprint yet, anchors deferred to
`/expand-requirement`.

## REVIEW lines

Neither requirement carried a `REVIEW(...)` line, so none died and none survived
here. The disclaim ring closed by criterion 10 had never been raised as one.
