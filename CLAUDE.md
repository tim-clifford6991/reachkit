# ReachKit — operating guardrails

ReachKit is a discoverability engine: a user submits a store/site URL, we scan it, score how findable it is, and hand back a ranked plan of actions. Next.js 16 App Router on Vercel · heavy work in Inngest at `/api/inngest` (`maxDuration=300`) · Supabase (Postgres + RLS + pgvector).

This file is the **rules of engagement** — the invariants and hard rules that must survive edits. It does not restate the architecture; two companion docs do that and must be kept in sync when they change:

- **`docs/architecture.md`** — living structural doc (3 Mermaid diagrams: system, scan sequence, billing). Verified accurate 2026-07-08.
- **`docs/score-calibration.md`** — scoring bands + the open calibration problem.
- **Interactive process/invariant map** — https://claude.ai/code/artifact/e2b1232f-a7fb-4071-9bf4-627740998700 (clickable nodes + the invariant enforcement ledger). ⚠️ STALE SNAPSHOT (pre 2026-07-09): does not reflect the v4 on-site headline, external-cost tracking, or the `/app` nav fix — treat this file + `docs/architecture.md` as authoritative over the artifact; regenerate the artifact when convenient.

## Anchor files (start here)

| Concern | File |
|---|---|
| Scan orchestration spine | `lib/scan/full-scan.ts` |
| Scoring | `lib/scan/registry-score.ts`, `lib/scan/signals.ts`, `lib/scan/compute-signals.ts` |
| Cache-poison guards | `lib/scan/demand/gather.ts` |
| Billing redaction / gating | `lib/billing/entitlements.ts` |
| Config: the one flag + all keys | `lib/config/env.ts` |
| Auth session refresh | `middleware.ts`, `lib/auth/middleware.ts` |

## Invariants — do not break these

Each has (or should have) a guard test. Breaking one is a correctness regression, not a style nit. The load-bearing constants these restate (headline version, fixed-basis keys, pillar weights, `MAX_SELECTED`) are pinned by `lib/scan/documented-invariants.test.ts` — a change there is your signal to update this file + `docs/architecture.md` in the SAME commit.

1. **Free↔paid headline stability.** The headline gauge is `headlineScore` — `registryScore` over the **FIXED on-site basis** (`FIXED_BASIS_SIGNAL_KEYS`: the 8 HTML signals title/meta/schema/canonical/headings + content_depth/social_share/media). Those 8 are measured identically from the page HTML on free AND paid, so the number is **identical free↔paid — it never moves on upgrade** — and it equals the on-site pillar bars the dashboard shows (gauge == pillar average). `score_version 4` (2026-07-09). Off-site strength (keyword footprint, backlinks, marketplace/community/press) is NEVER in the headline — it is the separate **`marketPositionScore`** grade. Outreach has no on-site signal, so it is measured off-site only (in Market Position), not the headline. Guard: `registry-score.test.ts` asserts `headlineFromRows`/`headlineScore` give the same number with and without deep signals — on the REAL persisted path (full-scan 10a + free-report both call `headlineScore`). **History note:** PR #36 briefly made the headline `registryScore(all 18)` (v3), which folded off-site signals in and dropped the score on upgrade (free 74 → paid 66); v4 reverted the headline to the on-site basis and fixed the pillar bars to match.
2. **Cost caps (`ScanBudget`).** 60 tool-calls; cents free 15 / full 250 / weekly 120; `BudgetExceededError` on breach. Both heavy cost points (deep scan + competitor-select) bounded to `MAX_SELECTED=5` rivals, de-duped only by per-domain caches. NB: `ScanBudget` cents track **LLM only**; DataForSEO + Tavily spend is now *measured* per scan/user (`scans.{dataforseo,tavily}_cost_cents`, `lib/scan/cost-context.ts`) but **not** yet enforced against the cap — external spend is bounded only by the tool-call / `MAX_SELECTED` caps (see `docs/architecture.md` §4.3).
3. **Don't-cache-empties.** Never cache an LLM-failure `[]`; refuse stale blank rows on read-back (`isEmptyDemandIntel` / `buyerInsightsEmpty`).
4. **Always-insight action floor.** `topUpActions`+`linkSignalKeys` floor the plan to `MIN_ACTIONS` with deterministic fixes; the **market-aware re-floor** re-runs after market signals attach (the earlier floor ran with `market:null`). Floor cards bypass the critic by design.
5. **Per-category floor.** Every active category keeps ≥1 surviving safe action after the §11 cap. Guard: `tests/eval/golden-set.eval.test.ts`.
6. **Brand-ambiguity: discovery-only.** Competitor gap is built ONLY from the category-validated discovery set (`facts.competitors`). The raw "alternatives" extract may enrich matching names but must NEVER add competitors (acquire.io vs acquire.com class of bug).
7. **§11 algorithm safety.** Outreach cap 5 · divergence 0.92 · 1 action per evidence-host · every card `draftRequiresEdit=true` (no auto-send). `lib/scan/algorithm-safety.ts`.
8. **Abuse rate limit.** 10 scans / IP-hash / hour, 15-min in-flight window; only the IP hash is stored (`lib/scan/abuse.ts`).
9. **Terminal-status resilience.** A pipeline failure must leave a renderable `degraded` partial, never a permanent ACTIVE status.
10. **Deep-pass sentinel is `scans.deepened_at`** — NOT `report_payload` (both tiers write that now).

