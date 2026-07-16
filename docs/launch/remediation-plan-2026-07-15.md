# Launch Remediation Plan — 2026-07-15 review findings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear every P0/P1/P2 finding from the 2026-07-15 four-track launch review so ReachKit can take real money safely, plus adopt the process gaps the review exposed.

**Architecture:** Six phases, ordered by revenue risk: (0) revenue rescue — dashboard/config fixes that make the first sale survivable, (1) honest storefront — one copy/legal PR, (2) observability wiring, (3) merge PR #72, (4) the one live money test, (5) P2 hardening PR, (6) process adoptions. Phases 1 and 5 are code PRs with tests; 0, 2 (mostly), 3 (half), and 4 are owner actions with exact steps. Tasks marked **[OWNER]** need Tim (dashboard access / real card / inbox); everything else is agent-executable.

**Tech Stack:** Next.js 16 App Router · Supabase · Stripe · Inngest · Vercel · PostHog · the repo's consistency harness (`pnpm test` / `check:arch` / `check:design` / bless workflow).

## Global Constraints

- **Change Protocol (CLAUDE.md):** any invariant/token/boundary change updates source + guard + CLAUDE.md + `docs/architecture.md` in the SAME commit. Gates only ever strengthen.
- **Design sync:** live component edits update their `ds-src` mirror in the same change; token edits touch `app/globals.css` AND `.design-sync/tokens.css`; card edits require rebuild (`node .design-sync/ds-src/build.mjs && node .design-sync/ds-src/layout.mjs`), `node scripts/gen-card-labels.mjs`, `/design-sync` upload (sentinel last), `pnpm bless:design -- <Cards>`. **Never bless a card you haven't diffed.** Archive via `archived: true` in `layout.mjs`, never delete files.
- **Tokens only** — no raw hex / arbitrary Tailwind values in any UI change.
- **Never fabricate a number or a customer.** Degrade, never invent.
- **Env access only via `lib/config/env.ts`** (ESLint-enforced); adding a prod-required key ⇒ also add it to the CI dummy-keys block in `.github/workflows/ci.yml` (recurring gotcha #3).
- **Never run `pnpm build` while `next dev` is running.**
- Local dev/build/int-tests need `INNGEST_SIGNING_KEY=local-dummy` (missing from `.env.local`).
- Branch protection is strict: every open PR needs "Update branch" after each merge to main.
- Free-report changes are verified by **rendering the live page**, not the DB payload.

---

## Phase 0 — Revenue rescue (do today, before anything else)

### Task 0.1 [OWNER] Repoint the live Stripe webhook endpoint

**Why:** endpoint `we_1TiGhTIFnqPzUa4cwPcW7jaE` targets dead `https://reachkit-pi.vercel.app/api/billing/webhook` (308 → reachkit.app; Stripe does not follow redirects). First real purchase = charged, never provisioned.

- [ ] **Step 1:** Stripe Dashboard (LIVE mode) → Developers → Webhooks → open the endpoint → **Edit** → change URL to `https://reachkit.app/api/billing/webhook`. **Edit in place — do NOT create a new endpoint** (a new one mints a new signing secret and invalidates `STRIPE_WEBHOOK_SECRET` in Vercel).
- [ ] **Step 2:** In the same edit, remove `customer.subscription.trial_will_end` from enabled events (dead — trial removed in P2/#62). Keep: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
- [ ] **Step 3:** Enable webhook-failure email alerts: Stripe Dashboard → Settings → (Business) Notifications → turn ON emails for failing webhook endpoints.
- [ ] **Step 4:** Verify: from the endpoint page use **"Send test event"** → `checkout.session.completed` → expect HTTP 200 in the delivery log. (The handler will 200-and-skip an unknown session — that's fine; we're proving reachability + signature, not provisioning.)

### Task 0.2 Require `STRIPE_PRICE_GROWTH` in prod (code)

**Files:**
- Modify: `lib/config/env.ts:28-32`
- Test: `lib/config/env.test.ts`
- Modify (if key absent): `.github/workflows/ci.yml` (dummy-keys block)

**Interfaces:** Produces: `STRIPE_REQUIRED_KEYS` now includes `"STRIPE_PRICE_GROWTH"`. Consumed by the prod boot assertion already in `env.ts`.

- [ ] **Step 1: Write the failing test** in `lib/config/env.test.ts`, alongside the existing prod-required assertions:

```ts
it("requires STRIPE_PRICE_GROWTH in production (a deploy missing it must fail at boot, not at Growth checkout)", () => {
  expect(STRIPE_REQUIRED_KEYS).toContain("STRIPE_PRICE_GROWTH");
});
```

If `STRIPE_REQUIRED_KEYS` isn't exported, export it as `export const STRIPE_REQUIRED_KEYS = [...] as const;` (it's currently module-private; exporting a readonly const is safe).

- [ ] **Step 2:** Run `pnpm vitest run lib/config/env.test.ts` → expect FAIL (`STRIPE_PRICE_GROWTH` not in list).
- [ ] **Step 3: Implement** — in `lib/config/env.ts`:

```ts
const STRIPE_REQUIRED_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_SOLO",
  // Growth is sold on /pricing — a deploy missing its price id must fail at
  // boot, not silently at the Growth checkout button (launch review 2026-07-15).
  "STRIPE_PRICE_GROWTH",
] as const;
```

- [ ] **Step 4:** Run the test again → PASS. Then `grep STRIPE_PRICE_GROWTH .github/workflows/ci.yml` — if the CI dummy-keys env block lacks it, add `STRIPE_PRICE_GROWTH: price_dummy` next to the existing `STRIPE_PRICE_SOLO` dummy (gotcha #3: fixtures=false integration job parses env).
- [ ] **Step 5:** `pnpm test` (full unit suite) → green. Commit:

```bash
git add lib/config/env.ts lib/config/env.test.ts .github/workflows/ci.yml
git commit -m "fix(env): require STRIPE_PRICE_GROWTH in prod — fail at boot, not at Growth checkout"
```

### Task 0.3 [OWNER] Set `REACHKIT_OWNER_EMAILS` in Vercel Production

**Why:** owner gate fails closed → `/app/diagnostics` (cost visibility) is inaccessible even to you.

- [ ] **Step 1:** Vercel dashboard → reachkit project → Settings → Environment Variables → Add: name `REACHKIT_OWNER_EMAILS`, value `timclifford101@gmail.com`, environment **Production** only, plain (not sensitive — it's just an email). **Do not pipe via CLI `vercel env add`** (known empty-sensitive-var gotcha); the dashboard form or REST API are both safe for a plain var.
- [ ] **Step 2:** Redeploy (env applies next-deploy-only — "still locked out" right after saving is not a bug).
- [ ] **Step 3:** Verify: log in on prod → open `https://reachkit.app/app/diagnostics` → page renders (per-scan costs + cost-alert strip visible).

### Task 0.4 [OWNER] Three dashboard toggles

- [ ] **Vercel Skew Protection:** Project Settings → Advanced → Skew Protection → ON (Pro feature; flagged "enable before launch" in `docs/launch/ops-notes.md`). Verify per that doc: deploy twice, click around an old tab.
- [ ] **Supabase Site URL:** Dashboard → project `kleepxxddbcnfsfwudoe` → Authentication → URL Configuration → Site URL = `https://reachkit.app`; redirect URLs include `https://reachkit.app/**`. Verify by sending yourself a magic link and checking the link's host.
- [ ] **Supabase leaked-password protection:** Authentication → Providers/Policies → enable leaked-password protection (one toggle; advisor WARN).

---

## Phase 1 — Honest storefront (one PR: copy + legal)

Branch: `launch/honest-storefront` off main. Every live-file edit in Tasks 1.1–1.5 has a `ds-src` mirror consequence collected in Task 1.7 — do the mirrors in the same PR.

### Task 1.1 Delete the fabricated testimonials

**Files:**
- Modify: `components/sections/captured/landing-html.ts:144-159` (the whole `<section>` containing the three quote cards)
- Modify: `.design-sync/ds-src/layout.mjs:82` (archive the card)

- [ ] **Step 1:** In `landing-html.ts`, delete lines 144–159 — the entire `<section style="max-width: 1180px; margin: 0px auto; padding: 64px 28px;">…</section>` that contains the Mara K. / Devon T. / Avi R. cards. Nothing replaces it: the CompanyTicker ("Companies we've analyzed") is the honest social proof and already renders elsewhere on the page. Do NOT write new testimonials.
- [ ] **Step 2:** Archive the DS card — in `.design-sync/ds-src/layout.mjs` change line 82 to:

```js
  Testimonials:     { group: "Marketing", render: "{}", archived: true },
```

(Delete-free archival per CLAUDE.md; the file `Testimonials.tsx` stays, exempt from mirror enforcement once archived.)

- [ ] **Step 3:** Render-verify locally: `pnpm dev`, open `http://localhost:3000/`, confirm the landing flows from the comparison table straight to "Built for you" with no orphan spacing, and no named quotes anywhere (`curl -s localhost:3000 | grep -c "Mara K"` → 0).
- [ ] **Step 4:** Commit: `git commit -am "fix(landing): remove fabricated testimonials (locked decision + EU UCPD) — archive DS card"`

### Task 1.2 Fix the score-model FAQ answer

**Files:**
- Modify: `components/sections/captured/pricing-html.ts:107`
- Modify: matching copy in `.design-sync/ds-src/PricingScreen.tsx` (Task 1.7 rebuilds)

- [ ] **Step 1:** Replace the FAQ answer at `pricing-html.ts:107` (currently "A weighted sum of 18 signals…") with copy that matches the shipped v5 unified score:

```html
<div style="font-size: 14px; line-height: 1.6; color: var(--c-muted);"><span class="sc-interp">Two 0–100 drivers multiplied together: on-page readiness (8 on-site fundamentals of your page) and search presence (your real ranked keywords). Both have to be strong — a perfect page nobody finds still scores low. Both drivers are broken out in your report.</span></div>
```

- [ ] **Step 2:** Sweep for other stale descriptions: `grep -rn "weighted sum" components/ content/ .design-sync/ds-src/` → fix every hit with the same sentence. (`results-screen.tsx:478` "18 signals" footnote is CORRECT — 18 signals exist in the breakdown — leave it.)
- [ ] **Step 3:** Commit: `git commit -am "fix(pricing): FAQ describes the shipped v5 score (geomean of two drivers), not the retired 18-signal sum"`

### Task 1.3 Fix pricing feature drift

**Files:**
- Modify: `components/sections/captured/pricing-html.ts:27,49-50,83-89`
- Modify: `components/sections/captured/landing-html.ts:229-230`
- Verify-then-modify: `app/(marketing)/pricing/page.tsx:12`

- [ ] **Step 1:** "Ranked fixes: All 7" is false (real floor `MIN_ACTIONS=5`, cap `MAX_ACTIONS=8` — `lib/scan/action-linking.ts:30,32`). At `pricing-html.ts:49` and `:50` replace `All 7` with `Full plan (up to 8)`.
- [ ] **Step 2:** Delete the two phantom Growth features — no shipped feature matches either:
  - `pricing-html.ts:27`: remove `<div>✓ Shareable score cards</div><div>✓ One-click public teardowns</div>` from the Growth bullet list (keep "Everything in Solo / Track 3 products / 50-keyword rank depth").
  - `pricing-html.ts:83-89`: delete both full feature-table rows ("Shareable score cards", "One-click public teardowns").
  - `landing-html.ts:229-230`: same two `<div>✓ …</div>` lines — delete.
  Do NOT invent replacement bullets.
- [ ] **Step 3:** Annual claim: run `grep -n "annual\|Annual\|yearly" components/sections/captured/pricing-html.ts components/app/pricing-plans.tsx 2>/dev/null` and load the live `/pricing` page. **If** no annual billing toggle actually renders, change `app/(marketing)/pricing/page.tsx:12` to:

```ts
    "Your first scan is free. From €59/mo to turn the report into a weekly action engine. No lock-in.",
```

**If** a toggle does render (env.ts:52 comment claims it does), leave the metadata and instead verify the annual price IDs are set in Vercel prod (they were created in WS5). Record which branch was true in the PR description.
- [ ] **Step 4:** Commit: `git commit -am "fix(pricing): remove phantom features, honest fix counts, reconcile annual claim"`

### Task 1.4 Price transparency on the unlock CTA (+ fix the dead paywallViewed funnel event)

**Files:**
- Modify: `components/report/captured/results-screen.tsx:481-496` (unlock band)
- Modify: the component that actually renders the unlock button — `components/report/captured/unlock-button.tsx` (`CapturedUnlockButton`)
- Delete usage-check: `components/…/trial-cta.tsx` (dead; final deletion happens in Task 5.4 — here we only move its one live job)

**Why:** visitors currently first learn the price inside Stripe Checkout; and P4's `funnel.paywallViewed` was wired to `TrialCta`, which has zero usages — the top of the paid funnel never fires.

- [ ] **Step 1:** In `results-screen.tsx`, add the price line under the button inside the unlock band (tokens/JM font, no raw hex — `#B7B4C4` already appears in this band's inline palette; reuse the same var-based color used for `unlockSub` if one exists, else match the band's existing muted literal):

```tsx
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                {p.unlockButton ?? (
                  <button style={{ fontFamily: PJ, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", background: "var(--c-surface)", border: "none", borderRadius: 10, padding: "13px 24px", cursor: "pointer", whiteSpace: "nowrap" }}>Unlock full report →</button>
                )}
                <span style={{ fontFamily: JM, fontSize: 12.5, color: "#B7B4C4" }}>{PRICE_LINE}</span>
              </div>
```

with, at the top of the file:

```ts
import { tierByPlan, fmtPrice } from "@/lib/billing/pricing";

const PRICE_LINE = `${fmtPrice(tierByPlan("solo").monthly)}/mo · cancel anytime`;
```

(`check:arch` allows components → lib; verify with `pnpm check:arch` — Anthropic/Supabase boundaries are unaffected.)
- [ ] **Step 2:** In `CapturedUnlockButton` (`unlock-button.tsx`), fire the funnel event on mount — move the exact `funnel.paywallViewed(...)` call out of `trial-cta.tsx` (copy its implementation verbatim, consent-gated client `capture` no-ops pre-consent by design):

```tsx
useEffect(() => {
  funnel.paywallViewed();
}, []);
```

and keep `funnel.checkoutStarted()` on click if not already present (mirror what `trial-cta.tsx` did).
- [ ] **Step 3:** Run the render E2E: `pnpm vitest run components/report/captured/results-screen.render.test.tsx` → PASS (the new price line must not trip the garbage-token assertions; if a scenario asserts exact band text, update the assertion to include the price line).
- [ ] **Step 4:** Commit: `git commit -am "feat(report): show €/mo + cancel-anytime on the unlock CTA; fire paywallViewed from the real paywall"`

### Task 1.5 Make the report intro honest (conditional, no invented claims)

**Files:**
- Modify: `components/report/captured/to-results-props.ts:154-156`
- Test: `components/report/captured/results-screen.render.test.tsx` (existing 3 scenarios)

**Why:** every free report currently says "*{site} is technically fine. … you're absent from the comparison and directory surfaces…*" — false for low on-page scores, and the "absent from…" claim has no data behind it (the never-fabricate class).

- [ ] **Step 1: Extend the render test** — the low-score scenario must not render "technically fine":

```ts
it("does not call a weak page 'technically fine' (directory scenario, low on-page)", () => {
  const html = renderScenario(directoryPayload); // existing helper in this file
  expect(html).not.toContain("is technically fine");
});
```

- [ ] **Step 2:** Run it → FAIL (intro is unconditional today).
- [ ] **Step 3: Implement** in `to-results-props.ts` — replace lines 154–156 with:

```ts
    intro:
      report.score.total >= 60
        ? "is in decent on-page shape. The plan below focuses on where you can still gain ground."
        : "has real on-page gaps holding it back. The plan below starts with the fixes that matter most.",
```

(Threshold 60 matches the existing headline banding above at `to-results-props.ts:140-141`; the unverifiable "comparison and directory surfaces" claim is dropped in both branches.)
- [ ] **Step 4:** Run the full render suite `pnpm vitest run components/report/captured/results-screen.render.test.tsx` → PASS (fix any scenario that asserted the old sentence). `pnpm test` → green.
- [ ] **Step 5:** Commit: `git commit -am "fix(report): conditional intro — never call a weak page 'technically fine', drop the unverified absence claim"`

### Task 1.6 [OWNER INPUT → then code] Imprint + governing law

**Files:**
- Modify: `content/legal/imprint.ts`
- Verify: `content/legal/terms.ts:78` (dangling reference resolves once imprint names a law)

**Owner input needed first:** (a) a real postal address — a registered-address/mailbox service is acceptable and avoids publishing a home address; (b) the governing-law jurisdiction (your country of establishment).

- [ ] **Step 1:** In `imprint.ts` "Operator" section, replace the on-request body + list with (address placeholder filled from owner input):

```ts
      body: [
        "ReachKit is operated by Tim Clifford (sole trader).",
      ],
      list: [
        "Service: ReachKit",
        "Operator: Tim Clifford",
        "Address: <OWNER-PROVIDED POSTAL ADDRESS>",
        "Contact email: hello@reachkit.app",
      ],
```

- [ ] **Step 2:** Add a section (satisfies the `terms.ts:78` deferral):

```ts
    {
      heading: "Governing law",
      body: [
        "These pages and the ReachKit service are operated under the laws of <OWNER-PROVIDED JURISDICTION>. See our Terms of Service for the full agreement.",
      ],
    },
```

- [ ] **Step 3:** In the "EU online dispute resolution" section, replace the hedged sentence ("unless stated otherwise once the operating entity is finalised") with a committed one: `"We are neither obliged nor willing to participate in dispute resolution proceedings before a consumer arbitration board."`
- [ ] **Step 4:** Update `lastUpdated` to the ship date. Optionally remove the `noindex` in `app/(marketing)/imprint/page.tsx` once real (keep if preferred). Verify `/imprint` renders and `/terms` § referencing it now resolves to a named law.
- [ ] **Step 5:** Commit: `git commit -am "fix(legal): real imprint — postal address, governing law, committed ODR stance"`

### Task 1.7 Design-sync reconciliation for Phase 1

**Files:**
- Modify: `.design-sync/ds-src/{PricingScreen,PricingTable,PlanCards,ResultsScreen,ToolsScreen}.tsx` (mirror the copy edits from 1.2–1.5), `Testimonials` already archived (1.1)
- Regenerate: `.design-sync/card-labels.json`, `_ds_manifest.json`

- [ ] **Step 1:** For each card, diff against its live counterpart and apply the same copy changes (FAQ sentence, `All 7`→`Full plan (up to 8)`, phantom bullets removed, unlock price line, intro copy if rendered).
- [ ] **Step 2:** `node .design-sync/ds-src/build.mjs && node .design-sync/ds-src/layout.mjs`, then `node scripts/gen-card-labels.mjs`.
- [ ] **Step 3:** `pnpm check:design` → must be green **before** upload (label drift hard-fails; the drift baseline may shrink — if so re-pin with `node scripts/check-design-parity.mjs --pin-drift` and note the shrink in the commit).
- [ ] **Step 4:** Run `/design-sync` scoped to the changed `components/<Group>/**` + `_ds_manifest.json`, sentinel `_ds_sync.json` LAST.
- [ ] **Step 5:** `pnpm bless:design -- PricingScreen PricingTable PlanCards ResultsScreen ToolsScreen` (scoped; each card was just diffed in Step 1, so the bless is legitimate).
- [ ] **Step 6:** Commit: `git commit -am "design: reconcile mirrors with honest-storefront copy; archive Testimonials"`

### Task 1.8 Phase-1 PR

- [ ] `pnpm test && pnpm lint && pnpm check:arch && pnpm check:design` all green; `INNGEST_SIGNING_KEY=local-dummy pnpm build` (with `next dev` STOPPED) → bundle gate green.
- [ ] Open PR "Launch: honest storefront — remove fabricated testimonials, truthful pricing/score copy, real imprint, CTA price transparency". After merge + deploy: headless-render live `/`, `/pricing`, and one fresh free report (`chrome --headless --dump-dom --virtual-time-budget=8000`) and read the actual text (hard rule: verify the render, not the payload).

---

## Phase 2 — Eyes on (observability actually working)

### Task 2.1 [OWNER + agent] Point PostHog at a real ReachKit project

- [ ] **Step 1 [OWNER]:** In PostHog (us.posthog.com), create project **"ReachKit"** in the org (or confirm one exists that I couldn't see). Copy its project API key (`phc_…`).
- [ ] **Step 2 [OWNER]:** Vercel → Environment Variables (Production): set `POSTHOG_KEY` (overwrite the 31-day-old value — it predates P4 and no ReachKit events have ever arrived anywhere), `POSTHOG_HOST=https://us.i.posthog.com`, and ADD `NEXT_PUBLIC_POSTHOG_KEY` (same key) + `NEXT_PUBLIC_POSTHOG_HOST`. `NEXT_PUBLIC_*` are build-time inlined → a fresh deploy is required, not just a restart.
- [ ] **Step 3:** Redeploy, then verify: browse the live site, accept the cookie banner, then in PostHog check `$pageview` events with `$host=reachkit.app` arrive; trigger one free scan and confirm `scan_started`. Server side: hit a route that logs and confirm no `$exception` noise.
- [ ] **Step 4 [OWNER]:** Wire `COST_ALERT_WEBHOOK_URL` (Vercel Production env) to a Slack/Discord incoming webhook so cost alerts reach a channel you actually read. Verify per `lib/config/env.ts` `COST_ALERT_*` thresholds by temporarily lowering one in a preview if desired, or accept fire-on-first-real-alert.

### Task 2.2 Post-deploy Inngest sync check in CI (kill the recurring stale-sync landmine)

**Files:**
- Modify: `.github/workflows/ci.yml`

**Why:** Inngest Cloud has now silently gone stale TWICE (pre-launch 2026-07-08, and again with P4's onFailure edits — today's `PUT /api/inngest` returned `modified: true`). Auto-sync-on-deploy is demonstrably unreliable.

- [ ] **Step 1:** Add a job to `ci.yml` that runs **on push to main only**, after the existing jobs:

```yaml
  inngest-sync:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - name: Wait for prod to serve this commit, then force Inngest re-sync
        run: |
          for i in $(seq 1 60); do
            LIVE=$(curl -sf https://reachkit.app/api/health | jq -r .commit || echo "")
            [ "$LIVE" = "${GITHUB_SHA::7}" ] && break
            sleep 15
          done
          if [ "$LIVE" != "${GITHUB_SHA::7}" ]; then
            echo "prod never reached ${GITHUB_SHA::7} (still $LIVE) — skipping sync"; exit 1
          fi
          RESP=$(curl -sf -X PUT https://reachkit.app/api/inngest)
          echo "$RESP"
          echo "$RESP" | jq -e '.message == "Successfully registered"'
```

- [ ] **Step 2:** Verify the job appears and passes on the next merge to main (it is additive; it does not gate PRs). If Vercel deploys lag >15 min the job fails loudly — that is the desired signal.
- [ ] **Step 3:** Commit: `git commit -am "ci: force + verify Inngest re-sync after every prod deploy (stale-sync landmine hit twice)"`

### Task 2.3 Preview-deployment env decision (recommend: accept + silence)

Preview deploys currently 500 on missing Supabase env (all runtime errors in the last 24h were this). Copying **prod service-role keys to Preview is NOT recommended** (unmerged branch code with prod-DB write access). Options: (a) accept — previews are for Vercel bot comments only; (b) dedicated free-tier Supabase project for previews. **Recommendation: (a) now, (b) post-launch if previews become a real review surface.**

- [ ] Document the decision in `docs/launch/ops-notes.md` (one paragraph, why previews 500 and why that's accepted) so the error noise isn't re-investigated later.

---

## Phase 3 — Ship PR #72 (add-product onboarding)

### Task 3.1 Commit the stranded tripwire hardening

**Files:**
- Add: `lib/testing/tripwire.ts`, `lib/testing/tripwire.test.ts` (currently untracked)
- Commit: `app/api/add-product-policy.test.ts` (currently modified, imports the helper)

- [ ] **Step 1:** `pnpm vitest run lib/testing/tripwire.test.ts app/api/add-product-policy.test.ts` → PASS locally.
- [ ] **Step 2:** `pnpm test` (whole suite) → green.
- [ ] **Step 3:**

```bash
git add lib/testing/ app/api/add-product-policy.test.ts
git commit -m "test(tripwire): shared expectCallsSymbol helper — vacuous whole-file matches structurally impossible"
git push
```

- [ ] **Step 4:** Confirm PR #72 CI returns green after the push.

### Task 3.2 [OWNER] Run the live-verification checklist, then merge

- [ ] Work through `docs/launch/add-product-live-verification.md` on the preview URL with your Growth account (all 5 sections; the checklist is the merge gate — red step = no merge).
- [ ] Merge PR #72 (squash, consistent with #61–#71). Delete the branch. If Phase 1's PR merged first, press "Update branch" (strict protection).

---

## Phase 4 — The one live money test [OWNER, ~€2]

**Pre-condition: Task 0.1 done** (webhook repointed) — otherwise this test fails exactly like a real customer would.

- [ ] **Step 1:** From an incognito window: run a free scan on any site → on the report click **Unlock full report** (the ANONYMOUS payment-first path — your 3 prior sessions were all the in-app path and all abandoned pre-payment; this path has never been driven live).
- [ ] **Step 2:** Pay €59 Solo monthly with a real card and a **fresh email** (e.g. `timclifford101+launchtest@gmail.com`).
- [ ] **Step 3:** Verify, in order: (a) Stripe webhook delivery log shows 200 for `checkout.session.completed`; (b) the magic-link email arrives via Resend; (c) the Stripe receipt email arrives (proves the receipts toggle); (d) magic link logs into `/app/dashboard` with tier=solo and the scanned site provisioned + deepening; (e) `/app/diagnostics` shows the scan's costs attributed.
- [ ] **Step 4:** In the app: billing → customer portal → cancel. Verify `subscription.deleted` webhook fires and the account downgrades to free (redacted report).
- [ ] **Step 5:** Stripe dashboard (or the Stripe MCP `create_refund` tool) → refund the €59. Net cost ≈ €1.50–2 non-refundable fees.
- [ ] **Step 6:** Record the run (date, session id, findings) in `docs/launch/launch-readiness-outstanding.md` — this closes the "paid-path check needs Tim's account" residual.

---

## Phase 5 — P2 hardening (one PR after launch-critical work)

Branch: `launch/p2-hardening` off main.

### Task 5.1 Shared-app fork-on-edit (cross-tenant tamper fix)

**Files:**
- Modify: `app/(app)/app/settings/actions.ts` (`updateProductUrl`, same-host branch ~line 94)
- Test: `tests/integration/shared-app-fork.test.ts` (new, follows `tests/integration/account-delete.test.ts` idiom: local Supabase, service client, fixtures mode)

**Why:** `attach` (PR #72) makes multi-owner `apps` rows the norm; the same-host in-place `store_url` update lets any co-owner mutate the row the victim also tracks.

- [ ] **Step 1: Write the failing integration test:**

```ts
import { describe, it, expect } from "vitest";
import { serverDb } from "@/lib/db/server"; // match account-delete.test.ts's client import

describe("updateProductUrl on a shared apps row", () => {
  it("forks instead of mutating in place when 2+ users track the same app", async () => {
    const db = serverDb();
    const { data: app } = await db.from("apps")
      .insert({ store_url: "https://shared-fork-test.example.com", platform: "web" })
      .select("id").single();
    const [a, b] = await Promise.all([
      db.from("users").insert({ email: "fork-a@test.local", app_ids: [app!.id], tier: "solo" }).select("id").single(),
      db.from("users").insert({ email: "fork-b@test.local", app_ids: [app!.id], tier: "solo" }).select("id").single(),
    ]);
    // exercise the same-host edit path for user A (import the inner helper the
    // action delegates to, as account-delete.test.ts does for deleteAccount)
    await updateProductUrlForUser(a.data!.id, app!.id, "https://shared-fork-test.example.com/new-page");
    const { data: original } = await db.from("apps").select("store_url").eq("id", app!.id).single();
    expect(original!.store_url).toBe("https://shared-fork-test.example.com"); // victim untouched
    const { data: userA } = await db.from("users").select("app_ids").eq("id", a.data!.id).single();
    expect(userA!.app_ids).not.toContain(app!.id); // A moved to a forked row
  });
});
```

(If `updateProductUrl` has no user-id-parameterized inner helper, extract one — `updateProductUrlForUser(userId, appId, url)` — and have the server action call it after `requireUser()`; that refactor is part of this task and mirrors how `deleteAccount` is structured for testability.)

- [ ] **Step 2:** `pnpm test:int -- shared-app-fork` → FAIL (in-place mutation changes the shared row today).
- [ ] **Step 3: Implement** — in the same-host branch of `updateProductUrl`, before the in-place update:

```ts
  // A shared `apps` row (two users tracking the same URL — normal since the
  // attach path, PR #72) must never be edited in place: forking keeps the
  // co-owner's product identity intact (security review 2026-07-15).
  const { count: owners } = await db
    .from("users")
    .select("id", { count: "exact", head: true })
    .contains("app_ids", [appId]);
  if ((owners ?? 0) > 1) {
    // Same code path as the host-change case: fork to a fresh row.
    ({ newAppId } = await switchTrackedProduct(userId, appId, routed.url, routed.platform));
    (await cookies()).set(ACTIVE_APP_COOKIE, newAppId, { path: "/", sameSite: "lax" });
    revalidatePath("/app/settings");
    revalidatePath("/app");
    return { ok: true, switched: true, host: nextHost };
  }
```

- [ ] **Step 4:** Test → PASS; full `pnpm test` + `pnpm test:int` green.
- [ ] **Step 5:** Commit: `git commit -am "fix(settings): fork shared apps rows on URL edit — co-owner can no longer mutate another user's product"`

### Task 5.2 Revoke public EXECUTE on `handle_new_user()`

**Files:**
- Create: `supabase/migrations/<timestamp>_revoke_handle_new_user_execute.sql`

- [ ] **Step 1:** Migration content:

```sql
-- handle_new_user() is an auth-trigger helper (SECURITY DEFINER). It must not
-- be callable via PostgREST RPC by anon/authenticated (Supabase advisor WARN,
-- launch review 2026-07-15). The auth trigger runs as the table owner and is
-- unaffected by these revokes.
revoke execute on function public.handle_new_user() from anon, authenticated;
```

- [ ] **Step 2:** Apply locally (`supabase db reset` or `supabase migration up`), run `pnpm test:int` → green (auth-trigger integration test still passes → trigger unaffected).
- [ ] **Step 3:** Apply to prod via the Supabase MCP `apply_migration` (⛔ prod DB access needs Tim's explicit authorization — request it, name the project). Re-run `get_advisors` → WARN gone.
- [ ] **Step 4:** Commit the migration file: `git commit -am "fix(db): revoke anon/authenticated EXECUTE on handle_new_user (advisor WARN)"`

### Task 5.3 Score calibration into CI (non-blocking)

**Files:**
- Modify: `.github/workflows/ci.yml` (the existing `live-smoke` job)

- [ ] **Step 1:** Add a step to the existing opt-in `live-smoke` job (workflow_dispatch-only, continue-on-error — it already has real secrets and a spend budget) that runs `pnpm tsx scripts/score-calibration.mts` and uploads its output as an artifact. This doesn't "enforce" band separation (still the open red rule) but makes the measurement one click instead of a forgotten local script.
- [ ] **Step 2:** Commit: `git commit -am "ci(live-smoke): run score-calibration and publish the report artifact"`

### Task 5.4 Housekeeping sweep

**Files:** `components/**/trial-cta.tsx` (delete — its funnel job moved in Task 1.4), `lib/email/resend.ts` (`sendTrialEndingEmail` remnants if any; delete `sendScanReadyEmail` dead code + its tests), `app/api/billing/trial/` → rename dir to `checkout` with the route file unchanged, plus every caller (`grep -rn "billing/trial" app components lib`) and `pricing-checkout-links.tsx:6,35` comments; `components/report/captured/to-results-props.ts:67,159` (guard the "+0 pts" locked-worth: when `lockedWorth === 0`, omit the "worth an estimated +N pts" clause rather than rendering +0); the two Settings forms' raw `#e5484d` → `var(--color-danger)`.

- [ ] **Step 1:** For the route rename: `git mv app/api/billing/trial app/api/billing/checkout`, update all callers found by the grep, run `pnpm vitest run app/api/costed-routes.test.ts app/api/entitlement-gates.test.ts` — if either tripwire pins the old path, update the pinned list in the SAME commit (Change Protocol: this is a deliberate rename, gates updated with source).
- [ ] **Step 2:** Each deletion: `grep -rn "<symbol>" app components lib` → zero non-test references before deleting; delete symbol + its tests together.
- [ ] **Step 3:** `pnpm test && pnpm lint && pnpm check:arch && pnpm check:design` green. Commit per logical unit (rename / dead code / +0 pts / tokens).

### Task 5.5 [OWNER] Close PR #46

Old "Claude Design 1:1" PR (2026-07-09) — its batched-upload work was superseded by the reconciles in #69/#71 and the batched pass that already ran. **Recommend: close without merging**, with a comment pointing at #69/#71. If any commits in it are still unique (check `git log main..harden/claude-design-1to1 --oneline`), cherry-pick those first.

---

## Phase 6 — Process adoptions (new topics from the 2026-07-15 review)

These seven tasks come from a pattern the review exposed: **every internal drift surface has a tripwire; every external one was on trust.** The worst finding of the whole review (Stripe webhook → dead domain) lived outside the repo, as did the stale Inngest sync (twice), the orphaned PostHog keys, and the unverifiable Supabase Site URL. 6.1–6.3 extend the ratchet philosophy to that layer; 6.4 closes a legal gap no earlier audit looked for; 6.5 makes "validate ASAP" falsifiable; 6.6–6.7 are launch hygiene. Pre-launch: 6.1, 6.2, 6.4, 6.5 (+ the two 10-minute owner checks in 6.6). Post-first-customer: 6.3, 6.7.

### Task 6.1 Live-config drift check (`scripts/check-live-config.mts`)

**Why:** the consistency harness pins code↔docs↔design (`check:arch`, `check:design`, doc tripwires), but NOTHING pins code↔**cloud config**. That blind spot produced the review's one silent revenue-killer: the live Stripe webhook endpoint pointed at `reachkit-pi.vercel.app` for weeks and no gate could ever have caught it, because no gate looks outward. This script is `check:design` for the cloud: every externally-configured value the code depends on gets a machine assertion. It belongs in the `live-smoke` CI job (it needs live secrets and makes real API reads), and it is also the **post-incident verifier**: after any Stripe/Vercel/Inngest dashboard change, run `pnpm check:live` instead of trusting the click.

**Failure modes this closes (all real, all from this project's history):** webhook URL drift (2026-07-15), Inngest Cloud silent stale sync (2026-07-08 and 2026-07-15), price-id/env drift (the WS5 "still USD after merge" class), prod deploy serving a stale commit, PostHog keys pointing at the wrong project.

**Files:**
- Create: `scripts/check-live-config.mts`
- Modify: `package.json` (add `"check:live": "tsx scripts/check-live-config.mts"`)
- Modify: `.github/workflows/ci.yml` (append a step to the existing `live-smoke` job)

**Interfaces:** Consumes env: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_SOLO_ANNUAL`, `STRIPE_PRICE_GROWTH_ANNUAL` (annuals optional — skip when blank), optional `POSTHOG_KEY`. Produces: exit 0 = live config matches code expectations; exit 1 with a sectioned failure report.

- [ ] **Step 1: Write the script.** Structure mirrors `scripts/check-design-parity.mjs` (numbered sections, accumulate failures, print all, exit non-zero at the end — never die on the first check so one run reports everything):

```ts
import Stripe from "stripe";

const PROD = "https://reachkit.app";
const failures: string[] = [];
const warnings: string[] = [];
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const fail = (msg: string) => { failures.push(msg); console.log(`  ✗ ${msg}`); };
const warn = (msg: string) => { warnings.push(msg); console.log(`  ⚠ ${msg}`); };

// ── 1. Prod freshness + health ────────────────────────────────────────────
console.log("1. prod health");
const health = await fetch(`${PROD}/api/health`).then((r) => r.json()).catch(() => null);
if (!health || health.db !== "ok") fail(`/api/health not ok: ${JSON.stringify(health)}`);
else ok(`health ok — commit ${health.commit}, region ${health.region}`);

// ── 2. Stripe webhook endpoint points at prod ─────────────────────────────
console.log("2. stripe webhook endpoint");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]; // must match the switch in lib/billing/webhook.ts
const endpoints = await stripe.webhookEndpoints.list({ limit: 10 });
const enabled = endpoints.data.filter((e) => e.status === "enabled");
const prodEp = enabled.find((e) => e.url.startsWith(`${PROD}/`));
if (!prodEp) {
  fail(`no ENABLED webhook endpoint on ${PROD} — endpoints: ${enabled.map((e) => e.url).join(", ") || "none"}`);
} else {
  ok(`endpoint ${prodEp.url}`);
  const events = prodEp.enabled_events ?? [];
  const missing = events.includes("*") ? [] : HANDLED_EVENTS.filter((ev) => !events.includes(ev));
  if (missing.length) fail(`endpoint missing handled events: ${missing.join(", ")}`);
  else ok("all 4 handled events enabled");
  const stale = enabled.filter((e) => !e.url.startsWith(`${PROD}/`));
  for (const e of stale) warn(`extra enabled endpoint pointing elsewhere: ${e.url} (disable it?)`);
}

// ── 3. Stripe prices resolve, active, EUR ─────────────────────────────────
console.log("3. stripe prices");
const PRICE_ENVS = ["STRIPE_PRICE_SOLO", "STRIPE_PRICE_GROWTH", "STRIPE_PRICE_SOLO_ANNUAL", "STRIPE_PRICE_GROWTH_ANNUAL"];
for (const name of PRICE_ENVS) {
  const id = process.env[name];
  if (!id) { name.endsWith("_ANNUAL") ? warn(`${name} unset (annual optional)`) : fail(`${name} unset`); continue; }
  try {
    const p = await stripe.prices.retrieve(id);
    if (!p.active) fail(`${name} (${id}) is INACTIVE`);
    else if (p.currency !== "eur") fail(`${name} (${id}) is ${p.currency}, expected eur`);
    else if (p.recurring?.trial_period_days) fail(`${name} (${id}) has a trial — trial was removed (P2/#62)`);
    else ok(`${name} → ${p.unit_amount! / 100} ${p.currency}/${p.recurring?.interval}`);
  } catch { fail(`${name} (${id}) does not resolve in this Stripe mode`); }
}

// ── 4. Inngest registration is current ────────────────────────────────────
console.log("4. inngest sync");
const inngest = await fetch(`${PROD}/api/inngest`, { method: "PUT" }).then((r) => r.json()).catch(() => null);
if (!inngest || inngest.message !== "Successfully registered") fail(`PUT /api/inngest failed: ${JSON.stringify(inngest)}`);
else if (inngest.modified) warn("Inngest WAS stale — this PUT fixed it, but auto-sync-on-deploy drifted again");
else ok("Inngest registration current (modified: false)");

// ── 5. Public pricing surface is EUR ───────────────────────────────────────
console.log("5. live pricing page");
const pricingHtml = await fetch(`${PROD}/pricing`).then((r) => r.text()).catch(() => "");
if (!pricingHtml.includes("€59")) fail("/pricing does not render €59 — price copy or deploy drift");
else ok("/pricing renders €59");

// ── verdict ────────────────────────────────────────────────────────────────
console.log(`\n${failures.length} failure(s), ${warnings.length} warning(s)`);
if (failures.length) process.exit(1);
```

- [ ] **Step 2:** `package.json` scripts: add `"check:live": "tsx scripts/check-live-config.mts"`. Run locally with live keys exported → all sections green (Task 0.1 must be done first; before it, section 2 fails — which proves the check works).
- [ ] **Step 3:** Append to the `live-smoke` job in `ci.yml` (same secrets context):

```yaml
      - name: Live config drift check
        run: pnpm check:live
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          STRIPE_PRICE_SOLO: ${{ secrets.STRIPE_PRICE_SOLO }}
          STRIPE_PRICE_GROWTH: ${{ secrets.STRIPE_PRICE_GROWTH }}
```

  ⚠️ Note the live-smoke secrets are deliberately `sk_test_` (see program notes) — the drift check needs the LIVE key to see the live webhook endpoint. Add a **separate** `STRIPE_LIVE_READONLY_KEY` repo secret using a Stripe **restricted key** (Dashboard → API keys → Create restricted key: read-only on Webhook Endpoints + Prices, nothing else) and pass THAT as `STRIPE_SECRET_KEY` to this step. A read-only restricted key means CI can never charge/refund anyone.
- [ ] **Step 4:** Document in `CLAUDE.md` Commands section (one line: `pnpm check:live` — cloud-config drift tripwire, needs live read-only Stripe key) and add the row to the enforcement-layers table (Change Protocol: new gate ⇒ documented in the same commit).
- [ ] **Step 5:** Commit: `git commit -am "ci: live-config drift tripwire — Stripe endpoint/prices, Inngest sync, prod health, EUR surface"`

### Task 6.2 [OWNER, ~10 min] External uptime monitor

**Why:** `/api/health` (P4) can tell you the DB is down — but only if something asks it. Today nothing does: an outage at 2am surfaces as a customer email. An external monitor is the only component that lives OUTSIDE your stack (Vercel status alone won't catch a Supabase outage, an env regression, or a DNS problem — the health endpoint's `db` check catches all three).

- [ ] **Step 1:** Create a free monitor at UptimeRobot (or BetterStack — either free tier suffices): type HTTP(s) keyword; URL `https://reachkit.app/api/health`; keyword `"db":"ok"` (keyword-EXISTS mode — a 200 with `"db":"down"` must still alert); interval 5 min.
- [ ] **Step 2:** Alert contacts: your email; plus the Slack/Discord webhook from Task 2.1 Step 4 if configured.
- [ ] **Step 3:** Add a second, plain HTTP monitor on `https://reachkit.app/` (catches CDN/DNS/routing failures where /api/health might still work, and vice versa).
- [ ] **Step 4:** Verify the alert path actually fires: pause monitor #1 → set its URL to `https://reachkit.app/api/health-nonexistent` → resume → wait for the alert to arrive → restore the URL. An unverified alert channel is a false sense of safety.
- [ ] **Step 5:** Record the monitor URLs + owning account in `docs/launch/ops-notes.md` (it's exactly the class of outside-the-repo setting that doc exists for).

### Task 6.3 Weekly Stripe↔DB reconciliation cron (build after customer #1)

**Why:** the P2 idempotency ledger defends against **duplicate** webhook deliveries; nothing defends against **missed** ones (endpoint down for >3 days = Stripe gives up retrying; endpoint misconfigured = this review's exact finding; event type not subscribed = silent). The failure mode is the worst kind: a paying customer whose `users.tier` says free, or a canceled customer who keeps paid access. A weekly read-only sweep converts "silent until a support email" into "alert within 7 days". Deliberately post-first-customer: with zero subscriptions it can only ever pass vacuously.

**Files:**
- Create: `lib/inngest/functions/billing-reconcile.ts`
- Modify: `app/api/inngest/route.ts` (register the function — 8th in the array)
- Test: `lib/inngest/functions/billing-reconcile.test.ts`

**Design (follow the `weeklyRefresh` idiom — cron trigger, `SCANNING_ENABLED`-style guard not needed since it's read-only):**

- [ ] **Step 1:** Function skeleton — cron `0 8 * * 1` (Mon 08:00 UTC, an hour before weekly-refresh so a drift alert lands before the week's scans spend money):

```ts
export const billingReconcile = inngest.createFunction(
  { id: "billing-reconcile", onFailure: captureInngestFailure },
  { cron: "0 8 * * 1" },
  async () => {
    const stripe = getStripe();
    const subs = await stripe.subscriptions.list({ status: "all", limit: 100 });
    const db = serverDb();
    const drifts: string[] = [];
    for (const sub of subs.data) {
      const { data: user } = await db.from("users")
        .select("id, tier, subscription_status")
        .eq("stripe_subscription_id", sub.id).maybeSingle();
      // Pure comparison — extract to reconcileDrift(sub, user) for unit tests:
      // 1. active/past_due-in-grace sub with no user row, or user.tier === "free"  → "paying customer without access"
      // 2. canceled/unpaid sub but user still active-tier                          → "canceled customer keeps access"
      // 3. sub.status !== user.subscription_status                                 → "status drift (stale webhook?)"
      const drift = reconcileDrift(sub, user);
      if (drift) drifts.push(`${sub.id}: ${drift}`);
    }
    if (drifts.length) {
      captureServerEvent("billing_drift", { count: drifts.length, drifts });   // PostHog (analytics-server)
      await postCostAlertWebhook(`billing_drift: ${drifts.length} mismatch(es)`); // reuse P4's webhook delivery
    }
    return { checked: subs.data.length, drifts: drifts.length };
  },
);
```

- [ ] **Step 2:** Unit-test `reconcileDrift` as a pure function (the three drift cases + the healthy case + past_due-within-grace = NOT a drift — reuse `isSubscriptionActive` from `lib/billing/entitlements.ts` so grace semantics can never fork between the webhook and the reconciler).
- [ ] **Step 3:** Register in `app/api/inngest/route.ts`; after deploy the Task 2.2 CI job re-syncs Inngest (this is the first new function that relies on it — a good live test of that job).
- [ ] **Step 4:** Track in `docs/launch/launch-readiness-outstanding.md` as "build at customer #1" until then.

### Task 6.4 EU 14-day withdrawal right at checkout

**Why:** EU consumer law (Consumer Rights Directive art. 9 & 16(m)) gives consumers a 14-day no-questions withdrawal right on online contracts. For digital services it can lapse early ONLY with the customer's **explicit consent to immediate performance + acknowledgment of losing the right**. ReachKit charges immediately and delivers immediately, sells to "founders" (many are sole traders = consumers in most member states' reading), and currently collects no such consent — so any EU customer could demand a full refund on day 13 and be legally right. No earlier audit covered this; the P3 legal phase handled data (GDPR), not contract formation. Two small changes make it compliant AND make refund demands defensible.

**Files:**
- Modify: `lib/billing/checkout.ts` (both session creators — the anonymous one ~:59 and the in-app one ~:150)
- Modify: `content/legal/terms.ts` (billing/withdrawal clause)
- Test: `lib/billing/checkout.test.ts` (assert both creators set `consent_collection`)

- [ ] **Step 1: Failing test** — in `lib/billing/checkout.test.ts`, for each creator assert the session params include:

```ts
expect(sessionParams.consent_collection).toEqual({ terms_of_service: "required" });
```

(Match the file's existing test idiom for capturing the params passed to `stripe.checkout.sessions.create` — it already asserts trial absence the same way.)
- [ ] **Step 2:** Run → FAIL. Implement: add to BOTH `sessions.create` param objects:

```ts
      // EU CRD: explicit ToS consent at checkout — the Terms carry the
      // immediate-performance / withdrawal-waiver clause (Task 6.4).
      consent_collection: { terms_of_service: "required" },
```

- [ ] **Step 3:** Add to `content/legal/terms.ts`, in the billing section:

```ts
      {
        heading: "Right of withdrawal (EU consumers)",
        body: [
          "By subscribing you expressly request that we begin providing the service immediately, and you acknowledge that once your report and action plan have been fully delivered, you lose your statutory 14-day right of withdrawal. If you withdraw before the service has been fully performed, we refund the proportion not yet provided.",
          "Independently of the above, plans are month-to-month: you can cancel at any time from the billing portal and keep access until the end of the paid period.",
        ],
      },
```

- [ ] **Step 4 [OWNER]:** Stripe Dashboard → Settings → Business → Public details → set **Terms of service URL** = `https://reachkit.app/terms` (and Privacy = `https://reachkit.app/privacy`). Without this, `consent_collection.terms_of_service` makes checkout error — which is why the code change and the dashboard setting must land together; verify immediately after via one test-mode checkout page load.
- [ ] **Step 5:** Tests pass; the Phase-4 live run doubles as the end-to-end verification (checkout page shows the ToS checkbox). Commit: `git commit -am "feat(billing): EU withdrawal-right consent at checkout + Terms clause"`

### Task 6.5 [OWNER decides numbers; agent scaffolds] Define "validated" before traffic arrives

**Why:** "validate the idea ASAP" is currently unfalsifiable — no written definition of pass/fail exists anywhere in the repo or docs. Without pre-committed thresholds, every outcome reads as "promising, keep going" (sunk-cost gravity is real for solo founders). The funnel becomes fully measurable the moment Task 2.1 lands (`scan_started → scan_findings_shown → paywall_viewed → checkout_started → subscription_activated`, each already instrumented — P4 + Task 1.4). This task pins the decision framework in writing.

**Files:**
- Create: `docs/launch/validation-criteria.md`

- [ ] **Step 1:** Create the doc from this skeleton — **the numbers below are proposed defaults for Tim to edit, not measurements**; they assume cold/community traffic (indie-hackers, PH, Reddit), not paid ads:

```markdown
# Validation criteria — decided BEFORE launch traffic

**Window:** 4 weeks from first public launch post (start: <DATE>).
**Traffic plan:** <channels Tim commits to — e.g. PH launch, 3 subreddit posts, X build-log>.

## The funnel gates (PostHog: funnel scan_started → subscription_activated)
| Stage | Metric | Floor (edit me) | Reading if below |
|---|---|---|---|
| Top | unique scans started | 200 | distribution problem, not product — fix channels first |
| Report | scan → findings shown | 85% | pipeline reliability problem (scan failures) |
| Interest | findings → paywall viewed | 35% | report isn't compelling — conversion surface work |
| Intent | paywall → checkout started | 4% | offer/price problem |
| Money | checkout → paid | 40% | checkout friction/trust problem |
| **Verdict** | **paying customers in window** | **3** | — |

## Decision rule (pre-committed)
- **≥3 paying customers** (any mix of Solo/Growth): validated — invest (Phase 5/6 backlog, content engine).
- **1–2 paying** OR strong intent (≥10 checkout starts) without conversion: iterate the offer, run one more 4-week window. Max ONE repeat window.
- **0 paying and <10 checkout starts** after the full traffic plan executed: the idea as priced/framed is not validated — pivot or park. Executed-traffic-plan is a precondition: no verdict without the distribution work actually done.

## Weekly ritual
Every Monday: read the funnel in PostHog, write 3 lines (numbers, surprise, next lever) at the bottom of this doc. The Task 6.3 reconcile + Task 2.1 events make the numbers trustworthy.
```

- [ ] **Step 2 [OWNER]:** Edit the floors + traffic plan to numbers you'll actually honor, set the start date, commit. The commit is the point — a pre-committed, version-controlled decision rule you can't quietly re-negotiate later.

### Task 6.6 [OWNER, ~1 h total] Support inbox verification + dogfood teardown + Search Console

**Why (inbox):** `hello@reachkit.app` is the contact address in Terms, Privacy, AND the new Imprint — if that mailbox doesn't receive (only Resend *sending* DNS was verified in P2's owner actions; receiving MX was never tested), every legal notice and customer issue silently vanishes, and the Imprint is non-compliant in practice.
**Why (dogfood):** for a discoverability tool, "what does ReachKit score on itself?" is the first question every skeptical buyer asks. Owning that answer publicly is both the best demo and a forcing function (if reachkit.app scores badly, the action plan is your own launch to-do list).

- [ ] **Step 1:** Send a mail to `hello@reachkit.app` from an external account → confirm receipt. If there's no MX for the domain, add email routing (Cloudflare Email Routing is free) → forward to your Gmail; retest.
- [ ] **Step 2:** Google Search Console: add property `reachkit.app` (DNS verification), submit `https://reachkit.app/sitemap.xml`. Also Bing Webmaster (imports from GSC in one click). This is table stakes the product itself would flag.
- [ ] **Step 3:** Run a real prod scan of `https://reachkit.app`. Read the report honestly; fix the embarrassing findings (they're pre-launch polish with an authoritative source: your own product).
- [ ] **Step 4:** Publish the self-teardown through the existing `content/teardowns/` mechanism (same pipeline as the 8 existing curated teardowns) and link it from the launch post — "here's our own score and what we're fixing" is disarming, on-brand social proof that costs nothing and fabricates nothing.

### Task 6.7 Backup restore drill + data-retention cron (post-launch, tracked)

**Why (drill):** PITR was consciously declined (~$100/mo); the accepted floor is the Pro daily backup (~24h loss). But `docs/launch/rollback-runbook.md`'s restore path has **never been executed** — an untested backup is a hope, not a plan. One drill converts it into a measured procedure with a known duration.
**Why (retention):** anonymous, never-claimed scans + their `raw_documents` (full scraped page bodies) grow unbounded. That's a GDPR storage-limitation exposure (scraped third-party content + `claim_email` PII held forever with no purpose) AND a real Supabase storage bill on the already-expensive project.

- [ ] **Step 1 (drill, one-time, ~1 h):** Download the latest daily backup (Supabase Dashboard → Database → Backups) → restore into a scratch local instance (`supabase start` + `psql < backup.sql`) → verify `select count(*) from scans; select count(*) from users;` match prod ±1 day and one report renders from the restored data. Record actual duration + gotchas in `rollback-runbook.md` §3.
- [ ] **Step 2 (retention, post-launch PR):** New Inngest cron `data-retention` (daily, 04:00 UTC, right after `searchCacheCleanup` — same file idiom): delete scans where `claim_email is null and user-unlinked (app not in any users.app_ids) and created_at < now() - interval '180 days'`, cascading their subtree; log counts. Add the 180-day figure to the Privacy page's retention section (it currently states no number). Guard test mirrors `search-cache-cleanup`'s.
- [ ] **Step 3:** Track both in `docs/launch/launch-readiness-outstanding.md` until done.

---

## Sequencing summary

| Phase | What | Who | When |
|---|---|---|---|
| 0 | Stripe webhook + env/toggles + `STRIPE_PRICE_GROWTH` | Owner + agent | Today, before anything |
| 1 | Honest-storefront PR (testimonials, FAQ, pricing, CTA, intro, imprint) | Agent (+ owner address/law input) | Next |
| 2 | PostHog live + Inngest CI sync + preview decision | Owner + agent | Parallel with 1 |
| 3 | Commit tripwire + live checklist + merge #72 | Agent then owner | After 1–2 |
| 4 | €59 live money test | Owner | After 0 (and ideally 1) |
| 5 | Hardening PR (fork-on-edit, revoke, calibration-in-CI, housekeeping, #46) | Agent | Launch week |
| 6 | Process adoptions (live-config check, uptime, reconcile, withdrawal consent, validation metrics, dogfood) | Mixed | 6.1/6.2/6.4/6.5 pre-launch; 6.3/6.7 after |

**Launch gate = Phases 0–4 complete.** Phase 5–6 items marked pre-launch (6.1, 6.2, 6.4, 6.5) are small; everything else follows behind real traffic.
