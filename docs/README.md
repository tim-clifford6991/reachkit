# The ReachKit v3 corpus — what governs what

This repository is documented as a *corpus*: a small set of documents, each with one job, an
owner, and a check that keeps it honest. Read this page first; it says where every kind of
knowledge lives so that UI, features, capabilities, process, setup and structure can change
without drifting from each other. The root `README.md` is the one-screen entry that points here.

## Authority, in order

When two documents disagree, the higher one wins and the lower one is corrected in its next PR.

| # | Document | What it holds | Changes when | Kept honest by |
|---|---|---|---|---|
| 1 | `DECISIONS.md` | Every ruling, dated, one line each, newest last. Owner rulings are recorded verbatim in intent. Between batches the master's rulings wait in `docs/pending-decisions.md`. | a ruling is made (owner) or a design/engineering decision closes (master) — batched into a docs PR | the drift audit checks its format and order; `docs/pending-decisions.md` is emptied by each batch |
| 2 | `BUILD.md` | **The specification.** What the product is: stack, design system, journey, screens, scoring, data, jobs, mail, payments, guardrails, env, build order, non-goals. | a DECISIONS row changes the spec (amended in the same or the next docs PR) | `scripts/drift-audit.mjs` (spec→code, routes, journeys, pins) |
| 3 | `docs/design/approved/full-set/UI-SPEC.md` | **The UI specification of record**: every screen and state, its modules, ranks, states, copy status and the requirement it satisfies. Its rendered form is `reachkit-full-screen-set.html`; its parent is the owner's artifact `reachkit-screen-system.html`; tokens in `tokens.css`; the directory's own index is `docs/design/approved/README.md`, the values it spends without a token name are `literals.md`, and the renders are `screens/*.png`. | the owner approves a new artifact (never by editing the HTML by hand) | `tests/ui/design/*` (token set, no bare literals, component registry), the layout suite's side-by-sides |
| 4 | `ARCHITECTURE.md` | Where code lives: module table with public entry points, and the twelve structural rules each with its check. | a module, directory or boundary is added or moved (in the same PR, docs exception) | eslint fences, `tests/app/toolchain.test.ts`, the drift audit |
| 5 | `DATA-COSTS.md` | The price book behind BUILD §6: every vendor endpoint, its price, freshness window and cap. | a vendor price is re-checked (dated) | `tests/pins.test.ts` (constants match the book) |
| 6 | `docs/PROCESS.md` | How work flows: issues, Done-when, PRs, required checks, landing, rulings, copy, design approval gate, the implementer brief and the box rules. | the process changes (master) | `pr-hygiene`, `ci.yml` |
| 7 | `docs/DEPLOYMENT.md` | Environments, the one Vercel project, env bindings and where each lives, Supabase, cutover and rollback. | infrastructure changes | the boot invariants (`src/lib/config/env.ts`), `.env.example` |
| 8 | `docs/RUNBOOK.md` | Operating the product alone: landing a change, the bindings and rotating one, jobs, kill switch, cost ledger, boot refusals, the substrate, backups and the restore drill. | an operational procedure is added or rehearsed | — (drills and incidents are dated inside it, §11) |
| 9 | `docs/design-reference.md` | Route → screen id → UI-SPEC section → requirement → tests. | a route or screen is added | a test asserts every route has a row |
| 10 | `CLAUDE.md` | The working agreement for agents: the corpus map, the enforced rules, the don'ts. Short by design. | rarely; when a rule gains or loses a check | — |
| 11 | `archive/sdlc-factory-2026-09-04/corpus/docs/**` | The frozen factory corpus: `requirements/REQ-*` (acceptance criteria), `decisions/ADR-*`, journeys, work orders, and the *superseded* design drawings. | never (read-only) | `tests/app/toolchain.test.ts` refuses writes under `archive/` |

The code is below all of these: a difference between the code and rows 1–5 is a defect in the
code, filed as an issue, unless a DECISIONS row says otherwise.

## Where each kind of change goes

| You want to change… | Start at | Then |
|---|---|---|
| a screen or a component | the owner approves an artifact → UI-SPEC.md updated in the same landing PR | BUILD §4 pointer, `design-reference.md` row, the implementing issue cites `S<id>` |
| a feature or behaviour | a DECISIONS row (owner ruling or master decision) | BUILD section amended; ARCHITECTURE row if a module moves; issue with `Done when` citing BUILD § and REQ criteria |
| a capability (vendor, model, job, mail kind) | BUILD §6.3 closed list / §11 / §12 + `DATA-COSTS.md` | `constants.ts` pin, the cost seam, the register (`MAIL_KINDS`, job registry) |
| a process rule | `docs/PROCESS.md` | the check that enforces it (`.github/workflows`, a test); CLAUDE.md only if agents must know it before reading anything else |
| setup or infrastructure | `docs/DEPLOYMENT.md` | `.env.example`, `env.ts` boot invariants, the runbook |
| structure (directory, module) | `ARCHITECTURE.md` rule 7 / module table | `tests/app/toolchain.test.ts` transcription |
| copy | the owner writes it into the copy registry (`src/lib/presentation/copy/keys/*.ts`) | `TODO(copy)` is the only placeholder; the string-literal sweep refuses inline sentences |

## Maintenance rules

1. **One home per fact.** A number, a name, a rule lives in one document and is referenced from the others.
2. **A code PR names the amendment; a docs PR lands it.** A code PR never edits an owner file (`CLAUDE.md`, CODEOWNERS): it names the documented fact it changes under *Corpus* in its body, and the master lands the amendment in a docs PR the same day, with or before the code. The documents are never more than one landing behind the code.
3. **Rulings are recorded the day they are made** by the master in `docs/pending-decisions.md`, and reach `DECISIONS.md` in the next docs batch (at most a few days apart). Owner rulings go straight to `DECISIONS.md`.
4. **The archive's requirements are read before filing.** Every issue cites the REQ criteria it satisfies; every UI issue cites its `S<id>`.
5. **Superseded means marked, not deleted.** Old drawings, old rulings and old plans stay where they are with a line saying what replaced them.
6. **The drift audit runs nightly** (`.github/workflows/drift-audit.yml`) and every PR (`--strict`); an UNSPECCED route or a GAP section is a defect in the corpus, not noise.
