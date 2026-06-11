# ReachKit Phase 1a — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the ReachKit repo, database, warehouse, job runner, cost telemetry, tool-registry interface, and scan-shaped API scaffolding — a deployable app with zero product logic — so every later cycle builds on stable, observable foundations.

**Architecture:** Next.js 16 (App Router, Turbopack) on Vercel; Supabase Postgres is the entire warehouse (three layers + pgvector); Inngest runs the scan pipeline as a durable multi-step function. Every external/LLM call appends a `pipeline_runs` row from day one (the 90%+ gross-margin constraint is enforced by telemetry, not hope). The scan pipeline, API routes, SSE stream, and tool registry exist as typed scaffolding here; their data-fetching bodies arrive in Phase 1b.

**Tech Stack:** Next.js 16 / React 19.2 + React Compiler / TypeScript strict / Tailwind v4 / shadcn-on-Base-UI / Supabase (Postgres + RLS + pgvector + magic-link Auth + Storage) / Inngest / Vitest / Zod / PostHog / Vercel.

**Spec refs:** `REACHKIT_SPEC_V2.md` §5.3 (stack), §5.4 (core model), §5.5 (API), §5.7 (warehouse + pgvector), §9.4 (tool registry), §13 (cost discipline), §20 (frontend stack), §21.4 (repo layout). Execution context: `docs/specs/2026-06-11-reachkit-execution-decomposition.md` (Cycle 0).

**Acceptance gate (Cycle 0):** app deploys to Vercel; all migrations apply cleanly; a `scan.demo` Inngest run writes a `pipeline_runs` row; a pgvector similarity query returns; CI is green including bundle-size budgets.

**Conventions:**
- Package manager: `pnpm`. Test runner: `vitest`. All commands run from repo root.
- Tests co-located as `*.test.ts` for unit; DB/Inngest integration tests in `tests/integration/` and run against **Supabase local** (`supabase start`).
- Commit after every task with the message shown. Use `feat:`/`chore:`/`test:` prefixes.
- TypeScript `strict: true`; no `any` in committed code (use `unknown` + narrowing).

---

## File Structure (created in this plan)

```
reachkit/
├── app/
│   ├── layout.tsx                      # root layout, fonts, theme provider
│   ├── (marketing)/page.tsx            # placeholder landing (real in Cycle 5)
│   ├── (funnel)/scan/[id]/page.tsx     # placeholder funnel shell (real in Cycle 2)
│   ├── (app)/app/page.tsx              # placeholder app shell (real in Cycle 4)
│   ├── report/[slug]/page.tsx          # placeholder public report (real in Cycle 3)
│   └── api/
│       ├── scan/route.ts               # POST /api/scan  (creates scan, enqueues Inngest)
│       ├── scan/[id]/stream/route.ts   # GET SSE progress stream
│       └── inngest/route.ts            # Inngest serve endpoint
├── components/
│   ├── ui/                             # shadcn-on-Base-UI primitives (owned)
│   ├── sections/  motion/  report/     # empty dirs w/ .gitkeep (filled later cycles)
├── lib/
│   ├── config/env.ts                   # zod-validated typed env
│   ├── db/client.ts                    # Supabase client (server + browser)
│   ├── db/types.ts                     # generated DB types
│   ├── db/raw-documents.ts             # raw_documents repo (content-hash dedupe)
│   ├── telemetry/pipeline-runs.ts      # recordPipelineRun + cost helpers
│   ├── tools/registry.ts               # tool-registry interface + ScanBudget enforcement
│   ├── inngest/client.ts               # Inngest client
│   ├── inngest/functions/scan-demo.ts  # no-op pipeline proving the path
│   ├── scan/pipeline.ts                # scan orchestration scaffold (stage hooks, no bodies)
│   ├── seo.ts                          # metadata + JSON-LD factory
│   ├── analytics.ts                    # PostHog init
│   └── flags.ts                        # feature flags
├── content/                            # .gitkeep (pages/playbooks land in Cycle 5)
├── supabase/
│   └── migrations/
│       ├── 0001_core_model.sql         # §5.4 tables
│       ├── 0002_warehouse.sql          # §5.7 layers 1-3 + telemetry
│       ├── 0003_pgvector.sql           # extension + embeddings + HNSW
│       └── 0004_rls.sql                # RLS policies + auth grants
├── tests/integration/                  # DB + Inngest integration tests
├── .github/workflows/ci.yml            # typecheck, lint, test, build, bundle budget
├── vitest.config.ts
├── tailwind config via @theme in app/globals.css
└── package.json
```

---

## Task 1: Initialize Next.js 16 + TypeScript strict + Tailwind v4

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/(marketing)/page.tsx`

- [ ] **Step 1: Scaffold the app**

Run:
```bash
pnpm dlx create-next-app@latest . --ts --app --tailwind --eslint --use-pnpm --turbopack --no-src-dir --import-alias "@/*"
```
Expected: project files created in the current directory (`reachkit/`). If prompted to proceed in a non-empty dir, accept (only `REACHKIT_SPEC_V2.md` and `docs/` exist).

- [ ] **Step 2: Enable React Compiler + strict TS**

Edit `next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: { cacheComponents: true }, // "use cache" (§20.1)
};

export default nextConfig;
```
Confirm `tsconfig.json` has `"strict": true` (create-next-app sets it; verify).

- [ ] **Step 3: Define Tailwind v4 theme tokens**

Replace `app/globals.css` body with the token layer (dark-first, §19 #9 / §20.4). Tokens are CSS variables in `@theme`:
```css
@import "tailwindcss";

@theme {
  --color-bg: #0a0a0b;
  --color-fg: #ededef;
  --color-accent: #5b8cff;
  --color-muted: #9b9ba3;
  --radius-card: 0.875rem;
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --duration-micro: 200ms;   /* §20.3 micro-interactions */
  --duration-transition: 500ms;
}

