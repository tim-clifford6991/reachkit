---
id: BP-XXX
type: blueprint
title: "<feature node title>"
status: draft
satisfies: []
covers: []
depends-on: []
blocked-by: []
rests-on: []
supersedes: []
code: []
---

# BP-XXX — <feature node title>

- Parent: BP-… | (root)

## Responsibility
<one sentence>

## Module / boundary
<where this lives in the codebase>

## Diagram
```mermaid
graph TD
  <this node placed in its container/feature tree>
```

## Public interface
```
<exact signatures / routes / events>
```

## Data model delta
<tables, fields, migrations>

## Error & edge behavior
<...>

## NFR budget
<latency, volume, authz, observability>

## Decisions
<inline ADR-style entries: path taken, alternative(s) rejected and why,
cost of reversing. A decision earns a standalone ADR file instead only
when it spans nodes no single blueprint owns, or amends another decision
(rule 2.2) — link it here via its own `decides-for` edge, don't duplicate
its reasoning in this section.>

1. <decision title> — Status: proposed | accepted | superseded by ADR-…
   - Context: …
   - Decision: …
   - Alternatives considered: …
   - Consequences: …

## Open questions
- [ ] <question> (owner: user) — delete once ruled; don't accumulate a log
