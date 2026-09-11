---
description: System · Repoint or retire downstream artifacts after requirement cleanup
---
`/requirement-cleanup` retires a duplicate requirement in place and lets the
survivor absorb its edges — but nothing repoints what already pointed at
the retired id. Left alone that breaks two ways: a live blueprint's
`satisfies` keeps naming a node that can never be approved into again, so
the edge sits on a dead end forever; and `/expand-requirement` counts only
non-superseded blueprints naming the SURVIVOR, so it fans out a second
blueprint for behaviour the retired twin already covers. This is the sweep
that runs between `/requirement-cleanup` and `/expand-requirement` to close that gap.

1. Enumerate every requirement `status: superseded` and its survivor — the
   id already sitting in the survivor's own `supersedes:` front-matter,
   never guessed and never matched by title. Nothing found → say so and
   stop; a re-run that finds nothing is this command working, not this
   command doing nothing.

2. Per retired REQ, dispatch the architect subagent (conflict-detection
   and traceability skills) over every LIVE blueprint (`status` not
   `superseded`) whose `satisfies` names it:
   - its design is distinct from anything already satisfying the survivor
     → replace the retired id with the survivor id in `satisfies`, in
     place. This is bookkeeping that follows a supersedes edge already on
     record, not a fresh judgment call (rule 5.2: structure is derived) —
     the blueprint's own `status` does not move, and the edit is
     reported, not re-gated.
   - the survivor is already satisfied by another live blueprint covering
     the same surface → the twin is what gets retired, not repointed:
     `status: superseded` on it, `supersedes:` on the surviving blueprint
     gains its id, and the reasoning for calling them the same surface
     goes in the retired blueprint's own body. Self-certified — the same
     precedent requirement cleanup's own duplicate-requirement step already
     sets (rules 2.2b/3.2) — and my review can revert it exactly as that
     one can. Never delete a file either way.

3. Per blueprint retired in step 2, dispatch the planner subagent
   (work-order-writing skill) over its work orders: any `draft`/`approved`
   one that hasn't started gets `status: superseded`, with one line naming
   the surviving blueprint. A `done` WO is history — never touched. A WO
   already in progress is never auto-retired, whatever became of its
   blueprint — it's listed for my ruling instead of guessed at.

4. ADRs are never retargeted. A decision is a record of what was decided
   and when, not a live edge — repointing one at a survivor would erase
   the record of what the retired requirement actually caused. A retired
   id still resolves regardless, because a superseded file is kept, never
   deleted.

5. Report one table: retired REQ → survivor, each affected blueprint with
   its action (repointed | retired), the work orders retired under it, and
   a last column for anything sent to my ruling. Close by naming the next
   two steps: run `factory-console --check` — `satisfies-superseded`
   should now be silent — then `/sdlc-factory:expand-requirement` is safe to
   run (the namespaced form is the one that resolves — constitution §4,
   "Typing a verb").

This asks me nothing it can derive from the corpus itself (rule 1.3): a
retired requirement's survivor is already on record, and which surface a
blueprint covers is the architect's call to make and state, not mine to be
asked about. Nothing here ever writes `status: approved`.
