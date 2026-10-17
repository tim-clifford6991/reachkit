---
name: design-system
description: Apply ReachKit UI rules — daisyUI with the one reachkit theme, Recharts 3, lucide. Use before touching anything under src/app or src/ui that renders.
---

# The ReachKit design system

Read `docs/DESIGN.md`. It is the whole rule, and this skill repeats none of it. For what a screen holds, read that screen's board from the table there — structure and wording, never pixels.

A screen change is proved by the gates that page names: `no overflow · axe`, and `tests/ui/design/strategy.test.ts` inside `typecheck · lint · unit`. The owner's look at the live site is taste. It does not replace those gates.
