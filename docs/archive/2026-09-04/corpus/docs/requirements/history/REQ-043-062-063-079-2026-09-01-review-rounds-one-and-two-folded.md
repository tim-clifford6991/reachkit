# REQ-043, REQ-062, REQ-063, REQ-079 and JN-003 — review rounds one and two folded, 2026-09-01 (requirements-analyst)

Rule 2.1 puts a requirement's changelog here. This entry is owed for two folds,
not one: the sibling set (REQ-056, REQ-057, REQ-060, REQ-079) has entries for
both of its rounds and these five artifacts had none for either.

## Round one — what is recoverable, and what is not

**No record of round one's findings on these five survives.** The `REVIEW(...)`
lines it answered were deleted when it folded them (rule 2.1) and no history
entry was written, so the questions it was answering cannot be reconstructed
from the corpus without inventing them (rule 1.2). What is recoverable is
recorded here and nothing more:

- The initial ADR-084 fold on all seven requirements is in
  `REQ-043-056-057-060-062-063-079-2026-09-01-adr-084-text-folded.md`. That was
  the drafting pass, not a review fold: it added REQ-043 criterion 12 (count
  11 → 12), deleted REQ-062's and REQ-063's false draft-delivery non-goals,
  rewrote REQ-079 criteria 4 and 6, and rewrote JN-003 steps 6 and 9.
- That entry records all six requirements and JN-003 being set to `in-review`.
  **At the start of this round-two fold the four requirements in this entry read
  `status: approved` on disk** while carrying fourteen open `REVIEW(...)` lines
  — the state rule 3.4 says is not ready. JN-003 read `in-review`.
- Round one's own edits to these files are therefore visible only as the
  difference between that entry's description and the text round two reviewed.
  They are not itemised here, because doing so would be reconstruction
  presented as record.

## Round two — fourteen lines, all deleted

REQ-043 (three), REQ-062 (four), REQ-063 (three), REQ-079 (three), JN-003 (one).
All fourteen are gone. **None became a `blocked-by` edge**: every one was a gap
or an ambiguity inside text this pass owns, and the two that read as
cross-requirement conflicts (REQ-063 × REQ-065, REQ-062 × REQ-060) are resolved
by withdrawing or bounding the claim on *this* side rather than by contradicting
an approved neighbour. This was the second and last round (rule 3.4).

### The two owner rulings this fold applies

1. **The 24-hour check is the only look ReachKit ever takes at a published
   page.** The weekly re-measurement measures the market (REQ-065 criterion 1)
   and visits no page. No fix may assume a later observation. REQ-062's and
   REQ-063's non-goals stand as written.
2. **On that one check, a page counts as gone on an unambiguous 404 or 410
   only.** Any other answer — a 5xx, a redirect, a 200 whose body is not our
   page, an unreachable site — is *could not be confirmed*: it stops the claim
   without asserting a takedown.

### Status moves

| Artifact | Was on disk | Now | Why |
|---|---|---|---|
| REQ-043 | approved | in-review | criterion 12 rewritten — a criterion change is a promise change |
| REQ-062 | approved | in-review | criteria 4 and 6 rewritten, criterion 7 added |
| REQ-063 | approved | in-review | criterion 7 withdrawn, criteria 1 and 6 rewritten |
| REQ-079 | approved | in-review | criterion 6 rewritten |
| JN-003 | **approved** | in-review | steps 7 and 9 reworded — journey-writing SKILL: a changed step drops an approved journey back through its gate. The brief for this fold stated JN-003 was already `in-review`; on disk it read `approved`, as it also did before the ADR-084 text fold that recorded moving it. |

Nothing here is approved. The signature is the owner's.

## REQ-043 — three lines folded, criterion count unchanged at 12

