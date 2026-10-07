#!/usr/bin/env node
// scripts/pass.mjs — `npm run pass`. SPEC §6 (owner, D64, 2026-10-07, issue
// 1301): a stored pass is checked again without anyone pressing Measure.
//
// # Usage
//
//   npm run pass -- --site reachkit.app --replay d4bb3740
//   npm run pass -- --site reachkit.app --replay d4bb3740 --live --cap-cents 30 --env-file ../../reachkitv3/.env.local
//   npm run pass -- --site reachkit.app --replay d4bb3740 --keep      # leave the local database up
//
// `--replay <scanId>` takes a pass exported to `scripts/pass/snapshot/` (its
// first eight characters are enough) and runs the pass's own steps over it:
// which top-ten domains it sizes, the rival conclusion, the prompts that
// follow the rivals, the topics and their prune, and the health checks. It
// prints the rivals, the reads, the cost, the checks, the topics and the 25
// prompts, and exits 0 only when the acceptance list holds.
//
// # What it runs against
//
// The repository's own local database (`scripts/db-substrate/`), rebuilt
// from `supabase/migrations` and loaded with the snapshot, so every query
// the pass makes is the real one. Production is never contacted: the run
// holds no production key, and `--replay` holds no vendor key either. A
// vendor or model call the stored pass made is answered from its `fetches`
// row; one it did not make is refused, listed with what it would have cost,
// and left unmeasured — a replay costs 0¢.
//
// `--live` lets those refused calls through instead, on the keys in
// `--env-file`, until `--cap-cents` (default 30) is spent. Each paid call is
// written to the box's spend log (D57). The pass's own stages before its
// report — reading the site, asking the searches and the prompts — are not
// run in either mode: their results are the stored report.
//
// One database per worktree: a replay rebuilds it, so do not run one beside
// `vitest --project db` or the layout sweep in the same worktree.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf(name);
  return at === -1 || at + 1 >= argv.length ? fallback : argv[at + 1];
};

function loadEnvFile(file) {
  if (!existsSync(file)) return false;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match === null) continue;
    const [, key, raw] = match;
    if (process.env[key] === undefined) process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
  return true;
}

/** Every binding the product's `env` asks of a process, as a value that
 *  reaches nothing. A replay never loads a real one. */
const NO_KEYS = {
  STRIPE_SECRET_KEY: "replay",
  STRIPE_WEBHOOK_SECRET: "replay",
  STRIPE_PRICE_ID: "replay",
  RESEND_API_KEY: "replay",
  MAIL_FROM: "replay@example.com",
  DATAFORSEO_LOGIN: "replay",
  DATAFORSEO_PASSWORD: "replay",
  ANTHROPIC_API_KEY: "replay",
  IP_HASH_SALT: "replay",
  OWNER_EMAILS: "replay@example.com",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1",
  HOSTED_EDGE_CNAME_TARGET: "replay.example.com",
};

/** The local database, up; its bindings replace any the shell held. */
function substrateUp() {
  const out = execFileSync("bash", [path.join(ROOT, "scripts/db-substrate/up.sh"), "--run"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  for (const line of out.split("\n")) {
    const match = /^export ([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match !== null) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? "")) {
    throw new Error("scripts/db-substrate/up.sh did not name a local database; nothing was run.");
  }
}

function substrateDown() {
  try {
    execFileSync("bash", [path.join(ROOT, "scripts/db-substrate/down.sh")], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  } catch {
    console.error("The local database could not be stopped: run scripts/db-substrate/down.sh.");
  }
}

async function main() {
  const site = flag("--site", null);
  const scan = flag("--replay", null);
  if (site === null || scan === null) {
    throw new Error("Usage: npm run pass -- --site <domain> --replay <scanId> [--live --cap-cents <n> --env-file <path>] [--keep]");
  }
  const live = argv.includes("--live");
  if (live) {
    const envFile = path.resolve(ROOT, flag("--env-file", ".env.local"));
    if (!loadEnvFile(envFile)) throw new Error(`No env file at ${envFile}. A live run needs the vendor keys: pass --env-file <path>.`);
    for (const key of ["ANTHROPIC_API_KEY", "DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"]) {
      const value = process.env[key];
      if (value === undefined || value === "" || value.startsWith("PENDING")) throw new Error(`${key} is not set to a real key in ${envFile}.`);
    }
  }
  for (const [key, value] of Object.entries(NO_KEYS)) {
    if (!live || process.env[key] === undefined || process.env[key].startsWith("PENDING")) process.env[key] = value;
  }
  // A paid call is never refused by a switch meant for the product, and
  // never reaches a production database: the bindings below come last.
  process.env.KILL_SWITCH = "false";
  substrateUp();

  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
  });
  try {
    const run = await server.ssrLoadModule("/scripts/pass/run.ts");
    return await run.main({ root: ROOT, site, scan, live, capCents: Number(flag("--cap-cents", "30")) });
  } finally {
    await server.close();
    if (!argv.includes("--keep")) substrateDown();
  }
}

main().then(
  (code) => process.exit(code ?? 0),
  (error) => {
    console.error(String(error?.stack ?? error?.message ?? error));
    process.exit(1);
  }
);
