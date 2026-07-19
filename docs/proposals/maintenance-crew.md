# Proposal: ReachKit Maintenance Crew — a standing team of scheduled agents

> **Status:** Proposal, not yet built. Parked for a later session to pick up.
> **Author:** Claude (planning session, 2026-07-17)
> **Scope of the eventual build:** 3 project-scoped subagent definitions (`.claude/agents/*.md`) + 3 scheduled routines + a report destination. Nothing here is implemented yet.

## Context — why this

ReachKit already has an unusually strong *deterministic* harness (`check:arch`, `check:design`, tripwires, mobile/render smoke, eval, `check:live`) plus generic review subagents. But there are **no project-scoped agents** (`.claude/agents/` doesn't exist), and every gate that exists is blind to the exact failure class the project's history records over and over:

- fabricated user reviews rendered under "every claim grounded in your live page" (fixtures masked it — no fixture takes a "zero reviews" arg)
- 3 of 4 numbers on the free-scan panel not measuring what their labels say; "18 signals" when we measure 9
- the AppShell card reading "Progress" for weeks after the live nav became "History" — `check:design` reported OK the whole time, *including right after a bless*
- the in-app upgrade that never deepened; 8 clean per-task reviews that still shipped a dead-end CTA ejecting paying users

These share one root: **nobody exercised the real rendered effect, ran `fixtures=false`, checked a number against its label, hunted the sibling defect, or proved a guard actually bites.** Deterministic checks structurally cannot do that judgment work. Neither can a source-only code reviewer.

**Goal:** regularly-running agents that (a) maintain the project against the guardrails, (b) surface insight from tracking about what's working/not, and (c) drive conversion + retention. Deliver a **crew of three specialist subagents + three scheduled routines** that run them on a cadence and file actionable, ranked findings — **propose-only, never auto-merge** (matches the `draftRequiresEdit` culture).

## The crew (3 subagents + 3 routines)

Each agent is a `.claude/agents/<name>.md` file (frontmatter: `name`, `description`, `model`, `tools`) whose system prompt bakes in the relevant owner rules. Each is invocable manually at any time **and** driven weekly by a routine that files a report.

---

### 1. `verification-auditor` — the skeptic (Quality & honesty)

**Charter.** Operationalizes the three hardest owner rules: *fix the CLASS not the case*, *look for what nobody is looking for*, *a guard you haven't SEEN FAIL is not a guard*. It never trusts source or the DB payload — it exercises the live effect.

**What it does each run:**
- **Free-report honesty sweep (the conversion surface).** Follows the CLAUDE.md rule literally: scan three archetypes against **prod** — a directory, a 0-ranking brand-new product, a normal SaaS — via `POST https://reachkit.app/api/scan`, poll to terminal, then **headless-render each `/scan/<slug>` result** (the `scripts/render-smoke.mjs` / `score-calibration.mts` pattern, system Chrome `--dump-dom`) and read the *actual rendered text*. Scanning prod means spend is already cost-attributed — no local paid keys needed.
- **Numbers-vs-labels audit.** For every metric shown on the free panel, trace it to its source and assert it measures what its label claims (the recurring `captureRate = score`, "18 signals"/9-measured, four "monthly searches" definitions class). Any label whose value is assigned rather than measured is a finding.
- **Class-defect hunt.** For each surfaced issue, name the class and enumerate siblings: the branch that can never render, the guard that can't bite, the metric that's silently garbage, the path with the same defect.
- **Guard-bite proofs.** When it proposes or reviews a guard, it **proves the guard bites in an isolated git worktree** (`isolation: worktree`): break the production code the guard protects, run the guard, watch it fail with real output, `git diff --stat` to confirm the mutation applied, revert. A guard it hasn't seen fail is reported as unverified. Uses `expectCallsSymbol` (`lib/testing/tripwire.ts`) for any new source tripwire.
- Optional real-adapter pass: on a schedule with keys present, run a bounded `REACHKIT_USE_FIXTURES=false` local scan to catch LLM-on-mixed-content bugs fixtures hide.

**Tools:** `Bash`, `Read`, `Grep`, `Glob`, `WebFetch`, `Explore`. Runs guard-bite mutations under worktree isolation. **Model:** opus. **Never** writes to main, never auto-fixes — files findings.

**Cadence:** weekly (bounded prod spend, ~3 scans/run) + on-demand after a free-report change.

---

### 2. `growth-insights-analyst` — the tracking read (Marketing / conversion / retention)

**Charter.** Turn the wired PostHog project (`reachkit`, id 290731) into a weekly, prioritized conversion+retention brief. What's working, what's leaking, what to try next.

**What it does each run:**
- **Scan→paid funnel** — where the drop-off is (landing → scan submit → free report render → checkout → provisioned/deepened). Cross-references shipped funnel/CTA fixes (dead landing CTAs, "Most popular"→Solo).
- **Retention cohorts** — do scanned/paid users come back; do tracked products get re-scanned; weekly-refresh engagement.
- **Free-report engagement** — heatmap/scroll/rageclick on the conversion surface (PostHog `assessing-heatmaps` skill); which panels correlate with checkout.
- **Error/health impact on conversion** — error-tracking + APM issues that sit on the funnel path.
- **Output:** a ranked list of 3–5 conversion/retention levers with the evidence behind each, plus 1–2 concrete experiment proposals (hypothesis, metric, variant) — *proposals only*, wired to `configuring-experiment-*` skills but not created without approval.

**Tools:** PostHog MCP (`exec`, SQL/query, insights, error-tracking, heatmaps), `Read`, `WebFetch`. **Read-only** — costs nothing, safe to run often. **Model:** opus.

**Cadence:** weekly.

> ⚠️ **Setup dependency (honest limitation):** interactively-authenticated MCP (PostHog) *may be absent in headless/cron runs*. If the routine can't reach PostHog MCP, this agent must run **interactively** on a weekly reminder, or the routine's env needs a PostHog **personal API key** wired for non-interactive use. Confirm before relying on it.

---

### 3. `drift-sentinel` — the ratchet watchdog (Consistency)

**Charter.** Catch the drift the deterministic gates can't see, and enforce the Change Protocol after the fact.

**What it does each run:**
- Runs the full ratchet (`typecheck`, `lint`, `test`, `check:arch`, `check:design`) and, with a read-only Stripe key, `check:live` — the code↔cloud drift tripwire (dead-domain webhook class).
- **DS bless-blindness patrol** — enumerates cards where `check:design` says OK but a live label/layout may have drifted (the "Progress"/"History" class a bless cannot silence); flags each for a human diff (never blesses).
- **Invariant-without-a-guard patrol** — cross-checks CLAUDE.md invariants against `documented-invariants.test.ts` + tripwires; reports any load-bearing rule with no machine check.
- **Doc drift** — flags where `docs/architecture.md` / CLAUDE.md diverge from code touched since last run.

**Tools:** `Bash`, `Read`, `Grep`, `WebFetch`. **Model:** sonnet (mostly mechanical). Read-only + report.

**Cadence:** on production deploy (aligns with the existing `inngest-sync` deploy hook) + weekly.

---

## Output contract (all three)

- Each run writes a dated report to `docs/audits/YYYY-MM-DD-<agent>.md` **on a branch** and opens **one GitHub issue** (`gh`) with findings **ranked most-severe first**, labeled `audit:<agent>`. De-dupe against open issues so the same finding doesn't refile weekly.
- `growth-insights-analyst` additionally publishes a **private Artifact dashboard** (trend viz per the `dataviz` skill) so the funnel/retention is scannable at a glance.
- **Hard rule for every agent:** propose, never dispose. No pushes to main, no auto-merge, no experiment/flag creation. Fixes come as **draft PRs** only when explicitly low-risk and requested; default is report-only. Mirrors the owner "confirm hard-to-reverse actions" + `draftRequiresEdit` culture.
- Every agent's system prompt embeds: *verify the effect not a proxy · verify the mutation applied · never fabricate a number, degrade instead · fix the class.*

## Files the build will create

| Path | What |
|---|---|
| `.claude/agents/verification-auditor.md` | Skeptic subagent def (frontmatter + system prompt with the 3 hard rules + the free-report render / numbers-vs-labels / guard-bite loop) |
| `.claude/agents/growth-insights-analyst.md` | PostHog funnel/retention subagent def |
| `.claude/agents/drift-sentinel.md` | Ratchet + Change-Protocol watchdog def |
| `.claude/agents/README.md` | One-screen index: what each agent is, cadence, cost, how to run manually |
| `docs/audits/.gitkeep` | Report destination |

**Scheduled routines** (created via the `schedule` skill → CronCreate, one per agent) — not files in-repo; they invoke the subagents on the cadences above and deliver the issue/report. Requires cloud agents enabled on the account.

## Reuse (don't rebuild)

- Live render: `scripts/render-smoke.mjs`, `scripts/render-mobile.mjs`, `scripts/lib/render-shared.mjs`.
- Prod scan-and-read-back loop: `scripts/score-calibration.mts` (`POST /api/scan` → poll → read score/band). Auditor reuses this shape.
- Authed `/app/*` render: `scripts/dev-auth-session.mjs` (local magic-link minter).
- Guard-bite helper: `lib/testing/tripwire.ts` `expectCallsSymbol`.
- Cloud drift: `scripts/check-live-config.mts`.
- The generic `code-reviewer` / `security-compliance-auditor` subagents stay as-is — the new crew is orthogonal (live effect + tracking, not source review).

## Honest constraints / risks (steer around)

1. **Cost.** The auditor spends real money per prod scan (DataForSEO/Anthropic/Tavily, cost-attributed). Weekly × 3 archetypes is bounded and cheap; do **not** raise cadence to daily/hourly without re-checking the soft caps (`EXTERNAL_SCAN_CAP_CENTS_*`).
2. **Headless MCP gap.** PostHog (and other interactively-authed) MCP may be unavailable in cron runs — growth agent may need an API key in the routine env or a weekly *reminder* to run interactively.
3. **No auto-apply.** By design these agents never touch main. If the auditor should later open fix PRs, that's an explicit follow-up (draft PRs, human merge).
4. **Scheduled cloud agents required.** The "regularly running" half needs cloud routines enabled; otherwise the subagent defs still work as on-demand `/agents`.

## Verification (how we'll know it works)

1. **Dry-run each agent manually** before scheduling: invoke `verification-auditor` against prod on the three archetypes and confirm it (a) renders live text, (b) catches at least one real numbers-vs-label or class finding, (c) files a ranked issue. Invoke `growth-insights-analyst` and confirm it returns a funnel with evidence + a dashboard. Invoke `drift-sentinel` and confirm it runs the ratchet + flags at least the known-open DS/doc drifts.
2. **Guard-bite self-test:** confirm the auditor, when handed a guard, actually breaks prod code in a worktree, sees red, and reverts (`git diff --stat` clean after) — i.e. it obeys its own rule.
3. **Then schedule** the three routines and watch the first weekly cycle produce three issues + one dashboard. Tune cadence/scope from the first run.
