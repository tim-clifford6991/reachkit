# REQ-002 — requirement cleanup, 2026-08-30 (free-funnel merge 3)

Merge decided by the owner's merge map. Count rule inapplicable: `blueprints/`
and `work-orders/` hold no artifact, so no front-matter `satisfies:`/
`implements:` line names REQ-002 or REQ-014 — both counts 0, a tie broken by the
lower id, which is REQ-002. That tie-break also settles the REQ-002 question
below.

## What merged

| id | before | after |
|---|---|---|
| REQ-002 (survivor) | 9 criteria, `status: draft` | 10 criteria, `status: draft`, `supersedes: [REQ-014]` — criteria 1–5 and 9 left for REQ-001 in merge 1, criteria 6–8 stayed and were renumbered 1–3 |
| REQ-014 | 7 criteria, 1 open `REVIEW(...)` | `status: superseded`, retired in place |

3 kept + 7 absorbed = 10. Nothing collapsed, nothing paraphrased. Grounds: one
behaviour — correction and removal are two dispositions of one proof of control,
which is what JN-006's own body says ("Correction and removal are the two
dispositions of one authority, bought by the single proof of control in step 3").

## The REQ-002 decision

REQ-002 was split across merges 1 and 3, and the map required it to end either
surviving one of them with the other half moved out, or fully consumed. **It
survives merge 3**, holding proof of control, correction and removal; its
criteria 1–5 and 9 moved to REQ-001. Reasoning:

- The count rule's tie-break (both counts 0, lower id wins) picks REQ-002 over
  REQ-014 for merge 3's survivor. Consuming REQ-002 entirely would have made
  REQ-014 the survivor against that rule.
- REQ-002 is the id the rest of the corpus already cites for proof of control —
  REQ-071, REQ-080 and REQ-059 each cite "REQ-002 criterion 7's proof". Those
  three citations survive the merge as criterion-number repoints; the other
  choice would have rewritten all three to a new id for no gain.
- Criterion 9 (permanence of a stored report) went to REQ-001 rather than staying
  here, though the map assigned only criteria 1–5 and 6–8: it is a promise about
  what the *address* serves on a later visit, which is REQ-001's behaviour and
  sits directly beside REQ-012's return-visit criteria. Leaving it here would
  have left REQ-002 holding one orphaned criterion of merge 1's behaviour — the
  outcome the map forbids.

No criterion of REQ-002 is orphaned: 1–5 and 9 are REQ-001 criteria 3–8 and 11,
6–8 are this file's criteria 1–3.

## Title

Was: "The free report is a public, shareable address that needs no account" — a
title for the criteria that left. Now: "Proof of control lets a domain's owner
correct the report's market or have the report taken down".

## Criterion mapping — every criterion carried verbatim

| survivor | from | citation repoints inside the criterion |
|---|---|---|
| 1 | REQ-002 c6 | "(REQ-014)" → "(criterion 9)"; "criterion 7's link" → "criterion 2's link" |
| 2 | REQ-002 c7 | "(REQ-014 criterion 6)" → "(criterion 9)"; "criterion 6 named" → "criterion 1 named" (×2); "(REQ-014 criterion 1)" → "(criterion 4)" |
| 3 | REQ-002 c8 | "criterion 7" → "criterion 2" (×2) |
| 4 | REQ-014 c1 | "(criterion 6)" → "(criterion 9)"; "REQ-002 criteria 6 and 7 name" → "criteria 1 and 2 name" |
| 5 | REQ-014 c2 | — |
| 6 | REQ-014 c3 | — |
| 7 | REQ-014 c4 | "(REQ-012 criterion 1)" → "(REQ-001 criterion 12)" |
| 8 | REQ-014 c5 | — |
| 9 | REQ-014 c6 | "REQ-002 criterion 7 names" → "criterion 2 names" |
| 10 | REQ-014 c7 | "(REQ-012 criterion 4)" → "(REQ-001 criterion 15)"; "(REQ-012 criterion 3)" → "(REQ-001 criterion 14)"; "(criterion 6)" → "(criterion 9)" |

## The `REVIEW(conflict with REQ-026)` line — deleted as stale

Verbatim, as REQ-014 carried it:

> - [ ] REVIEW(conflict with REQ-026): criterion 6 says a category set by a proven
>       owner "holds for the domain — every later scan of it is measured against
>       that category", unqualified. REQ-026 c2 and c4 say the market the founder
>       confirms at setup is the one the product uses from then on and the one the
>       deep pass runs against, and REQ-071 c1 lets it be replaced in Settings —
>       neither requiring proof of control. For a domain whose owner set a category
>       on the free path, the build cannot tell which of the two governs a paid
>       scan.

The merge does not close it — REQ-026 is in another cluster, as the map warned.
An earlier edit to REQ-014 already did. The finding quotes criterion 6 as
unqualified ("every later scan of it"); the text it now carries, and that this
survivor carries verbatim as criterion 9, reads "every later **free** scan of it"
and continues "It binds the free path and nothing else: the market a paying
account is measured in is the one its founder confirms at setup (REQ-026) and may
replace afterwards (REQ-071 criterion 1), which no proof of control over a public
report displaces or is displaced by." That names REQ-026 and REQ-071 as governing
the paid path outright, which is the answer the finding asked for. I checked
REQ-026 criteria 2 and 4 and REQ-071 criterion 1 against it: neither is
contradicted, because neither speaks to the free path. A finding whose quoted
premise no longer exists in the text is stale, and carrying it forward would keep
manufacturing the round it already survived.

## Front-matter

- `depends-on`: REQ-002 [] ∪ REQ-014 [REQ-007] = [REQ-006] — REQ-007 is
  superseded by REQ-006 in merge 5, so the edge is written to its survivor.
- No reciprocal `depends-on: [REQ-001]` here, though criteria 7 and 10 cite
  REQ-001: REQ-001 already declares `depends-on: [REQ-002]`, and both directions
  would make a cycle in a derived graph (§7).
- Priority: REQ-002 Must, REQ-014 Should → survivor **Must**. This raises
  REQ-014's seven criteria from Should to Must. It is the honest reading — the
  correction path is the only defence a non-customer has against a wrong public
  verdict about their business, and JN-006 has no outcome without it — but it is
  a change of commitment the merge causes, not one the map asked for, and the
  owner should overrule it if they meant the correction path to stay deferrable.

## Non-goals

Union. REQ-002's three proof/removal lines were kept here and repointed to
criteria 2 and 3; its other four went to REQ-001 in merge 1. REQ-014's four kept
as they stood, with "criterion 7's promise" → "criterion 10's promise". No
disclaim-ring line survived: every non-goal that pointed at REQ-014 or at
REQ-002's own removal criteria now points at a criterion inside this file.

T1 check: "No repeated or unlimited corrections…" is stated as criterion 8, and
"No ban on a domain its owner has not asked to remove" as criterion 3. Nothing
promise-bearing is left on the list. No T1 promotion in this merge.
