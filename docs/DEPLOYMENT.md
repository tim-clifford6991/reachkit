# Deployment — environments, the one project, bindings, cutover

**Rule (owner, 2026-09-08): one Vercel project, one Supabase project, one set of bindings.** No
duplicate projects, environments or databases. Cutover ran on 2026-09-08 (log, §4): `reachkit.app`
serves v3 from `main`. §1 is the current structure; §3 is the procedure as executed, kept as the
record and the rollback path.

## 1. Structure

| Thing | Value |
|---|---|
| Vercel team | `timclifford` (`team_lFEcKlyuKD5risdEnak7iRIm`) — **Hobby plan since 2026-09-08** (one concurrent build, no team members, no deployment protection) |
| Vercel project | **`reachkit`** (`prj_QJUivDYYshplvV0enuc2oZNIjcnd`) — owns `reachkit.app`, `www.reachkit.app`, `dev.reachkit.app`; Git-linked to `tim-clifford6991/reachkit` (the link keys on the repository id, unchanged by the 2026-09-08 rename); **production branch `main`** since cutover (`release` still exists at the cutover commit and is not the production branch); Node 24; Next.js framework preset; no root directory |
| Preview | every PR gets a preview deployment (`*.vercel.app`); deployment protection is off (Hobby, and Vercel's standard protection does not exempt a branch-bound custom domain) |
| Development host | `dev.reachkit.app` — bound to `main` on the same project. Since cutover `main` is production, so it serves the same deployment as `reachkit.app`; it stays as the URL the owner steers on until the owner rules it removed |
| Supabase | project `reachkit` (`kleepxxddbcnfsfwudoe`, Postgres 17, us-east-1) — **v3's database since cutover**: v2's objects moved to schema `v2_archive`, v3's 38 migrations applied (owner ruling 2026-09-04: 1 user, 0 leads, 0 customers to keep). **Free plan since 2026-09-08** (two projects; a project pauses after seven idle days — the weekly tick keeps it awake once jobs run, #315). The org is Vercel-Marketplace-managed: uninstalling that integration would delete the org and the database; the exit path is a transfer to a Supabase-managed org |
| Jobs | Inngest app registered at `https://reachkit.app/api/jobs` (keys below) — **pending #315**: keys not in `env.ts`, app not registered, crons do not tick |
| Mail | Resend, sending domain `reachkit.app` verified (SPF/DKIM/DMARC), `MAIL_FROM` bound — **pending #325, #81** |
| Payments | Stripe live: one product `ReachKit`, one €49/month tax-inclusive price bound as `STRIPE_PRICE_ID` on production and preview (2026-09-08); v2's products and prices inactive; webhook endpoint `/api/stripe/webhook`; customer portal on |
| Hosted CMS | customers CNAME to `HOSTED_EDGE_CNAME_TARGET` (`edge.reachkit.app`); per-customer domains added to the project through the Vercel Domains API (M11 #322) |

The interim project `reachkitv3` (`prj_Uy2SirnONaFoSxgCdOzcc0C295XE`) was deleted on 2026-09-08 (log).

## 2. Bindings — where each lives and who sets it

Sensitive bindings are write-only in Vercel (the API never returns them); the owner pastes them in the dashboard. Nothing below is ever logged or committed.

| Binding | Targets | Set by | Notes |
|---|---|---|---|
| `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` | prod, preview | owner | the `reachkit` Supabase project; previews share the database until a branch/dev project is ruled |
| `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_PRICE_ID` | prod, preview | owner | test-mode keys on preview, live on production, once M11 #319 passes |
| `RESEND_API_KEY` · `MAIL_FROM` | prod, preview | owner | `MAIL_FROM` is #81 |
| `DATAFORSEO_LOGIN` · `DATAFORSEO_PASSWORD` | prod, preview | owner | |
| `ANTHROPIC_API_KEY` · `NANO_API_KEY` (optional) | prod, preview | owner | `NANO_API_KEY` defaults to `ANTHROPIC_API_KEY` |
| `INNGEST_SIGNING_KEY` · `INNGEST_EVENT_KEY` | prod, preview | owner | present on `reachkit` already; add to `env.ts` (#315) |
| `IP_HASH_SALT` | prod (+ preview) | owner | a fresh random value per environment |
| `KILL_SWITCH` | all | master | `false`; flipping it stops every paid stage (runbook) |
| `OWNER_EMAILS` | all | master | |
| `HOSTED_EDGE_CNAME_TARGET` | all | master | `edge.reachkit.app` |
| `NEXT_PUBLIC_APP_URL` | all | master | `https://reachkit.app` on production; the preview URL on preview |
| `DATABASE_URL` | none (tooling only) | owner, locally | `scripts/db-live/apply.sh` reads it from the shell; never bound in Vercel |
| `RK_FIXED_NOW` | **never** | — | test fixture; a production build refuses it |

**v2 leftovers to delete from `reachkit` after cutover** (not read by v3): `APP_URL`, `NEXT_PUBLIC_SITE_URL`, `REACHKIT_OWNER_EMAILS`, `REACHKIT_USE_FIXTURES`, `REACHKIT_MARKET_ANALYSIS`, `DATAFORSEO_BACKLINKS`, `DATAFORSEO_LANGUAGE_CODE`, `DATAFORSEO_LOCATION_CODE`, `POSTHOG_HOST`, `POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY`, `PRODUCT_HUNT_TOKEN`, `TAVILY_API_KEY`, `VOYAGE_API_KEY`, `YOUTUBE_API_KEY`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_GROWTH_ANNUAL`, `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_SOLO_ANNUAL`, `STRIPE_PROMO_CODE_ID`. (Analytics returns only if the owner rules yes on #336.)

## 3. Consolidation and cutover procedure — executed 2026-09-08

Executed by the master with the Vercel REST API (CLI token) and the Supabase connector; values are never printed. Kept as the record and the rollback path.

1. **Freeze v2's production.** Note the current production deployment of `reachkit` (v2 `main`, 23 Aug 2026) — it is the rollback candidate and stays deployed.
2. **Relink.** Point `reachkit`'s Git integration at `tim-clifford6991/reachkitv3`. Choose one of:
   - **Staged (recommended until M11 passes):** production branch set to `release` (a branch that does not exist yet), so no production deployment happens; assign `dev.reachkit.app` to `main` on `reachkit`; every push to `main` deploys to `dev.reachkit.app`, every PR to a preview.
   - **Immediate:** production branch `main`; the next push deploys v3 to `reachkit.app`.
3. **Bindings.** Verify the table above on `reachkit` (names present, targets right); add `MAIL_FROM`, `NANO_API_KEY` if used; delete the v2 leftovers.
4. **Remove the interim project.** Delete `reachkitv3` (its domains `dev.reachkit.app` and `reachkitv3.vercel.app`; `dev.reachkit.app` re-added to `reachkit` first). Update the GitHub required check `Vercel` (it is per-project; re-register from the new project's first deployment).
5. **Database.** Owner runs `scripts/db-live/apply.sh` against the `reachkit` Supabase project after wiping the v2 schema (owner ruling 2026-09-04); live-schema suites confirm RLS; boot invariants pass on the first deployment.
6. **Cutover** (owner's go, 2026-09-08 17:37Z, ahead of M11 by owner decision): the ignored-build-step cleared, `release` fast-forwarded to `main`, production branch `main` → v3 serves `reachkit.app`. Still open after cutover: Inngest (#315), Resend (#325, #81), the M11 live checks. **Rollback:** `alter table v2_archive.<t> set schema public` for every table, then promote the frozen v2 deployment `dpl_2NEUXishMXAkzXG4Ti85yTy7NDda` and re-bind v2's price id.

## 4. Log
- 2026-09-05 — interim project `reachkitv3` created with `dev.reachkit.app`; 12 secrets placeholders (owner had not pasted).
- 2026-09-08 — owner ruling: consolidate to `reachkit`; this document written; execution pending the owner's choice between the staged and immediate path in step 2.
- 2026-09-08 12:40Z — **staged path executed** (owner: "staged"): `reachkit` unlinked from reachkitv2 and linked to `tim-clifford6991/reachkitv3`; v2's production deployment (23 Aug, `dpl_2NEUXishMXAkzXG4Ti85yTy7NDda`) stays live as the rollback candidate; `release` branch created at main's HEAD and set as the production branch; the ignored-build-step command skips every production build until cutover (`if [ "$VERCEL_ENV" = "production" ]; then exit 0; else exit 1; fi`); `dev.reachkit.app` moved from `reachkitv3` to `reachkit` bound to branch `main`; a `main` deployment triggered; deployment protection `all_except_custom_domains` set on `reachkit`. Cutover later = remove the ignore command, push `main` → `release` (fast-forward), remove `dev.reachkit.app`.
- 2026-09-08 12:50Z — first v3 preview builds on `reachkit` failed at the boot invariants: `IP_HASH_SALT` and `OWNER_EMAILS` existed on production only. Both added to the preview target (`OWNER_EMAILS` encrypted, `IP_HASH_SALT` sensitive, values carried over from the interim project's development target); builds re-triggered. Lesson: every binding in `env.ts` must exist on **preview** too, or no PR can build.
- 2026-09-08 13:0xZ — interim project `reachkitv3` **deleted** (HTTP 204); `reachkit` is the only ReachKit project. Deployment protection **off** on `reachkit`: Vercel's standard protection does not exempt a *branch-bound* custom domain, so `dev.reachkit.app` showed the Vercel login; v2 never had protection, so this restores the previous state. First v3 runtime on `dev.reachkit.app` returned 500 from the boot invariant `PriceObjectMismatch`: v2's `STRIPE_PRICE_ID` is a €59 price, v3's spec is €49 (BUILD §13). **Open until the owner acts:** (a) a €49/month Stripe price bound as `STRIPE_PRICE_ID` on preview (test mode) — the boot invariants refuse anything else; (b) the database: v2's schema is live on reachkit.app, so v3 on `dev.reachkit.app` needs a v3 database until cutover (a Supabase branch or a temporary dev project), or the database cutover happens now and takes v2 down with it.
- 2026-09-08 ~17:37Z — **cutover executed** (owner's go). Stripe: live product `ReachKit` and its €49/month tax-inclusive price created, v2's products and prices set inactive, `STRIPE_PRICE_ID` bound on production and preview. Database: every v2 object moved to schema `v2_archive`, v3's 38 migrations applied through the Supabase connector in five chunks; the security advisor then named eight plpgsql functions with a mutable `search_path` (#384) and six policy-less tables that are so by design. Vercel: the ignored-build-step cleared, `release` fast-forwarded to `main` (420bb48) → production deployment; `main` redeployed. Verified 2026-09-09: `reachkit.app` renders v3's landing (the Discoverability Score specimen); `dev.reachkit.app` serves the same `main`.
- 2026-09-08 (evening) — the production branch is **`main`** (`release` exists at 420bb48 and is not the production branch). Owner downgraded Vercel to **Hobby** and Supabase to **Free**. GitHub: `reachkitv3` renamed **`reachkit`** (repository id unchanged, old URLs redirect); the former `reachkit` renamed `reachkitv1` and archived; `reachkitv2` archived. The Vercel link follows the repository id, so deployments continue; the local checkout stays at `/root/projects/reachkitv3`.
- 2026-09-09 — the Vercel CLI token on the agent box returns 403 on every endpoint and the CLI is no longer installed: env and deploy operations through the API wait for the owner to run `vercel login` there (or paste a fresh token). Until then deploy state is read from the GitHub `Vercel` commit status.
- 2026-09-09 (morning) — owner reinstalled the CLI and logged in; `vercel whoami` refreshes the OAuth token in `~/.local/share/com.vercel.cli/auth.json` (a 403 with `invalidToken` means: run `vercel whoami` first, then retry). The Vercel MCP connector is attached to the master session (project and deployments readable; no env management). **v2 env leftovers still present** on `reachkit` (22 rows: `APP_URL`, `NEXT_PUBLIC_SITE_URL`, `REACHKIT_*`, `DATAFORSEO_BACKLINKS/LANGUAGE_CODE/LOCATION_CODE`, `POSTHOG_*`, `NEXT_PUBLIC_POSTHOG_*`, `PRODUCT_HUNT_TOKEN`, `TAVILY_API_KEY`, `VOYAGE_API_KEY`, `YOUTUBE_API_KEY`, `STRIPE_PRICE_GROWTH(_ANNUAL)`, `STRIPE_PRICE_SOLO(_ANNUAL)`, `STRIPE_PROMO_CODE_ID`): none is read by v3; the delete calls are blocked by the master session's classifier, so the owner runs `/root/ops/reachkit/bin/rm-v2-env.sh` or deletes them in the dashboard. Deleted rows are struck from §2 when that happens.
