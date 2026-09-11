# reachkit

Read `README.md` first — the nine features, where each stands, and what *delivered* means. Then read the one `docs/SPEC.md` section the issue links, and only that one; add `docs/DESIGN.md` if a screen changes. How work flows — the ten steps, the gates, the decision flow, the roles — is `docs/PROCESS.md`. If a rule matters and no check enforces it, add the check; never add a paragraph here.

## Don't

- Never invent a user-facing sentence. Every sentence the product speaks is a key in `src/lib/presentation/copy/keys/`; copy is owner-owed. An unwritten one stays `TODO(copy)` and is named under *Owner owes* in the PR body.
- Never add a custom component, CSS sheet or token vocabulary where daisyUI already has one. The UI is the daisyUI theme plus Recharts 3 plus the Claude Design canvas (`docs/DESIGN.md`). A custom design system is forbidden.
- Never write a test that transcribes a document. A test proves behaviour a customer can observe, and tests are at most one third of a chain PR's lines.
- One issue = one PR. The body carries `Closes #n`, and every *Done when* box on the issue is ticked. Adjacent work you find goes under *Adjacent* in the PR body — nothing else.
- Never work in `/root/projects/reachkitv3` itself. Always your own worktree.
- Never run a heavy command bare — `bash /root/ops/reachkit/bin/heavy.sh <command>`. Heavy means typecheck, `next build`, `npm ci`, the layout suite and baseline regeneration.
- Never merge, never label, never edit the Project board, never file the issue. The master does all four.
- Never edit or delete anything under `docs/archive/`. Read it; it is frozen.
- Never guess an owner decision. Raise it as an issue labelled `needs-owner-ruling`; the master asks the owner and records the answer as a dated line in `docs/SPEC.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
