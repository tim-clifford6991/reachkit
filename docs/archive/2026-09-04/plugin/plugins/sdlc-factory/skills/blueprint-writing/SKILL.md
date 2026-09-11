---
name: blueprint-writing
description: How to write blueprint feature nodes (BP) — hierarchy, interfaces, data model, NFR budgets. Use when creating or editing anything in sdlc-factory/docs/blueprints/.
---

# Blueprint Writing

Hierarchy: Epic → Feature → Capability, each a BP-### node with a parent
pointer. Leaf nodes must be small enough to plan into ≤5 work orders.

## Taxonomy (C4)

Every node is one of three kinds, named in its title and Responsibility
line rather than a separate schema field (a fourth front-matter key isn't
worth a second grammar change for what a sentence already says):

- **feature** — cut straight from a requirement; a leaf of the Epic →
  Feature → Capability hierarchy above. The default kind, and the only
  one `/expand-requirement` mints for most requirements.
- **container** — a deployable/runnable unit (a service, an app, a
  database) that owns a module. Minted only when the requirement's module
  has no container node yet.
- **component** — a major structural part inside an existing container (a
  library, a subsystem). Minted only when the requirement's module has no
  component node yet, and only under a container.

A requirement that already has a home in an existing container/component
gets a feature node underneath it; one that opens a module nobody owns
yet gets the container or component first, then the feature.

## Front-matter

```yaml
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
```

`code:` lists the repo-relative path globs this node governs
(`src/lib/cache/**`, `supabase/migrations/*_cache*.sql`). Keep it to the
module boundary the node owns; a glob that matches the whole repo governs
nothing usefully. Container/component nodes anchor directories; feature
nodes anchor the files they specify.

`satisfies` is derivation — this node was cut from that requirement, and
the stage gate binds it. `covers` is coverage — this requirement's
behaviour lives here but didn't originate it (the shape a `/codebase-scan`
node takes). Only `satisfies` is gate-bearing (constitution rule 5.4); use both
fields when both are true, and leave either `[]` when neither applies.

## Content

Every node specifies: responsibility (one sentence), module/boundary it
lives in, public interface (signatures, API routes, events — exact,
typed), data model delta (tables/fields/migrations), error and edge-case
behavior, NFR budget (latency, volume, auth, observability), dependencies
on other BP nodes. A node cut on `/expand-requirement` also carries a `## Diagram`
section — one mermaid block placing it in its container/feature tree —
written at creation, not backfilled later.

An interface is stated once. If the code exists, the blueprint cites the
symbol by anchor (rule 5.3) and states only the contract the code must
keep; a blueprint that transcribes a signature is the second copy rule
2.5 forbids.

## Decisions — inline by default (rule 2.2)

An architecturally significant choice with a real alternative becomes a
"## Decisions" section in this node: the path taken, the alternative(s)
rejected and why, and the cost of reversing it. It earns a standalone ADR
file, cross-linked via that ADR's own `decides-for` edge, only when the
decision spans nodes no single blueprint owns, or amends another decision.
Length and how contested the choice was are not the test.

**Landmine ADRs.** A decision that reads as wrong on its face but is
load-bearing — an obvious-looking cleanup would quietly break something
the requirement depends on — always earns a standalone file, regardless
of the test above: an ADR whose job is to state plainly why the
counterintuitive choice must stand, so the next person who trips over it
finds the reason before they "fix" it.

## Rules

- Interfaces are contracts: downstream WOs and code must match them
  verbatim or the librarian logs drift as a `blocked-by` edge.
- Detect and forbid circular BP dependencies.
- A REQ satisfied by zero nodes, or a node satisfying zero REQs, is an
  error — report it.
