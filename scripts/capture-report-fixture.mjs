/**
 * capture-report-fixture — freeze a LIVE scan's `report_payload` as a
 * report-corpus acceptance fixture (`lib/scan/fixtures/report-corpus/<host>.json`).
 *
 *   pnpm capture:report <scanId> --archetype=<directory|zero-ranking|normal-saas|pathological> [--note="…"] [--force]
 *
 * READ-ONLY against Supabase (same service-client idiom as
 * scripts/lib/render-shared.mjs). The payload is captured VERBATIM — never
 * hand-pruned (the react-email lesson: an edited fixture starves or feeds the
 * checks dishonestly). Refuses to overwrite an existing fixture without
 * --force, so an archetype's pinned payload can't be silently replaced.
 *
 * Owner flow: run a live scan, read it (you do anyway), then one command
 * freezes it as an acceptance fixture the rubric runs against every build.
 */

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./lib/render-shared.mjs";

const ARCHETYPES = ["directory", "zero-ranking", "normal-saas", "pathological"];

function fail(msg) {
  console.error(`[capture:report] ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const scanId = args.find((a) => !a.startsWith("--"));
const archetype = (args.find((a) => a.startsWith("--archetype=")) ?? "").slice("--archetype=".length);
const note = (args.find((a) => a.startsWith("--note=")) ?? "").slice("--note=".length);
const force = args.includes("--force");

if (!scanId) fail("usage: pnpm capture:report <scanId> --archetype=<a> [--note=…] [--force]");
if (!ARCHETYPES.includes(archetype)) fail(`--archetype must be one of: ${ARCHETYPES.join(", ")}`);

loadEnvLocal();
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (load .env.local or export them)");

const { createClient } = await import("@supabase/supabase-js");
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: scan, error } = await db
  .from("scans")
  .select("id, tier, completed_at, report_payload, apps(store_url, name)")
  .eq("id", scanId)
  .maybeSingle();
if (error) fail(`scan lookup failed: ${error.message}`);
if (!scan) fail(`scan ${scanId} not found`);
if (!scan.report_payload) fail(`scan ${scanId} has no report_payload (not completed?)`);

const siteUrl = scan.apps?.store_url ?? "";
let host = "unknown";
try {
  host = new URL(siteUrl).hostname.replace(/^www\./, "");
} catch {
  fail(`could not parse a host from the scan's store_url ("${siteUrl}")`);
}

const dir = join(process.cwd(), "lib/scan/fixtures/report-corpus");
const file = join(dir, `${host}.json`);
if (existsSync(file) && !force) {
  fail(`${file} already exists — a pinned archetype payload is not silently replaced; pass --force to re-capture`);
}
mkdirSync(dir, { recursive: true });

const fixture = {
  domain: host,
  siteUrl,
  archetype,
  scanId: scan.id,
  tier: scan.tier,
  capturedAt: (scan.completed_at ?? "").slice(0, 10),
  note: note || undefined,
  reportPayload: scan.report_payload,
};
writeFileSync(file, JSON.stringify(fixture, null, 2) + "\n");
console.log(`[capture:report] wrote ${file} (archetype=${archetype}, tier=${scan.tier}, captured ${fixture.capturedAt})`);
console.log("[capture:report] next: add its per-fixture expectations to components/report/captured/report-corpus.rubric.test.tsx");
