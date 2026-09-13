// tests/presentation/copy/budget.ts — BP-020 Decisions 3, WO-279 (supersedes WO-044)
//
// BP-020 `## Decisions` entry 3 already chose this number under
// constitution rule 1.1, at the blueprint level, with its derivation and
// reversal cost recorded there: 120 s, because the sweep is CI
// infrastructure, not a product code path — `structure.md` rule 5 sends
// every number that appears twice to `src/lib/config/constants.ts`
// (BP-005), and putting a CI wall-clock budget there would make
// a constants pin assert a fact about CI hardware, not about the
// product. Declared here and nowhere else, per the file plan.
//
// Exceeding it is fixed by sharding on the surface glob — passing
// `surfaceTree()` a narrower root, or splitting the sweep into two
// describes over disjoint subtrees — never by raising the number: a
// silently raised budget is how a disabled sweep looks, in CI, exactly
// like a passing one (constitution rule 5.5; BP-020 `## Decisions` entry
// 3's own consequence). Reversal cost: one line, here alone; no other
// file holds a second copy of this number (rule 2.4).
export const COPY_SWEEP_BUDGET_MS = 120_000;
