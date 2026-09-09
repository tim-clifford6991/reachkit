# ReachKit

A founder gives us a URL. We measure how findable the site is — in Google and in AI answers —
against the rivals they confirm, derive the pages worth publishing, write one a day and publish
it to a blog on their own domain after a veto window. Every Monday we re-measure and show what
moved. Live at https://reachkit.app.

This repository is the whole product and its specification: `tim-clifford6991/reachkit`, the v3
lineage (v1 and v2 are archived repositories). The specification is versioned beside the code,
and merge is the only definition of done.

## Read in this order

| | Document | What it is |
|---|---|---|
| 1 | `DECISIONS.md` | Every ruling, dated, one line each, newest last. A ruling here is not re-opened. |
| 2 | `BUILD.md` | The specification: stack, journey, screens, scoring, data, jobs, mail, payments, guardrails, env, build order. |
| 3 | `docs/design/approved/full-set/UI-SPEC.md` | **The UI specification of record** — twenty screens `S1`–`S20` with their states, the twelve owner rulings of 2026-09-08, the design system. Rendered beside it as `reachkit-full-screen-set.html`; its parent is the owner's artifact `docs/design/approved/reachkit-screen-system.html`; tokens in `docs/design/approved/tokens.css`. |
| 4 | `ARCHITECTURE.md` | Where code lives: the module table and the twelve structural rules, each with the check that enforces it. |
| 5 | `DATA-COSTS.md` | The price book behind BUILD §6. |
| 6 | `docs/README.md` | **The authority map** — which document governs what, in what order they win, and what keeps each honest. Anything not in this table is there. |
| 7 | `docs/PROCESS.md` · `docs/DEPLOYMENT.md` | How work flows · environments, bindings, cutover. |
| 8 | `CLAUDE.md` | The working agreement for agents. |
| 9 | `archive/sdlc-factory-2026-09-04/corpus/docs/{requirements,decisions}` | The acceptance criteria (`REQ-*`) and decision records (`ADR-*`) behind BUILD — the detail an issue cites. Read-only; the archive's design *drawings* are superseded by row 3. |

## How work happens

One GitHub issue = one branch = one PR. The PR body says `Closes #N`; every *Done when* box on the
issue is ticked; the required checks are green (`typecheck · lint · unit`, `layout conformance
(browser)`, `schema · RLS (live Postgres)`, `audit`, `Vercel`); the master lands it. Owner files
(`BUILD.md`, `DECISIONS.md`, `ARCHITECTURE.md`, `.github/**`, `scripts/**`, the lint and test
configs) change only in their own docs PR. The whole process is `docs/PROCESS.md`.

## Running it

```sh
npm ci
npm run dev                                   # http://localhost:3000, bindings from .env.local (.env.example lists them)
npm run typecheck && npm run lint && npm test # the db project needs the substrate: scripts/db-substrate/README.md
npm run test:layout                           # the browser sweep against the approved set
node scripts/drift-audit.mjs                  # spec ↔ code ↔ tests
```

Stack: Next.js (App Router) + TypeScript, Tailwind 4 + daisyUI 5, Supabase, Stripe, Resend,
Inngest, DataForSEO, Anthropic — `BUILD.md` §1. Environments and where each binding lives:
`docs/DEPLOYMENT.md`.
