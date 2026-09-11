---
description: System · Cut verified blueprints into work orders
---
Invoke the planner subagent on $ARGUMENTS (or all verified BP leaves
without WOs if empty). Return the WO set with dependency ordering and
which WOs can run in parallel. Every order is a slice, never a file
(constitution rule 2.6); a `ui: yes` order is named in the return so
`/factory` routes it to `/design` for its preview.

`consolidate BP-###` (or several ids): dispatch the planner to
consolidate that blueprint's unstarted work orders per rule 2.6
(`agents/planner.md`, "Consolidating a set") — a merge, never a discard:
criteria and file plans carried verbatim, the replaced orders kept as
`superseded`. Return the old → new mapping and the criterion, file-plan
and line counts before and after. Lands uncommitted; I accept it by
committing.

Caller: `/factory` (constitution §4's routing map).