## Hard rules for working in this repo

- **Always live-test with `REACHKIT_USE_FIXTURES=false` before trusting a change.** Fixtures + eval + code-review all MASK real-adapter / LLM-on-mixed-content bugs (they return canned clean data). The `linear.app=22` SPA-fetch failure was invisible to the fixture suite.
- **Never run `pnpm build` while `next dev` is running** — it corrupts `.next` and looks like "no changes / stale UI".
- **`report_payload` is one JSON blob and older reports predate sections** — every consumer must null-coalesce (`?? []`). Don't add a typed per-domain intel table unless something reads it back (`demand_intel` is the one kept read-through cache; 7 write-only tables were retired).
- **`REACHKIT_USE_FIXTURES` is the only feature flag.** Owner-gated surfaces use `REACHKIT_OWNER_EMAILS`.
- **Inngest sync can go stale silently** — newer functions get dropped from Cloud; force with `PUT /api/inngest` and verify auto-sync-on-deploy.

## Claude Design & UI conventions (read before building any UI)

- **Tokens only — never arbitrary Tailwind values or raw hex.** The theme is the single seam: light in `app/globals.css` `@theme`, dark in the `.dark` overrides. Use the semantic tokens — Tailwind classes (`bg-surface`, `text-muted`, `text-accent`) or the CSS vars in inline styles (`var(--c-*)` semantic palette · `var(--color-*)` Tailwind theme · `var(--radius-*)`, `var(--elevation-*)`, `var(--font-*)`). NEVER `bg-[#6e56f7]`, `text-[13px]`, or raw hex — those break light/dark and drift from the system. Score-band colours are `--c-band-*`.
- **Reuse before you build — the inventory is the map.** What exists, what's active vs archived, and each component's live counterpart is `.design-sync/INVENTORY.md` (25 active atomic components · 20 page templates · a few archived). In the app itself, the two component kits are: **shadcn / Base UI primitives** in `@/components/ui` (`base-nova` style, `@base-ui/react`, lucide icons — command, dialog, tooltip, sonner, skeleton, info-tip) and the **`--c-*` intel kit** `@/components/app/intel/kit.tsx` (`Card`, `HeroCard`, `Badge`, `Gauge`, `Bar`, `Donut`, `KpiRow`, `DataTable`, `Tabs`, `Eyebrow`, `EvidenceLink`, …). Check both before writing anything new.
- **Import paths / conventions** (from `components.json`): `@/components`, ui = `@/components/ui`, utils = `@/lib/utils` (the `cn()` helper = `clsx` + `tailwind-merge` — use it for conditional classes), lib = `@/lib`, hooks = `@/hooks`. shadcn style is **`base-nova`** (Base UI, not Radix); icons are **lucide-react**. Server Components by default (`rsc: true`).
- **Compose from existing primitives before introducing anything new.** A new component must first be attempted as a composition of the `@/components/ui` primitives + the intel kit + existing design-system components. Only add a genuinely new atomic component when no combination works — and when you do, add it to the kit/inventory and (for Claude Design) `.design-sync/ds-src/` + `INVENTORY.md` in the same change. **Claude Design specifics:** page templates compose existing `ds-src` components (never hand-rolled lookalikes); a component is active only if a Page composes it (else `archived: true` in `layout.mjs`, delete-free); the build regenerates `_ds_manifest.json` and the `_ds_sync.json` sentinel must be re-armed **last** on upload or the pane looks stale. Full workflow in `.design-sync/NOTES.md` + `INVENTORY.md`.

## Consistency harness + Change Protocol (the ratchet — read before changing an invariant, a token, or a boundary)

