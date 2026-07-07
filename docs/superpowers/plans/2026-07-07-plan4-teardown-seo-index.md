# Plan 4 — Teardown SEO Index (searchable, paginated, uncapped sitemap)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn every completed scan into a permanent, **searchable** and **paginated** public entry on `/teardowns` (linking to `/scan/<slug>`), and ensure **all** of them are in the sitemap — an SEO growth surface with no silent top-N cap.

**Architecture:** `listPublicScans` currently dedupes in memory *after* a DB `limit`, so it can't back correct pagination. Introduce a deduped Postgres **view** `public_scans` (one latest completed web scan per app), then rewrite `listPublicScans({ q?, limit, offset })` + add `countPublicScans({ q? })` to query it (search = `store_url ILIKE`, order = `completed_at desc`, page = `.range()`). The `/teardowns` page becomes `?q=&page=`-driven (server-rendered filter + pager, tiny client input island). The sitemap enumerates the full set via the count.

**Tech Stack:** Next.js 16 App Router (server components), TypeScript, Supabase (view + `serverDb()` service role), Vitest.

## Global Constraints

- **No silent cap:** the index and sitemap must reflect ALL qualifying scans (a scan qualifies = `status='done'` AND `completed_at IS NOT NULL` AND `apps.platform='web'`, deduped to one per app). Do not add a `score_total`/`report_payload` requirement (scans with a null score are listed; the score just hides).
- **Search field = domain (`store_url`/slug).** `apps.name` is never populated by the pipeline — do NOT search it. Product-name search is out of scope (would need a backfill migration).
- **Link target = `/scan/<slug>`** (already the case; keep it).
- **Server-rendered:** the teardowns page stays a server component; search/pagination via `searchParams`, with at most a small `"use client"` input island (model on `pricing/billing-toggle.tsx`). Keep marketing First-Load-JS small.
- **Reads use `serverDb()`** (service role) so the view over RLS tables is readable; no RLS/grant changes needed.

## File Structure

- **Create** `supabase/migrations/2026070713xxxx_public_scans_view.sql` — the deduped `public_scans` view.
- **Modify** `lib/scan/public-scans.ts` — rewrite `listPublicScans` + add `countPublicScans` over the view.
- **Modify** `app/(marketing)/teardowns/page.tsx` — `?q=&page=` search + pager + count over the live scans.
- **Create** `app/(marketing)/teardowns/teardown-search.tsx` — tiny client input island (updates `?q=`).
- **Modify** `app/sitemap.ts` — enumerate all public scans (drive off `countPublicScans`), and add `/teardowns?page=N` page URLs.
- **Create** `tests/integration/public-scans.test.ts` — search/pagination/dedupe/count coverage.

---

## Task 1: `public_scans` view + reworked `listPublicScans` / `countPublicScans`

**Files:**
- Create: `supabase/migrations/2026070713xxxx_public_scans_view.sql`
- Modify: `lib/scan/public-scans.ts`
- Test: `tests/integration/public-scans.test.ts`

**Interfaces:**
- Consumes: `serverDb`, `slugForScan`.
- Produces:
  - `export async function listPublicScans(opts?: { q?: string; limit?: number; offset?: number }): Promise<PublicScan[]>` — deduped, `completed_at DESC`, optional domain search, page window. Keeps the `PublicScan` shape `{ slug, host, score, completedAt }`.
  - `export async function countPublicScans(opts?: { q?: string }): Promise<number>` — total matching entries (for the pager + sitemap).
  - **Back-compat:** keep a positional-number overload OR update the two callers (sitemap, teardowns). Prefer updating callers; if simpler, accept `listPublicScans(limitNumber)` still by normalizing.

**Migration (`public_scans` view):**
```sql
-- One public teardown per app: the latest completed WEB scan. Powers the
-- /teardowns index (search + pagination) and the sitemap. Read via the service
-- role (serverDb), so no RLS grant is required.
create or replace view public_scans as
select distinct on (s.app_id)
  s.app_id,
  s.id            as scan_id,
  s.score_total,
  s.completed_at,
  a.store_url,
  a.platform
from scans s
join apps a on a.id = s.app_id
where s.status = 'done'
  and s.completed_at is not null
  and a.platform = 'web'
order by s.app_id, s.completed_at desc;
```

- [ ] **Step 1: Write the failing test** (`tests/integration/public-scans.test.ts`, model on `tests/integration/scan-abuse.test.ts` seeding + cleanup):
  - Seed 3 web apps each with a done scan (distinct `completed_at`), plus one app with TWO done scans (assert dedupe → one entry, latest), plus one non-web app (assert excluded), plus one `status!='done'` scan (excluded).
  - `listPublicScans()` returns the deduped web set, `completed_at DESC`.
  - `listPublicScans({ q: "<one domain substring>" })` returns only matching.
  - `listPublicScans({ limit: 2, offset: 0 })` and `{ limit: 2, offset: 2 }` return disjoint pages covering the set.
  - `countPublicScans()` == number of distinct qualifying apps; `countPublicScans({ q })` matches the filtered count.
  - Clean up seeded rows in `afterAll`.
  Run: `pnpm test:int tests/integration/public-scans.test.ts` → FAIL.
