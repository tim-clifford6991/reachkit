---
description: System · Fan out approved requirements into the blueprints and work orders they're missing
---
For each requirement in scope, list what already exists and leave it
alone; cut only what's missing — and "exists" means the current thing,
not any thing with the right shape: a blueprint counts only while its
`satisfies:` edge comes from a node that is not `status: superseded` (a
superseded one doesn't count — the requirement is unsatisfied again and a
replacement is cut); its work orders count only while their `implements:`
edges come from work orders that are themselves not `status: superseded`;
and a blueprint with no current work orders is only fanned into once it
is itself `approved` — one still `draft`/`in-review` is listed as
waiting, never fanned into, because rule 3 forbids a work order from a
non-verified blueprint. Nothing here commits — every file this writes
lands uncommitted for my git review; approval already happened at
`/require`, this is just fan-out.

After a requirement cleanup that superseded any requirements, run
`/sdlc-factory:relink` first — otherwise this counts only blueprints naming the survivor and
cuts a duplicate for behaviour the retired twin already covers.

Scope ($ARGUMENTS): one REQ id, several REQ ids, or `--approved` for
every requirement currently `status: approved` — the pass `/blueprint`
used to run until 0.12.0 folded it here; step 2 below is that dispatch.

Per requirement in scope:

1. **Refuse** any requirement whose status is not `approved` — cite rule 3
   ("No blueprint from a non-approved requirement") and list it under
   **refused**, the clause named. Nothing else runs for it.
2. **Blueprint.** If a blueprint whose `satisfies:` names this
   requirement exists and is not `status: superseded`, list it
   **untouched** ("already has BP-###") and go to step 3 for that node.
   Otherwise (none exists, or every one that does is `superseded`)
   dispatch the architect subagent (background) to cut exactly one: a
   `feature` node by default; a `container` or `component` node only when
   the requirement's module owns neither yet (the taxonomy in
   `skills/blueprint-writing/SKILL.md`). The architect writes `satisfies:`
   in front-matter as it creates the file — never as a follow-up edit —
   with a mermaid diagram, `code:` anchors born in the same pass
   (module-bounded, rule 5.6), an ADR only for a fork that clears rule 2.2
   (a landmine ADR always clears it — a decision that reads as a mistake
   but is load-bearing), and self-certifies `status: approved` per rule
   3.2, stating its grounds. List it **created**, with the new BP id and
   any ADR ids.
3. **Work orders.** Take the blueprint identified in step 2 (the current
   one, existing or just cut).
   - If it is not `status: approved` yet, list it **waiting**
     ("waiting — blueprint BP-### is `<status>`") and stop for this
     requirement — rule 3 forbids a work order from a non-verified
     blueprint, so nothing is dispatched against it this run.
   - Otherwise, if it already has ≥1 work order whose `implements:` edge
     points at it and whose own status is not `superseded`, list it
     **untouched** ("already has WO-### … WO-###").
   - Otherwise dispatch the planner subagent (background, starting only
     once its blueprint's architect step has finished) to cut the WO set:
     dependency order, in/out of scope, acceptance criteria inherited
     verbatim from the requirement (never paraphrased), `implements:`
     born in front-matter, `wave:` left absent (`/wave propose` assigns
     it, not this), and each WO's `## Log` opened with one line —
     `- <date> created — planner`, its first checkpoint (constitution
     rule 6.1). List it **created**, with the new WO ids.

Requirements in scope fan out in parallel with each other; within one
requirement's chain, the planner step never starts before its architect
step does, and never starts at all while the blueprint sits below
`approved` — a WO cut against a blueprint that doesn't exist yet, or one
that hasn't cleared its own gate, is the same fabricated edge either way,
the thing this whole graph exists to refuse.

Return: the created / untouched / waiting / refused table (one row per
requirement, naming every BP/WO/ADR id it touched or cites, and for
**waiting** rows, the blueprint's current status); the diff to review
(`git status` against the docs root); every open question either
subagent raised, verbatim; and a console deep-link for anything created.
I decide what to commit — nothing this dispatches does.

Scope: $ARGUMENTS
