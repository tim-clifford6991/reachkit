# reachkit

Read `README.md` (nine features, what delivered means), then `docs/PROCESS.md` › Current, including Coherence: the rules, the queue, the space, the gates, spend and tests. Then only the `docs/SPEC.md` section you are changing. UI: `docs/DESIGN.md`. Operating the box and the vendors: `docs/RUNBOOK.md`. The owner tests live on `dev.reachkit.app`.

Ship the paying path. Prefer a library over new code.

## Don't

- Never add a custom component, CSS sheet, token set, or SVG chart where daisyUI or Recharts covers it. Do not wrap daisyUI in a new `Btn`/`Card`.
- Never match pixels or copy markup from a board; it says what a screen holds, daisyUI classes say how it looks. Never add a UI dependency that is not on `docs/DESIGN.md`’s list.
- The `seo-audit` skill does not open ReachKit issues. A finding it would file goes to the product manager first. Vendor skills (daisyUI, Stripe, Supabase, Resend, Vercel) do not add a product rule.
- Never copy a rule into a memory file or into `/root/ops` that these pages do not already state.
- Never use a general-purpose agent for work an agent in `.claude/agents/` or `~/.claude/agents/` covers (owner 2026-10-19). Another agent type is used only when none fits, and the brief says why.
- Never keep something only because a test, gate, ruling or approved file protects it; where a library does the job, delete the custom version and its test (owner 2026-09-25, #1105).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
