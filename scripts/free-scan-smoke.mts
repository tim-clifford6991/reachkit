/**
 * free-scan-smoke.mts — a live-test harness for the FREE scan's Phase A/B/C
 * output (2026-07-22, the product-contract reset).
 *
 * WHY THIS EXISTS
 * ----------------
 * Phases A (market size + your share), B (the LLM relevance judge) and C (the
 * 3-fix floor) all change what the free board shows — and every one of them is
 * the class of change fixtures MASK (an LLM reading real, mixed keyword data; a
 * market sized from a real leader's real footprint). The only trustworthy check
 * is a real scan on real adapters. This script runs one and prints the exact
 * fields to eyeball, so you don't have to hunt them in the rendered page.
 *
 * It drives the REAL production pipeline (POST /api/scan → Inngest → the same
 * runFreeReport the site runs) — NOT a reimplementation — then reads the
 * persisted report_payload back from Postgres and prints:
 *   • the unified Discoverability Score (on-page × search presence)
 *   • CATEGORY: label + demand   ·   NICHE: label + demand
 *   • MARKET: the leader it was sized from + demand + top phrases + your gaps
 *     (Phase A/B — this is where the judge's precision shows: a leader's
 *     off-topic/generic keywords should NOT appear here)
 *   • the 3 ranked FIXES (titles + "+N") and the locked count (Phase C floor)
 *
 * This is a TOOL, not a test — it makes real network + LLM + DataForSEO calls
 * and creates a real `scans` row (cost + DB write). NOT run in CI.
 *
 * USAGE (local dev — the app must be running: `pnpm dev` + `pnpm dev:inngest`):
 *   npx tsx --env-file=.env.local scripts/free-scan-smoke.mts --url=usefathom.com
 *   npx tsx --env-file=.env.local scripts/free-scan-smoke.mts --url=trustmrr.com,spacex.com
 * Against a preview/prod deploy instead of localhost:
 *   npx tsx --env-file=.env.local scripts/free-scan-smoke.mts \
 *       --base-url=https://<preview>.vercel.app --url=usefathom.com
 *
 * Flags:
 *   --url=<csv>        Domains to scan (required).
 *   --base-url=<url>   Target app (default http://localhost:3000).
 *   --timeout=<ms>     Per-scan poll timeout (default 180000 = 3 min).
 *   --poll=<ms>        Poll interval (default 3000).
 *
 * Needs (in .env.local): SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (to read the
 * payload back), and the app it targets needs the real adapter keys
 * (ANTHROPIC_API_KEY, DATAFORSEO_LOGIN/PASSWORD) or the judge/market degrade.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// --- minimal .env.local loader (mirrors score-calibration.mts) --------------
function loadEnvLocal(): void {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
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

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const arg = (name: string): string | undefined => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

const BASE_URL = (arg("base-url") ?? "http://localhost:3000").replace(/\/$/, "");
const URLS = (arg("url") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const TIMEOUT = Number(arg("timeout") ?? 180000);
const POLL = Number(arg("poll") ?? 3000);
const TERMINAL = new Set(["done", "failed", "degraded", "error"]);

if (URLS.length === 0) {
  console.error("Usage: npx tsx --env-file=.env.local scripts/free-scan-smoke.mts --url=usefathom.com[,trustmrr.com]");
  process.exit(1);
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (in .env.local) to read the report payload back.");
  process.exit(1);
}

async function startScan(domain: string): Promise<{ scanId: string; slug: string }> {
  const res = await fetch(`${BASE_URL}/api/scan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ store_url: domain }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST /api/scan (${domain}) → ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { scan_id?: string; slug?: string };
  if (!json.scan_id) throw new Error(`POST /api/scan (${domain}) → unexpected body: ${text.slice(0, 300)}`);
  return { scanId: json.scan_id, slug: json.slug ?? "" };
}

interface DemandRow { keyword: string; volume: number; yourPosition?: number }
interface LadderCard { label: string; demand: number; phrases?: DemandRow[]; gaps?: DemandRow[] }
interface Action { title: string; expectedOutcome?: { delta?: number } }
interface Payload {
  score?: { total?: number };
  searchVisibility?: {
    score?: number; onPageReadiness?: number;
    categoryCard?: LadderCard; nicheCard?: LadderCard;
    categoryDemand?: number; categoryLeader?: string;
  };
  whatToDoThisWeek?: { quickWins?: Action[]; medium?: Action[]; longPlay?: Action[] };
}

// Minimal shape of the one query we run — avoids importing the generated DB type.
interface Db {
  from(t: string): {
    select(c: string): {
      eq(col: string, val: string): {
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
  };
}
async function pollPayload(db: Db, scanId: string): Promise<{ status: string; payload: Payload | null } | null> {
  const deadline = Date.now() + TIMEOUT;
  while (Date.now() < deadline) {
    const { data, error } = await db.from("scans").select("status, report_payload").eq("id", scanId).maybeSingle();
    if (error) throw new Error(`scans read failed: ${error.message}`);
    const status = (data?.status as string) ?? "queued";
    if (data && TERMINAL.has(status)) return { status, payload: (data.report_payload as Payload) ?? null };
    await sleep(POLL);
  }
  return null;
}

const num = (n: number | undefined): string => (typeof n === "number" ? n.toLocaleString() : "—");
const rows = (rs: DemandRow[] | undefined, cap = 6): string =>
  (rs ?? []).slice(0, cap).map((r) => `      · ${r.keyword} — ${num(r.volume)}/mo${r.yourPosition ? ` (you #${r.yourPosition})` : ""}`).join("\n") || "      (none)";

function printReport(domain: string, status: string, p: Payload | null): void {
  console.log(`\n${"═".repeat(72)}\n  ${domain}   [${status}]\n${"═".repeat(72)}`);
  if (!p) return void console.log("  no report_payload (scan did not persist a free report)");
  const sv = p.searchVisibility ?? {};
  console.log(`  Discoverability ${num(p.score?.total)}   (on-page ${num(sv.onPageReadiness)} × search ${num(sv.score)})`);
  console.log(`\n  CATEGORY  ${sv.categoryCard?.label ?? "—"}   ${num(sv.categoryCard?.demand ?? sv.categoryDemand)}/mo`);
  if (sv.categoryLeader) console.log(`            market sized from leader: ${sv.categoryLeader}  ← Phase A/B: these phrases must be ON-topic`);
  console.log(rows(sv.categoryCard?.phrases));
  console.log(`  your gaps (near-misses that feed the fixes):\n${rows(sv.categoryCard?.gaps, 4)}`);
  console.log(`\n  NICHE     ${sv.nicheCard?.label ?? "—"}   ${num(sv.nicheCard?.demand)}/mo`);
  const acts = [
    ...(p.whatToDoThisWeek?.quickWins ?? []),
    ...(p.whatToDoThisWeek?.medium ?? []),
    ...(p.whatToDoThisWeek?.longPlay ?? []),
  ].sort((a, b) => (b.expectedOutcome?.delta ?? 0) - (a.expectedOutcome?.delta ?? 0));
  console.log(`\n  FIXES (${acts.length} total — Phase C floor is 3):`);
  acts.slice(0, 5).forEach((a, i) => console.log(`   ${i + 1}. +${a.expectedOutcome?.delta ?? 0}  ${a.title}`));
}

async function main(): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  // The generated client's query-builder types are too deep to match the minimal
  // `Db` shape structurally (TS2589) — cast, exactly as score-calibration.mts does.
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  }) as unknown as Db;
  console.log(`free-scan smoke → ${BASE_URL}  (${URLS.length} url(s))`);
  for (const domain of URLS) {
    try {
      const { scanId } = await startScan(domain);
      console.log(`\n… scanning ${domain} (scan ${scanId}) — polling up to ${Math.round(TIMEOUT / 1000)}s`);
      const res = await pollPayload(db, scanId);
      if (!res) console.log(`  ${domain}: TIMED OUT after ${Math.round(TIMEOUT / 1000)}s`);
      else printReport(domain, res.status, res.payload);
    } catch (e) {
      console.log(`  ${domain}: ERROR — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

void main();
