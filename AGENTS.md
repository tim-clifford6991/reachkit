# AGENTS.md

This repository's rules of engagement live in **[CLAUDE.md](./CLAUDE.md)** — read it
first and treat it as authoritative, whichever agent or IDE you are (Cursor, Copilot,
Aider, Claude Code, …). It defines the invariants, the anchor files, the hard rules,
and the **Consistency harness + Change Protocol** that keeps architecture and the
Claude Design system from drifting.

Before you finish a change, the ratchet must stay green:

```
pnpm typecheck && pnpm lint && pnpm test && pnpm check:arch && pnpm check:design
```

- `pnpm check:arch` — layer/import boundaries (`.dependency-cruiser.cjs`).
- `pnpm check:design` — Claude Design ↔ codebase token/band/mirror parity (`scripts/check-design-parity.mjs`).

If a check fails, fix the code — do not weaken the check. To change an invariant on
purpose, follow the Change Protocol in CLAUDE.md (update the source, its guard, and the
docs in the same commit). Strengthen forward; never re-break the baseline.
