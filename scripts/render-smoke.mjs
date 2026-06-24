/**
 * Headless render smoke-test for every key route (Cycle 5 · Milestone D · Task 12).
 *
 * WHY THIS EXISTS
 * ---------------
 * `pnpm build`, `pnpm typecheck`, and `pnpm check:bundle` all compile and bundle
 * successfully even when a route THROWS at render time. The 2026-06-13 UI bugs
 * (circular CSS font var, Cache-Components Suspense violations, server-component
 * event handlers, ssr:false report sections) every one passed those gates and
 * still blew up the moment a real browser rendered the page. The only thing that
 * catches that class of bug is loading each route in a REAL browser and asserting
 * the rendered DOM is healthy. That is exactly what this script does.
 *
 * APPROACH (deliberately lightweight — no Playwright/puppeteer dependency)
 * -----------------------------------------------------------------------
 *   - Drive the system Chrome in headless mode with `--dump-dom`, which prints
 *     the fully-rendered DOM (after JS executes) to stdout. `--virtual-time-budget`
 *     gives client components / hydration / ssr:false dynamic imports time to run,
 *     so this catches CLIENT render errors too, not just server ones.
 *   - For the data routes (`/scan/:id/results`, `/report/:id`) we SEED a demo scan
 *     directly into Supabase (an `apps` row + a `scans` row with a complete, valid
 *     `report_payload`) using a tiny inline @supabase/supabase-js service client,
 *     then point the routes at that seeded id. Reuses an existing completed demo
 *     scan if one is already present.
 *   - Per route we assert (a) NO Next.js error-overlay markers are in the DOM and
 *     (b) a route-specific content marker IS present.
 *
 * PREREQUISITES (this is a pragmatic local smoke-test, NOT a CI harness):
 *   - A server must already be running at BASE_URL (default http://localhost:3000).
 *     Start one yourself first, e.g. `pnpm dev` or `pnpm build && pnpm start`.
 *   - System Chrome (or chromium / google-chrome on PATH, or $CHROME_BIN).
 *   - Supabase reachable with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the env
 *     (loaded from .env.local automatically below). Only needed to seed the two
 *     data routes — every other route is asserted regardless.
 *
 * USAGE
 *   pnpm test:render                 # against http://localhost:3000
 *   BASE_URL=http://localhost:4000 pnpm test:render
 *   CHROME_BIN=/path/to/chrome pnpm test:render
 *
 * EXIT CODES
 *   0 — every route passed (no error overlay, marker present)
 *   1 — at least one route failed, or a hard prerequisite was missing
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Minimal .env.local loader (so the seed has SUPABASE_* without extra deps).
// Real process.env always wins; we only fill in vars that are not already set.
// ---------------------------------------------------------------------------

function loadEnvLocal() {
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
    // Strip surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvLocal();

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Resolve a Chrome binary: $CHROME_BIN → known macOS path → PATH lookups.
// ---------------------------------------------------------------------------

function which(bin) {
  try {
    const { execFileSync } = require("node:child_process");
    const out = execFileSync("which", [bin], { encoding: "utf8" }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function resolveChrome() {
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

// `require` shim for the small synchronous `which` helper above (ESM module).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Render a URL via headless Chrome and return its dumped DOM (string).
// ---------------------------------------------------------------------------

function dumpDom(chromeBin, url) {
  return new Promise((resolve, reject) => {
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--virtual-time-budget=6000",
      "--dump-dom",
      url,
    ];
    execFile(
      chromeBin,
      args,
      { maxBuffer: 64 * 1024 * 1024, timeout: 45_000 },
      (err, stdout, stderr) => {
        // Chrome can exit non-zero while still having dumped usable DOM; only
        // treat it as a hard failure when there is genuinely no output.
        if (err && !stdout) {
          reject(new Error(`${err.message}${stderr ? `\n${stderr}` : ""}`));
          return;
        }
        resolve(stdout ?? "");
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Strip <script>…</script> blocks from a dumped DOM.
//
// CRITICAL: Next.js inlines the serialized RSC Flight payload (the `__next_f`
// segments) AND the not-found component tree into <script> tags on EVERY page.
// That payload literally contains "404: This page could not be found." and other
// React/Next default error strings — so scanning the raw DOM for error markers
// yields false positives on perfectly healthy pages. Real error overlays and a
// genuine rendered 404 appear as VISIBLE DOM (outside <script>), so we scan only
// the script-stripped DOM. (Verified: home page → 0 hits after stripping; a real
// /does-not-exist 404 → 2 hits — the distinction holds.)
//
// We also drop the script-borne content for the marker check, which makes the
// test STRONGER: a content marker must be genuinely rendered, not merely present
// in the inlined Flight data.
// ---------------------------------------------------------------------------

function stripScripts(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

// ---------------------------------------------------------------------------
// Error-overlay markers that must NEVER appear in a healthy (script-stripped) DOM.
// These are the strings Next.js / React render errors surface at runtime.
// ---------------------------------------------------------------------------

const ERROR_MARKERS = [
  "Runtime Error",
  "Unhandled Runtime Error",
  "blocking-route", // Cache-Components: blocking data outside <Suspense>
  "Event handlers cannot be passed", // server-component passed an onClick
  "Application error",
  "This page could not be found", // a route that should exist 404'd
  "Internal Server Error",
  "missing-suspense-with-csr-bailout",
];

// ---------------------------------------------------------------------------
// Seed a demo scan (apps + scans row with a complete report_payload).
// Returns the seeded scan id, or null if Supabase isn't configured/reachable.
// ---------------------------------------------------------------------------

function buildReportPayload() {
  // A complete, schema-valid ReportPayload (lib/scan/report.ts → ReportPayload).
  // Realistic but synthetic; mirrors the fixture data shape so every report
  // section component renders its full, non-degraded layout.
  const isoNow = new Date().toISOString();
  const deadline = new Date(Date.now() + 7 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

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

async function seedDemoScan() {
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

  // Reuse an existing completed demo scan if one is already present (keeps the
  // table tidy across repeated runs and avoids unnecessary writes).
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

  // Insert a fresh app + scan.
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

// ---------------------------------------------------------------------------
// Route table. Each route asserts: no error overlay + (optionally) a marker.
// `markers` passes if ANY listed marker is present (case-insensitive).
// `errorOnly: true` routes only assert the absence of an error overlay
// (e.g. /app legitimately redirects/blanks for an anonymous visitor).
// ---------------------------------------------------------------------------

function buildRoutes(scanId) {
  const routes = [
    { path: "/", markers: ["findable you are", "Analyze my site"] },
    { path: "/scan", markers: ["findable you are", "Analyze my site"] },
    { path: "/pricing", markers: ["$59", "$129"] },
    { path: "/teardowns", markers: ["Teardown", "Bearable"] },
    { path: "/teardowns/bearable", markers: ["Bearable"] },
    { path: "/privacy", markers: ["Privacy"] },
    { path: "/app", errorOnly: true },
  ];
  if (scanId) {
    routes.push({
      path: `/scan/${scanId}/results`,
      markers: ["ranked fixes", "Positioning Mirror"],
    });
    routes.push({
      path: `/report/${scanId}`,
      markers: ["ranked fixes", "Positioning Mirror"],
    });
  }
  return routes;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const chromeBin = resolveChrome();
  if (!chromeBin) {
    console.error(
      "✗ Could not find a Chrome/Chromium binary.\n" +
        "  Set CHROME_BIN, or install Google Chrome / Chromium on PATH."
    );
    process.exit(1);
  }
  console.log(`Chrome:   ${chromeBin}`);
  console.log(`Base URL: ${BASE_URL}`);

  // Fail fast with a clear message if the server isn't up.
  try {
    const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(5000) });
    // Any HTTP response (even a 4xx/5xx on "/") proves the server is listening.
    void res;
  } catch {
    console.error(
      `✗ No server reachable at ${BASE_URL}.\n` +
        "  Start one first, e.g. `pnpm dev` or `pnpm build && pnpm start`, then re-run."
    );
    process.exit(1);
  }

  const scanId = await seedDemoScan();
  const routes = buildRoutes(scanId);

  console.log(`\nRendering ${routes.length} routes with headless Chrome...\n`);

  const results = [];
  for (const route of routes) {
    const url = `${BASE_URL}${route.path}`;
    let dom = "";
    let renderError = null;
    try {
      dom = await dumpDom(chromeBin, url);
    } catch (err) {
      renderError = err.message;
    }

    // Scan the script-stripped DOM so the inlined RSC Flight payload (which
    // contains React/Next default error strings on every page) cannot trip us.
    const visible = stripScripts(dom);
    const lower = visible.toLowerCase();
    const foundErrorMarker = ERROR_MARKERS.find((m) => lower.includes(m.toLowerCase()));

    let foundMarker = null;
    let markerOk = true;
    if (!route.errorOnly && route.markers?.length) {
      foundMarker = route.markers.find((m) => lower.includes(m.toLowerCase())) ?? null;
      markerOk = foundMarker !== null;
    }

    const pass =
      renderError === null &&
      dom.length > 0 &&
      !foundErrorMarker &&
      markerOk;

    let reason = "";
    if (renderError) reason = `render failed: ${renderError}`;
    else if (dom.length === 0) reason = "empty DOM";
    else if (foundErrorMarker) reason = `error overlay: "${foundErrorMarker}"`;
    else if (!markerOk) reason = `missing marker (expected one of: ${route.markers.join(", ")})`;
    else if (route.errorOnly) reason = "no error overlay (errorOnly)";
    else reason = `marker "${foundMarker}"`;

    results.push({ path: route.path, pass, reason });
  }

  // ── Print the per-route table ────────────────────────────────────────────
  const pad = Math.max(...results.map((r) => r.path.length), 8);
  console.log("Route".padEnd(pad) + "  Result  Detail");
  console.log("-".repeat(pad) + "  ------  ------");
  for (const r of results) {
    console.log(`${r.path.padEnd(pad)}  ${r.pass ? "  ✓   " : "  ✗   "}  ${r.reason}`);
  }

  const failures = results.filter((r) => !r.pass);
  console.log("");
  if (failures.length > 0) {
    console.error(
      `✗ ${failures.length}/${results.length} route(s) failed: ${failures
        .map((f) => f.path)
        .join(", ")}`
    );
    process.exit(1);
  }
  console.log(`✓ all ${results.length} routes rendered cleanly`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`✗ render-smoke crashed: ${err.stack ?? err.message}`);
  process.exit(1);
});
