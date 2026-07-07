# Pre-launch validation runbook

Repeatable end-to-end validation of the live scan pipeline. Run before every
launch-critical deploy. This is the exact loop used on 2026-07-07/08.

**Targets:** prod Supabase `kleepxxddbcnfsfwudoe`, prod app `https://reachkit-pi.vercel.app`.
Needs the prod `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard → Settings → API) for
the auth/deepen steps. Never commit it.

## 0. Deploy hygiene
- After ANY prod deploy: `curl -X PUT https://reachkit-pi.vercel.app/api/inngest`
  → expect `{"message":"Successfully registered","modified":…}`. (Automated by
  `.github/workflows/inngest-sync.yml`; do it manually if the Action didn't run.)
  If Inngest is stale, `scan/deepen` (and the crons) silently drop events.

## 1. (Optional) purge the test app
```sql
-- find the app + scans for the domain, then delete the scan rows (cascades to
-- findings/actions/scan_signals/scan_events/pipeline_runs) or truncate for a full reset.
delete from scans where app_id in (select id from apps where store_url ilike '%trustmrr%');
```

## 2. Free scan (anonymous)
```bash
curl -s -X POST https://reachkit-pi.vercel.app/api/scan \
  -H 'content-type: application/json' -d '{"store_url":"trustmrr.com"}'
# → { scan_id, slug }
```
Poll `scans` until `status='done'`. Record `started_at`/`completed_at` (free time).

## 3. Grant paid + deepen (simulates the post-checkout path without Stripe)
```sql
update users set tier='growth', subscription_status='active',
  current_period_end = now() + interval '30 days',
  app_ids = array[<app_id>]::uuid[]
where email='<you>@example.com';
```
Mint a session and re-POST as the paid user (fires `ensureDeepScan`):
```bash
KEY=<prod service_role>; SUPA=https://kleepxxddbcnfsfwudoe.supabase.co; APP=https://reachkit-pi.vercel.app
TH=$(curl -s -X POST "$SUPA/auth/v1/admin/generate_link" -H "apikey: $KEY" -H "authorization: Bearer $KEY" \
  -H 'content-type: application/json' -d '{"type":"magiclink","email":"<you>@example.com"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["hashed_token"])')
curl -s -o /dev/null -c jar "$APP/auth/confirm?token_hash=$TH&type=magiclink&next=/app"
curl -s -b jar -X POST "$APP/api/scan" -H 'content-type: application/json' -d '{"store_url":"trustmrr.com"}'
```
Poll until `scans.deepened_at` is set (deep time = deepened_at − free completed_at).

## 4. Completeness checks (SQL)
```sql
select tier, status, score_total, score_version, deepened_at, cost_cents,
  (select count(*) from actions where scan_id=s.id)        as actions,       -- ≥5
  (select count(*) from scan_signals where scan_id=s.id)   as signals,       -- 18
  (select count(*) from score_snapshots where app_id=s.app_id) as snaps,     -- ≥2
  (select count(*) from market_snapshots where app_id=s.app_id) as mkt_snaps,-- ≥1
  (report_payload->'market' is not null)                   as has_market,
  (select count(*) from competitors where app_id=s.app_id and competitor_store_url<>'') as comp_domains
from scans s order by created_at desc limit 1;
-- also: every actions.signal_keys is non-empty; cost_cents ≈ sum(pipeline_runs.cost_cents)
```

## 5. Render checks (no false "empty/failed" states)
```bash
curl -s https://reachkit-pi.vercel.app/scan/trustmrr.com | grep -c "wasn't available"   # → 0 (A5)
# free page: score band, "Not measured" (A6), 3 open + locked-titled fixes (A2), gap teaser (A5)
```

## 6. Report times + costs
```sql
select stage, model, tokens_in, tokens_out, cost_cents, duration_ms
from pipeline_runs where scan_id=<id> order by created_at;
```

## Pass bar
`done` status · score present · actions ≥5 with signal_keys · market present · snapshots + cost_cents populated · free page shows no apology and a real upgrade wall.
