/**
 * Shared helpers for the headless-Chrome render harnesses.
 *
 * Both `scripts/render-smoke.mjs` (desktop DOM-health smoke test) and
 * `scripts/render-mobile.mjs` (mobile horizontal-overflow guard) need the same
 * three things: a `.env.local` loader (so the demo seed has SUPABASE_*), a
 * Chrome-binary resolver, and the demo-scan seeder that backs the two data
 * routes (`/scan/:id/results`, `/report/:id`). Keeping ONE copy of the seed here
 * means the two harnesses can never drift to different report payloads.
 */

import { execFile, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Minimal .env.local loader. Real process.env always wins; we only fill in
// vars that are not already set.
// ---------------------------------------------------------------------------

export function loadEnvLocal() {
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// ---------------------------------------------------------------------------
// Resolve a Chrome binary: $CHROME_BIN → known macOS path → PATH lookups.
// ---------------------------------------------------------------------------

function which(bin) {
  try {
    const out = execFileSync("which", [bin], { encoding: "utf8" }).trim();
    return out || null;
  } catch {
    return null;
  }
}

export function resolveChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean);
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"]) {
    const found = which(name);
    if (found) return found;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Seed a demo scan (apps + scans row with a complete report_payload).
// Returns the seeded scan id, or null if Supabase isn't configured/reachable.
// ---------------------------------------------------------------------------

function buildReportPayload() {
  // A complete, schema-valid ReportPayload (lib/scan/report.ts → ReportPayload).
  const isoNow = new Date().toISOString();
  const deadline = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const actionCard = (over) => ({
    category: "seo_aso",
    title: "Inject the 'habit tracker' keyword cluster into the listing title",
    why: "8,100 monthly searches with no top competitor owning the phrase in title — a low-effort, high-visibility ASO win.",
    evidenceIds: [],
    evidence: [
      { excerpt: "habit tracker app", source: "keyword_data", sourceType: "dataforseo_keywords" },
      { excerpt: "the streak feature keeps me going", source: "review_themes", sourceType: "app_store_rss" },
    ],
    effortMin: 20,
    suggestedDeadline: deadline,
    expectedOutcome: { scoreComponent: "seo", delta: 6 },
    draft: "HabitKit — Daily Habit Tracker\n\nBuild lasting habits with the simplest habit tracker for iOS.",
    draftRequiresEdit: true,
    verification: { method: "url", state: "pending" },
    basis: "evidence_based",
    confidence: 0.9,
    ...over,
  });

  return {
    mode: "ios",
    generatedAt: isoNow,
    whatYouOffer: {
      positioningMirror: {
        listingSays: "Build habits in 21 days with science-backed streaks, trusted by 500,000+ users.",
        reviewsValue: "Users prize the streak feature for consistency, but report crashes on older iOS.",
        gap: "The listing emphasises rapid 21-day habit formation, but users actually value long-term persistence tools — and the stability issues undercut the premium promise.",
      },
    },
    whoItsFor: {
      summary: 'Buyers who value streak consistency, reminders, reliable widgets. Reviews confirm: "the streak feature keeps me going".',
      signals: ["streak consistency", "daily reminders", "reliable widgets", "low cognitive load"],
    },
    whereTheyAre: {
      surfaces: [
        { source: "reddit", title: "r/productivity — 'best habit tracker?' weekly thread", url: "https://example.com/reddit" },
        { source: "youtube", title: "Top 5 habit tracker apps (48k views)", url: "https://example.com/youtube" },
      ],
      competitorGap: [
        { competitor: "Habitify", dimension: "analytics depth", them: 80, you: 35 },
        { competitor: "Streaks", dimension: "Apple Watch", them: 90, you: 50 },
      ],
    },
    whatToDoThisWeek: {
      quickWins: [actionCard({})],
      medium: [
        actionCard({
          category: "content",
          title: "Publish a 'how to build a habit' guide targeting long-tail search",
          effortMin: 90,
          expectedOutcome: { scoreComponent: "content", delta: 8 },
        }),
      ],
      longPlay: [
        actionCard({
          category: "outreach",
          title: "Pitch 3 productivity newsletters with the 'simple habit building' angle",
          effortMin: 180,
          expectedOutcome: { scoreComponent: "outreach", delta: 10 },
        }),
      ],
    },
    score: {
      total: 63,
      breakdown: { content: 41, outreach: 28, seo: 71 },
      basis: "verified",
      radar: [
        { axis: "Keywords", value: 71, active: true },
        { axis: "Directories", value: 20, active: true },
        { axis: "Comparison", value: 30, active: true },
        { axis: "ASO", value: 55, active: true },
        { axis: "Content", value: 41, active: true },
        { axis: "Outreach", value: 28, active: true },
        { axis: "Reviews", value: 80, active: true },
      ],
    },
  };
}

export async function seedDemoScan() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn(
      "[seed] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping the seed.\n" +
        "       The data routes (/scan/:id/results, /report/:id) will be skipped."
    );
    return null;
  }

  let createClient;
  try {
    ({ createClient } = await import("@supabase/supabase-js"));
  } catch {
    console.warn("[seed] @supabase/supabase-js not importable — skipping the seed.");
    return null;
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  try {
    const { data: existing } = await db
      .from("scans")
      .select("id")
      .not("report_payload", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      console.log(`[seed] reusing existing completed scan ${existing.id}`);
      return existing.id;
    }
  } catch (err) {
    console.warn(`[seed] lookup of existing scan failed (will try to insert): ${err.message}`);
  }

  const appId = randomUUID();
  const scanId = randomUUID();

  const { error: appErr } = await db.from("apps").insert({
    id: appId,
    platform: "ios",
    store_url: "https://apps.apple.com/us/app/render-smoke-demo/id000000000",
    name: "Render Smoke Demo",
    category: "Productivity",
  });
  if (appErr) {
    console.warn(`[seed] failed to insert app: ${appErr.message} — skipping data routes.`);
    return null;
  }

  const payload = buildReportPayload();
  const { error: scanErr } = await db.from("scans").insert({
    id: scanId,
    app_id: appId,
    status: "complete",
    tier: "free",
    cost_cents: 0,
    started_at: new Date(Date.now() - 60_000).toISOString(),
    completed_at: new Date().toISOString(),
    score_total: payload.score.total,
    score_breakdown: payload.score.breakdown,
    report_payload: payload,
  });
  if (scanErr) {
    console.warn(`[seed] failed to insert scan: ${scanErr.message} — skipping data routes.`);
    return null;
  }

  console.log(`[seed] inserted demo scan ${scanId} (app ${appId})`);
  return scanId;
}

// Re-export execFile for harnesses that spawn Chrome directly.
export { execFile };
