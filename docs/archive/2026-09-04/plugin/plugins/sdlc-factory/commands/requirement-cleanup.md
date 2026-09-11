---
description: Owner · Bring a requirement that has outgrown one page back to one page
---
I name a scope below: a journey (`JN-001`, meaning every requirement its
steps exercise), one or more requirement IDs (`REQ-012 REQ-013`), or
`--all` for the whole corpus, journey by journey, requirements on no
journey last. `--all` is resumable: a requirement whose latest
`requirements/history/` entry is already a requirement-cleanup entry and
whose status is still `in-review` was cleaned up by an earlier run I
haven't re-signed yet — it's skipped and listed as "already cleaned up,"
not redone. For each requirement in scope, invoke the requirements-analyst
subagent's Requirement cleanup procedure (`agents/requirements-analyst.md`,
detail in `skills/cleanup-routing/SKILL.md`).

The analyst rewrites each requirement to the template — user story, a
one-paragraph rationale, acceptance criteria kept verbatim, non-goals, open
questions — and displaces what a REQ must not contain (rule 2.1): narrative
and amendment notes to a dated `requirements/history/` entry; `Source:`
evidence to `registry/evidence/<REQ>.md`, cited once; `Implemented by:`/
`Pinned by:` lines to the architect, as a proposed `code:` anchor on the
satisfying blueprint (rule 2.4) — the architect applies it and says which
lines became which globs, and a line it can't confidently bound to a glob
is never dropped, only left as `REVIEW(gap)` on that blueprint and kept
verbatim in the history entry too. When no non-superseded blueprint
satisfies the requirement at all, those lines never reach the architect —
there is no blueprint to anchor them to — so they stay in the history
entry only, and the report says "no blueprint yet — anchors deferred to
/expand-requirement"; `Satisfied by:` and `Tag:` lines
dropped; `Depends on:`/`Blocked by:` bullets dropped in favor of the
front-matter that already states them, front-matter winning on any
disagreement. Where two requirements state one behaviour, the survivor is
the one more blueprints and work orders already cite (least churn), a tie
going to the lower id, the derivation recorded in the history entry (rule
1.1, mine to overrule) — it absorbs the criteria and gains `supersedes:`,
while the other is set to `status: superseded` immediately, self-certified
(rules 2.2b, 3.2), so an `/expand-requirement` in between never fans out from a
retired duplicate; my review can still revert it. Every rewrite is checked
against its journey placement (rule 5.7). A rewrite that touches a
requirement that was `approved` drops it to `in-review` — my signature
covered what I signed, not this rewrite.

Every rewrite gets two rounds of `/review` (rule 3.4) before I see it —
both dispatched here, since the analyst cannot invoke the reviewer itself:
round one on its rewrite, with findings handed back to it to fold in, and
round two on the result.

Return, per requirement: the diff summary, what moved where, the
architect's anchor proposal by name (or "no blueprint yet — anchors
deferred to /expand-requirement" when none exists), every open `REVIEW(...)` line
verbatim, and the new status. I decide what to re-approve myself; nothing
here writes `status: approved` and nothing here deletes a file. When any
requirement in scope was superseded, this closes by invoking `/relink`
itself — the sweep that repoints or retires what still cites the retired
id (its one caller is this verb, constitution §4's routing map) — and then
spells out the next step: re-approve each rewritten requirement, then
`/sdlc-factory:expand-requirement` it (the namespaced form is the one that
resolves — constitution §4, "Typing a verb").

Scope: $ARGUMENTS
