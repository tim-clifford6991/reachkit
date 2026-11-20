#!/usr/bin/env node
// scripts/pass.mjs — `npm run pass`. SPEC §6 (owner, D64, 2026-10-07, issue
// 1301): a stored pass is checked again without anyone pressing Measure.
//
// # Usage
//
//   npm run pass -- --site reachkit.app --replay d4bb3740
//   npm run pass -- --site reachkit.app --replay d4bb3740 --live --cap-cents 30 --env-file ../../.env.local
//   npm run pass -- --site reachkit.app --replay d4bb3740 --keep      # leave the local database up
//   npm run pass -- --site reachkit.app --replay d4bb3740 --eval-site opportunity-typing,topic-typed --model claude-haiku-5-5 --eval-mode plan
//
// `--eval-site` (the model evaluation, `scripts/eval-models/pass-site.ts`) makes the named call sites miss the
// store, so each goes to `--model` through the eval transport and ledger; `--eval-mode` is fake (the default), plan
// or live, and live reads only `ANTHROPIC_API_KEY` from the env file. Every other row is served as stored and any
// other miss is refused, as in a replay. It cannot be combined with `--live`, which buys vendor calls. A live
// evaluation follows `scripts/eval-models.mjs`'s "Running live": prices re-read, and the ledger reconciled against the
// Anthropic Console after the first batch, stopping on a difference over 10 percent. `--cases <file>`
// replays a pass from an export (`scripts/eval-models/export/passes.sql`) instead of `scripts/pass/snapshot/`; the file
// goes through the evaluation's one case loader, which refuses it whole on any of its rules.
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
import { existsSync, readFileSync, rmSync } from "node:fs";
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

const EVAL_DIR = "/root/ops/reachkit/eval";

/** The one key a live evaluation needs, read from the env file without loading anything else in it. */
function anthropicKey(file) {
  if (!existsSync(file)) throw new Error(`No env file at ${file}.`);
  const line = readFileSync(file, "utf8").split("\n").find((l) => /^\s*ANTHROPIC_API_KEY\s*=/.test(l));
  const key = line?.replace(/^\s*ANTHROPIC_API_KEY\s*=\s*/, "").trim().replace(/^["']|["']$/g, "");
  if (!key || key.startsWith("PENDING")) throw new Error("ANTHROPIC_API_KEY is not set to a real key in the env file.");
  return key;
}

/** The SDK, wherever `src/` imports it, is the evaluation's transport (bundled, so the plugin sees the import). */
function evalTransport() {
  const transport = path.join(ROOT, "scripts/eval-models/transport.ts");
  return {
    ssr: { noExternal: ["@anthropic-ai/sdk"] },
    plugins: [{ name: "eval-models-transport", enforce: "pre", resolveId: (source, importer) => (source === "@anthropic-ai/sdk" && importer?.startsWith(path.join(ROOT, "src") + path.sep) ? transport : null) }],
  };
}

function evalOptions(scan, sites, mode) {
  const ledgerFile = path.resolve(flag("--ledger", path.join(EVAL_DIR, mode === "live" ? "ledger.jsonl" : "fake-ledger.jsonl")));
  const results = path.resolve(flag("--results", path.join(EVAL_DIR, "results", mode === "live" ? "pass.jsonl" : `pass-${mode}.jsonl`)));
  for (const file of [ledgerFile, results]) if (!path.relative(ROOT, file).startsWith("..")) throw new Error("The ledger and results live outside the repository (it is public).");
  const capText = flag("--eval-cap-cents", "5900");
  if (!/^\d+(\.\d+)?$/.test(capText)) throw new Error(`--eval-cap-cents takes a number of cents, 0 or more; got "${capText}".`);
  return { scan, sites, model: flag("--model", null), mode, ledgerFile, capCents: Number(capText), results, local: new URL(process.env.SUPABASE_URL).origin };
}

async function main() {
  const site = flag("--site", null);
  const scan = flag("--replay", null);
  if (site === null || scan === null) {
    throw new Error("Usage: npm run pass -- --site <domain> --replay <scanId> [--live --cap-cents <n> --env-file <path>] [--keep]");
  }
  const live = argv.includes("--live");
  const evalSites = flag("--eval-site", null)?.split(",").filter(Boolean) ?? null;
  const evalMode = flag("--eval-mode", "fake");
  if (evalSites !== null && live) throw new Error("--eval-site cannot be combined with --live: the evaluation buys model calls only.");
  if (evalSites !== null && !["fake", "plan", "live"].includes(evalMode)) throw new Error("--eval-mode is fake, plan or live.");
  if (evalSites !== null && evalMode === "live" && argv.includes("--ledger")) throw new Error("A live evaluation always books into the one ledger.");
  if (argv.includes("--cases") && evalSites === null) throw new Error("--cases (an exported pass, read through the evaluation's loader) needs --eval-site.");
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
  if (evalSites !== null && evalMode === "live") process.env.ANTHROPIC_API_KEY = anthropicKey(path.resolve(ROOT, flag("--env-file", ".env.local")));
  substrateUp();

  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
    ...(evalSites === null ? {} : evalTransport()),
  });
  try {
    const evaluation = evalSites === null ? null : await server.ssrLoadModule("/scripts/eval-models/pass-site.ts");
    evaluation?.startPassEval(evalOptions(scan, evalSites, evalMode));
    const cases = flag("--cases", null);
    if (cases !== null) process.env.RK_PASS_SNAPSHOTS = evaluation.stagePassCase(path.resolve(cases), scan, ROOT, path.join(EVAL_DIR, "staged"));
    const run = await server.ssrLoadModule("/scripts/pass/run.ts");
    const code = await run.main({ root: ROOT, site, scan, live, capCents: Number(flag("--cap-cents", "30")) });
    evaluation?.finishPassEval(code);
    return code;
  } finally {
    if (process.env.RK_PASS_SNAPSHOTS?.startsWith(path.join(EVAL_DIR, "staged"))) rmSync(process.env.RK_PASS_SNAPSHOTS, { recursive: true, force: true });
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
