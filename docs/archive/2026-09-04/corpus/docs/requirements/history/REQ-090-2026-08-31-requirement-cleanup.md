# REQ-090 + REQ-021 — merged, 2026-08-31 (merge pass, merge 1)

## Survivor by count

Grep of front-matter `satisfies:`/`implements:` lines in `blueprints/` and
`work-orders/`: **REQ-021 — 0. REQ-090 — 0.** Both directories hold no artifact
but their templates. A tie, so the survivor is the lower id: **REQ-021**. No
reason found to overrule — neither id is named by any downstream artifact, and
REQ-021 already carried the `rests-on` row the merged behaviour needs.

Why one requirement: neither file could state itself without naming the other.
REQ-021 criterion 6 defined the price surface's terms as "the same terms the
offer at the end of a report states (REQ-090 criterion 2)"; REQ-090 criterion 3
defined a replaced address as being "on the same terms as an address given with
no report behind the purchase (REQ-021 criteria 4 and 5)"; REQ-021 criterion 3
and REQ-090 criterion 4 each ended by citing the other for the same fact. That is
the merge test in `skills/prd-writing/SKILL.md`, and the "nothing measured for
the purchased domain" fact was being restated across five files as a result.

## What happened

| id | before | after |
|---|---|---|
| REQ-021 | 7 criteria, `status: draft`, title "Buying with no report behind the purchase" | 12 criteria, `status: draft`, `supersedes: [REQ-090]`, retitled "Where the offer lives, what a purchase carries into setup, and an account with nothing measured yet" |
| REQ-090 | 5 criteria, `status: draft` | `status: superseded`, retired in place, file kept |

Priority: both were Must; the survivor is Must. No priority change.

## Criterion provenance — every criterion carried verbatim

| survivor | from | change |
|---|---|---|
| 1 | REQ-090 c1 | none |
| 2 | REQ-090 c2 | none |
| 3 | REQ-090 c5 | none |
| 4 | REQ-021 c6 | "(REQ-090 criterion 2)" → "(criterion 2)" |
| 5 | REQ-021 c1 | none |
| 6 | REQ-090 c3 | "(REQ-021 criteria 4 and 5)" → "(criteria 8 and 9)" |
| 7 | REQ-021 c2 | none |
| 8 | REQ-021 c4 | none |
| 9 | REQ-021 c5 | none |
| 10 | REQ-021 c7 | "(criterion 5)" → "(criterion 9)" |
| 11 | REQ-021 c3 | none |
| 12 | REQ-090 c4 | one trailing clause dropped — see below |

Nothing was reworded. The only edits are the citation repoints the renumbering
forces, and one deletion, recorded here in full.

### The one deletion — REQ-090 criterion 4's trailing clause

REQ-090 criterion 4 ended:

> … and the account stands as one with nothing measured yet; what is offered from
> the market they state themselves, suggested rivals among it, is not a
> measurement of their site and remains available to them (REQ-021 criterion 3).

The clause after the semicolon is a restatement of REQ-021 criterion 3's own
closing clause, which now sits four criteria above it as survivor criterion 11:
"what is offered from the market they stated — suggested rivals among it — is not
a measurement of their site and remains available (REQ-027 criterion 1)". With
both in one file it is a pure routing seam and one of the nine restatements this
merge exists to remove; it is dropped from the criterion and preserved verbatim
here. The criterion's own promise — that the replaced domain's measurements are
not this account's — is untouched.

## Non-goals

Union of both lists, with three moves:

- REQ-090's "An offer presented on a report whose scan has not finished
  (criterion 5)" — dropped. It disclaimed a fact that is now survivor criterion 3
  in the same file; nothing is lost (owner ruling T1: no promise lives only in
  `## Non-goals`, and this one is a criterion).
- REQ-090's "the pre-measurement state is REQ-021 criterion 3's" half of its
  setup-card non-goal — dropped as the disclaim ring: it routed to a criterion
  now inside this file. The REQ-026 half is kept.
- REQ-021's and REQ-090's separate "second plan, tier, trial or discount"
  non-goals — collapsed into one line covering both surfaces.

All other non-goals carried, with their `criterion N` references repointed to the
new numbering.

## Front-matter

- `depends-on`: [REQ-020, REQ-025, REQ-070, REQ-076] ∪ [REQ-001, REQ-021,
  REQ-022, REQ-025, REQ-026] = [REQ-001, REQ-020, REQ-022, REQ-025, REQ-026,
  REQ-070, REQ-076]. The self-edge REQ-021 was dropped. No cycle was created:
  none of REQ-001, REQ-020, REQ-022, REQ-025, REQ-026, REQ-070, REQ-076 reaches
  REQ-021 through its own `depends-on` (checked transitively).
- `rests-on`: REQ-021's single open row carried unchanged; REQ-090 had none.
- `supersedes: [REQ-090]`.

## Citations repointed

- `journeys/JN-002.md` step 1 `exercises` → `[REQ-021, REQ-020, REQ-022,
  REQ-023]`; step 4 → `[REQ-021]`; step 5 → `[REQ-026, REQ-021]`.
- `journeys/JN-002.md` open question: "REQ-021 criteria 5 and 7" → "criteria 9
  and 10". The `REVIEW(gap)` itself stands — the merge did not close it.
- `requirements/REQ-025.md` rationale and criterion 1: REQ-090 → REQ-021,
  "criterion 3" → "criterion 6", "REQ-021 criterion 2" → "criterion 7".
- `requirements/REQ-026.md` rationale ("REQ-021 criterion 3" → "criterion 11"),
  criterion 3 ("REQ-090 criterion 4" → "REQ-021 criterion 12"), criterion 6
  ("REQ-090 criterion 3" → "REQ-021 criterion 6").
- `requirements/REQ-027.md` criterion 1 and its open question: REQ-090 criterion
  4 → REQ-021 criterion 12. Criterion 1's verbatim quotation of REQ-090 was
  converted to a bare citation, per the corpus ruling against quoting sibling
  prose.
- `requirements/REQ-071.md` criterion 6: "REQ-021 criterion 5" → "criterion 9".
- `requirements/REQ-080.md` (already `status: superseded`) cites REQ-021
  criterion 5 and was **not** edited: it is retired in place and its citations
  are frozen as the record of what it said.
