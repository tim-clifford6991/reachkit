/**
 * score-calibration.mts — live score-calibration harness (C3,
 * docs/plans/2026-07-07-launch-readiness.md).
 *
 * WHY THIS EXISTS
 * ----------------
 * The v2 headline score (lib/scan/registry-score.ts, over the fixed 8-signal
 * on-site basis in FIXED_BASIS_SIGNAL_KEYS) is computed deterministically from
 * lib/scan/signals.ts + lib/scan/compute-signals.ts. Whenever those thresholds
 * change (see the C3 tightening of content_depth / media_richness — comments
 * in both files), the only way to know whether the change actually produces a
 * credible score distribution is to run it against REAL sites: fixtures,
 * evals, and code review have all historically masked real-adapter/scoring
 * bugs in this repo (see memory `reachkit-realmode-quality`). This script is
 * that live check.
 *
 * This is a TOOL, not a test — it makes real network calls, creates real
 * `scans`/`apps` rows (cost + DB writes), and is NOT run in CI. Run it by hand
 * against a preview deployment (safer/cheaper) or prod, whenever score
 * thresholds change and need re-validation.
 *
 * WHAT IT DOES
 * ------------
 * For each domain: POST /api/scan, poll until the scan reaches a terminal
 * state, then read back the total score, band, per-pillar breakdown, and the
 * 18-signal pass/warn/fail/unmeasured counts — and print one row per domain
 * plus a pass/fail verdict against the C3 acceptance bar (monotonic band
 * separation; a median indie site lands 50–69 "Fair").
 *
 * READ PATH — DOCUMENTED, since there is no public JSON score/report endpoint
 * today (checked: app/api/scan/route.ts returns only {scan_id, slug} on POST;
 * the SSE stream at app/api/scan/[id]/stream/route.ts carries progress events,
 * not the score; the only public score surface is the <title> tag of
 * /scan/<slug>, set by generateMetadata in app/(funnel)/scan/[id]/page.tsx —
 * "Discoverability Score: N/100 — ReachKit" — which has no breakdown or
 * signal detail). Two modes:
 *
 *   DB mode (default, used when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are
 *   set — via .env.local or the environment): full detail, read directly from
 *   Postgres — `scans.status/score_total/score_breakdown` and the persisted
 *   18-signal rows in `scan_signals` (supabase/migrations/20260621000000_scan_signals.sql).
 *   This is the same table the pre-launch runbook (scripts/prelaunch-validate.md)
 *   queries by hand.
 *
 *   HTTP-only mode (forced with --http, or the automatic fallback when DB
 *   creds aren't set): total score + band ONLY, scraped from the page
 *   <title>. Use this against an environment you don't have DB creds for. No
 *   pillar breakdown or signal states are available this way.
 *
 * If a JSON status/report endpoint ships later, prefer it over both — swap
 * pollDb/pollHttpTitle for a single fetch and delete the HTML-scrape path.
 *
 * USAGE
 *   npx tsx --env-file=.env.local scripts/score-calibration.mts
 *   npx tsx --env-file=.env.local scripts/score-calibration.mts --base-url=https://reachkit-preview.vercel.app
 *   npx tsx scripts/score-calibration.mts --domains=linear.app,notion.so,example.com
 *   npx tsx scripts/score-calibration.mts --http                # force HTTP-only, no DB creds needed
 *   npx tsx scripts/score-calibration.mts --timeout=180000 --poll=2000
 *
 * Flags:
 *   --base-url=<url>   Target app (default https://reachkit-pi.vercel.app).
 *   --domains=<csv>    Comma-separated domains to scan (default: curated list below).
 *   --http             Force HTTP-only mode even if DB creds are present.
 *   --timeout=<ms>     Per-domain poll timeout (default 240000 = 4 min; deep
 *                      scans can take longer — this harness only needs the
 *                      free-tier score, which lands well inside this window).
 *   --poll=<ms>        Poll interval (default 3000).
 *
 * NOT RUN as part of this change — this file is a tool to be exercised later
 * with live network + prod/preview DB access, not exercised here.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bandFor } from "../lib/scan/score-bands";

// ---------------------------------------------------------------------------
// Minimal .env.local loader (mirrors scripts/render-smoke.mjs). Real
// process.env always wins; only fills in vars that aren't already set.
// ---------------------------------------------------------------------------
function loadEnvLocal(): void {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();

// ---------------------------------------------------------------------------
// Curated default domain list — a spread meant to exercise the full band
// range. Swap/extend via --domains once live results come back; these are a
// starting point, not gospel.
// ---------------------------------------------------------------------------
interface DomainSpec {
  domain: string;
  cohort: "strong" | "median" | "weak" | "custom";
  note: string;
}

const DEFAULT_DOMAINS: DomainSpec[] = [
  {
    domain: "linear.app",
    cohort: "strong",
    note:
      "Strong SaaS marketing site — deep copy, schema, OG/Twitter tags, rich imagery. " +
      "Expected to anchor the top of the range (Findable/Highly discoverable).",
  },
  {
    domain: "nudgi.ai",
    cohort: "median",
    note:
      "Real indie SaaS, previously live-verified end-to-end in this repo (memory: " +
      "reachkit-prod-infra). Genuine but thinner site than linear.app — should land " +
      "\"Fair\" (50-69), not maxed out on any pillar.",
  },
  {
    domain: "example.com",
    cohort: "weak",
    note:
      "Canonical placeholder page — no schema, no OG tags, minimal copy, no images. " +
      "Should anchor the bottom of the range (Invisible/Hard to find).",
  },
];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
interface Args {
  baseUrl: string;
  domains: DomainSpec[];
  forceHttp: boolean;
  timeoutMs: number;
  pollMs: number;
  usingDefaultDomains: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    const hit = argv.find((a) => a.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : undefined;
  };
  const baseUrl = (get("base-url") ?? "https://reachkit-pi.vercel.app").replace(/\/+$/, "");
  const domainsArg = get("domains");
  const usingDefaultDomains = domainsArg == null;
  const domains: DomainSpec[] = domainsArg
    ? domainsArg
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean)
        .map((domain) => ({ domain, cohort: "custom" as const, note: "" }))
    : DEFAULT_DOMAINS;
  return {
    baseUrl,
    domains,
    forceHttp: argv.includes("--http"),
    timeoutMs: Number(get("timeout") ?? 240_000),
    pollMs: Number(get("poll") ?? 3_000),
    usingDefaultDomains,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// POST /api/scan
// ---------------------------------------------------------------------------
async function startScan(baseUrl: string, domain: string): Promise<{ scanId: string; slug: string }> {
  const res = await fetch(`${baseUrl}/api/scan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ store_url: domain }),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`POST /api/scan (${domain}) → ${res.status}: ${bodyText.slice(0, 300)}`);
  }
  let json: { scan_id?: string; slug?: string };
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new Error(`POST /api/scan (${domain}) → unparseable body: ${bodyText.slice(0, 300)}`);
  }
  if (!json.scan_id || !json.slug) {
    throw new Error(`POST /api/scan (${domain}) → unexpected body: ${bodyText.slice(0, 300)}`);
  }
  return { scanId: json.scan_id, slug: json.slug };
}

// ---------------------------------------------------------------------------
// DB mode — full detail via Postgres.
// ---------------------------------------------------------------------------
const TERMINAL_STATUSES = new Set(["done", "failed", "degraded", "error"]);

interface SignalCounts {
  pass: number;
  warn: number;
  fail: number;
  unmeasured: number;
}
function emptyCounts(): SignalCounts {
  return { pass: 0, warn: 0, fail: 0, unmeasured: 0 };
}

interface DbResult {
  status: string;
  total: number | null;
  breakdown: { content?: number; outreach?: number; seo?: number } | null;
  counts: SignalCounts;
  byPillar: Record<string, SignalCounts>;
}

// Minimal shape of the fields we read — avoids depending on the full
// generated Database type here (keeps this script import-light).
interface SupabaseLikeClient {
  from(table: string): {
    select(cols: string): {
      eq(
        col: string,
        val: string,
      ): {
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      } & Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
    };
  };
}

async function pollDb(
  db: SupabaseLikeClient,
  scanId: string,
  opts: { timeoutMs: number; pollMs: number },
): Promise<DbResult | null> {
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    const { data, error } = await db
      .from("scans")
      .select("status, score_total, score_breakdown")
      .eq("id", scanId)
      .maybeSingle();
    if (error) throw new Error(`scans read failed for ${scanId}: ${error.message}`);
    const status = (data?.status as string | undefined) ?? "queued";
    if (data && TERMINAL_STATUSES.has(status)) {
      const { data: signalRows, error: sigErr } = await db
        .from("scan_signals")
        .select("state, pillar")
        .eq("scan_id", scanId);
      if (sigErr) throw new Error(`scan_signals read failed for ${scanId}: ${sigErr.message}`);
      const counts = emptyCounts();
      const byPillar: Record<string, SignalCounts> = {};
      for (const row of (signalRows ?? []) as Array<{ state: string; pillar: string }>) {
        const state = row.state as keyof SignalCounts;
        if (state in counts) counts[state] += 1;
        byPillar[row.pillar] ??= emptyCounts();
        if (state in byPillar[row.pillar]!) byPillar[row.pillar]![state] += 1;
      }
      return {
        status,
        total: (data.score_total as number | null) ?? null,
        breakdown: (data.score_breakdown as DbResult["breakdown"]) ?? null,
        counts,
        byPillar,
      };
    }
    await sleep(opts.pollMs);
  }
  return null; // timed out
}

// ---------------------------------------------------------------------------
// HTTP-only mode — scrape the total score from the page <title>.
// ---------------------------------------------------------------------------
async function pollHttpTitleScore(
  baseUrl: string,
  slug: string,
  opts: { timeoutMs: number; pollMs: number },
): Promise<number | null> {
  const url = `${baseUrl}/scan/${encodeURIComponent(slug)}`;
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      const html = await res.text();
      const m = html.match(/Discoverability Score:\s*(\d+)\/100/);
      if (m?.[1]) return Number(m[1]);
    } catch {
      // transient fetch error — keep polling until the deadline
    }
    await sleep(opts.pollMs);
  }
  return null; // timed out
}

// ---------------------------------------------------------------------------
// Row + table printing
// ---------------------------------------------------------------------------
interface ResultRow {
  domain: string;
  cohort: string;
  status: string;
  total: number | null;
  band: string | null;
  breakdown: { content?: number; outreach?: number; seo?: number } | null;
  counts: SignalCounts | null;
  error: string | null;
}

function fmtCounts(c: SignalCounts | undefined | null): string {
  if (!c) return "—";
  return `${c.pass}p/${c.warn}w/${c.fail}f/${c.unmeasured}u`;
}

function printTable(rows: ResultRow[], detailed: boolean): void {
  const headers = detailed
    ? ["Domain", "Cohort", "Status", "Score", "Band", "Content", "Outreach", "SEO", "Signals(p/w/f/u)"]
    : ["Domain", "Cohort", "Status", "Score", "Band"];
  const cells = rows.map((r) =>
    detailed
      ? [
          r.domain,
          r.cohort,
          r.error ? "ERROR" : r.status,
          r.total != null ? String(r.total) : "—",
          r.band ?? "—",
          r.breakdown?.content != null ? String(r.breakdown.content) : "—",
          r.breakdown?.outreach != null ? String(r.breakdown.outreach) : "—",
          r.breakdown?.seo != null ? String(r.breakdown.seo) : "—",
          fmtCounts(r.counts),
        ]
      : [r.domain, r.cohort, r.error ? "ERROR" : r.status, r.total != null ? String(r.total) : "—", r.band ?? "—"],
  );
  const widths = headers.map((h, i) => Math.max(h.length, ...cells.map((row) => (row[i] ?? "").length)));
  const line = (parts: string[]) => parts.map((p, i) => p.padEnd(widths[i]!)).join("  ");
  console.log("");
  console.log(line(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of cells) console.log(line(row));
  console.log("");
  for (const r of rows) {
    if (r.error) console.log(`  ! ${r.domain}: ${r.error}`);
  }
}

// ---------------------------------------------------------------------------
// C3 acceptance check — only meaningful against the curated default cohort
// labels (strong/median/weak); skipped for a custom --domains list.
// ---------------------------------------------------------------------------
function checkAcceptanceBar(rows: ResultRow[], usingDefaultDomains: boolean): void {
  if (!usingDefaultDomains) {
    console.log("(Custom --domains list — skipping the strong/median/weak acceptance check.)");
    return;
  }
  const byCohort = Object.fromEntries(rows.map((r) => [r.cohort, r]));
  const strong = byCohort.strong;
  const median = byCohort.median;
  const weak = byCohort.weak;
  console.log("C3 acceptance bar (docs/plans/2026-07-07-launch-readiness.md):");
  if (!strong?.total || !median?.total || !weak?.total) {
    console.log("  ✗ INCONCLUSIVE — one or more cohort scores missing (scan error or timeout above).");
    return;
  }
  const monotonic = strong.total > median.total && median.total > weak.total;
  console.log(
    `  ${monotonic ? "✓" : "✗"} monotonic band separation: strong(${strong.total}) > median(${median.total}) > weak(${weak.total})`,
  );
  const medianFair = median.total >= 50 && median.total <= 69;
  console.log(`  ${medianFair ? "✓" : "✗"} median indie lands 50-69 "Fair" (got ${median.total}, band "${median.band}")`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const hasDbCreds = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const useDb = !args.forceHttp && hasDbCreds;

  console.log(`Base URL:  ${args.baseUrl}`);
  console.log(`Mode:      ${useDb ? "DB (full detail — score, breakdown, signal states)" : "HTTP-only (total score + band only, scraped from <title>)"}`);
  console.log(`Domains:   ${args.domains.map((d) => d.domain).join(", ")}`);
  if (!useDb && !args.forceHttp) {
    console.log(
      "           (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — falling back to HTTP-only. " +
        "Run with --env-file=.env.local for full detail, or pass --http to silence this note.)",
    );
  }

  let db: SupabaseLikeClient | null = null;
  if (useDb) {
    const { createClient } = await import("@supabase/supabase-js");
    db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    }) as unknown as SupabaseLikeClient;
  }

  const rows: ResultRow[] = [];
  for (const spec of args.domains) {
    process.stdout.write(`Scanning ${spec.domain}${spec.note ? ` (${spec.cohort})` : ""}... `);
    try {
      const { scanId, slug } = await startScan(args.baseUrl, spec.domain);
      if (useDb && db) {
        const result = await pollDb(db, scanId, args);
        if (!result) {
          console.log("TIMEOUT");
          rows.push({
            domain: spec.domain,
            cohort: spec.cohort,
            status: "timeout",
            total: null,
            band: null,
            breakdown: null,
            counts: null,
            error: `timed out after ${args.timeoutMs}ms waiting for a terminal status`,
          });
          continue;
        }
        const band = result.total != null ? bandFor(result.total).label : null;
        console.log(`${result.status} — ${result.total ?? "?"}/100${band ? ` (${band})` : ""}`);
        rows.push({
          domain: spec.domain,
          cohort: spec.cohort,
          status: result.status,
          total: result.total,
          band,
          breakdown: result.breakdown,
          counts: result.counts,
          error: null,
        });
      } else {
        const total = await pollHttpTitleScore(args.baseUrl, slug, args);
        if (total == null) {
          console.log("TIMEOUT");
          rows.push({
            domain: spec.domain,
            cohort: spec.cohort,
            status: "timeout",
            total: null,
            band: null,
            breakdown: null,
            counts: null,
            error: `timed out after ${args.timeoutMs}ms waiting for the score to appear in <title>`,
          });
          continue;
        }
        const band = bandFor(total).label;
        console.log(`${total}/100 (${band})`);
        rows.push({
          domain: spec.domain,
          cohort: spec.cohort,
          status: "done",
          total,
          band,
          breakdown: null,
          counts: null,
          error: null,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log("ERROR");
      rows.push({
        domain: spec.domain,
        cohort: spec.cohort,
        status: "error",
        total: null,
        band: null,
        breakdown: null,
        counts: null,
        error: message,
      });
    }
  }

  printTable(rows, useDb);
  checkAcceptanceBar(rows, args.usingDefaultDomains);
}

main().catch((err) => {
  console.error(`✗ score-calibration crashed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  process.exit(1);
});
