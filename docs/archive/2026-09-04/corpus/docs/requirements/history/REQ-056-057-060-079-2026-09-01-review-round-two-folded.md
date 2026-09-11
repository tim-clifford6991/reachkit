# REQ-056, REQ-057, REQ-060, REQ-079 — round-two review folded, 2026-09-01 (requirements-analyst)

Seven `REVIEW(...)` lines were open across REQ-056 (two), REQ-057 (two),
REQ-060 (two) and REQ-079 (one). All seven are now deleted; none became a
`blocked-by` edge, because none of the seven was a contradiction with an
approved artifact — each was an ambiguity or a gap inside text this pass owns.
No status was raised: all four stay `in-review`. This was the second and last
review round (rule 3.4).

## Owner rulings applied

1. **The deletion mail is a count and a place, not a list.** REQ-079 criterion 6
   no longer names each post left in the customer's own WordPress. It says how
   many ReachKit created, that they stand there as drafts and are theirs to keep
   or remove, and the one place in their own WordPress that brings all of them
   up together — "never a list of them, whatever their number". The
   unreachable-destination arm is unchanged and still names each page: the
   ruling was about the WordPress population, and there is no "place in their
   own site" for a page at a destination ReachKit serves.
2. **The failed unpublish gets a retry on the page's record.** REQ-056 criterion
   16's fourth outcome (the site could not be reached) now carries an action on
   that page's own record to ask for the return to draft again, offered for as
   long as the page exists. Stated so that criterion 3's terminal `unpublished`
   is untouched: "asking leaves the page's state unchanged", and a successful
   ask replaces the line with the first outcome.

## REQ-056 — two lines folded, then deleted

Criterion 16 rewritten whole, not appended to: the four outcomes are now a
nested list rather than one 15-line sentence, and the criterion is the same
length as before while carrying one more promise.

- `REVIEW(ambiguity)` — "One written line on that page's own record in ReachKit,
  and on no other surface" is replaced by ADR-081 Decision 4's reading: the line
  "is rendered on ReachKit's own surface and no line is written into the
  customer's site". The absolute reading is explicitly withdrawn — "Where
  another requirement puts the same naming on another ReachKit surface, it names
  the same outcome as the line on this record and never a different one" — which
  un-forbids REQ-079 criteria 4 and 6 and fixes the only thing the absolute
  reading was protecting (two ReachKit surfaces disagreeing about one post).
- `REVIEW(gap)` — ruling 2, in the fourth outcome.

## REQ-057 — two lines folded, then deleted

- `REVIEW(ambiguity)` — exclusivity is **not** a promise; the three consequences
  bind on their own. "That mail is the only telling ReachKit sends the customer
  before that page publishes, so it is sent no later than…" becomes "That mail
  reaches the customer no later than…", with "Each of those three holds on its
  own, whether this mail is the first telling the customer has had about the
  page or a further one criterion 8 requires." Nothing that was required before
  is optional now; the false premise is gone and the three testable clauses are
  unconditional.
- `REVIEW(gap)` — criterion 9 no longer hangs its positive on a named date. "at
  the date and time it names the page will be delivered" becomes "the page will
  be delivered … and will be waiting there as a draft for them to publish — at
  the date and time it names, where that telling names one", with an explicit
  sentence binding it to the copilot arm that names no date, and a second
  negative: never "that anything ReachKit does will make it live".

## REQ-060 — two lines folded, then deleted; one criterion added

- `REVIEW(conflict with REQ-056 criterion 16)` — the waiting line now has an end:
  it stands "until the customer unpublishes it; from that moment … REQ-056
  criterion 16's line stands in the waiting line's place, and the two are never
  shown together."
- `REVIEW(untestable: criterion 2)` — "No mail is sent because of the delivery
  itself" (a cause) becomes an observation: "Completing the delivery sends the
  customer no mail of its own: the only mail a page bound to this destination
  occasions is the telling REQ-057 criteria 1, 7 and 8 require of it, and
  nothing further is sent when it arrives." At a zero window the test is now
  "exactly REQ-057's mail, and no second one", which discriminates.
- **New criterion 6** — the findability guarantee ruling 1 rests on: every page
  ReachKit created in the customer's WordPress comes up together in one list
  inside their own site, without opening posts one at a time or knowing a title,
  and their own posts are not in it; whatever makes this true is put on a post
  only by ReachKit creating it, never by a later write (so ADR-081 Decision 4 is
  untouched). The means — author, tag, category — is the architect's.
- One `rests-on` row added, disposition `open`: that every connectable WordPress
  install permits such an attribute under the application password the customer
  gave. Unverified in this corpus; if refuted for some installs, criterion 6
  cannot be met there and REQ-079 criterion 6's mail has no place to name.

## REQ-079 — one line folded, then deleted

- `REVIEW(gap)` — ruling 1, in criterion 6. `depends-on` gains REQ-060: the mail
  can name a place only because REQ-060 criterion 6 guarantees one exists.
- Criterion 4's in-app naming is unchanged. The ruling was about the mail; a
  list on a surface the customer can scroll and filter is not the failure the
  ruling names, and narrowing criterion 4 would change a promise nobody asked to
  change.

## Downstream

- REQ-060 criterion 6 is new behaviour with no blueprint: BP-048 today writes
  only ADR-080's marker, which is post meta and invisible to the customer in
  wp-admin. The visible attribute criterion 6 needs is a second thing, not the
  marker under a new name — ADR-080 decision 5 forbids changing the marker's
  shape without a fallback, and conflating the two re-arms that landmine.
  BP-048, BP-045 and ADR-081 are the architect's to re-read; a work order for
  the WordPress `deliver` path is affected.
- REQ-056 criterion 16's fourth outcome now carries an **action**, not only a
  line. ADR-081 Decision 3's `UnpublishResult` union still has no `unreachable`
  arm (round one already reported this); a retry of the write needs one, or an
  equivalent. WO-214 and WO-239 are affected.
- REQ-079 criterion 6 — WO-143 implements the delete-account mail; it was
  already due a re-extract after round one and the shape has now changed again
  (count + place, not a list).
- REQ-057 criteria 7 and 9 — BP-046 and WO-216 carry `wholeOfTheTelling`, whose
  premise this pass removes outright rather than narrows. The three behaviours
  the flag drives are unchanged; the name is now wrong twice over. WO-106 and
  BP-016/BP-053's `suppressible: false` are unaffected — criterion 7 still makes
  that send unsuppressible, and now does so without resting on exclusivity.
- REQ-060 criterion 2 — WO-237 quotes it verbatim; re-extract.

## Reported, not edited

- REQ-060 criterion 4 still reads "on that page's own record … and on no other
  surface", the phrasing struck from REQ-056 criterion 16 this pass. It is not
  ambiguous in the same way there — nothing else requires the no-SEO-plugin line
  on a second surface — so changing it would alter a promise no review line
  raised.
- REQ-079 criterion 6's unreachable-destination arm still says "names it and
  says what they must do about it". For a hosted destination the customer can do
  nothing after their account is deleted, and the population is unbounded in the
  same way the WordPress one was. Neither the count-and-place shape nor an
  action translates; only the owner can settle what that arm should say.
