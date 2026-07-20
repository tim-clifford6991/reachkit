# Requirement Intake — <slug>

> Copy this template to `docs/superpowers/intakes/YYYY-MM-DD-<slug>.md` for every
> SUBSTANTIVE requirement (definition in CLAUDE.md → Requirement Intake Protocol)
> BEFORE any design or plan. It exists to force three things the shipped-bug
> history proves get skipped under momentum: restating the requirement, asking
> the clarifying questions FIRST, and enumerating the permutation matrix —
> the cardpointers leak was exactly one unenumerated cell (paid viewer × public
> /scan). Sections may be brief; they may not be blank.

## 1. Verbatim requirement

> "<the owner's words, quoted exactly>" — <owner>, <date>

## 2. Restatement

<The implementer's own words. Call out every delta from the verbatim — anything
added, assumed, or narrowed.>

## 3. Open questions — asked BEFORE design

| # | Question | Answer | Answered by / date |
|---|---|---|---|
| 1 | | | |

<If genuinely none: say "None needed because …" — an empty table with no reason
is an intake failure.>

## 4. Permutation matrix

Axes: **tier** (free / paid) × **auth** (anon / authed / owner) × **entry
surface** (public `/scan` · `/app` · checkout/webhook · cron/Inngest) ×
**data-state** (fresh / legacy-payload / empty-inputs / pathological /
wrong-subject). List every cell the requirement touches as **covered** (how) or
**excluded** (why). No blank cells — an unlisted cell is an unenumerated hole,
not an exclusion.

| Cell | Covered / Excluded | How / why |
|---|---|---|
| e.g. paid × authed × public `/scan` × fresh | covered | surface-driven: always tier=free (invariant #12) |

## 5. Acceptance criteria (written FIRST, watched fail)

- Render-visible → the corpus expectation: fixture + expected outcome
  (`lib/scan/fixtures/report-corpus/` + `report-corpus.rubric.test.tsx`, or a
  new rubric rule in `lib/testing/report-rubric.ts`).
- Otherwise → the named guard: test file + the assertion, and the production
  mutation that will prove it bites.

## 6. Class statement

<"What else fails this same way?" — name the class this requirement/fix belongs
to and every sibling site. A fix that resolves one instance and leaves siblings
standing is not done (owner rule 2026-07-17).>

## 7. Rendered-surface ledger

<Every NEW data point or cost-bearing call this requirement introduces, and the
surface that renders it. A call with no named surface must not exist ("never pay
for data you don't render"). Deleting a render deletes its call.>

## 8. REQUIREMENTS.md delta

<Which `R-x.y` sections of `docs/REQUIREMENTS.md` this adds/changes — the edit
ships in the same PR. A requirement that fits no section gets a new one.>
