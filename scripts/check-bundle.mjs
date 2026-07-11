/**
 * Bundle-size budget guard for Next 16 + Turbopack.
 *
 * Next 16 with Turbopack does NOT emit `app-build-manifest.json`. Instead the
 * relevant artefacts are:
 *
 *   .next/build-manifest.json           — rootMainFiles (shared baseline) + polyfillFiles
 *   .next/app-path-routes-manifest.json — maps "/(group)/page" → URL, tells us the route group
 *   .next/app-paths-manifest.json       — maps "/(group)/page" → server JS path, used to derive
 *                                          the client-reference-manifest path
 *   .next/server/app/{path}/page_client-reference-manifest.js
 *                                       — entryJSFiles lists per-entry client chunks
 *
 * "First Load JS" for a route = gzip-compressed sum of deduplicated union of:
 *   polyfillFiles + rootMainFiles + page entryJSFiles
 * (all paths are relative to `.next/` after stripping the `/_next/` prefix)
 *
 * Sizes are measured gzip-compressed to match the industry standard (and the
 * budgets in §20.4 of the spec). Next 16 + Turbopack does not print First Load
 * JS sizes in its build output, so this script computes them directly.
 *
 * Budget notes (all three values account for the ~182 KB Next 16 + Turbopack +
 * React 19 framework baseline measured on the bare scaffold with no app code):
 *   (marketing) 220 KB — every marketing page carries the site-wide chrome:
 *                         branded nav + Resources dropdown + mobile menu, theme
 *                         toggle (next-themes), and a 4-column footer + social
 *                         row. Baseline pages sit ~209 KB; only /pricing (Stripe
 *                         checkout client) approaches the cap. Heavy animation
 *                         (GSAP/Lenis/Motion) and the toast layer stay lazy; the
 *                         shared root chunk is unchanged (~175 KB).
 *   (funnel)    225 KB — the `/scan/[id]` page carries the SSE scan-theater +
 *                         the score-reveal; the heavy bits (DiscoverabilityScore,
 *                         Stagger, EmailGate) are all lazy-loaded.
 *   (app)       275 KB — authenticated product shell (persistent sidebar + sign
 *                         out, score block) PLUS the four intel dashboards
 *                         (supply/demand/synthesis/plans) and their chart kit,
 *                         which share a ~249 KB app-group client baseline; the
 *                         richest (supply) lands ~267 KB. This budget sits just
 *                         above the current worst case so it still catches future
 *                         regressions. FOLLOW-UP: the ~249 KB shared app-group
 *                         floor (present even on onboarding/settings/billing) is
 *                         worth investigating for a real reduction (code-split the
 *                         intel kit / defer charts) rather than raising further.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { gzipSync } from "node:zlib";

// Budgets in KB of First Load JS (gzip) per route group (§20.4). See file-header comment.
const BUDGETS = { "(marketing)": 220, "(funnel)": 225, "(app)": 275 };

/**
 * Known-overage baseline (the ratchet — same pattern as check-arch KNOWN_CYCLES
 * and the design coverage baseline). These 4 pages went over the (app) budget in
 * the 2026-07-10/11 free-report + unified-score work and were merged on red CI —
 * which made EVERY CI gate decorative. Pinning their current measured size (+1 KB
 * jitter headroom) makes the gate bite again: growth beyond the pin FAILS, every
 * other page stays on the 275 KB budget, and when a page shrinks back under
 * budget its entry MUST be deleted (the script fails otherwise, so the baseline
 * only shrinks). FOLLOW-UP: reduce these for real (defer chart kit / dynamic()
 * the heavy intel components) — do NOT add entries to make a regression pass.
 */
const KNOWN_OVERAGES_KB = {
  "/(app)/app/audience/competitors/page": 284,
  "/(app)/app/audience/customers/page": 280,
  "/(app)/app/dashboard/page": 283,
  "/(app)/app/plan/page": 293,
};

const NEXT_DIR = ".next";

// Set to true when measurement infrastructure exists but a specific read fails.
// A budget guard that silently can't measure is worse than none — we exit 1.
let hadMeasurementError = false;

function readJson(relPath) {
  const full = join(NEXT_DIR, relPath);
  if (!existsSync(full)) return null;
  return JSON.parse(readFileSync(full, "utf8"));
}

function fileSizeGzipKb(relPath) {
  // relPath is relative to .next (e.g. "static/chunks/foo.js")
  const fullPath = join(NEXT_DIR, relPath);
  try {
    const buf = readFileSync(fullPath);
    return gzipSync(buf).length / 1024;
  } catch {
    console.warn(`[check-bundle] could not read chunk: ${fullPath}`);
    hadMeasurementError = true;
    return 0;
  }
}