Criterion 12 was **replaced, not appended to** (rule 2.1's soft budget).

1. `REVIEW(conflict with REQ-062)` — the fallback fired on "the page is no
   longer published at its public address", which nothing observes. It now fires
   only on what ReachKit already recorded: it unpublished the page itself
   (REQ-056 criterion 7), the one check found no page at the public address
   (REQ-062 criterion 4), or no address inside that WordPress can be formed. The
   unkeepable absolute "offers none that does not open the page" is **withdrawn**
   and replaced by an honest bound — where the record says nothing against a
   page the way through is offered, and "the detail claims only that this is
   where the page was put, never that it is there now". One non-goal added: the
   day detail fetches neither address, now or ever.
2. `REVIEW(untestable)` — the second way through was distinguished by "where it
   is shown to them whether or not it is still published", a property of the
   WordPress editor. Replaced by a discriminator that is ReachKit's own
   behaviour: a second address, offered separately from the first, "inside their
   own WordPress" and opening that post there "rather than at its public
   address". A test now fails when the route is deleted (§8).
3. `REVIEW(gap)` — the Contributor case (ADR-084 Decision 3) dissolves rather
   than being handled: criterion 12 no longer promises the customer can edit, so
   there is no promise left for a role assignment to break. The non-goal now says
   what the customer may do there, "under whichever WordPress user they are
   signed in as, is theirs and not ReachKit's to promise". The `rests-on` row is
   corrected with it: the assumption is that an address can be formed *from what
   ReachKit recorded at delivery*, not "under the application password they
   gave", which is not the credential the signed-in customer arrives with.

**Rule 5.7 correction.** Placement read "JN-003 steps 1, 2 and 3"; step 3
exercises REQ-045, REQ-050, REQ-053, REQ-055 and REQ-093 and not REQ-043, while
step 8 exercises REQ-043 and was unnamed. Now "steps 1, 2 and 8, and step 9". No
journey edit was needed — every step named already carries REQ-043 in
`exercises`. `depends-on` gains REQ-062.

## REQ-062 — four lines folded, one criterion added (6 → 7)

1. `REVIEW(ambiguity: what counts as no page)` — ruling 2 applied to criterion 4,
   which now has **three** outcomes: a 404 or 410 and nothing else records that
   no page was found; any other answer records that the check could not be
   confirmed, and the page is not recorded as no longer there; and in neither
   case is anything stated as a failure of the page or of publishing. Criterion 4
   also now **names no cause**: "it names no cause and never says who removed the
   page or that the customer did". The old parenthesis attributing the removal to
   the customer is gone.
2. `REVIEW(gap: the hosted CNAME)` — resolved by moving reachability out of
   criterion 6 entirely. Criterion 4's third outcome now covers an unreachable
   site at every destination, so the hosted page whose CNAME broke after
   publishing is neither blamed for its own DNS nor routed to a criterion scoped
   to sites ReachKit does not serve. Criterion 6 keeps only the sitemap and the
   robots policy — the two things a site ReachKit does not serve controls — and
   its "or that could not be reached at all" clause is deleted, along with
   criterion 4's "then criterion 6 governs".
3. `REVIEW(ambiguity: publishes no sitemap at all)` — a condition of the site is
   now "recorded only from an answer the site gave". Where ReachKit could not
   reach or could not read what it went to look at, nothing is stated as the
   customer's to act on and **no check is suppressed for any later page** — the
   false accusation and the silently-disabled check both go.
4. `REVIEW(conflict with REQ-060)` — resolved inside REQ-062 rather than by
   editing REQ-060, which a sibling analyst holds. New criterion 7: wherever a
   surface states that page's state, it carries criterion 4's recorded outcome
   and its date alongside, "and no surface states as a fact about the page today
   anything beyond what that one check recorded on that date". This does not
   touch REQ-060 criterion 2's publish state — a dated observation is not a
   liveness assertion — and it removes "nothing states which the customer should
   believe".

Three non-goals rewritten or added: nothing goes looking again (and "a page
removed after that check goes on being shown and judged as it was"); no cause is
ever attributed to an absent page; a not-confirmed check is a final outcome, not
a pending one, and is never retried.

## REQ-063 — three lines folded, criterion 7 withdrawn (7 → 6)

**Criterion 7 is withdrawn outright.** Its resumption rested on a later
observation that will never be made. The number is **not reused** — a repurposed
criterion 7 would silently repoint every downstream citation of "REQ-063
criterion 7" at a different promise, which is exactly the plausible-but-wrong
address rule 5.3 exists against. Anything still citing criterion 7 now dangles
visibly.

1. `REVIEW(conflict with REQ-065)` — criterion 6's cause "the page was not there
   when this week's measurement went to its live address" is replaced by
   "ReachKit's one check at 24 hours found no page at its live address (REQ-062
   criterion 4)". Criterion 6 gains the permanence its withdrawn sibling used to
   qualify: "A page marked no longer judgeable stays so, and nothing restores
   it."
2. `REVIEW(conflict with REQ-056)` — moot with criterion 7 gone. REQ-056
   criterion 3's terminal `unpublished` is no longer contradicted by a resumed
   working verdict.
3. `REVIEW(gap: rule 5.7)` — moot with criterion 7 gone. The remaining criteria
   are walked by JN-005 steps 1 and 4 as the rationale already records; JN-005
   needs no new step and was not edited.

**The accepted consequence is now stated, not implied.** Criterion 1: "no
measurement looks at a published page's address, so a page the customer removes
after the 24-hour check goes on being judged week after week as though it were
still there, and ReachKit never learns otherwise." Two non-goals carry the same
fact from the other side — no look at a published page's address at all, and no
noticing that a page has come back or gone.

## REQ-079 — three lines folded

Criterion 6's mail is re-anchored to **REQ-056 criterion 16's four outcomes**
(rule 2.4: the outcome set has one home) and rewritten as four bullets, one
sentence each.

1. `REVIEW(ambiguity: three states in two sentences)` — no sentence now carries
   two outcomes or one count for both, so "an outcome holding no posts is not
   named at all" is applicable to each.
2. `REVIEW(gap: no longer in the site)` — that outcome's sentence "naming no
   place, because there is nothing there to find". The customer is no longer sent
   to a WordPress list to look for posts that cannot be in it.
3. `REVIEW(gap: the false first state)` — the never-made-live population is
   corrected to what ADR-084 Decision 3 and REQ-060 criterion 7 actually leave:
   posts "which nobody published, which were never public, and into which
   nothing has been written". The claim that they are "live and public on their
   own domain under their own name" is deleted as false about every member of
   that population.

`depends-on` gains REQ-056. The rationale's "pages on the web in the customer's
own name rather than invisible drafts" is softened to "most of what is left
behind", for the same reason. Criteria 1–5 and 7 are untouched.

## JN-003 — one line folded

Step 7 no longer says "where they took the post down themselves". ReachKit sees
an address and an answer, not a cause. The step now reads "where nothing was
found at the page's address, or where the check could not settle the question
either way, reads that with the date it was looked for and no blame put on
them" — which also brings the owner-signed claim into line with criterion 4's
third outcome. Step 9 is softened to match REQ-043 criterion 12: the second way
"opens the post inside their own WordPress", and where ReachKit already knows a
way leads nowhere the customer reads that in its place. Status stays
`in-review`.

## What this fold invalidates

For the architect and the planner. Nothing below was edited by this pass.

- **REQ-063 criterion 7 no longer exists.** Any blueprint, work order or test
  citing it, and any resumption path for a page marked no longer judgeable, is
  dead. BP-051 carries the weekly verdict scope.
- **No weekly per-page fetch is to be built.** Anything derived from REQ-063's
  old criteria 6 and 7 that added a page visit to the weekly job (REQ-065's
  path) must be dropped, not implemented.
- **REQ-062 criterion 4 is now a three-way outcome, not two.** Every fixture,
  copy key and stored disposition assuming "found / not found" needs a third
  arm. ADR-084's fourth `rests-on` row — that a 404 for a post id can be told
  from an unreachable site — is now load-bearing for the *page address* fetch as
  well as for the unpublish arms, and BP-048/BP-049's error mapping is the
  architect's to re-read against it. WO-234 (verification) and WO-232 (the
  `no_live_address` fixtures) are affected.
- **REQ-062 criterion 7 is new behaviour with no blueprint.** Carrying the
  check's recorded outcome onto every surface that states a page's state touches
  the day panel (BP-039) and the page record.
- **REQ-062 criterion 6 no longer covers reachability**, and its
  site-condition record now requires an answer from the site. Any suppression
  logic keyed on "could not be reached" is wrong.
- **REQ-043 criterion 12 no longer promises editability** and no longer forbids
  offering a way through that may open nothing; it does forbid the day panel
  fetching either address. WO-164, WO-166 and WO-168 (the day panel) are
  affected.
- **REQ-079 criterion 6's mail is four sentences, not two**, keyed to REQ-056
  criterion 16's outcomes. WO-143 needs a third re-extract.
- **Held concurrently, not read at final state:** REQ-056, REQ-057 and REQ-060
  are a sibling analyst's this pass. REQ-079 criterion 6 and REQ-063 criterion 6
  now cite REQ-056 criterion 16 and criterion 7 by number; if that fold renumbers
  either, these citations need re-checking.
