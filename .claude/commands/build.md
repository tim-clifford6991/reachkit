---
description: Build one GitHub issue end to end in its own worktree — read the corpus in order, code + tests, checks, PR — then stop for the master's landing
argument-hint: <issue number>
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

Build issue #$ARGUMENTS. Follow `docs/PROCESS.md` §2 exactly; do not skip a step or add scope.

1. `gh issue view $ARGUMENTS`. It must have a `## Done when` checklist and a milestone; a screen issue must name its `S<id>` in `SPEC.md` §4.8. If any is missing, stop and say so. If the issue adds or changes a surface that is not in the approved set, stop: the design approval gate (PROCESS §4) comes first.
2. Read, in order: `CLAUDE.md` → the issue → the `SPEC.md` §§ it cites → `DECISIONS.md` (whole) → the `ARCHITECTURE.md` rows for the paths you will touch → for a screen, UI-SPEC.md §1 and the `S<id>` section → the REQ criteria the issue names (`archive/sdlc-factory-2026-09-04/corpus/docs/requirements/`).
3. Worktree, never the main checkout: `git fetch origin && git worktree add ../reachkitv3-wt/issue-$ARGUMENTS -b feat/$ARGUMENTS-<short-slug> origin/main` (`fix/` or `docs/` as fits), then `flock /tmp/npm-ci.lock npm ci` there.
4. Implement the issue and its tests. `// BUILD §x.y` at the top of each new module. Copy: the approved set's unbracketed strings are approved (ruling 11a); anything else is a key with `TODO(copy)`, listed in the PR. Never invent a sentence. Never edit an owner file (`SPEC.md`, `DECISIONS.md`, `ARCHITECTURE.md`, `.github/**`, `scripts/**`, `eslint.config.mjs`, `vitest.config.ts`, `src/lib/config/`); a documented fact you change is named under *Corpus* in the PR body.
5. Verify: `npm run typecheck && npm run lint && npx vitest run --project node --project ui --maxWorkers=2`; `--project db` when `supabase/` or `src/lib/db/` changed (substrate up first: `scripts/db-substrate/README.md`); the layout suite when anything visual changed, in the foreground under `flock /tmp/layout.lock` (PROCESS §5). `node scripts/drift-audit.mjs --strict` must report no finding.
6. Tick every `Done when` box you satisfied (`gh issue edit $ARGUMENTS --body …`); never an owner-review box. A box you could not satisfy stays unticked, and the PR says why.
7. Small conventional commits ending with the session's `Co-Authored-By` line. Push. `gh pr create` with the template: `Closes #$ARGUMENTS` · What changed · How I verified it · Owner owes · Corpus. A UI PR also carries the token table and the side-by-side render (approved set beside the build at 1280, every state touched).
8. `gh pr checks --watch`. Fix what you caused; a Vercel failure unrelated to the diff is named with its cause. Stop when green and report the PR URL. Do not merge — the master lands it.
