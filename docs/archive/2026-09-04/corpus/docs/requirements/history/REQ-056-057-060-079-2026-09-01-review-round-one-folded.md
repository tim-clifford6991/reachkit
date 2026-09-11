# REQ-056, REQ-057, REQ-060, REQ-079 — round-one review folded, 2026-09-01 (requirements-analyst)

Eight `REVIEW(...)` lines were open across REQ-056 (three), REQ-060 (three) and
REQ-079 (two). All eight are now gone, folded into criterion text; none became a
`blocked-by` edge. REQ-057 carried no review line of its own and is edited only
because owner ruling 2 lands on it. No status was raised: REQ-056, REQ-060 and
REQ-079 stay `in-review`, and REQ-057 drops `approved → in-review` because this
pass changes text the owner's signature covered.

## Owner rulings applied

1. **The post-deletion list.** REQ-079 criterion 6's `account` mail was
   conditional on a destination that could not be reached. It now carries every
   post left behind — the ones in the customer's own WordPress that criterion 4
   leaves for them to remove, and the pages still live at an unreachable
   destination — each identified well enough to find in their own site, with
   what to do about it. Where nothing is left behind, no mail is sent (derived,
   rule 1.1: a mail listing nothing is noise, and the alternative — an empty
   list — tells the customer nothing).
2. **The delivery mail.** REQ-060 criterion 2's totality claim ("That record is
   the whole of the telling … sends no mail") is struck and replaced with the
   narrow negative: no mail is sent *because of the delivery itself*. REQ-057
   gains criterion 9, the WordPress variant of every telling criteria 1, 7 and 8
   require — the page will be waiting as a draft for the customer to publish,
   never that it will be or has been made live — and criterion 7's "the date and
   time it goes live" becomes "the date and time it publishes".

## REQ-056 — three lines folded, then deleted

Criterion 16 is rewritten whole rather than appended to (16 criteria, 17
non-goals; the budget forbids growth).

- `REVIEW(ambiguity)` — the never-live naming now has a surface, in REQ-060
  criterion 4's shape: "One written line on that page's own record in ReachKit,
  and on no other surface". This is ADR-081 Decision 4's reading ("'Names the
  post' is a line ReachKit renders on its own surface"), which the previous
  wording contradicted by appearing to name the post inside the customer's site.
