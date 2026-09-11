# REQ-074 — criterion 8 added, and JN-004 gains the step REQ-060 criterion 6 was owed, 2026-09-01 (requirements-analyst)

Two gaps found downstream and neither written where the promise belongs. Both
are closed here. REQ-074 moves `approved → in-review` and JN-004 moves
`approved → in-review`: a criterion is a promise and a step is a claim about how
a person walks, so the owner's gate reopens on both (§3's stage-gate vocabulary,
`skills/journey-writing/SKILL.md`, "Adding or changing a step on an
already-approved journey drops its status back to `in-review` in the same
edit"). Rule 3.4's two rounds are owed after this return; neither draft
transcribes a settled specification — both decide.

## REQ-074 — criterion 8, the destination whose account cannot publish

REQ-074 criterion 1 closes over three destination states and criterion 2 fixes
what one of them — the expired credential — says and offers. REQ-060 criterion 7
puts a second occasion inside the failing state (a WordPress credential that can
create posts and not publish them) and states what the destinations list must
say there, so the destinations list's own promise was living in a neighbouring
requirement. BP-058 and ADR-086 each carry an `open` `rests-on` row saying so
("REQ-074 gains a criterion for the destinations list in this occasion … Until
that criterion exists this node renders the occasion from REQ-060 criterion 7
alone — enough to build, and not enough for the destinations list to own the
promise (rule 5.7)").

Criterion 8 now carries it in REQ-074's own terms, stated for any destination
rather than for WordPress alone: the state is criterion 1's `failing`; the line
says the connection is live and the account is not allowed to publish; nothing
on this occasion says pages are held or that nothing has been lost (the page is
one criterion 5 brings to rest needing the customer); the action leads to a
credential for a different account, and re-entering the stored credential is
never the remedy.

The discriminating limb is the last one. "The action leads to a different
credential" cannot be tested by reading a control's label, so the criterion
states the observable consequence instead: supplying the credential already
stored leaves the destination not reading as working, publishes nothing to it,
and tells the customer the account still cannot publish. A build that offers the
ordinary Reconnect and treats a re-entry as a fix fails that test; a build that
merely renames the button does not pass it (§8, "a test that survives deletion
of its feature is vacuous").

Also changed, and why:
- The user story named only the expired token and promised "pages … waiting for
  me rather than lost", which is false on this occasion — the page failed. It
  now names both occasions and promises recovery plus never being sent round an
  action that changes nothing.
- The rationale gains the occasion in one sentence, one pointer to REQ-060
  criterion 7 for the WordPress form and the delivery's fate (`skills/prd-writing`
  — a pointer belongs in the rationale, not in a non-goal), the placement line
  it never carried (JN-004 step 3), and the greenfield code note.
- Two non-goals added: the sentence and the action's words are owner-owed
  (criterion 8 fixes what each must and must not do, and mints neither); and
  establishing *whether* an account may publish, which is not the customer's
  promise.

Not done, deliberately:
- No `depends-on: REQ-060` edge. REQ-060 already depends on REQ-074; adding the
  reverse would make a cycle. Criterion 8 is written so that it stands without
  REQ-060 — the occasion is described by what is true of the credential, not by
  the vendor it belongs to.
- No `rests-on` row for "an account that can create but cannot publish can be
  told apart before or at delivery". ADR-086 carries that assumption already
  (`open`), and REQ-060 criterion 7 asserts the check without one; a third copy
  is the second copy rule 2.4 forbids, twice over.
- Criterion count 7 → 8, inside rule 2.1's ~12 soft budget. No split: the
  occasion cannot state itself without criteria 1 and 5, so a second file would
  be a seam.

## JN-004 — a step for REQ-060 criterion 6, judged rather than transcribed

REQ-060 criterion 6 (every page ReachKit created in the customer's WordPress
comes up together in one list there) was exercised by no step in any journey.
JN-003 step 6 walks one page on delivery morning; JN-004 step 8 exercises
REQ-079 alone. A previous analyst recorded a proposed step in REQ-060's
rationale. It is adopted in substance and changed in three ways:

1. **The arm where there is no such place is walked too.** REQ-060 and REQ-079
   both carry an `open` `rests-on` saying a connected site may permit no such
   place, and REQ-079 criterion 6 makes the mail say so and still carry its
   count. A step that only walks the happy arm would leave the journey claiming
   an outcome the corpus does not yet stand behind.
2. **"Nothing they wrote themselves mixed in" is in the step.** That is the half
   of criterion 6 a founder actually notices, and a step that says only "finds
   them in one list" is walked by a list of every post in the site.
3. **It is written as what the person does, not as the criterion.** "Following
   the one place the deletion mail named" is requirement text; "going to the one
   place ReachKit's last mail pointed them to" is the person's move (rule 2's
   artifact contract — a journey holds no restated requirement text).

`exercises: [REQ-060, REQ-079]` is kept as proposed. REQ-079 is not double-
listed for the sake of it: the mail that names the place, and its promise to say
so when there is no place, are REQ-079 criterion 6's, and without it the step's
entry point rests on nothing.

**Position: after step 8, so the delete branch stays contiguous.** The step is
what the customer does next after the deletion mail; the step that was 9
("Comes back after the plan has lapsed …") is a later moment on the cancel
branch and now sits at 10. Appending at the end instead would have preserved
every existing step number, and was rejected: it would put "opens their own
WordPress once the account is gone" after "comes back and resumes", which is not
a path anyone walks.

**Step count is now 10, against `skills/journey-writing/SKILL.md`'s 3–9.** Kept
as one journey: it is still one persona and one outcome — change one thing, or
go — and the tenth step is the tail of the leaving branch outside ReachKit, not
a second journey. Recorded here rather than acted on; splitting JN-004 is its
own pass, and would ripple through every placement line pointing into it.

The body gains two passages at journey altitude: the cannot-publish state beside
the expired one in the destinations paragraph, and the WordPress hand-off in the
closing paragraph.

## Not edited, and what this invalidates

Only REQ-074 and JN-004 were touched. Left standing and now inaccurate:

- **REQ-060 rationale** — "Criterion 6 is walked by no step today … a step owed
  on JN-004 after step 8 … Neither journey is this pass's to edit." The step now
  exists. The rationale describes rather than quotes it deliberately (recorded
  in `REQ-056-057-060-2026-09-01-adr-084-review-round-two-folded.md`), so no
  wording needs syncing — but the "owed"/"walked by no step" framing is stale
  and its placement line should become JN-004 step 9.
- **REQ-060 criterion 7 and its non-goal** — criterion 7 now states the
  destinations-list promise that REQ-074 criterion 8 also states, which is the
  second copy rule 2.4 forbids. REQ-074 is the home: the destinations list, its
  states, its lines and its actions are REQ-074's throughout. A pass owning
  REQ-060 should narrow criterion 7 to the WordPress-side facts it alone owns
  (the delivery fails for a reason no repeated attempt could clear; no post
  ReachKit reports as published is left standing as a draft) and point its
  non-goal at REQ-074 criteria 1 and 8.
- **REQ-076 rationale** — "Placement: JN-004 steps 5 and 9". Step 9 is now step
  10. A bare number with no quote beside it (rule 5.3); it needs correcting in a
  pass that owns REQ-076.
- **BP-058 and ADR-086** — each carries an `open` `rests-on` row saying REQ-074
  owes this criterion. Both are now dischargeable against REQ-074 criterion 8
  and belong to the architect. BP-058's status-grounds addendum ("REQ-074 owes a
  criterion for this occasion and does not have one") is stale in the same way.
- **Downstream of REQ-074's status.** BP-058 satisfies REQ-074 and self-
  certified `approved` on REQ-074 being `approved`; REQ-074 is now `in-review`
  until the owner signs. That is the librarian's to record, not this pass's.
