# sdlc-factory corpus — frozen 2026-09-04

This directory is the complete SDLC Factory state of reachkitv3 at the moment the
process was retired for this project (DECISIONS.md, 2026-09-04). It is kept for
reference and is **read-only by convention**: nothing here is maintained, linted,
or tested, and no file here is an authority on anything. `eslint.config.mjs`
ignores it. Git history holds every earlier version.

## Why it was retired

Six days (2026-08-30 → 2026-09-04) produced 539 corpus documents (86,821 lines)
and 273 work orders against 67 source files (5,428 lines). 22 work orders were
done; 207 sat approved and unbuilt. Governance-grade traceability for a
one-owner MVP cost ~16× the product it traced, and the doctrine — prose an agent
had to interpret each session — was itself the medium drift grew in. The
replacement puts intent in three owner files and every rule that matters in a
machine check. See `../../CLAUDE.md`.

## What is here

| Path | Was | Now |
|---|---|---|
| `corpus/CLAUDE.md` | The factory constitution (442 lines) | Retired. `../../CLAUDE.md` (~40 lines) |
| `corpus/docs/requirements/` (126) | REQ-* atomic requirements | GitHub issues, milestones per BUILD §16 |
| `corpus/docs/blueprints/` (64) | BP-* feature nodes, interfaces, data model | `../../ARCHITECTURE.md` + the code |
| `corpus/docs/work-orders/` (273) | WO-* file-level plans | GitHub issues (clustered ~5:1); plans re-derived from code per PR |
| `corpus/docs/decisions/` (33) | ADR-* | `../../DECISIONS.md`, one dated line each, `ADR-nnn` pointer back here |
| `corpus/docs/journeys/` (7) | JN-* persona journeys | `tests/journeys/` — one e2e test per BUILD §3 arrow |
| `corpus/docs/design/` | previews, tokens, components, meaning-over-data audit | Approved artifacts remain the visual source of truth; link them from issues |
| `corpus/docs/registry/` | structure map, waves, capabilities, evidence | structure → ARCHITECTURE.md; waves → milestones; evidence stays here |
| `plugin/` | vendored sdlc-factory 0.13.2 (agents, commands, skills, console) | Removed from `.claude/`. Central repo `tim-clifford6991/sdlc-factory` untouched |
| `OWNER-QUESTIONS.md` | owner rulings 2026-09-03 | Rulings → DECISIONS.md; the one open item (Search Console) → issue `later` |
| `REQUIREMENTS-CONSOLIDATION.md` | 2026-08-30 corpus brief | Historical |
| `factory.config.json` | plugin config | Historical |

## State at freeze

- Branch `wave/W3` @ `0e74acf`. Wave W3 (the free report screen) was open:
  WO-283, 018, 276, 277, 278, 279, 280, 281, 282, 284 in progress; 282 and 286
  approved but unbuilt.
- WO-284 (boot environment: `SUPABASE_SERVICE_ROLE_KEY`, `NANO_API_KEY`
  optional, `DATABASE_URL` out of `Env`) had ~200 uncommitted lines in worktree
  `reachkitv3-wt/WO-284`. It becomes the first feature PR under the new process.
- Done: WO-001–003, 005, 006, 018, 029, 030, 041, 051, 056–058, 062, 070, 267–270,
  272, 274, 275.
- Known spec drift the corpus had found and BUILD.md had not absorbed: ADR-094
  (async AI Overviews on the free report) and the four 2026-09-03 UX rulings
  (driver bars, per-question volume, market-total footnote, Overview tiles).
  Tracked as an owner issue against BUILD.md.
- `tests/pins.test.ts` — named by BUILD §1 and by `vitest.config.ts`'s sequencer —
  did not exist yet (WO-007 approved, unbuilt). Tracked as an issue.

## How to read it

Every artifact has YAML frontmatter with `id`, `status`, and edges
(`satisfies`, `implements`, `depends-on`, `supersedes`). `REVIEW(...)` lines are
open questions the reviewer left. Statuses `superseded` mean a later artifact
replaced it — follow `supersedes`.
