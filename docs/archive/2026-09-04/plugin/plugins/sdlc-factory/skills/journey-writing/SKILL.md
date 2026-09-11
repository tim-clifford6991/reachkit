---
name: journey-writing
description: How to write journey nodes (JN) — one persona, one outcome, the requirements each step exercises. Use when creating or editing anything in sdlc-factory/docs/journeys/.
---

# Journey Writing

One journey = one persona reaching one outcome. A journey that serves two
personas, or one persona chasing two unrelated outcomes, is two journeys —
split it rather than branching inside one file. 3–9 steps: fewer than 3 is
not yet a journey (it's a single interaction); more than 9 is usually two
journeys stitched together, or a step that is really a sub-journey of its
own.

## Front-matter

```yaml
---
id: JN-XXX
type: journey
title: "<title>"
status: draft
persona: "<persona>"
steps:
  - step: "<what the persona does>"
    exercises: [REQ-XXX]
depends-on: []
blocked-by: []
rests-on: []
supersedes: []
---
```

`persona` is a short, free-text label for who is walking the journey — a
role, not a name ("founder", "on-call engineer"), stated once at the
journey's own level, not repeated per step.

`steps` is the ordered path: each row is `{ step, exercises }`, `step` a
short present-tense description of what the persona does or sees, and
`exercises` the requirements that step exercises — always an array, `[]`
for a step nothing yet grounds. Order is meaningful; the console renders
steps in file order, not sorted.

## Rules

- **A step names requirements it exercises, never code.** `exercises`
  points at `REQ-###` ids only — never a blueprint, work order, or file
  path. If a step's grounding is really "this module does X", that belongs
  in the requirement's own blueprint, not on the journey.
- **Rule 5.7 — every promise has a place.** Every `approved` requirement
  must appear in at least one journey's `exercises`, or the analyst
  records, in the requirement's own body, why it has no journey yet
  (infrastructure with no user-facing step, a requirement ahead of the
  journey that will use it, and so on).
  Silence is not the same as a recorded exemption — an approved
  requirement on no journey and with no stated reason is exactly the gap
  this rule exists to surface.
- **Journeys are owner-approved.** A journey is a claim about how a real
  person uses the product, not a derived index — draft it, but its
  `status: approved` is the owner's signature, the same gate `satisfies`
  waits on for a blueprint. Adding or changing a step on an already-approved
  journey drops its status back to `in-review` in the same edit — the
  signature covered what it signed, not a step added under it afterward.
- A journey's own `depends-on` / `blocked-by` / `rests-on` /
  `supersedes` follow the same grammar every other front-matter node uses;
  they say something about the journey artifact itself (a journey blocked
  on a decision, say), not about the steps inside it.