// Strip the /_next/ prefix that Turbopack uses in some manifest paths
function normaliseChunkPath(p) {
  return p.replace(/^\/_next\//, "");
}

const buildManifest = readJson("build-manifest.json");
if (!buildManifest) {
  console.error("✗ .next/build-manifest.json not found — run `pnpm build` first");
  process.exit(1);
}

// Shared chunks sent on every page
const sharedChunks = new Set([
  ...(buildManifest.polyfillFiles ?? []).filter((f) => f.endsWith(".js")),
  ...(buildManifest.rootMainFiles ?? []).filter((f) => f.endsWith(".js")),
]);

const appPathRoutes = readJson("app-path-routes-manifest.json") ?? {};
const rawAppPathsManifest = readJson("server/app-paths-manifest.json");

// If the manifest is missing/empty but there are budget-tracked routes in
// app-path-routes-manifest, something is wrong — flag it loudly.
const budgetedRoutes = Object.keys(appPathRoutes).filter((k) => {
  const g = k.match(/\((\w+)\)/)?.[0];
  return g && g in BUDGETS;
});
if (!rawAppPathsManifest && budgetedRoutes.length > 0) {
  console.warn(
    "[check-bundle] server/app-paths-manifest.json is missing but budgeted routes exist: " +
      budgetedRoutes.join(", ")
  );
  hadMeasurementError = true;
}
const appPathsManifest = rawAppPathsManifest ?? {};

let failed = false;
let checkedAny = false;

for (const [routeKey] of Object.entries(appPathRoutes)) {
  // routeKey looks like "/(marketing)/page"
  const group = routeKey.match(/\((\w+)\)/)?.[0];
  if (!group || !(group in BUDGETS)) continue;

  // Derive path to page_client-reference-manifest.js
  // appPathsManifest maps "/(marketing)/page" → "app/(marketing)/page.js"
  const serverPagePath = appPathsManifest[routeKey];
  if (!serverPagePath) continue;

  // e.g. "app/(marketing)/page.js" → server/app/(marketing)/page_client-reference-manifest.js
  const manifestPath = join(
    "server",
    dirname(serverPagePath),
    "page_client-reference-manifest.js"
  );

  let pageChunks = [];
  const manifestFull = join(NEXT_DIR, manifestPath);
  if (existsSync(manifestFull)) {
    // The file is a JS assignment, not JSON. Extract entryJSFiles via regex.
    const src = readFileSync(manifestFull, "utf8");
    // entryJSFiles: {"[project]/app/layout":["static/chunks/foo.js"],...}
    const match = src.match(/"entryJSFiles"\s*:\s*(\{[^}]+\})/s);
    if (match) {
      try {
        const entryJSFiles = JSON.parse(match[1]);
        for (const files of Object.values(entryJSFiles)) {
          for (const f of files) {
            if (f.endsWith(".js")) pageChunks.push(f);
          }
        }
      } catch (err) {
        // The manifest file exists and the regex matched, so a parse failure
        // means the entryJSFiles data is corrupt — flag it loudly.
        console.warn(
          `[check-bundle] failed to parse entryJSFiles for route ${routeKey}: ${err.message}`
        );
        hadMeasurementError = true;
      }
    }
  }

  // Union of shared + page-specific, deduped
  const allChunks = new Set([...sharedChunks, ...pageChunks.map(normaliseChunkPath)]);
  const kb = Array.from(allChunks).reduce((n, f) => n + fileSizeGzipKb(f), 0);

  checkedAny = true;
  const pinned = KNOWN_OVERAGES_KB[routeKey];
  if (pinned !== undefined && kb <= BUDGETS[group]) {
    console.error(
      `✗ ${routeKey} (${group}) ${kb.toFixed(0)} KB is back UNDER budget — pin the win: delete its KNOWN_OVERAGES_KB entry`
    );
    failed = true;
  } else if (pinned !== undefined) {
    if (kb > pinned) {
      console.error(
        `✗ ${routeKey} (${group}) ${kb.toFixed(0)} KB (gzip) > pinned overage baseline ${pinned} KB — the baseline only shrinks`
      );
      failed = true;
    } else {
      console.log(
        `⚠ ${routeKey} (${group}) ${kb.toFixed(0)} KB (gzip) over ${BUDGETS[group]} KB budget but within pinned baseline ${pinned} KB (reduction is a tracked follow-up)`
      );
    }
  } else if (kb > BUDGETS[group]) {
    console.error(
      `✗ ${routeKey} (${group}) ${kb.toFixed(0)} KB (gzip) > budget ${BUDGETS[group]} KB`
    );
    failed = true;
  } else {
    console.log(
      `✓ ${routeKey} (${group}) ${kb.toFixed(0)} KB (gzip) <= budget ${BUDGETS[group]} KB`
    );
  }
}

if (!checkedAny) {
  // No route groups match the budgets yet — that's fine at this stage of the project.
  console.log("No routes matched budget groups — nothing to check yet.");
}

process.exit(failed || hadMeasurementError ? 1 : 0);
