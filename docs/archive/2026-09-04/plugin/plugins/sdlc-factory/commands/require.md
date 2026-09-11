---
description: Owner · Turn raw input into structured requirements
---
Route the input below through the requirements-analyst subagent per
CLAUDE.md: it takes what I want built, in whatever shape it comes — a raw
idea, a flow, a constraint, a sentence — and returns a drafted REQ, its
place on a journey (an existing step, a new one, or the recorded reason it
has none), and the existing code it already touches.

Then run rule 3.4's two rounds — both are this command's to dispatch,
since no agent can invoke another agent:

1. Round one: invoke the reviewer subagent on the returned draft. If it
   leaves `REVIEW(...)` lines, hand them back to the analyst to fold in —
   the author addresses its own findings; the reviewer never rewrites.
2. Round two: invoke the reviewer again on the result, before anything
   below is presented to me.

One exception (rule 3.4): a draft the analyst marks as faithful
transcription of a cited, settled specification gets round one only —
fidelity and testability — its decisions were made where it cites. Run
round two solely on the drafts that decide something their source does
not, and route any conflict between transcribed drafts to `/decide` or
`/requirement-cleanup`, never into another round.

Corpus-scale input — more than one journey's worth of asks — is
skeleton-first (`skills/prd-writing/SKILL.md`, Corpus-scale intake): the
analyst returns journeys, the cross-cutting laws, and a one-line slot
list for my approval BEFORE any full requirement is drafted. Slots then
fill in isolation against the frozen skeleton, and review runs once, on
the filled set.

- If that pass adds nothing, present the draft as **ready**: the REQ, its
  journey placement, the code it touches, and only the question rule 1.3
  says only I can answer — nothing the analyst could defensibly derive
  itself.
- If that pass leaves any open `REVIEW(...)` lines — its own or ones
  carried over from round one — present the draft as **not ready**: list
  every open line verbatim and say so; a draft carrying open `REVIEW(...)`
  lines is not presented as ready to approve (rule 3.4).

Approval is mine either way, not the analyst's or the reviewer's: I set
`status: approved` on the file myself when I'm satisfied — nothing here
sets it for me. The moment I do, this closes with the next step spelled
out: `Approved — run /sdlc-factory:expand-requirement <REQ-ID> to fan it out to a
blueprint and work orders.` (The namespaced form is the one that
resolves — constitution §4, "Typing a verb".)

Input: $ARGUMENTS