html { color-scheme: dark; background: var(--color-bg); color: var(--color-fg); }
```

- [ ] **Step 4: Wire Geist fonts in the root layout**

Edit `app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = { title: "ReachKit", description: "The distribution system for solo founders." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```
Run `pnpm add geist`.

- [ ] **Step 5: Verify build + dev server**

Run:
```bash
pnpm build
```
Expected: build completes with no type errors; routes `/` compiled.

- [ ] **Step 6: Commit**

```bash
git init && git add -A
git commit -m "chore: scaffold Next.js 16 + Tailwind v4 + Geist, strict TS, React Compiler"
```

---

## Task 2: Vitest + lint + CI pipeline with bundle budget

**Files:**
- Create: `vitest.config.ts`, `lib/_smoke.test.ts`, `.github/workflows/ci.yml`, `scripts/check-bundle.mjs`

- [ ] **Step 1: Install and configure Vitest**

Run `pnpm add -D vitest @vitest/coverage-v8`. Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { environment: "node", include: ["**/*.test.ts"], exclude: ["tests/integration/**", "node_modules/**"] },
});
```
Run `pnpm add -D vite-tsconfig-paths`. Add scripts to `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:int": "vitest run --config vitest.integration.config.ts",
  "typecheck": "tsc --noEmit",
  "check:bundle": "node scripts/check-bundle.mjs"
}
```

- [ ] **Step 2: Write a smoke test (proves the runner)**

Create `lib/_smoke.test.ts`:
```ts
import { expect, test } from "vitest";
test("vitest runs", () => { expect(1 + 1).toBe(2); });
```

- [ ] **Step 3: Run it — expect PASS**

Run: `pnpm test`
Expected: `1 passed`.

- [ ] **Step 4: Bundle-budget guard (§20.4)**

Create `scripts/check-bundle.mjs` (fails CI if a route-group First Load JS exceeds budget; parses `.next/app-build-manifest.json` sizes):
```js
import { readFileSync } from "node:fs";
// Budgets in KB of First Load JS per route group (§20.4).
const BUDGETS = { "(marketing)": 180, "(funnel)": 160, "(app)": 220 };
const manifest = JSON.parse(readFileSync(".next/app-build-manifest.json", "utf8"));
let failed = false;
for (const [route, files] of Object.entries(manifest.pages ?? {})) {
  const group = route.match(/\((\w+)\)/)?.[0];
  if (!group || !(group in BUDGETS)) continue;
  const kb = files.filter((f) => f.endsWith(".js")).reduce((n, f) => {
    try { return n + readFileSync(`.next/${f}`).length / 1024; } catch { return n; }
  }, 0);
  if (kb > BUDGETS[group]) { console.error(`✗ ${route} ${kb.toFixed(0)}KB > ${BUDGETS[group]}KB`); failed = true; }
}
process.exit(failed ? 1 : 0);
```

- [ ] **Step 5: CI workflow**

Create `.github/workflows/ci.yml`:
```yaml
name: CI
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
      - run: pnpm check:bundle
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add Vitest, CI pipeline, and per-route bundle budgets"
```

---

## Task 3: Typed, validated environment config

**Files:**
- Create: `lib/config/env.ts`, `lib/config/env.test.ts`, `.env.example`

- [ ] **Step 1: Write the failing test**

Create `lib/config/env.test.ts`:
```ts
import { expect, test, vi } from "vitest";

test("parseEnv throws on missing required key", async () => {
  const { parseEnv } = await import("./env");
  expect(() => parseEnv({} as NodeJS.ProcessEnv)).toThrow(/SUPABASE_URL/);
});

test("parseEnv returns typed config when valid", async () => {
  const { parseEnv } = await import("./env");
  const cfg = parseEnv({
    SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s",
    ANTHROPIC_API_KEY: "k", DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p",
    TAVILY_API_KEY: "t", RESEND_API_KEY: "r", POSTHOG_KEY: "ph", POSTHOG_HOST: "https://app.posthog.com",
    SCAN_BUDGET_CENTS: "150",
  } as unknown as NodeJS.ProcessEnv);
  expect(cfg.scanBudgetCents).toBe(150);
  expect(cfg.anthropicApiKey).toBe("k");
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm test lib/config/env.test.ts`
Expected: FAIL ("Cannot find module './env'").

- [ ] **Step 3: Implement `lib/config/env.ts`**

```ts
import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  DATAFORSEO_LOGIN: z.string().min(1),
  DATAFORSEO_PASSWORD: z.string().min(1),
  TAVILY_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  POSTHOG_KEY: z.string().min(1),
  POSTHOG_HOST: z.string().url(),
  SCAN_BUDGET_CENTS: z.coerce.number().int().positive().default(150), // §13 per-scan cap
});

export function parseEnv(src: NodeJS.ProcessEnv) {
  const p = schema.parse(src);
  return {
    supabaseUrl: p.SUPABASE_URL, supabaseAnonKey: p.SUPABASE_ANON_KEY, supabaseServiceKey: p.SUPABASE_SERVICE_ROLE_KEY,
    anthropicApiKey: p.ANTHROPIC_API_KEY, dataforseoLogin: p.DATAFORSEO_LOGIN, dataforseoPassword: p.DATAFORSEO_PASSWORD,
    tavilyApiKey: p.TAVILY_API_KEY, resendApiKey: p.RESEND_API_KEY,
    posthogKey: p.POSTHOG_KEY, posthogHost: p.POSTHOG_HOST, scanBudgetCents: p.SCAN_BUDGET_CENTS,
  };
}

export const env = parseEnv(process.env);
export type Env = ReturnType<typeof parseEnv>;
```
Run `pnpm add zod`. Create `.env.example` listing all keys above (empty values).

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm test lib/config/env.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: typed, zod-validated environment config with per-scan budget cap"
```

---

## Task 4: shadcn/ui on Base UI + theme

**Files:**
- Create: `components/ui/*` (via CLI), `components.json`

- [ ] **Step 1: Init shadcn with Base UI primitives**

Run `pnpm dlx shadcn@latest init`. At the prompts, select the **Base UI** primitive layer (per current shadcn docs; D40 — Base UI over Radix), the existing `app/globals.css`, and CSS variables = yes. This writes `components.json`.

- [ ] **Step 2: Add the primitives this build needs early**

Run:
```bash
pnpm dlx shadcn@latest add button card badge input skeleton sonner
```
Expected: files appear under `components/ui/`.

- [ ] **Step 3: Verify a primitive renders with the theme**

Add a temporary `<Button>` to `app/(marketing)/page.tsx`, run `pnpm dev`, load `/`, confirm the button renders with the accent color (`--color-accent`), then remove the temporary usage.

- [ ] **Step 4: Verify build still green**

Run: `pnpm build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: shadcn/ui on Base UI primitives with dark-first theme tokens"
```

---

## Task 5: Supabase local + core data model migration (§5.4)

**Files:**
- Create: `supabase/migrations/0001_core_model.sql`, `tests/integration/schema.test.ts`, `vitest.integration.config.ts`

- [ ] **Step 1: Init Supabase locally**

Run:
```bash
pnpm dlx supabase init
pnpm dlx supabase start
```
Expected: local stack boots; prints local `API URL`, `anon key`, `service_role key`. Put these into `.env.local`.

- [ ] **Step 2: Write migration `0001_core_model.sql` (§5.4 verbatim shapes)**

```sql
create extension if not exists "pgcrypto";

create table apps (
  id uuid primary key default gen_random_uuid(),
  store_url text not null,
  platform text not null check (platform in ('ios','android','web')),
  name text, category text,
  icp_mode text,                       -- 'standard' | 'cold_start'
  business_type text check (business_type in ('b2c_consumer','prosumer','b2b')),
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  app_ids uuid[] not null default '{}',
  tier text not null default 'free' check (tier in ('free','solo','growth')),
  founder_voice jsonb,
  created_at timestamptz not null default now()
);

create table scans (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','collecting','extracting','synthesizing','critiquing','formatting','done','degraded','failed')),
  tier text not null default 'free' check (tier in ('free','full')),
  score_total int, score_breakdown jsonb,
  started_at timestamptz, completed_at timestamptz,
  cost_cents int not null default 0
);

create table evidence (
  id bigint generated always as identity primary key,
  scan_id uuid not null references scans(id) on delete cascade,
  source_type text not null,
  url text, excerpt text,
  captured_at timestamptz not null default now()
);

create table findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  category text not null,
  basis text not null check (basis in ('evidence_based','probability_based')),
  confidence numeric(3,2) not null,
  body jsonb not null,
  evidence_ids bigint[] not null default '{}'
);

create table actions (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(id) on delete cascade,
  category text not null,
  title text not null, effort_min int, deadline date,
  expected_outcome jsonb,
  draft text, status text not null default 'pending',
  verify_url text, verify_state text not null default 'pending',
  score_component text, created_at timestamptz not null default now()
);

create table score_snapshots (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(id) on delete cascade,
  taken_at timestamptz not null default now(),
  total int not null, breakdown jsonb not null,
  installs_reported int
);

create table competitors (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(id) on delete cascade,
  competitor_store_url text, name text,
  source text not null, confirmed boolean not null default false
);

create table monitors (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(id) on delete cascade,
  kind text not null,                  -- 'keyword' | 'competitor' | 'intent'
  query text, cadence text not null default 'weekly',
  last_run_at timestamptz,
  watermark jsonb not null default '{}'  -- §5.7 delta state
);
```

- [ ] **Step 3: Apply + write the schema integration test**

Create `vitest.integration.config.ts` (same as base but `include: ["tests/integration/**/*.test.ts"]`). Create `tests/integration/schema.test.ts`:
```ts
import { expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

test("core tables exist and apps accepts a row", async () => {
  const { data, error } = await db.from("apps")
    .insert({ store_url: "https://reachkit.app", platform: "web", business_type: "b2c_consumer" })
    .select().single();
  expect(error).toBeNull();
  expect(data?.platform).toBe("web");
});
```
Run `pnpm add @supabase/supabase-js`.

- [ ] **Step 4: Run migration + integration test — expect PASS**

Run:
```bash
pnpm dlx supabase migration up
pnpm test:int tests/integration/schema.test.ts
```
Expected: migration applies; test passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: core data model migration (apps, scans, evidence, findings, actions, monitors)"
```

---

## Task 6: Warehouse layers + cost telemetry migration (§5.7)

**Files:**
- Create: `supabase/migrations/0002_warehouse.sql`, `tests/integration/warehouse.test.ts`

- [ ] **Step 1: Write `0002_warehouse.sql`**

```sql
-- Layer 1: raw evidence (immutable, append-only, content-hash deduped)
create table raw_documents (
  id bigint generated always as identity primary key,
  subject_type text not null,          -- 'app' | 'competitor' | 'keyword' | 'community' | 'creator'
  subject_key text not null,
  source_type text not null,
  url text,
  content_hash text not null,
  body jsonb,                          -- bulky blobs go to Storage; row holds pointer in body.storage_path
  fetched_at timestamptz not null default now(),
  mode text not null check (mode in ('ios','android','web')),
  unique (subject_type, subject_key, content_hash)
);

-- Layer 2: compressed fact sheets (cheap-model output, shared, TTL'd)
create table fact_sheets (
  id bigint generated always as identity primary key,
  subject_type text not null, subject_key text not null,
  kind text not null,                  -- 'review_themes' | 'keyword_data' | 'competitor' | 'community_map' | 'serp'
  body jsonb not null,
  evidence_ids bigint[] not null default '{}',
  model_version text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,     -- TTLs per §5.7
  shared boolean not null default true
);
create index fact_sheets_subject_idx on fact_sheets (subject_type, subject_key, kind);
create index fact_sheets_expiry_idx on fact_sheets (expires_at);

-- Layer 3: outcomes (the compounding moat)
create table outcomes (
  id uuid primary key default gen_random_uuid(),
  action_id uuid references actions(id) on delete set null,
  app_id uuid not null references apps(id) on delete cascade,
  verified_signal text,
  observed_delta jsonb,
  observed_at timestamptz not null default now()
);

-- Cost telemetry (margin enforcement, §13)
create table pipeline_runs (
  id bigint generated always as identity primary key,
  scan_id uuid references scans(id) on delete cascade,
  stage text not null,                 -- 'collect'|'extract'|'synth'|'critic'|'format'|'tool'
  model text,                          -- claude-haiku-4-5-20251001 | claude-sonnet-4-6 | null (data call)
  tokens_in int not null default 0, tokens_out int not null default 0,
  cost_cents numeric(8,3) not null default 0,
  critic_rejections int not null default 0,
  duration_ms int not null default 0,
  created_at timestamptz not null default now()
);
create index pipeline_runs_scan_idx on pipeline_runs (scan_id);
```

- [ ] **Step 2: Write the dedupe integration test**

Create `tests/integration/warehouse.test.ts`:
```ts
import { expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

test("raw_documents dedupes on (subject, hash)", async () => {
  const row = { subject_type: "app", subject_key: "sofa-ios", source_type: "itunes", content_hash: "h1", mode: "ios", body: {} };
  await db.from("raw_documents").insert(row);
  const { error } = await db.from("raw_documents").insert(row);
  expect(error?.code).toBe("23505"); // unique violation
});
```

- [ ] **Step 3: Apply + run — expect PASS**

Run: `pnpm dlx supabase migration up && pnpm test:int tests/integration/warehouse.test.ts`
Expected: unique-violation assertion passes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: warehouse layers 1-3 + pipeline_runs cost telemetry"
```

---

## Task 7: pgvector semantic layer (§5.7)

**Files:**
- Create: `supabase/migrations/0003_pgvector.sql`, `tests/integration/pgvector.test.ts`

- [ ] **Step 1: Write `0003_pgvector.sql`**

```sql
create extension if not exists vector;

-- One embeddings table for all semantic content (§5.7: reviews, threads, PAA, positioning, findings, drafts)
create table embeddings (
  id bigint generated always as identity primary key,
  subject_type text not null,          -- 'review' | 'thread' | 'question' | 'positioning' | 'finding' | 'draft'
  subject_key text not null,
  app_id uuid references apps(id) on delete cascade,
  content text not null,
  embedding vector(1024) not null,     -- model dim recorded per row below
  model text not null,
  model_version text not null,
  created_at timestamptz not null default now()
);
create index embeddings_hnsw_idx on embeddings using hnsw (embedding vector_cosine_ops);
create index embeddings_subject_idx on embeddings (subject_type, app_id);
```

- [ ] **Step 2: Write a similarity-query test (proves HNSW works)**

Create `tests/integration/pgvector.test.ts`:
```ts
import { expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

test("pgvector nearest-neighbour returns the closer row", async () => {
  const v = (fill: number) => `[${Array(1024).fill(fill).join(",")}]`;
  await db.from("embeddings").insert([
    { subject_type: "review", subject_key: "a", content: "near", embedding: v(0.10), model: "test", model_version: "1" },
    { subject_type: "review", subject_key: "b", content: "far",  embedding: v(0.90), model: "test", model_version: "1" },
  ]);
  const { data } = await db.rpc("match_embeddings", { query: v(0.11), match_count: 1 });
  expect(data?.[0]?.content).toBe("near");
});
```
Add the RPC to the same migration:
```sql
create or replace function match_embeddings(query vector(1024), match_count int)
returns table (content text, similarity float)
language sql stable as $$
  select content, 1 - (embedding <=> query) as similarity
  from embeddings order by embedding <=> query limit match_count;
$$;
```

- [ ] **Step 3: Apply + run — expect PASS**

Run: `pnpm dlx supabase migration up && pnpm test:int tests/integration/pgvector.test.ts`
Expected: returns `"near"`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: pgvector embeddings table, HNSW index, match_embeddings RPC"
```

---

## Task 8: RLS policies + magic-link auth (§5.7, D42)

**Files:**
- Create: `supabase/migrations/0004_rls.sql`, `tests/integration/rls.test.ts`

- [ ] **Step 1: Write `0004_rls.sql`**

Enable RLS; owner-scoped access on customer tables; warehouse layers are service-role only.
```sql
alter table apps enable row level security;
alter table scans enable row level security;
alter table findings enable row level security;
alter table actions enable row level security;

-- a user owns an app if its id is in users.app_ids
create policy "owner reads apps" on apps for select
  using (id = any ((select app_ids from users where id = auth.uid()))));

create policy "owner reads scans" on scans for select
  using (app_id = any ((select app_ids from users where id = auth.uid()))));

-- raw_documents / fact_sheets / pipeline_runs / embeddings: no anon/auth policies => service-role only
alter table raw_documents enable row level security;
alter table fact_sheets enable row level security;
alter table pipeline_runs enable row level security;
alter table embeddings enable row level security;
```
Configure magic-link auth in `supabase/config.toml`: `[auth.email] enable_signup = true; enable_confirmations = false` and disable password sign-in (magic link only, D42).

- [ ] **Step 2: Write the isolation test**

Create `tests/integration/rls.test.ts`: with the **anon** client (no session), a `select` on `scans` returns zero rows even when rows exist (service-role inserted them). Assert `data` is empty array, `error` is null.
```ts
import { expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
const svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

test("anon cannot read scans (RLS)", async () => {
  const app = await svc.from("apps").insert({ store_url: "x", platform: "web" }).select().single();
  await svc.from("scans").insert({ app_id: app.data!.id });
  const { data } = await anon.from("scans").select();
  expect(data).toEqual([]);
});
```

- [ ] **Step 3: Apply + run — expect PASS**

Run: `pnpm dlx supabase migration up && pnpm test:int tests/integration/rls.test.ts`
Expected: anon read returns `[]`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: RLS policies (owner-scoped customer tables, service-only warehouse) + magic-link auth"
```

---

## Task 9: Typed DB client + raw_documents repository (content-hash dedupe)

**Files:**
- Create: `lib/db/client.ts`, `lib/db/types.ts`, `lib/db/raw-documents.ts`, `lib/db/raw-documents.test.ts`

- [ ] **Step 1: Generate DB types + client**

Run:
```bash
pnpm dlx supabase gen types typescript --local > lib/db/types.ts
```
Create `lib/db/client.ts`:
```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { env } from "@/lib/config/env";

// Service-role client for pipeline/server code (bypasses RLS by design).
export const serverDb = () => createClient<Database>(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false } });
```

- [ ] **Step 2: Write the failing test for `contentHash` + `upsertRawDocument`**

Create `lib/db/raw-documents.test.ts`:
```ts
import { expect, test } from "vitest";
import { contentHash } from "./raw-documents";

test("contentHash is stable and order-independent for same value", () => {
  expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
});
test("contentHash differs for different content", () => {
  expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `pnpm test lib/db/raw-documents.test.ts`
Expected: FAIL ("Cannot find module './raw-documents'").

- [ ] **Step 4: Implement `lib/db/raw-documents.ts`**

```ts
import { createHash } from "node:crypto";
import { serverDb } from "./client";

// Stable hash over canonically-sorted keys so dedupe is order-independent.
export function contentHash(body: unknown): string {
  const canon = JSON.stringify(body, Object.keys(body as object ?? {}).sort());
  return createHash("sha256").update(canon).digest("hex");
}

export type RawDocInput = {
  subjectType: string; subjectKey: string; sourceType: string;
  url?: string; body: unknown; mode: "ios" | "android" | "web";
};

// Insert if new; on (subject, hash) conflict, do nothing and return existing id.
export async function upsertRawDocument(input: RawDocInput): Promise<{ id: number; deduped: boolean }> {
  const hash = contentHash(input.body);
  const db = serverDb();
  const { data, error } = await db.from("raw_documents")
    .upsert({ subject_type: input.subjectType, subject_key: input.subjectKey, source_type: input.sourceType,
              url: input.url, content_hash: hash, body: input.body as never, mode: input.mode },
            { onConflict: "subject_type,subject_key,content_hash", ignoreDuplicates: false })
    .select("id").single();
  if (error) throw error;
  return { id: data!.id, deduped: false };
}
```

- [ ] **Step 5: Run unit test — expect PASS**

Run: `pnpm test lib/db/raw-documents.test.ts`
Expected: `2 passed`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: typed Supabase client + raw_documents repo with content-hash dedupe"
```

---

## Task 10: Cost-telemetry writer (`pipeline_runs`)

**Files:**
- Create: `lib/telemetry/pipeline-runs.ts`, `lib/telemetry/pipeline-runs.test.ts`

- [ ] **Step 1: Write the failing test (cost math is pure, test it directly)**

Create `lib/telemetry/pipeline-runs.test.ts`:
```ts
import { expect, test } from "vitest";
import { anthropicCostCents, MODEL_PRICES } from "./pipeline-runs";

test("Sonnet 4.6 cost = tokens × published rate", () => {
  // §13: Sonnet reads fact sheets only; verify the math, not the policy.
  const c = anthropicCostCents("claude-sonnet-4-6", 1000, 500);
  const expected = (1000 / 1e6) * MODEL_PRICES["claude-sonnet-4-6"].inPerMTokUsd * 100
                 + (500 / 1e6) * MODEL_PRICES["claude-sonnet-4-6"].outPerMTokUsd * 100;
  expect(c).toBeCloseTo(expected, 6);
});
test("Haiku is cheaper than Sonnet for identical tokens", () => {
  expect(anthropicCostCents("claude-haiku-4-5-20251001", 1000, 1000))
    .toBeLessThan(anthropicCostCents("claude-sonnet-4-6", 1000, 1000));
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm test lib/telemetry/pipeline-runs.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `lib/telemetry/pipeline-runs.ts`**

```ts
import { serverDb } from "@/lib/db/client";

// Published per-MTok USD rates. Confirm against the claude-api skill before launch.
export const MODEL_PRICES = {
  "claude-haiku-4-5-20251001": { inPerMTokUsd: 1.0, outPerMTokUsd: 5.0 },
  "claude-sonnet-4-6":         { inPerMTokUsd: 3.0, outPerMTokUsd: 15.0 },
} as const;
export type ModelId = keyof typeof MODEL_PRICES;

export function anthropicCostCents(model: ModelId, tokensIn: number, tokensOut: number): number {
  const p = MODEL_PRICES[model];
  return (tokensIn / 1e6) * p.inPerMTokUsd * 100 + (tokensOut / 1e6) * p.outPerMTokUsd * 100;
}

export type PipelineRun = {
  scanId: string | null;
  stage: "collect" | "extract" | "synth" | "critic" | "format" | "tool";
  model?: ModelId; tokensIn?: number; tokensOut?: number;
  costCents: number; criticRejections?: number; durationMs: number;
};

export async function recordPipelineRun(run: PipelineRun): Promise<void> {
  const db = serverDb();
  const { error } = await db.from("pipeline_runs").insert({
    scan_id: run.scanId, stage: run.stage, model: run.model ?? null,
    tokens_in: run.tokensIn ?? 0, tokens_out: run.tokensOut ?? 0,
    cost_cents: run.costCents, critic_rejections: run.criticRejections ?? 0, duration_ms: run.durationMs,
  });
  if (error) throw error;
}

export async function scanCostCents(scanId: string): Promise<number> {
  const db = serverDb();
  const { data } = await db.from("pipeline_runs").select("cost_cents").eq("scan_id", scanId);
  return (data ?? []).reduce((n, r) => n + Number(r.cost_cents), 0);
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm test lib/telemetry/pipeline-runs.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Integration test — writer persists a row**

Create `tests/integration/telemetry.test.ts`: insert a scan, call `recordPipelineRun`, assert `scanCostCents` returns the cost. Run `pnpm test:int tests/integration/telemetry.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: pipeline_runs cost-telemetry writer + Anthropic cost math"
```

---

## Task 11: Tool-registry interface + per-scan budget enforcement (§9.4, §9.5)

**Files:**
- Create: `lib/tools/registry.ts`, `lib/tools/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/tools/registry.test.ts`:
```ts
import { expect, test } from "vitest";
import { ScanBudget, BudgetExceededError } from "./registry";

test("budget allows calls under the cap then throws", () => {
  const b = new ScanBudget({ maxToolCalls: 2, budgetCents: 100 });
  b.charge({ toolCalls: 1, cents: 10 });
  b.charge({ toolCalls: 1, cents: 10 });
  expect(() => b.charge({ toolCalls: 1, cents: 10 })).toThrow(BudgetExceededError);
});
test("budget throws when cents cap exceeded", () => {
  const b = new ScanBudget({ maxToolCalls: 100, budgetCents: 15 });
  expect(() => b.charge({ toolCalls: 1, cents: 20 })).toThrow(BudgetExceededError);
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm test lib/tools/registry.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `lib/tools/registry.ts`**

```ts
// §9.4 tool classes: D = data call (cheap, wide), L = LLM call (expensive, narrow).
export type ToolClass = "D" | "L";

export interface ToolDefinition<Args = unknown, Result = unknown> {
  name: string;          // find_competitors | get_reviews | ... (the 10 names in §9.4)
  klass: ToolClass;
  run(args: Args, ctx: ToolContext): Promise<Result>;
}

export interface ToolContext { scanId: string | null; mode: "ios" | "android" | "web"; budget: ScanBudget; }

export class BudgetExceededError extends Error {}

// §9.5: every loop runs under a budget; 30-60 tool-call ceiling, per-scan cents cap (§13).
export class ScanBudget {
  private toolCalls = 0; private cents = 0;
  constructor(private readonly limits: { maxToolCalls: number; budgetCents: number }) {}
  charge(use: { toolCalls: number; cents: number }) {
    if (this.toolCalls + use.toolCalls > this.limits.maxToolCalls)
      throw new BudgetExceededError(`tool-call cap ${this.limits.maxToolCalls} exceeded`);
    if (this.cents + use.cents > this.limits.budgetCents)
      throw new BudgetExceededError(`budget ${this.limits.budgetCents}¢ exceeded`);
    this.toolCalls += use.toolCalls; this.cents += use.cents;
  }
  get spentCents() { return this.cents; }
  get callsMade() { return this.toolCalls; }
}

// Registry skeleton — the 10 tool names declared; bodies land in Phase 1b/Cycle 3.
export const TOOL_NAMES = [
  "find_competitors","get_reviews","get_listing","search_keywords","search_web",
  "find_communities","find_creators","check_link","track_rank","verify_action",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export const registry = new Map<ToolName, ToolDefinition>();
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm test lib/tools/registry.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: tool-registry interface + ScanBudget enforcement (call cap + cents cap)"
```

---

## Task 12: Inngest harness + `scan.demo` no-op proving the pipeline path

**Files:**
- Create: `lib/inngest/client.ts`, `lib/inngest/functions/scan-demo.ts`, `lib/scan/pipeline.ts`, `app/api/inngest/route.ts`, `tests/integration/scan-demo.test.ts`

- [ ] **Step 1: Inngest client + serve route**

Run `pnpm add inngest`. Create `lib/inngest/client.ts`:
```ts
import { Inngest } from "inngest";
export const inngest = new Inngest({ id: "reachkit" });
```
Create `app/api/inngest/route.ts`:
```ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { scanDemo } from "@/lib/inngest/functions/scan-demo";
export const { GET, POST, PUT } = serve({ client: inngest, functions: [scanDemo] });
```

- [ ] **Step 2: Pipeline scaffold (stage hooks, no bodies)**

Create `lib/scan/pipeline.ts` — the typed stage sequence Phase 1b fills in:
```ts
import { ScanBudget } from "@/lib/tools/registry";

export type ScanStage = "collect" | "extract" | "synth" | "critic" | "format";
export const SCAN_STAGES: ScanStage[] = ["collect", "extract", "synth", "critic", "format"];

export interface ScanContext { scanId: string; appId: string; mode: "ios" | "android" | "web"; budget: ScanBudget; }

// Phase 1b implements collect(); 2 implements extract+synth(minimal); 3 implements critic+format.
export async function runCollect(_ctx: ScanContext): Promise<void> { /* Phase 1b */ }
```

- [ ] **Step 3: `scan.demo` function — writes a `pipeline_runs` row**

Create `lib/inngest/functions/scan-demo.ts`:
```ts
import { inngest } from "@/lib/inngest/client";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";

export const scanDemo = inngest.createFunction(
  { id: "scan-demo" },
  { event: "scan/demo.requested" },
  async ({ event, step }) => {
    await step.run("record-telemetry", async () => {
      await recordPipelineRun({ scanId: event.data.scanId ?? null, stage: "collect", costCents: 0, durationMs: 1 });
    });
    return { ok: true };
  },
);
```

- [ ] **Step 4: Integration test — sending the event writes telemetry**

Create `tests/integration/scan-demo.test.ts`: start the Inngest dev server (`pnpm dlx inngest-cli dev` in a background step or documented prerequisite), insert a scan, send `scan/demo.requested` with its id via `inngest.send`, poll `scanCostCents`/`pipeline_runs` until a row appears (timeout 10s), assert it exists.
```ts
import { expect, test } from "vitest";
import { inngest } from "@/lib/inngest/client";
import { serverDb } from "@/lib/db/client";

test("scan.demo writes a pipeline_runs row", async () => {
  const db = serverDb();
  const app = await db.from("apps").insert({ store_url: "x", platform: "web" }).select().single();
  const scan = await db.from("scans").insert({ app_id: app.data!.id }).select().single();
  await inngest.send({ name: "scan/demo.requested", data: { scanId: scan.data!.id } });
  let rows = 0;
  for (let i = 0; i < 20 && rows === 0; i++) {
    const { count } = await db.from("pipeline_runs").select("*", { count: "exact", head: true }).eq("scan_id", scan.data!.id);
    rows = count ?? 0; if (rows === 0) await new Promise((r) => setTimeout(r, 500));
  }
  expect(rows).toBeGreaterThan(0);
});
```
Document in the test file header: requires `inngest-cli dev` and `supabase start` running.

- [ ] **Step 5: Run — expect PASS**

Run (with Inngest dev + Supabase local up): `pnpm test:int tests/integration/scan-demo.test.ts`
Expected: a `pipeline_runs` row appears for the scan. **(This is the Cycle 0 acceptance gate.)**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Inngest harness + scan.demo no-op proving the pipeline-to-telemetry path"
```

---

## Task 13: Scan API skeleton + SSE progress contract (§5.5)

**Files:**
- Create: `app/api/scan/route.ts`, `app/api/scan/[id]/stream/route.ts`, `lib/scan/router.ts`, `lib/scan/router.test.ts`

- [ ] **Step 1: Write the failing test for the input router (§5.2)**

Create `lib/scan/router.test.ts`:
```ts
import { expect, test } from "vitest";
import { classifyUrl } from "./router";

test.each([
  ["https://apps.apple.com/us/app/sofa/id1124456) ", "ios"],
  ["https://play.google.com/store/apps/details?id=com.x", "android"],
  ["https://nudgi.app/pricing", "web"],
  ["reachkit.app", "web"],
])("classifyUrl(%s) → %s", (url, platform) => {
  expect(classifyUrl(url).platform).toBe(platform);
});
test("classifyUrl rejects non-URLs", () => {
  expect(() => classifyUrl("not a url at all !!")).toThrow();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm test lib/scan/router.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `lib/scan/router.ts`**

```ts
export type Platform = "ios" | "android" | "web";
export interface RoutedInput { platform: Platform; url: string; }

export function classifyUrl(raw: string): RoutedInput {
  const url = new URL(raw.includes("://") ? raw.trim() : `https://${raw.trim()}`);
  if (url.hostname.endsWith("apps.apple.com")) return { platform: "ios", url: url.toString() };
  if (url.hostname.endsWith("play.google.com")) return { platform: "android", url: url.toString() };
  return { platform: "web", url: url.toString() };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm test lib/scan/router.test.ts`
Expected: tests pass (fix the trailing `) ` in the test fixture if needed — the apple URL must be valid).

- [ ] **Step 5: Implement `POST /api/scan` (anonymous allowed, §5.5)**

`app/api/scan/route.ts`: validate body `{ store_url }`, `classifyUrl`, upsert `apps` row, insert `scans` row (status `queued`), `inngest.send({ name: "scan/requested", data: { scanId } })` (handler wired in Phase 1b — for now reuse `scan/demo.requested`), return `{ scan_id }`.
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverDb } from "@/lib/db/client";
import { classifyUrl } from "@/lib/scan/router";
import { inngest } from "@/lib/inngest/client";

const Body = z.object({ store_url: z.string().min(4) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "store_url required" }, { status: 400 });
  const routed = classifyUrl(parsed.data.store_url);
  const db = serverDb();
  const app = await db.from("apps").insert({ store_url: routed.url, platform: routed.platform }).select("id").single();
  if (app.error) return NextResponse.json({ error: app.error.message }, { status: 500 });
  const scan = await db.from("scans").insert({ app_id: app.data.id, status: "queued" }).select("id").single();
  if (scan.error) return NextResponse.json({ error: scan.error.message }, { status: 500 });
  await inngest.send({ name: "scan/demo.requested", data: { scanId: scan.data.id } });
  return NextResponse.json({ scan_id: scan.data.id });
}
```

- [ ] **Step 6: Implement `GET /api/scan/[id]/stream` (SSE contract)**

`app/api/scan/[id]/stream/route.ts`: returns a `text/event-stream`. For Cycle 0, emits a deterministic demo sequence (`working` → `facts`) so the funnel UI (Cycle 2) can build against a real contract. Event shape: `{ type: "artifact"|"facts"|"done", payload }`.
```ts
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: object) => controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`));
      send({ type: "artifact", payload: { scanId: id, label: "reviews fetched", count: 0 } });
      send({ type: "done", payload: { scanId: id } });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
```

- [ ] **Step 7: Verify the route end-to-end (manual smoke)**

Run `pnpm dev`, then:
```bash
curl -s -X POST localhost:3000/api/scan -H 'content-type: application/json' -d '{"store_url":"https://nudgi.app"}'
```
Expected: `{"scan_id":"<uuid>"}`. Then `curl -N localhost:3000/api/scan/<uuid>/stream` streams two `data:` events.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: POST /api/scan + SSE progress contract + tested input router"
```

---

## Task 14: Cross-cutting libs — seo.ts, analytics.ts, flags.ts

**Files:**
- Create: `lib/seo.ts`, `lib/seo.test.ts`, `lib/analytics.ts`, `lib/flags.ts`

- [ ] **Step 1: Write the failing test for the JSON-LD builder (§22 / §21.4)**

Create `lib/seo.test.ts`:
```ts
import { expect, test } from "vitest";
import { softwareApplicationLd, buildMetadata } from "./seo";

test("softwareApplicationLd emits valid schema.org shape", () => {
  const ld = softwareApplicationLd({ name: "ReachKit", url: "https://reachkit.app", priceUsd: 29 });
  expect(ld["@type"]).toBe("SoftwareApplication");
  expect(ld.offers.price).toBe("29");
});
test("buildMetadata sets canonical + OG title", () => {
  const m = buildMetadata({ title: "Pricing", path: "/pricing" });
  expect(m.alternates?.canonical).toBe("https://reachkit.app/pricing");
  expect(m.openGraph?.title).toContain("Pricing");
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm test lib/seo.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `lib/seo.ts` (the enforcement point — every page uses this)**

```ts
import type { Metadata } from "next";

export const SITE = { url: "https://reachkit.app", name: "ReachKit" } as const;

export function buildMetadata(opts: { title: string; description?: string; path: string }): Metadata {
  const canonical = `${SITE.url}${opts.path}`;
  return {
    title: `${opts.title} — ${SITE.name}`,
    description: opts.description,
    alternates: { canonical },
    openGraph: { title: `${opts.title} — ${SITE.name}`, url: canonical, siteName: SITE.name },
  };
}

export function softwareApplicationLd(o: { name: string; url: string; priceUsd: number }) {
  return {
    "@context": "https://schema.org", "@type": "SoftwareApplication",
    name: o.name, applicationCategory: "BusinessApplication", url: o.url,
    offers: { "@type": "Offer", price: String(o.priceUsd), priceCurrency: "USD" },
  } as const;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm test lib/seo.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Implement analytics + flags (no tests — thin wrappers)**

`lib/analytics.ts`: PostHog browser init keyed on `env.posthogKey`/`posthogHost`, exporting `capture(event, props)`. `lib/flags.ts`: `export const flags = { dailySignalFeed: false, growthTier: false } as const;` (§9.6/§12 gated features default off).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: lib/seo JSON-LD+metadata factory, PostHog analytics, feature flags"
```

---

## Task 15: Route-group shells + Vercel deploy + smoke

**Files:**
- Create: `app/(funnel)/scan/[id]/page.tsx`, `app/(app)/app/page.tsx`, `app/report/[slug]/page.tsx`, `components/sections/.gitkeep`, `components/motion/.gitkeep`, `components/report/.gitkeep`, `content/.gitkeep`, `vercel.json`

- [ ] **Step 1: Create placeholder route-group shells**

Each is a minimal server component using `buildMetadata` (proves the SEO enforcement point compiles per route group). Example `app/report/[slug]/page.tsx`:
```tsx
import { buildMetadata } from "@/lib/seo";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; return buildMetadata({ title: `Report ${slug}`, path: `/report/${slug}` });
}
export default function ReportPage() { return <main>Report (Cycle 3)</main>; }
```
Repeat for `(funnel)/scan/[id]` and `(app)/app`. Add `.gitkeep` to the empty component/content dirs.

- [ ] **Step 2: Verify build + bundle budget**

Run: `pnpm build && pnpm check:bundle`
Expected: build succeeds; bundle check passes for all three route groups.

- [ ] **Step 3: Link + deploy to Vercel**

Run:
```bash
pnpm dlx vercel link
pnpm dlx vercel env pull .env.local   # after adding prod env vars in the Vercel dashboard
pnpm dlx vercel --prod
```
Expected: a production URL. (Supabase prod project + env vars must be configured in the dashboard first; document the required keys from `.env.example`.)

- [ ] **Step 4: Smoke the deploy**

`curl -s -X POST https://<deploy>/api/scan -d '{"store_url":"https://nudgi.app"}' -H 'content-type: application/json'`
Expected: `{"scan_id":"..."}` against the prod Supabase project; an `apps` + `scans` row appears.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: route-group shells, Vercel deploy config, production smoke"
```

---

## Self-Review (completed by the plan author)

**Spec coverage (Cycle 0 scope, decomposition §3.0):**
- Repo + tooling + TS strict + Tailwind v4 + shadcn/Base UI → Tasks 1, 2, 4 ✓
- Core data model §5.4 → Task 5 ✓ · Warehouse layers 1–3 + `pipeline_runs` §5.7 → Tasks 6, 10 ✓ · pgvector + HNSW → Task 7 ✓ · RLS + magic-link auth (D42) → Task 8 ✓
- Inngest harness + no-op proving the path → Task 12 ✓
- Cost telemetry from day one (§13) → Tasks 6, 10 ✓
- Tool-registry interface + budgets (§9.4/§9.5) → Task 11 ✓
- `lib/seo`+`analytics`+`flags` (§21.4) → Task 14 ✓ · repo layout §21.4 → Tasks 1, 15 ✓
- Scan-shaped API scaffolding + SSE contract (§5.5) → Task 13 ✓
- Vercel deploy + PostHog wired → Tasks 14, 15 ✓
- Acceptance gate (deploy + migrations + scan.demo telemetry row + pgvector query) → Tasks 7, 12, 15 ✓

**Placeholder scan:** No "TBD/TODO/handle edge cases" in steps; the only forward references ("Phase 1b implements collect()", "bodies land in Cycle 3") are deliberate scaffolding boundaries, with the consuming cycle named.

**Type consistency:** `ScanBudget`, `recordPipelineRun`, `serverDb`, `classifyUrl`, `contentHash`, `buildMetadata`, `softwareApplicationLd`, `ModelId`, `ToolName` are each defined once and referenced with matching signatures across tasks. The `scan/demo.requested` event name is consistent between Tasks 12 and 13 (the real `scan/requested` handler arrives in Phase 1b).

**Known confirm-at-build items (not placeholders):** exact shadcn Base-UI init prompts (Task 4) and Anthropic per-MTok rates (Task 10) are verified against current vendor docs / the `claude-api` skill at build time; the embedding dimension (Task 7, `vector(1024)`) is set to the chosen embedding model's dimension when the Phase 1b extractor picks the model.

---

*Next artifact: `docs/plans/2026-06-11-phase-1b-scan-skeleton.md` (Cycle 1 — Stage 0 collectors, per-mode adapters, tool-registry D-tool bodies, real `scan/requested` pipeline, live SSE artifacts, preliminary facts screen), written against the interfaces this plan establishes.*
