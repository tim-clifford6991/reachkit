# reachkit

Read `README.md` (nine features, what delivered means), then only the `docs/SPEC.md` section you are changing. UI: `docs/DESIGN.md` — three rules (daisyUI, Recharts, lucide). Flow: `docs/PROCESS.md`. The owner tests live on `dev.reachkit.app`.

Ship the paying path. Prefer a library over new code. Do not open `docs/archive/`.

## Don't

- Never invent a user-facing sentence. Keys live in `src/lib/presentation/copy/keys/`. Missing → `TODO(copy)` on the PR.
- Never add a custom component, CSS sheet, token set, or SVG chart where daisyUI or Recharts covers it. Do not wrap daisyUI in a new `Btn`/`Card`.
- Never “match the artboard.” There is no artboard in the process.
- Never write a test that transcribes a document.
- Never guess an owner decision — `blocked-on-owner` and ask; record the answer as a dated SPEC line.
- Never edit `docs/archive/`.
- Never reintroduce Master, Worker, dispatcher, lander, `rk-*` agents, mandatory worktrees, or extra merge gates.

Work in `/root/projects/reachkitv3` on a branch from `origin/main`. Merge when `typecheck · lint · unit`, `audit`, and `schema · RLS` are green.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
