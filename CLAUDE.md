# reachkitv3

**Read `docs/README.md` first** — the corpus map: which document governs what, in which order, and what keeps each one honest. In one line: `DECISIONS.md` (rulings) → `BUILD.md` (the spec) → `docs/design/approved/full-set/UI-SPEC.md` (the UI spec of record; every screen is an `S<id>` there) → `ARCHITECTURE.md` (where code lives) → `DATA-COSTS.md` (the price book) → the archived requirements and decisions (`archive/sdlc-factory-2026-09-04/corpus/docs/{requirements,decisions}`, the detail behind BUILD; its *drawings* are superseded). Where BUILD is silent, read the archive's REQ before asking; ask the owner once; the answer lands in `DECISIONS.md`.

**CI is the process.** Every rule that matters is a check in `.github/workflows/`, a lint rule in `eslint.config.mjs`, or a test. If you care about a rule and no check enforces it, add the check — do not add a paragraph here. The full process is `docs/PROCESS.md`.

## How work flows
- One GitHub issue = one branch = one PR. Never start without an issue. Branch `feat/<issue>-<slug>`, `fix/…`, `docs/…`.
- Read, in order: the issue · the `BUILD.md` § it cites · `DECISIONS.md` (whole) · the `ARCHITECTURE.md` rows for the paths you touch · for a screen, `UI-SPEC.md` §1 and its `S<id>` · the REQ criteria the issue names.
- `npm run typecheck && npm run lint && npm test` green locally before opening a PR. CI runs the same and will not pass otherwise.
- PR body: `Closes #N` · what changed · how you verified it · owner owes. A UI PR also carries the token table and the side-by-side render against the approved set. The `pr-hygiene` check fails without `Closes #N` and without every `Done when` box ticked.
- Merge is done. Nothing else counts as done. The master lands PRs; the owner steers on dev.

## Rules the code already enforces (don't work around them)
- Every pinned number lives in `src/lib/config/constants.ts`; nothing is inlined twice.
- Every byte leaving the process toward a customer URL goes through `src/lib/egress/safeFetch()`. Every vendor or LLM call goes through the cost seam in `src/lib/costs/`. Nothing outside `BUILD.md` §6.3's closed list ships.
- `src/lib/**` never imports from `src/app/**`. Only `@/lib/db` is imported from outside `src/lib/db`. Only `hasActiveAccess()` is imported from outside `src/lib/account/billing`.
- Every sentence the product speaks is a key in `src/lib/presentation/copy/`. Copy is the owner's: the approved set's unbracketed strings are approved (ruling 11a); anything else is a key with `TODO(copy)`, flagged in the PR. Never invent a sentence.
- No generated prose anywhere except draft page content, always labelled (`GeneratedText`).
- No emoji in the product. Every numeral is JetBrains Mono. No bare literal for a colour, radius, shadow, spacing, type size, measure or breakpoint — tokens only (`docs/design/approved/tokens.css` is the source; `src/ui/theme.css` carries exactly it).

## Design
The approved prototype is `docs/design/approved/full-set/` (rendered set + `UI-SPEC.md`), derived from the owner's artifact `docs/design/approved/reachkit-screen-system.html`. Match it screen by screen; a new or changed surface is drawn in its idiom, approved by the owner as an artifact, landed into the set and UI-SPEC.md, and only then built. The chart inventory (§2.4) and the component set (§2.2) are closed. Never design from v2 or from the archive's drawings.

## Don't
- Add settings that tune the engine (caps, cadences, model choice are constants).
- Add a dependency, a top-level directory, or a vendor call without asking.
- Pad scope beyond the issue. If you find adjacent work, open an issue for it.
- Edit `BUILD.md`, `DECISIONS.md`, `ARCHITECTURE.md`, `.github/**`, `eslint.config.mjs`, `vitest.config.ts`, `scripts/**` or `src/lib/config/` in a feature PR. The corpus is maintained by the master in docs PRs (owner ruling 2026-09-08); a code PR that changes a documented fact names the amendment under *Owner owes* / *Corpus* in its body.
- Touch `archive/` — it is the frozen 2026-08-30 → 2026-09-04 sdlc-factory corpus. Read it for requirements and decisions; never write to it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
