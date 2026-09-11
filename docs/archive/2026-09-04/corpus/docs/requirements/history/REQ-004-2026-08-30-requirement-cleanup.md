# REQ-004 — requirement cleanup, 2026-08-30 (free-funnel merge 4)

Merge decided by the owner's merge map. Count rule inapplicable: `blueprints/`
and `work-orders/` hold no artifact, so both counts are 0 — a tie the lower id
breaks in favour of REQ-004, the owner's survivor.

## What merged

| id | before | after |
|---|---|---|
| REQ-004 (survivor) | 5 criteria, `status: draft` | 12 criteria, `status: draft`, `supersedes: [REQ-005]` |
| REQ-005 | 7 criteria | `status: superseded`, retired in place |

12 in, 12 out. Nothing collapsed, nothing paraphrased. Grounds: REQ-005 is the
corpus-wide null-vs-zero law and it opens on the header REQ-004 owns — REQ-004
criteria 2 and 3 could not state themselves without citing REQ-005, and REQ-005
criteria 1, 2 and 4 could not state themselves without citing REQ-004's score.

## Title

Was: "The report opens with one score, its band, and the drivers behind it". Now:
"The report opens with one score, its band and its drivers — and what could not be
measured says so, while a measured zero stays a zero".

## REQ-005's four-way partition — intact and verbatim

| the case | survivor criterion | what it renders and stores |
|---|---|---|
| could not determine the input exists | 6 | "—" on every dependent driver; nulls only where a driver depended on it, so an input no driver depends on never withholds the score |
| read it and found none of what was counted | 7 | a measured 0 with its denominator, never "—" |
| storage | inside 6, 7, 8, 9 and 12 — "when the report renders **and the result is stored**" | the same partition binds what is recorded, not only what is shown |
| never attempted, the scan stopped early | 9 | "—", one written line saying the scan stopped early, never 0 |

No word of any of the four was changed except the citation repoints listed below.

## Criterion mapping — every criterion carried verbatim

| survivor | from | citation repoints inside the criterion |
|---|---|---|
| 1 | REQ-004 c1 | — |
| 2 | REQ-004 c2 | "(REQ-005)" → "(criterion 6)" |
| 3 | REQ-004 c3 | "(REQ-005)" → "(criteria 6 and 9)" |
| 4–5 | REQ-004 c4–c5 | — |
| 6 | REQ-005 c1 | — |
| 7 | REQ-005 c2 | "is REQ-009 criterion 3's and REQ-004's, not this requirement's" → "is REQ-009 criterion 3's and criteria 1 to 3's, not this criterion's"; "criterion 1" → "criterion 6" |
| 8 | REQ-005 c3 | — |
| 9 | REQ-005 c4 | "(REQ-015 criteria 6 and 8)" → "(REQ-003 criterion 11)" |
| 10–11 | REQ-005 c5–c6 | — |
| 12 | REQ-005 c7 | "(criterion 1)" → "(criterion 6)"; "(criterion 4)" → "(criterion 9)" |

## A dangling citation found and corrected

REQ-005 criterion 4 cited "REQ-015 criteria 6 and 8". REQ-015 had seven criteria
— **there was no criterion 8**, and the citation had been reading plausibly while
addressing nothing. Only the live half survives, repointed to REQ-003 criterion
11 (the spend ceiling). This is the failure mode rule 5.3 describes for line
numbers, reproduced with criterion numbers; a `/relink`-style check for
out-of-range criterion citations would catch the rest of the corpus's.

## Front-matter

- `depends-on`: REQ-005's `[REQ-004]` is a self-edge after the merge and was
  dropped; the survivor carries `[]`.
- `rests-on`: none on either.
- Priority: Must on both; survivor Must.

## Non-goals

Union. Two dispositions worth recording:

- REQ-005's "What a read access rule makes of the blocked-readers count and of
  the score — REQ-009 and REQ-004 hold those; this requirement holds only whether
  the result is a measured value or a '—'" was half disclaim ring: REQ-004 is now
  this requirement. Rewritten as a routing line that points outward to REQ-009
  and inward to criteria 1–3, keeping the pointer a reader needs and dropping the
  claim that this requirement does not own what it owns.
- "No estimated, interpolated, or last-known-good value…" repointed to criterion
  12.

T1 check: "No hiding of the whole report because one part failed" is the only
line a customer could notice the absence of, and criterion 11 states it as
behaviour already ("every part that was measured is shown in full and the report
is otherwise usable"). No T1 promotion in this merge.

## Open `REVIEW(...)` touching this requirement

None on either input. But REQ-003's surviving `REVIEW(gap)` names this
requirement's criterion 9 as the other half of its contradiction — a spend
ceiling reached with a score driver still outstanding. It is recorded there, not
duplicated here (rule 2.4).
