# reachkit

Read `README.md` first — the nine features, where each stands, and what *delivered* means. Then the one `docs/SPEC.md` section the work is for (and `docs/DESIGN.md` if a screen changes). How work flows is `docs/PROCESS.md`: issue → docs if needed → implement → merge when the three checks are green. The owner tests live on `dev.reachkit.app`. There is no factory.

Ship the paying path. Prefer an existing library over new code.

## Don't

- Never invent a user-facing sentence. Every sentence the product speaks is a key in `src/lib/presentation/copy/keys/`; copy is owner-owed. An unwritten one stays `TODO(copy)` and is named on the PR.
- Never add a custom component, CSS sheet or token vocabulary where daisyUI, Recharts 3 or the canvas already has one.
- Never write a test that transcribes a document. A test proves behaviour a customer can observe.
- Never guess an owner decision. Label the issue `blocked-on-owner` and ask; record the answer as a dated line in `docs/SPEC.md`.
- Never edit or delete anything under `docs/archive/`.
- Never reintroduce Master, Worker, dispatcher, lander, `rk-*` agents, mandatory worktrees, or extra merge gates.

Work in this checkout (or a local clone). Branch from `origin/main`, open a PR, merge when `typecheck · lint · unit`, `audit`, and `schema · RLS` are green.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
