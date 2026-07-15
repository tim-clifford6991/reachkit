# Live verification — add-a-product flow (PR #72)

**Why this exists:** CLAUDE.md's hard rule — *"Always live-test with `REACHKIT_USE_FIXTURES=false` before trusting a change. Fixtures + eval + code-review all MASK real-adapter / LLM-on-mixed-content bugs."* Every step below needs an authenticated **Growth** session (magic-link to your inbox), so it cannot be automated from the agent side. This is the last gate before merge.

**Preview:** https://reachkit-git-feat-add-5185cd-timclifford101-gmailcoms-projects.vercel.app
**Account:** `timclifford101@gmail.com` (already `tier: growth` → 3 app slots).

Tick each. If any step fails, paste what you saw — the branch does not merge on a red step.

## 1. The core fix — you never touch the public funnel

- [ ] AppSwitcher → **+ Add product** → lands on **`/app/add`** *inside the shell* (sidebar visible), **not** `/scan`.
- [ ] Submit a brand-new domain → you land on the new product's dashboard with **live progress rendered in place** (spinner/steps on the dashboard itself).
- [ ] **You are never shown "Unlock full report" anywhere in this flow.** ← this is the whole point of the PR.
- [ ] You are never bounced to a `/scan/...` URL at any point, including when the scan completes.

## 2. Non-blocking — the owner decision

- [ ] **Mid-scan**, switch to your other product via the AppSwitcher. It must be **fully usable** — not greyed out, not behind an overlay.
- [ ] When product #2's scan finishes, no blocking overlay appears (you have 2+ apps, so the competitor pick must render in-page, not lock the app).
- [ ] Open `/app/plan` or `/app/audience/customers` for the new product → the competitor picker appears inline there.

## 3. Refusals cost nothing

- [ ] Submit a domain you **already track** → friendly "already tracking" refusal. No new product appears in the switcher.
- [ ] Fill your 3rd slot, then try a 4th → explicit **cap message + upgrade CTA** (not a silent failure, not an untracked scan).
- [ ] After the cap refusal, confirm on `/app/diagnostics` that **no new scan row** was created for it. *(This is the invariant-#2 fix: refusals must spend £0.)*

## 4. Dedupe / staleness (the 14-day policy)

- [ ] Add a domain with a **recent public scan** (something scanned today) → it should **deepen**: fast, no fresh collect, and the dashboard shows paid data (not free-tier).
- [ ] Confirm that product's data is **not** free-redacted — i.e. `deepened_at` is set. Check `/app/diagnostics`.

## 5. Cost attribution (invariant #2)

- [ ] On `/app/diagnostics`, the new scan shows populated `cost_cents` / `dataforseo_cost_cents`.
- [ ] No spend appears that isn't tied to a scan → and through `app_ids` → to your user. *Nothing spends money anonymously.*

---

## Known-outstanding (deliberately not fixed here)

- **DB-level cap enforcement** — the cap is check-then-act. A re-read bounds a double-add race but doesn't eliminate it (you'd have to race yourself).
- **Shared `apps` rows** — `apps` is keyed by URL globally, so two users tracking one URL share an `app_id`. Pre-existing; needs a multi-tenancy pass.
- `startScan` writes no `ip_hash`, so this entrypoint is invisible to the per-IP limiter (bounded by the tier cap).
- Raw `#e5484d` still in the two Settings forms (pre-existing token drift).
