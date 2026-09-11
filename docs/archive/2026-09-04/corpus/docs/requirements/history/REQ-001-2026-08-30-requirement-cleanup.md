# REQ-001 — requirement cleanup, 2026-08-30 (free-funnel merge 1)

Merge decided by the owner's merge map, not by the survivor-count rule:
`blueprints/` and `work-orders/` hold no artifact at all — no front-matter
`satisfies:`/`implements:` line names REQ-001, REQ-002 or REQ-012, so all three
counts are 0. Under the count rule that is a three-way tie decided by the lower
id, which selects REQ-001; the owner's map selects the same survivor.

## What merged

| id | before | after |
|---|---|---|
| REQ-001 (survivor) | 5 criteria, `status: draft` | 18 criteria, `status: draft`, `supersedes: [REQ-012]` |
| REQ-002 | 9 criteria | 10 criteria — criteria 1–5 and 9 moved out to REQ-001; survives merge 3 holding the proof-of-control behaviour |
| REQ-012 | 7 criteria | `status: superseded`, retired in place |

5 + 6 + 7 = 18 criteria in, 18 out. No two criteria collapsed; nothing was
paraphrased. Grounds: one behaviour — what `/scan/{domain}` serves, to whom, and
when a scan starts.

## Title

Was: "One field on the landing page starts a free scan". Now: "One field starts a
free scan, and `/scan/{domain}` is the one public address that serves it" — the
survivor is the address's state machine, not the landing field alone.

## Criterion mapping — every criterion carried verbatim

| survivor | from | citation repoints inside the criterion |
|---|---|---|
| 1 | REQ-001 c1 | — |
| 2 | REQ-001 c2 | — |
| 3 | REQ-001 c3 | — |
| 4 | REQ-002 c4 | — |
| 5 | REQ-002 c3 | trailing routing sentence deleted (below) |
| 6 | REQ-002 c1 | — |
| 7 | REQ-002 c2 | — |
| 8 | REQ-002 c5 | — |
| 9 | REQ-001 c4 | "REQ-012's" → "criteria 12 to 16's"; "REQ-015's" → "REQ-003's"; "REQ-002's" unchanged (REQ-002 survives merge 3 holding removal) |
| 10 | REQ-001 c5 | "criterion 4" → "criterion 9" |
| 11 | REQ-002 c9 | "criterion 7" → "REQ-002 criterion 2"; "REQ-012 criteria 3 and 4" → "criteria 14 and 15" |
| 12 | REQ-012 c1 | "(REQ-005)" → "(REQ-004)" |
| 13 | REQ-012 c2 | — |
| 14 | REQ-012 c3 | "(REQ-005)" → "(REQ-004)"; "REQ-003 criterion 5, \"when it reaches 90 seconds, then measuring stops\"" → "REQ-003 criterion 5"; "REQ-015 criterion 6, \"reaches its spend ceiling while it is running\"" → "REQ-003 criterion 11" |
| 15 | REQ-012 c4 | — |
| 16 | REQ-012 c5 | — |
| 17 | REQ-012 c6 | — |
| 18 | REQ-012 c7 | "REQ-002 criterion 8, \"shows the removed report to nobody and starts no scan\"" → "REQ-002 criterion 3"; "criteria 1 to 6" → "criteria 12 to 17" |

Two verbatim quotations of sibling prose (in criteria 14 and 18) were converted
to bare citations under the corpus ruling that siblings are cited by ID and
criterion number.

## The one sentence deleted, verbatim

From REQ-002 c3, now survivor criterion 5:

> Which of the three a given visitor gets, and whether a scan starts, is
> REQ-001, REQ-012 and REQ-015's, not this requirement's.

Its whole content was routing, and two of the three routes (REQ-001, REQ-012)
now name this same requirement — after the merge the sentence asserts that this
requirement does not own what it now owns. Deleting it loses no promise: the
promise is the first sentence of criterion 5, carried verbatim. The third route
(REQ-015 → REQ-003) survives as the last non-goal.

## The unowned gap the owner named

"A first visit to a shared or typed report address for an unscanned domain has no
owner, because REQ-001's Given is a landing-field submission." That is no longer
true of the text as it stood: REQ-001 c4 already read "when its report address is
first reached — by a submission on the landing page, or by opening that address
directly, whether the visitor typed it by hand or followed a link somebody
shared". The gap was closed by an earlier edit, not by this merge; the criterion
is carried verbatim as survivor criterion 9 and the rationale now says in prose
that this requirement owns that first visit, so the ownership is stated on the
survivor rather than inferable from a Given.

## Front-matter

- `depends-on`: REQ-001 [] ∪ REQ-012 [REQ-002] = [REQ-002]. REQ-002 survives
  merge 3, so the edge is live, not a self-edge.
- REQ-002 does **not** carry a reciprocal `depends-on: [REQ-001]` even though its
  criteria cite REQ-001 criteria 12, 14 and 15: the two requirements cite each
  other, and one direction had to be dropped to avoid a cycle in a derived graph
  (§7, no circular dependencies). REQ-001 → REQ-002 was kept because REQ-001
  carries three citations of REQ-002 against REQ-002's two of REQ-001.
- `rests-on`: none on any of the three.
- Priority: Must on all three inputs; survivor Must.

## Non-goals

Union of the three lists, with these dispositions:

- REQ-002's "No ban on a domain its owner has not asked to remove…", "No second
  proof of control elsewhere in the product…" and "Which mailbox at a domain
  criterion 7's link is sent to…" moved to REQ-002, whose behaviour they bound.
- REQ-002's "The exhaustive mapping of every state a report address can be in…"
  was kept and repointed: REQ-001 and REQ-012 are now this requirement (cited as
  criteria 5, 9 and 12–18), REQ-015 is REQ-003.
- REQ-001's "the market is derived and corrected on the report itself (REQ-014)"
  repointed to REQ-002.
- T1 check: no line on any of the three lists carries a promise a customer would
  notice the absence of. Every one either points at a criterion in the same file
  (permanence → 11, no account before a report → 10) or excludes scope with no
  customer-visible consequence (no stale-report notification, no report history,
  no branding of a shared report). No T1 promotion in this merge.

## Rule 4.2 — what I think is wrong

18 criteria is past rule 2.1's one page, and past the 3–5 the prd-writing skill
calls one behaviour's usual weight. The merge is right — these really are one
state machine, and the seams between them were manufacturing findings — but the
survivor is now the largest requirement in the corpus. If a later pass wants it
smaller, the cut that does not re-open a seam is criteria 12–18 (what a *stored*
report does on a return visit) against 1–11 (what the address does before one
exists); that is the same cut this merge just closed, so it should not be made
without a reason better than length.