- [ ] **Step 2: Apply the migration** locally (`psql "$LOCAL" -f <migration>`), and confirm the view exists.
- [ ] **Step 3: Implement** `listPublicScans`/`countPublicScans` over `public_scans`:
  - `listPublicScans`: `db.from("public_scans").select("scan_id, score_total, completed_at, store_url")` + `.ilike("store_url", \`%${q}%\`)` when `q` + `.order("completed_at", { ascending: false })` + `.range(offset, offset + limit - 1)`; map each to `PublicScan` via `slugForScan({ storeUrl, platform: "web", scanId })` (host = slug). Default `limit` generous (e.g. 48) but caller-overridable.
  - `countPublicScans`: `db.from("public_scans").select("app_id", { count: "exact", head: true })` + optional `.ilike`.
  - Normalize the legacy `listPublicScans(48)` numeric call (sitemap/teardowns) — either update both callers in their tasks or accept `number | opts`.
- [ ] **Step 4: Run test → pass; `pnpm test` (full) + `tsc --noEmit` clean.**
- [ ] **Step 5: Apply the migration to PROD** (via the Supabase MCP `apply_migration`, project `kleepxxddbcnfsfwudoe`) so the deployed code's view exists. (The controller will run this — the implementer notes it in the report.)
- [ ] **Step 6: Commit** `feat(teardowns): public_scans view + searchable/paginated listPublicScans + countPublicScans`

---

## Task 2: `/teardowns` — search + pagination + count over live scans

**Files:**
- Modify: `app/(marketing)/teardowns/page.tsx`
- Create: `app/(marketing)/teardowns/teardown-search.tsx` (client input island)

**Changes:**
- `TeardownsPage` accepts `searchParams: Promise<{ q?: string; page?: string }>` (Next 16 async searchParams). Parse `q` (trim) and `page` (1-based, clamp ≥1). `const PAGE_SIZE = 24`.
- The `LiveScans` async section: call `listPublicScans({ q, limit: PAGE_SIZE, offset: (page-1)*PAGE_SIZE })` and `countPublicScans({ q })`. Render:
  - a heading with the real count (e.g. `{total} scans indexed` — replace/augment the editorial-only count copy),
  - the `<TeardownSearch initialQ={q} />` input island above the grid,
  - the existing chip grid (each `<Link href={`/scan/${s.slug}`}>` — unchanged),
  - a pager (Prev/Next + "page X of N") built from `total`/`PAGE_SIZE`, using `<Link>` to `/teardowns?q=…&page=…` (server navigation, no client state); hide Prev on page 1, Next on the last page.
  - empty state when `total === 0` for a query ("No teardowns match '<q>'").
- `teardown-search.tsx`: `"use client"`, a controlled `<input>` that on submit (Enter) / debounce does `router.push('/teardowns?q=' + encodeURIComponent(value))` (reset to page 1). Keep it tiny (model on `billing-toggle.tsx`'s island size). No client-side list filtering — the server does it.
- Keep the editorial `allTeardowns` section as-is (it's separate static content).

- [ ] **Step 1: Implement** the page changes + the search island.
- [ ] **Step 2: `pnpm test` + `tsc --noEmit` clean.** Manually reason the empty/last-page/pager URLs.
- [ ] **Step 3: Commit** `feat(teardowns): search + pagination + live count on the index`

---

## Task 3: Sitemap enumerates ALL public scans + teardown pages

**Files:**
- Modify: `app/sitemap.ts`

**Changes:**
- Replace the hard `listPublicScans(500)` cap: fetch the full set. Use `countPublicScans()` then page through `listPublicScans({ limit, offset })` in chunks (e.g. 1000) until all are collected, mapping each to `${SITE.url}/scan/${slug}` (as today). (At current scale one call suffices, but the loop removes the silent 500 cap.)
- Add `/teardowns?page=N` URLs for N = 1..ceil(total / PAGE_SIZE) (PAGE_SIZE = 24, matching Task 2) so the paginated index is crawlable. (Import or re-declare PAGE_SIZE consistently — export it from the teardowns page or a shared const.)
- Keep the existing editorial `/teardowns/<slug>` entries.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: `tsc --noEmit` clean; reason the URL set is correct (no dupes, no cap).**
- [ ] **Step 3: Commit** `feat(sitemap): enumerate all public scans + paginated teardown index pages`

---

## Self-Review

- **Spec coverage:** every completed scan listed (view, no cap — T1/T2), searchable (domain ilike — T1/T2), paginated (range + pager — T1/T2), in the sitemap (T3), links to `/scan/<slug>` (already). Tests (T1).
- **Scale note:** the view + `.range()` + count is correct at any size; the sitemap chunk loop removes the 500 cap.
- **Out of scope:** product-name search (needs an `apps.name` backfill migration + trgm index) — note as a follow-up; domain search covers the visible identity.

## Execution Handoff
Subagent-driven. **T1 first** (view + data layer; everything depends on it) → **T2 ∥ T3** (page vs sitemap; disjoint files, both consume T1's new signatures). The controller applies the prod migration after T1's local verification.
