---
description: System · Reverse-engineer the existing codebase into the SDLC Factory knowledge graph
---
Run the brownfield codebase scan per the constitution. Work in this order,
committing docs after each phase, and surface only questions only I can
answer (rule 1.3) between phases — derive and record everything else.

Phase 1 — Charter: analyze the repo (stack, entry points, build/test
commands, deploy) and draft sdlc-factory/docs/00-project.md. Confirm with me.

Phase 2 — Structure map: map every top-level directory/module into
sdlc-factory/docs/registry/structure.md with one-sentence responsibilities.
Flag files that fit nowhere.

Phase 3 — Capability index: catalog reusable capabilities (services,
utilities, endpoints, jobs) into sdlc-factory/docs/registry/capabilities.md.
Flag suspected duplicates immediately with a `blocked-by` edge, reasoning in
the artifact's own body.

Phase 4 — Reverse requirements: infer what the software currently DOES as
REQ-### entries (status: approved), via the requirements-analyst. A
requirement transcribed from running code is `covers`, never `satisfies` — a
requirement written from a module cannot be that module's ancestor
(constitution rule 5.4). This is the highest-value check in this phase.
Mark uncertain behavior as a `rests-on` entry with disposition `open` (or
`undischargeable` where no future pass could settle it).

Phase 5 — Reverse blueprints: via the architect, create BP nodes for the
existing architecture as-is, interfaces copied from real code. Record
evident past decisions as ADRs (status: accepted) or, where the decision
belongs to one node only, as an inline "## Decisions" section per rule 2.2.

Phase 6 — Design inventory: via the design-guardian, extract existing
colors, fonts, spacing, and recurring UI elements into
sdlc-factory/docs/design/tokens.md and components.md as `proposed` values;
list inconsistencies found.

Phase 7 — Closing report: confirm the registry regenerates clean,
list orphan code, open `blocked-by` edges, open assumptions, and the top 10
risks. End with recommended first real work orders.

Scope note: $ARGUMENTS
