# ReachKit — Rollback & Recovery Runbook (launch P5)

_Last verified 2026-07-15 against prod Supabase `kleepxxddbcnfsfwudoe`._

Migrations here are **forward-only** — there are no down-migrations. A destructive
migration (e.g. `20260708120000_retire_dead_intel_tables.sql`, `DROP TABLE … CASCADE`
on 7 tables) is **irreversible by re-running SQL**; recovery means restoring a backup.
PITR is deliberately OFF (§4), so the recovery floor is the **last daily backup**
(~24h of possible data loss) and the real safeguard is taking a targeted dump
**before** any destructive migration (§3.1). This runbook is the recovery story
those constraints imply.

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

There are no down-migrations **and PITR is deliberately OFF** (§4), so the recovery
floor is the last **daily backup** — expect **up to ~24h of data loss**. Plan
accordingly:

1. **Stop writes** — set `SCANNING_ENABLED=false` and, if needed, pause the Inngest crons, so no new data lands mid-restore.
2. **Restore the most recent daily backup** — Supabase Dashboard → Database → Backups → the latest daily snapshot **before** the bad migration ran → Restore. This is the only way to recover a `DROP TABLE`.
3. Restoring rewinds the WHOLE database to that snapshot. Everything written since it is gone — there is no timestamp-level rewind without PITR. Communicate the data-loss window.
4. Re-apply only the good migrations (via Supabase MCP `apply_migration` or the CLI), verify with the §1 query, then re-enable scanning.

### 3.1 The mitigation that replaces PITR: snapshot BEFORE you destroy

Because the recovery floor is a whole day, the discipline moves **forward** of the
migration. Before applying any migration containing `DROP`, `TRUNCATE`, or a
destructive `ALTER`:

1. Take an on-demand backup (Dashboard → Database → Backups → the daily backup is
   scheduled, so for anything risky use `pg_dump` of the affected tables), e.g.:
   ```bash
   pg_dump "$SUPABASE_DB_URL" -t public.<table> --data-only --column-inserts > /tmp/<table>-$(date +%F).sql
   ```
2. Keep the dump until the change is verified in prod.
3. Only then apply the migration.

This is cheap, targeted, and gives a real undo for exactly the class of change that
PITR would otherwise cover.

## 4. Backups / PITR — DECIDED: PITR stays OFF (2026-07-15)

- The org (`timclifford`) is on **Pro**, which includes **daily backups (~7-day retention)** — that's the safety net.
- **PITR is deliberately NOT enabled**: it's a ~$100/mo add-on and Supabase spend is already a concern. Owner decision, 2026-07-15.
- **Consequence, accepted:** no timestamp-level restore. Worst-case recovery loses up to ~24h of scans/reports/accounts. For a pre-launch product with no productive users, that trade is reasonable — **revisit once there are paying users whose data loss would be unacceptable** (a day of a paying customer's scans + plan is a real cost).
- Because of this, §3.1 (snapshot before destructive migrations) is the operative safeguard, not a nice-to-have.

## 5. Applying pending migrations to prod (when there ARE any)

Currently **none pending** (§1). When a PR adds a migration:

1. Merge the PR (migration file lands in `supabase/migrations/`).
2. Apply to prod via Supabase MCP `apply_migration` (or `supabase db push`) — with owner go-ahead for any destructive statement.
3. Verify with the §1 query. Deploy the code that reads the new schema **after** the migration is applied (additive columns that live code reads will error at runtime if the deploy lands first).

## 6. No `seed.sql` needed

Tiers/limits (`TIER_LIMITS`) and price mapping are **code constants** + env price IDs, not DB rows. A fresh prod DB needs only the migrations + the `handle_new_user` auth trigger. No reference/lookup data is assumed present — confirmed 2026-07-15.
