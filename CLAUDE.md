# reachkit

Read `README.md` (nine features, what delivered means), then only the `docs/SPEC.md` section you are changing. Launch status is only `docs/GO-LIVE.md`. UI: `docs/DESIGN.md` — the stack, the theme, the shell, the names, and each screen's board. Flow, gates, worktrees and the queue: `docs/PROCESS.md`. Operating the box: `docs/RUNBOOK.md`. The owner tests live on `dev.reachkit.app`.

Ship the paying path. Prefer a library over new code. Follow **Current** in `docs/PROCESS.md`.

## Don't

- Never ship `TODO(copy)` in a customer-visible string (owner ruling 2026-09-16, #759). Keys live in `src/lib/presentation/copy/keys/`. Missing → draft the sentence in the registry’s voice, ship it, and name every new or changed string in the PR body so the owner can correct it.
- Never add a custom component, CSS sheet, token set, or SVG chart where daisyUI or Recharts covers it. Do not wrap daisyUI in a new `Btn`/`Card`.
- Never match pixels or copy markup from a board; it says what a screen holds, daisyUI classes say how it looks. Never add a UI dependency that is not on `docs/DESIGN.md`’s list.
- Never write a test that transcribes a document.
- Never guess an owner decision — `blocked-on-owner` and ask; record the answer as a dated SPEC line.
- Never add a merge gate beyond the four in `docs/PROCESS.md`. Coherence and the UI strategy checks live inside `audit` and `no overflow · axe`. One issue uses one worktree, removed when its pull request merges.
- Follow **Coherence** in `docs/PROCESS.md`. Owner feedback is classified before a worktree exists: an example of a parent is a comment on that parent, a word or a screen extends the strategy check, and a new condition is an issue with Surfaces, Invariants and Overlaps filled. The session that classifies does not also implement. Fill Conditions, Overlaps and Surfaces on the pull request. The owner's look at `dev.reachkit.app` is taste. It is not the check for a condition or a screen the gates already cover.
- The `seo-audit` skill does not open ReachKit issues. A finding it would file is classified under Coherence first. Vendor skills (daisyUI, Stripe, Supabase, Resend, Vercel) do not add a product rule.
- Never copy a rule into a memory file or into `/root/ops` that these pages do not already state.
- Never keep something only because a test, gate, ruling or approved file protects it; where a library does the job, delete the custom version and its test (owner 2026-09-25, `docs/PROCESS.md`, #1105).

One issue, one worktree branched from `origin/main`, then stop. Merge when the four gates in `docs/PROCESS.md` are green: `typecheck · lint · unit`, `audit`, `schema · RLS`, and `no overflow · axe`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
