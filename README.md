# ReachKit

A founder gives us a URL. We measure how findable the site is — in Google and in AI answers —
against the rivals they confirm, derive the pages worth publishing, write one a day and publish
it to a blog on their own domain after a veto window. Every Monday we re-measure and show what
moved. Live at https://reachkit.app.

This repository is the whole product and its specification: `tim-clifford6991/reachkit`, the v3
lineage (v1 and v2 are archived repositories).

## The MVP value chain, in priority order

The product is one chain. A link in it that a stranger cannot walk is worth more than every
improvement to the links around it, so the chain is the queue order (owner ruling 2026-09-10,
re-stated 2026-09-11).

| # | Phase | A stranger can… | The surfaces that carry it |
|---|---|---|---|
| 1 | **Landing** | read what ReachKit does and type their domain into one field | `/` |
| 2 | **Free scan** | get a real, permanent report for their own domain | `/scan/{domain}` · `/api/scan` · `src/lib/{scan,measure,market}` |
| 3 | **Sign-up** | ask for the full page and reach the offer | `/pricing` · `/api/lead` · the giveaway mail |
| 4 | **Pay** | pay €49 with no account first, and land on `/setup` from the mailed link | Stripe Checkout · `/api/stripe/webhook` · `/auth/confirm` · `/setup` |
| 5 | **Paid dashboard** | confirm market · rivals · destination and see Overview, Calendar, a first draft and Settings | `/setup/waiting` · `/app` · `/app/calendar` · `/app/draft/{id}` · `/app/settings` |

**Phase N is not started while phase N−1 has an open issue** — except work already in flight.
The master keeps `state/queue.txt` in this order and holds the rest.

**UI fidelity to the approved set (milestone M14) is frozen** until a Stripe test-mode payment
reaches `/setup` (#319). Fidelity is phase-6 work on a chain that does not yet carry a customer.

## What "delivered" means

Delivered is one thing, and it is not a merge:

> **Live on production, with real copy, and a stranger can complete landing → free scan →
> sign-up → pay → paid dashboard without help.**

Real copy means no `TODO(copy)` renders on the path. Merged is not delivered. Green is not
delivered. Visible on dev is not delivered. A phase is delivered when a person who has never
seen ReachKit walks its step on reachkit.app and gets what the step promises.

## The documents — one home per fact

When two documents disagree, the higher one wins and the lower one is corrected in its next PR.
Anything not in this table is not an authority. This is the only authority table in the
repository.

| # | Document | What it holds | Kept honest by |
|---|---|---|---|
| 1 | `README.md` | This page: what the product is, the value chain in priority order, what delivered means, and where every other fact lives. | the chain is the queue order |
| 2 | `DECISIONS.md` | Dated, append-only **product** rulings, one line each, newest last. A ruling here is not re-opened; a superseded row is struck in place, never deleted. Implementation rulings live as `// SPEC §x.y` comments at their module. | `scripts/drift-audit.mjs` (format and order) |
| 3 | `BUILD.md` | **The single WHAT**: stack, design system, journey, screens, scoring, data, jobs, mail, payments, guardrails, env, build order. MVP only — deferred behaviour is `LATER.md`. *(Renamed `SPEC.md` by the second docs PR of 2026-09-11; `BUILD §n` citations keep resolving.)* | `scripts/drift-audit.mjs` (spec ↔ code ↔ tests) |
| 4 | `ARCHITECTURE.md` | Where code lives: the module table with public entry points, and the structural rules, each naming the check that is the rule. | eslint fences · `tests/app/toolchain.test.ts` · the drift audit |
| 5 | `PROCESS.md` | How one issue becomes a merge, in ten steps or fewer. Roles, the required checks, landing, rulings, the box. | `pr-hygiene` · `ci.yml` |
| 6 | `CLAUDE.md` | The working agreement for agents: pointers and the don'ts. Thirty lines. | — |
| 7 | `LATER.md` | Deferred edge cases, v1.1 work and non-goals. Nothing here is built. *(Arrives with the second docs PR of 2026-09-11.)* | the `later` label on its issues |

Below all of these: **the code**. A difference between the code and rows 2–4 is a defect in the
code, filed as an issue, unless a DECISIONS row says otherwise.

Beside them, not above them — nothing under `docs/` is read by the running product:

- `docs/design/approved/**` — the approved screen set: `full-set/UI-SPEC.md` (the UI
  specification of record, folded into the spec's §4 by the second docs PR) and its render
  `full-set/reachkit-full-screen-set.html`, the owner's parent artifact
  `reachkit-screen-system.html`, `tokens.css` (the source `src/ui/theme.css` carries exactly),
  `literals.md` (which values still have no token name) and the directory's own
  `design/approved/README.md`.
- `docs/DEPLOYMENT.md` — environments, the one Vercel project, bindings and cutover.
- `docs/RUNBOOK.md` — operating it alone: jobs, keys, the kill switch, the cost ledger, restore.
- `docs/pending-decisions.md` — the master's ruling queue, emptied into `DECISIONS.md` each batch.
- `docs/design-reference.md` — route → screen id → requirement → tests; read by
  `scripts/copy/owed.mjs`, which generates `docs/copy/owed.md`, the sheet of copy keys still owed.
- `docs/briefs/autopilot-quality-2026-09-10.md` — the owner's brief of 2026-09-10, already folded
  into the spec and `DECISIONS.md`; a brief is a source, never an authority.
- `archive/**` — the frozen 2026-09-04 sdlc-factory corpus, whose `REQ-*` acceptance criteria and
  `ADR-*` records are the detail an issue cites. **Nothing under `archive/` is ever edited or
  deleted.**

## How work happens

One GitHub issue = one branch = one PR. The PR body says `Closes #N`; every *Done when* box on
the issue is ticked; the five required checks are green (`typecheck · lint · unit`, `layout
conformance (browser)`, `schema · RLS (live Postgres)`, `closes one issue · done-when ticked`,
`audit` — `Vercel` is not a gate since 2026-09-09); the master approves and the lander merges.
Owner files (`BUILD.md`, `DECISIONS.md`, `ARCHITECTURE.md`, `.github/**`, `scripts/**`, the lint
and test configs) change only in their own docs PR. The whole process is `PROCESS.md`.

The system's job is to **write code**. Documentation exists for decisions, process and
architecture — nothing else.

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

## Operating it

Landing a change, rotating a key, running a job by hand, flipping the kill switch, reading the
cost ledger, a deployment that refuses to boot, backups and the restore drill — `docs/RUNBOOK.md`.
