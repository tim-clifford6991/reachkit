# ReachKit — Architecture, Data Flow & Processes

> Living architecture document. Update this as the system evolves.
> Last updated: 2026-07-07

ReachKit is a single-stack Next.js 16 (App Router) application deployed on Vercel.
There is no separate backend service — API routes are thin, and all heavy /
long-running work is offloaded to **Inngest** background functions hosted at
`/api/inngest`. State lives in **Supabase** (Postgres + RLS + pgvector).

---

## 1. System Architecture & Data Flow

```mermaid
graph TB
    subgraph client["👤 Client (Browser)"]
        Visitor["Anonymous Visitor"]
        User["Authenticated User"]
    end

    subgraph vercel["▲ Vercel — Next.js 16 App Router"]
        subgraph routes["Route Groups"]
            MKT["(marketing)<br/>landing · /scan · /gallery<br/>/pricing · /teardowns/[slug]<br/>/tools/* · /compare/[slug]"]
            FUN["(funnel)<br/>/scan/[id] report<br/>Stripe→Email→Magic-Link wall"]
            APP["(app) — gated dashboard<br/>/app · /plan · /dashboard<br/>/demand · /supply · /synthesis<br/>/competitors · /billing"]
        end

        subgraph api["API Routes (app/api)"]
            AScan["/scan · /scan/[id]/stream<br/>/scan/[id]/checkout"]
            AApp["/app/intel · /app/[id]/refresh<br/>/app/[id]/queue · /voice"]
            ABill["/billing/checkout · /webhook<br/>/portal · /trial"]
            AAuth["/auth/magic-link"]
            AComp["/competitors/candidates · /select"]
            AAct["/action · /content-draft · /distribute"]
            AIng["/api/inngest (function host)"]
        end
    end

    subgraph core["⚙️ Core Libs (lib/)"]
        Pipeline["lib/scan — pipeline<br/>collect→extract→synth→critic→format"]
        Score["Scoring Engine<br/>SIGNAL_REGISTRY (~18 signals)<br/>3 pillars: SEO · Content · Outreach"]
        Adapters["lib/scan/adapters<br/>data collectors"]
        LLMlib["lib/llm — Anthropic<br/>extract · synth · critic · actions"]
        Deepen["lib/scan/deepen<br/>free → full/deep gate"]
    end

    subgraph jobs["🔄 Inngest (Background Jobs)"]
        JReq["scan/requested"]
        JDeep["scan/deepen"]
        JDemo["scan/demo.requested"]
        JVerify["action/verify"]
        JWeekly["weekly-refresh<br/>cron Mon 09:00"]
        JPulse["score-pulse<br/>cron Thu 09:00"]
        JClean["search-cache-cleanup"]
    end

    subgraph data["🗄️ Supabase (Postgres + RLS + pgvector)"]
        DBcore["apps · scans · findings · actions<br/>scan_signals · score_snapshots<br/>fact_sheets · scan_events"]
        DBintel["domain_intel · demand_intel<br/>competitors · keyword_gap<br/>content_plan_item · distribution_plan_item"]
        DBinfra["users · billing · search_cache<br/>embeddings (pgvector) · pipeline_runs<br/>public_scans (view)"]
    end

    subgraph ext["🌐 External Services"]
        Anthropic["Anthropic Claude<br/>(LLM synthesis)"]
        Voyage["VoyageAI<br/>(embeddings)"]
        DFS["DataForSEO<br/>backlinks · keywords · rank · traffic"]
        Tavily["Tavily (web search)"]
        Sources["Public sources<br/>iTunes/App Store · HN Algolia<br/>Product Hunt · YouTube · X<br/>G2 · Trustpilot · web.archive"]
        Stripe["Stripe (billing)"]
        Resend["Resend (email/magic-link)"]
        PostHog["PostHog (analytics)"]
    end

    Visitor -->|"submit URL"| AScan
    User --> APP
    APP --> AApp

    AScan -->|"insert app+scan<br/>send scan/requested"| JReq
    AScan -.->|"stream progress (SSE)"| FUN
    AApp --> Pipeline
    AComp --> Adapters

    JReq --> Pipeline
    JDeep --> Deepen --> Pipeline
    JDemo --> Pipeline
    JWeekly --> Pipeline
    JPulse --> Score

    Pipeline --> Adapters
    Pipeline --> Score
    Pipeline --> LLMlib
    Pipeline -->|"persist"| DBcore
    Deepen -->|"emit scan/deepen"| JDeep

    Adapters --> DFS
    Adapters --> Tavily
    Adapters --> Sources
    LLMlib --> Anthropic
    LLMlib --> Voyage
    Voyage --> DBinfra

    ABill <-->|"checkout · webhook · portal"| Stripe
    Stripe -.->|"webhook → create account"| AAuth
    AAuth --> Resend
    ABill --> DBinfra

    Pipeline --> DBintel
    api --> DBcore
    routes -.->|"read"| PostHog
    AIng -.hosts.-> jobs
```

---

## 2. Scan Flow — from URL to Report (two-tier: free → deep)