Architecture and the Claude Design system are kept from drifting by **machine-checked** gates, not prose alone. The rule: **strict adherence, iterate forward, never go backwards.** A gate may be *strengthened*; it may never be weakened to make a regression pass. Non-Claude agents read the same rules via `AGENTS.md` (a pointer to this file).

**The four enforcement layers** (all run in CI; the last three also run on pre-commit):

| Layer | Command | Pins / enforces |
|---|---|---|
| Behavioral guard tests | `pnpm test` | Invariants #1 (`registry-score.test.ts`), #5 (`golden-set.eval` via `pnpm eval`), #7 (`algorithm-safety.test.ts`), #8 (`abuse.test.ts`), + scoring guards. |
| Doc-contract tripwire | `pnpm test` → `lib/scan/documented-invariants.test.ts` | The load-bearing constants restated in this file: headline v4, `FIXED_BASIS_SIGNAL_KEYS` (8), `PILLAR_WEIGHTS`, `MAX_SELECTED`, `MIN_ACTIONS`. |
| Architecture boundaries | `pnpm check:arch` (`.dependency-cruiser.cjs`) | Layer imports from `docs/architecture.md`: `lib ✗→ app` · scan/llm/billing `✗→ components` · Anthropic SDK only in `lib/llm` · Supabase only in `lib/db`/`lib/auth`/`middleware.ts` · production `✗→` dev scaffolding (`app/design`, `app/test-*`, `app/api/test-*`). |
| Design parity | `pnpm check:design` (`scripts/check-design-parity.mjs`) | Claude Design ↔ code: every `--c-*` in `app/globals.css` equals `.design-sync/tokens.css` (light+dark); `--c-band-*` equals `SCORE_BANDS` in `score-bands.ts`; every `@mirrors <path>` in `.design-sync/ds-src/*.tsx` resolves to a live file. |

**Design token source of truth.** App tokens live in `app/globals.css` (`@theme` light + `.dark`). The committed DS mirror is **`.design-sync/tokens.css`** (parity-checked; `layout.mjs` copies it into the gitignored `ds-bundle/tokens/tokens.css` on build — it is no longer re-fetched from the remote project). To change a token: edit `app/globals.css` AND `.design-sync/tokens.css` together, then `pnpm check:design`. Score-band colors change only in `score-bands.ts` → mirror into `globals.css` `--c-band-*` (and thus `.design-sync/tokens.css`). New design-system component → add its `ds-src` file with a `/* @mirrors <live-path> */` tag.

**The Change Protocol.** To change an invariant, a token, or a layer boundary *on purpose*, update all of these **in the same commit**: (1) the source constant / token / rule, (2) its guard/parity check, (3) this file (`CLAUDE.md`), (4) `docs/architecture.md` if structural. CI enforces the mechanical half; this protocol names the human half. New invariant → it gets a guard (test, arch rule, or parity check) *before* merge, and this table is updated. Never delete a check without a documented reason in the commit body.

> Node note: `check:arch` runs dependency-cruiser via its programmatic API (`scripts/check-arch.mjs`) so it works on non-LTS node (25) as well as CI's node 22. The `env-only-in-lib/config` invariant is **not** yet an arch rule (env access isn't an import edge; ~10 call sites remain) — a known follow-up.

## Known open risks (steer around these)

- **Score calibration is unresolved and unenforced** (the one red rule): headline fails band-separation on live data — SPA-fetch→SEO=0 gives false lows, tidy pages give false 100s. `scripts/score-calibration.mts` is a live tool, NOT run in CI.
- **Dev scaffolding surface** — `app/test-*`, `app/api/test-*`, `app/design/*` must be confirmed gated/removed before prod exposure. (`pnpm check:arch` now blocks production code from *importing* them, but does not gate the routes themselves.)
- **Cohort cache-key stability** — deep-scan vs competitor-select cost de-dup relies entirely on per-domain cache keys; a key drift silently doubles DataForSEO spend.
- **`audienceProxy` always 0** — the YouTube 2nd `videos.list` call is never made; creator reach is a placeholder.

## Commands

- `pnpm test` — unit · `pnpm test:int` — integration (needs local Supabase) · `pnpm eval` — golden-set
- `pnpm check:arch` — layer/import boundaries · `pnpm check:design` — Claude Design ↔ code token/band/mirror parity (the ratchet; see "Consistency harness")
- `pnpm dev` + `pnpm dev:inngest` — local (Inngest must run alongside)
