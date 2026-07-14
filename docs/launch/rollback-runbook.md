# ReachKit — Rollback & Recovery Runbook (launch P5)

_Last verified 2026-07-15 against prod Supabase `kleepxxddbcnfsfwudoe`._

Migrations here are **forward-only** — there are no down-migrations. A destructive
migration (e.g. `20260708120000_retire_dead_intel_tables.sql`, `DROP TABLE … CASCADE`
on 7 tables) is **irreversible by re-running SQL**; recovery is a point-in-time
restore. This runbook is the recovery story that gap implies.

## 1. Prod migration state — VERIFIED APPLIED (2026-07-15)

Checked live via `information_schema` (read-only). All green — **nothing pending**:

| Check | Expected | Actual |
|---|---|---|
| 7 retired intel tables remaining | 0 | **0** ✅ |
| `scans` cost columns (`dataforseo_cost_cents`, `tavily_cost_cents`, `external_cap_hit_at`) | 3 | **3** ✅ |
| `user_spend_monthly` view | present | **present** ✅ |
| `processed_stripe_events` (P2 idempotency ledger) | present | **present** ✅ |
| `scans.scan_consent_at` (P3a) | present | **present** ✅ |
| `actions.scheduled_for` | present | **present** ✅ |

Re-run this check before any deploy that ships a new migration:

```sql
select
  (select count(*) from information_schema.tables where table_schema='public'
     and table_name in ('keyword_gap','demand_pocket','content_plan_item','distribution_plan_item','cohort_competitor','domain_intel','domain_content_page')) as dead_tables_remaining,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='scans'
     and column_name in ('dataforseo_cost_cents','tavily_cost_cents','external_cap_hit_at')) as scan_cost_cols_present,
  (select count(*) from information_schema.views where table_schema='public' and table_name='user_spend_monthly') as spend_view_present;
```

## 2. Rolling back a bad DEPLOY (no schema change)

Fastest path — no data risk:

1. Vercel → the ReachKit project → **Deployments** → the last-known-good deployment → **Promote to Production** (instant alias swap, no rebuild).
2. If the bad deploy only added code (no migration), that's the whole rollback.
3. Kill switch for a degraded scan dependency (not a rollback): set `SCANNING_ENABLED=false` in Vercel env → redeploy, or it takes effect on the next deploy. Pauses new scans without touching data (P4).

## 3. Rolling back a bad MIGRATION (data corruption / bad DROP)

There are no down-migrations, so:

1. **Stop writes** — set `SCANNING_ENABLED=false` and, if needed, pause the Inngest crons, so no new data lands mid-restore.
2. **Point-in-time restore (PITR)** — Supabase Dashboard → Database → Backups → restore to a timestamp **just before** the bad migration ran. This is the only way to recover a `DROP TABLE`.
3. Restoring rewinds the WHOLE database to that timestamp — any legitimate writes after it are lost. Choose the timestamp deliberately and communicate the data-loss window.
4. Re-apply only the good migrations after the restore point (via Supabase MCP `apply_migration` or the CLI), verify with the §1 query, then re-enable scanning.

## 4. Backups / PITR — OWNER-ACTION (verify before launch)

- **Confirm PITR is ON** for `kleepxxddbcnfsfwudoe` (Dashboard → Database → Backups). PITR is a paid add-on and is **not** enabled by default on all plans — without it, only daily logical backups exist and the recovery granularity is a full day, not a timestamp. This is Tim's toggle to confirm.
- Note the retention window (e.g. 7 days) — it bounds how far back §3 can restore.

## 5. Applying pending migrations to prod (when there ARE any)

Currently **none pending** (§1). When a PR adds a migration:

1. Merge the PR (migration file lands in `supabase/migrations/`).
2. Apply to prod via Supabase MCP `apply_migration` (or `supabase db push`) — with owner go-ahead for any destructive statement.
3. Verify with the §1 query. Deploy the code that reads the new schema **after** the migration is applied (additive columns that live code reads will error at runtime if the deploy lands first).

## 6. No `seed.sql` needed

Tiers/limits (`TIER_LIMITS`) and price mapping are **code constants** + env price IDs, not DB rows. A fresh prod DB needs only the migrations + the `handle_new_user` auth trigger. No reference/lookup data is assumed present — confirmed 2026-07-15.