```mermaid
sequenceDiagram
    autonumber
    participant U as Visitor
    participant API as POST /api/scan
    participant DB as Supabase
    participant ING as Inngest
    participant P as Scan Pipeline
    participant EXT as External APIs
    participant LLM as Anthropic/Voyage
    participant SSE as /scan/[id]/stream

    U->>API: submit store/site URL
    API->>DB: insert apps + scans (status=queued)
    API->>ING: send "scan/requested" {scanId}
    API-->>U: redirect → /scan/[id]

    U->>SSE: subscribe (Server-Sent Events)

    ING->>P: step "collect"
    P->>EXT: DataForSEO · iTunes · HN · PH · web-reviews · domain-age
    P->>P: extract HTML → fact_sheets
    P->>LLM: extract + synth + critic
    P->>P: compute-signals → pillar scores → fixed-basis score
    P->>DB: persist scan_signals · findings · score_snapshots
    P-->>SSE: emit scan_events (live progress)

    ING->>P: step "findings" → "free-report"
    P->>DB: write lightweight FREE report (status=done)
    Note over U,SSE: Free score + report visible immediately

    U->>API: clicks upgrade → Stripe checkout
    API->>ING: ensureDeepScan → send "scan/deepen"
    ING->>P: runFullScan (heavy pass)
    P->>EXT: deeper competitor + demand + keyword intel
    P->>LLM: deep synthesis + action generation
    P->>DB: full report · actions · competitors · plan items
    P-->>SSE: deepened_at set → deep report unlocked
```

---

## 3. Accounts, Billing & Recurring Cadence (§11)

```mermaid
graph LR
    subgraph funnel["💳 Payment-First Funnel"]
        Report["Free scan report"] -->|"upgrade"| Checkout["/billing/checkout<br/>Stripe (7-day trial)"]
        Checkout --> StripeCo["Stripe Checkout"]
        StripeCo -->|"webhook"| WH["/billing/webhook"]
        WH -->|"create user + account"| Users["users table"]
        WH -->|"send magic link"| ML["/auth/magic-link → Resend"]
        ML --> Dash["(app) Dashboard unlocked"]
    end

    subgraph cadence["📅 Ongoing Cadence — §11"]
        Mon["weekly-refresh<br/>cron Mon 09:00 UTC"] -->|"per paid app"| Refresh["refreshOneApp<br/>re-collect + re-score"]
        Thu["score-pulse<br/>cron Thu 09:00 UTC"] -->|"midweek heartbeat"| Pulse["delta score check"]
        Refresh --> Plan["/app/plan timeline<br/>content_plan_item<br/>distribution_plan_item"]
        Pulse --> Plan
    end

    subgraph portal["Self-Service"]
        Dash --> BPortal["/billing/portal → Stripe"]
    end

    Dash -.-> cadence
```

---

## Key architectural notes

- **Single stack, no separate backend** — everything runs on Vercel as Next.js
  App Router (Fluid Compute). API routes are thin; heavy work is offloaded to
  **Inngest** functions hosted at `/api/inngest`.
- **Two-tier scan** — a fast, free lightweight report is produced first
  (`lib/scan/free-report.ts`), then `scan/deepen` runs the expensive full pass
  (`lib/scan/full-scan.ts`) only after payment. The fixed-basis score stays
  stable across both tiers.
- **Scoring engine** — `SIGNAL_REGISTRY` in `lib/scan/signals.ts` drives ~18
  deterministic (no-LLM) signals grouped into 3 weighted pillars
  (**SEO 0.45 / Content 0.30 / Outreach 0.25**), persisted to `scan_signals` +
  `score_snapshots`. `score-full.ts` produces the verified anti-vanity score +
  7-axis radar for the paid pass.
- **Data layer** — Supabase Postgres with RLS on all tables, `pgvector` for
  embeddings (via VoyageAI), a JSON `search_cache` layer over DataForSEO, plus
  typed structured intel tables (`domain_intel`, `demand_intel`, `competitors`,
  `keyword_gap`, `content_plan_item`, `distribution_plan_item`). `public_scans`
  is a view feeding the `/gallery` page + landing ticker.
- **Background cadence** — `weekly-refresh` (cron Mon 09:00 UTC) and
  `score-pulse` (cron Thu 09:00 UTC) drive the recurring §11 cadence that feeds
  the `/app/plan` timeline; `search-cache-cleanup` (cron daily 03:00 UTC) prunes
  `search_cache` rows older than 30 days.
- **Two funnel paths** — Path A (scan-first): free report → `/scan/[id]/checkout`;
  Path B (trial-direct): `/billing/trial` anonymous checkout with no prior scan.
  Both converge on the Stripe webhook → account provision → magic link.
- **Feature flags** — reduced to only `REACHKIT_USE_FIXTURES`, which runs the
  whole pipeline keyless (no external API calls) in dev/test.

## Directory map (high level)

| Path | Responsibility |
|------|----------------|
| `app/(marketing)` | Public site: landing, /scan, /gallery, /pricing, tools, teardowns |
| `app/(funnel)` | Scan report + payment/email/magic-link wall |
| `app/(app)` | Gated product dashboard (plan, demand, supply, synthesis, competitors, billing) |
| `app/api` | Thin API routes (scan, billing, auth, competitors, action, inngest host) |
| `lib/scan` | Scan pipeline, scoring engine, adapters, deepen gate, reports |
| `lib/scan/adapters` | External data collectors (DataForSEO, Tavily, iTunes, HN, PH, YouTube, X, web-reviews) |
| `lib/llm` | Anthropic synthesis (extract, synth, critic, actions) + Voyage embeddings |
| `lib/inngest` | Inngest client + background functions |
| `lib/db` | Supabase client + generated types |
| `lib/billing` | Stripe integration |
| `lib/auth` | Magic-link auth |
| `lib/email` | Resend transactional email |
| `supabase/migrations` | Postgres schema + RLS migrations |