- `REVIEW(gap)` — the was-live arm is no longer unconditional. Four outcomes are
  now stated on the one line: returned to draft; never made live, so nothing
  written and removal is theirs; the post is no longer in their site, so there
  was nothing to return (ADR-081 Decision 5, "returns `named_for_removal` rather
  than failing", stated at customer altitude); or the site could not be reached,
  so nothing was written, the post may still be live, and the customer can ask
  for the return to draft again. The retry is of the write, not of a state
  change, so criterion 3's terminal `unpublished` is untouched.
- `REVIEW(conflict with REQ-060)` — resolved in REQ-060, whose non-goal now says
  which posts it covers (below). REQ-056's own non-goal already excepted the one
  write.

## REQ-060 — three lines folded, then deleted

- `REVIEW(conflict with REQ-064)` — the REQ-064 criterion 6 citation that
  propped up the totality claim is gone with the claim. The narrowed negative
  stands on its own occasion and needs no grounding elsewhere.
- `REVIEW(conflict with REQ-057)` — settled by ruling 2. REQ-057 tells the
  customer; REQ-060 fixes only that the delivery itself sends nothing.
- `REVIEW(ambiguity: criterion 2)` — the claim now binds named surfaces: "on
  that record, and on every product surface the page appears on, it is shown as
  waiting … and never as live". Strike it and a calendar entry reading "live"
  passes, which is the discrimination the previous clause lacked.
- Non-goal narrowed: "Uploading media, or editing any existing WordPress post —
  except returning to draft a post ReachKit itself made live there … a post
  ReachKit did not make live is never written into at all."
- Placement recorded in the rationale (JN-003 step 6); it had none.

## REQ-057 — ruling 2, and one narrowing

- New criterion 9 (the WordPress variant of the telling). Criteria 1–8 are
  otherwise unchanged.
- Criterion 7's "the date and time it goes live" → "publishes"; the sentence is
  sent for a WordPress-bound page and was untrue of it.
- Criterion 7's "Because that mail is the whole of the telling where no interval
  exists" → "That mail is the only telling ReachKit sends the customer before
  that page publishes". The totality reading was already false — REQ-075
  criterion 2 keeps the event visible in the app and REQ-060 criterion 2 keeps a
  written line on the page's record — and the three consequences that hang off
  it (timing, unsuppressible, no unsubscribe link) are all about *sending*. The
  promise is narrowed, not withdrawn: nothing that was required before is
  optional now.
- Placement recorded in the rationale (JN-003 steps 5 and 6); it had none.

## REQ-079 — two lines folded, then deleted

- `REVIEW(gap)` — ruling 1, in criterion 6.
- `REVIEW(untestable: criterion 4)` — criterion 4 now states three observation
  moments instead of one: visiting a page that was live at a destination
  ReachKit serves; looking in the customer's own WordPress at a post ReachKit
  created there; and opening ReachKit afterwards, where the naming and the
  still-live list are read. The never-live arm — the only populated one today,
  per ADR-081's Consequences — now has a moment of its own.
- Placement recorded in the rationale (JN-004 step 8); it had none.

## Placement drift

REQ-056's rationale read "JN-003 steps 6 and 7". JN-003 step 7 exercises REQ-062
alone; REQ-056 is exercised at steps 5, 6 and 9, and criterion 16 is walked at
step 9. Corrected, and cited by step text rather than number so it survives the
next journey edit (rule 5.3). REQ-050 ("step 4") and REQ-059 ("step 7", exercised
at step 6) carry the same drift and are outside this pass — reported.

## Downstream

- REQ-056 criterion 16 and REQ-079 criterion 4 — WO-239 inherits both verbatim
  and says so; WO-142 inherits REQ-079 criterion 4. Both `draft`. Re-extract.
- REQ-079 criterion 6 — WO-143 implements the delete-account mail on the old
  condition ("where a destination could not be reached"). `approved`.
  Re-extract.
- REQ-056 criterion 16's fourth outcome — the site that could not be reached —
  has no arm in ADR-081 Decision 3's `UnpublishResult` union, which declined an
  `unreachable` arm on the grounds that the unreachable case is REQ-079 criterion
  4's `stillLive` list. That list exists only for unpublish-everything, so the
  single-page unpublish now needs an outcome the union does not carry. WO-214
  and WO-239 are affected; the architect decides whether this reaches ADR-081 as
  a superseding decision.
- REQ-057 criteria 7 and 9 — WO-216 ("The telling …") and BP-046 carry
  `wholeOfTheTelling`; the flag's *behaviour* is unchanged, its name and comment
  are now wrong, and criterion 9 is new work. Re-extract. WO-104's
  `unsuppressibleWhen` string names the condition (autopilot at a zero window),
  which is unchanged; it stands.
- REQ-060 criterion 2 — WO-237 quotes it verbatim. Re-extract.

## Reported, not edited

- REQ-064's non-goal "What each mail says, which belongs to the requirement it
  serves" still lists REQ-060. After this pass no mail is sent on REQ-060's
  occasion and the mail's words are REQ-057's, so REQ-060 does not belong on
  that list. Not raised as a `blocked-by`: the line is a pointer in a non-goal
  the requirement itself calls bookkeeping, nothing REQ-060 promises rests on
  it, and REQ-064 is held by another analyst this pass.
- REQ-064 criterion 7's "where that mail is the whole of the customer's telling
  that a page is going live" and REQ-075's `rests-on` claim ("the whole of the
  customer's telling that a page is going live") both paraphrase the REQ-057
  clause narrowed above, and both say "going live" of a mail that, for a
  WordPress destination, now says the opposite.
