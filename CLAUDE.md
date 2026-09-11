# reachkit

`tim-clifford6991/reachkit`. **Read `README.md` first**: what the product is, the MVP value chain in priority order, what *delivered* means, and the one authority table. Then read only what your issue cites — `BUILD.md` for the WHAT, `ARCHITECTURE.md` for where code lives, `PROCESS.md` for how an issue becomes a merge, `LATER.md` for what is deliberately not built. **`DECISIONS.md` is grepped by topic, never read whole.** Where the spec is silent, read the archive's `REQ-*` before asking; ask the owner once; the answer lands in `DECISIONS.md` (a product ruling) or in a `// SPEC §x.y` comment at the module (an implementation ruling).

**CI is the process.** Every rule that matters is a check in `.github/workflows/`, a lint rule in `eslint.config.mjs`, or a test. If you care about a rule and no check enforces it, add the check — do not add a paragraph here.

## How work flows (the whole of it is `PROCESS.md`)
- One GitHub issue = one branch = one PR. Never start without an issue. Branch `feat/<issue>-<slug>`, `fix/…`, `docs/…`.
- Locally: `npm run typecheck && npm run lint` and the test files for the source you changed. Never `next build`, the layout suite or a baseline regeneration on the box — CI runs those (`PROCESS.md` §5).
- PR body: `Closes #N` · what changed · how you verified it · owner owes · adjacent. The token table only if you touched tokens; a `Renders:` line only if you changed a screen; never a pasted render — CI composes it.
- Merge is not done. **Delivered** is live on production with real copy and a stranger walking the chain. The master lands PRs.

## Rules the code already enforces (don't work around them)
- Every pinned number lives in `src/lib/config/constants.ts`; nothing is inlined twice.
- Every byte leaving toward a customer URL goes through `src/lib/egress/safeFetch()`. Every vendor or LLM call goes through `src/lib/costs/`. Nothing outside `BUILD.md` §6.3's closed list ships.
- `src/lib/**` never imports from `src/app/**`. Only `@/lib/db` is imported from outside `src/lib/db`. Only `hasActiveAccess()` is imported from outside `src/lib/account/billing`.
- Every sentence the product speaks is a key in `src/lib/presentation/copy/`. **Copy travels one route** (2026-09-10): the master drafts it from v2 and the spec, the owner approves the sheet, you apply it byte for byte. A key with no approved value is `TODO(copy)`, flagged in the PR — you never write the sentence yourself.
- No generated prose except draft page content, always labelled (`GeneratedText`). No emoji. Every numeral is JetBrains Mono. No bare literal for a colour, radius, shadow, spacing, type size, measure or breakpoint — tokens only (`docs/design/approved/tokens.css` is the source; `src/ui/theme.css` carries exactly it).
- **A test proves behaviour a customer can observe.** No test transcribes a document; tests are at most a third of a chain PR's lines until the first paying user (`ARCHITECTURE.md` rule 5).

## Design
The approved set is `docs/design/approved/full-set/` (rendered set + `UI-SPEC.md`), derived from the owner's artifact `reachkit-screen-system.html`. Match it screen by screen; a new or changed surface is drawn in its idiom, approved by the owner, landed into the set, and only then built. The chart inventory and the component set are closed. Never design from v2 or from the archive's drawings.

## Don't
- Add settings that tune the engine (caps, cadences, model choice are constants).
- Add a dependency, a top-level directory, a vendor call or a root document without asking.
- Pad scope beyond the issue. Record adjacent work under *Adjacent* in your PR body — only the master files issues and merges to `main`.
- Edit `BUILD.md`, `DECISIONS.md`, `ARCHITECTURE.md`, `PROCESS.md`, `.github/**`, `eslint.config.mjs`, `vitest.config.ts`, `scripts/**` or `src/lib/config/` in a feature PR — the master lands those in docs PRs; name the amendment under *Owner owes* / *Corpus*.
- Touch `archive/` — the frozen 2026-09-04 corpus. Read it; never write to it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
