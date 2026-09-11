# REQ-008 — the rival-framing line added as criteria 9 and 10, 2026-08-31

Owner ruling R2, 2026-08-31: the free report does not size rivals — §6.4's
never-list forbids per-rival `ranked_keywords` on the free path, and sizing five
rivals (5 × `RANKED_RIVAL_ROWS` at 2.4¢) would consume the whole 12¢ `CAP_FREE`.
The only free rival signal is occupancy across the 12 SERPs, which measures
dominance in this market and not company size. The ruling replaces sizing with
framing: a large competitor appearing in these results is not a discouragement
but validation that the market has commercial weight, because companies of that
scale are competing for these searches — evidence the searches are worth
competing for. The customer's outcome is not forecast.

## What changed

| | before | after |
|---|---|---|
| `status` | `approved` | `in-review` — the owner accepted this cost in advance and will re-approve |
| criteria | 8 | 10 (criteria 9 and 10 added; 1–8 untouched, unrenumbered) |
| non-goals | 3 | 4 |
| rationale | no placement line, no framing clause | placement (JN-001 step 5) and the framing bound stated; `BUILD.md` §2.5 added to the source list |
| `registry/evidence/REQ-008.md` | one section (the locale line) | five sections; the R2 derivation, the §6.4/§6.1/§6.6 quotes, the §2.5 agreement, the one-home decision and the REQ-091 non-conflict |

No journey file was touched. JN-001 step 5 already `exercises: [REQ-008,
REQ-091]` and already names the rival contrast the new line sits with, so
placement was satisfied by an existing step and no approved journey dropped to
`in-review`.

REQ-006 was read and left unedited. Rule 2.4 puts the framing in one home, and
the occupancy signal it rests on is REQ-008's card; REQ-006 states no rival
contrast to frame and already carries 13 criteria against rule 2.1's ~12 soft
budget. No routing seam was added to either file in place of the second copy.

## Why the criterion is split in two

Criterion 9 is the promise (a line exists, where it sits, what it conveys).
Criterion 10 is the honesty bound, separated so a build that ships a revenue
promise fails a named criterion rather than half of a compound one. Criterion 10
bans: revenue, profit, traffic-value or money figures; any forecast of the
customer's outcome from entering the market; and any attribution of size,
funding, headcount, customer count or ranking count to a rival — the last being
R2 seen from the other side, since with `ranked_keywords` off the free path any
adjective of scale would be an invented measurement (rule 1.2).

## Rule 4.2 — one objection, recorded once

The owner's framing includes "The customer is not in them." That sentence is true
of the cold-start report the ruling was written against, and false of a report
where the customer appears in some of the 12 — which criterion 1 renders. Binding
it into a line that must hold on every report would ship a false statement to
warm-start customers, so criterion 9 binds only what is true of every report: that
these domains compete for the same 12 searches, and that their presence is
evidence those searches are worth competing for. The customer's own count is
already on the card (criterion 1) and reads against the rivals' without the line
asserting it. If the owner wants the absence clause said explicitly, it is a
conditional line — shown only when the customer's count is 0 — and that is a
criterion edit, not a copy change.

## Copy owed to the owner (constitution §1 — customer-visible strings)

One string: the framing line on the Google card. Criteria 9 and 10 fix that it
exists, that it sits with the rival comparison after the figures, what it must
convey and what it may not; the words are the owner's.
