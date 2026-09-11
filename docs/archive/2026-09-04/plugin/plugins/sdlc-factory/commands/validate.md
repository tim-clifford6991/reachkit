---
description: System · Validate a completed work order against its requirements
---
For every `ui: yes` order in the wave (`skills/work-order-writing/SKILL.md`),
dispatch the design-guardian subagent first — once, over that set — for its UI-fit pass
(`agents/design-guardian.md`): placement against the journey map,
navigation, related settings, and adjacent features, left as
`- [ ] REVIEW(placement): …` lines under the WO's own `## Open questions`
— never a design-file edit. A `ui: no` WO skips this step entirely.

**The argument is a wave, not an order (0.13.2).** `$ARGUMENTS` names the
open wave — `W<n>`, or empty for the current one — and this pass covers
every work order that row names, against the merged `wave/W<n>` branch.
An order id is still accepted for a surgical re-check of one order, but
the gate §3 states is the wave pass; a per-order run does not close
anything.

Invoke the validator subagent. Return the criterion-by-criterion PASS/FAIL
table — every criterion of every order in the wave, each row naming its
order — and one verdict. On REJECT, list precise defects for the
implementer, per order.

The validator writes ONE `## TST-###` section into the wave's **first**
order (the first id in the row's list) carrying
`Validates: <every id in the row>` (`agents/validator.md`). That line is
the gate: the parser mints a `validates` edge per id on it, so an order
the line omits stays unvalidated and `done-without-validation` says so.

For each `ui: yes` WO in the wave, the validator's own report — not this
command — then writes one `Placement:` line naming that order, fed by the
pass just dispatched:
`Placement: clean` when nothing is left open, or `Placement: reviewed —
<n> open questions` naming the count when something still is
(`agents/validator.md`). The librarian's `done` gate requires this line
to exist on a `ui: yes` WO's latest TST section
(`agents/librarian.md`) — a UI WO cannot close without one — but the line
itself doesn't change the verdict; placement is a recommendation, not a
defect (`skills/design-system/SKILL.md`).
