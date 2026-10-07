#!/usr/bin/env node
// scripts/panel.mjs — `npm run panel`. SPEC §0 (owner, 2026-10-07, issue
// 1304): the customer panel, a fixed set of varied real businesses run
// through a paying site's first pass. Every change to market understanding,
// the knowledge base, rivals, terms, measured searches or topics passes it,
// not only reachkit.app, before the owner is asked to measure.
//
// # Usage
//
//   npm run panel -- --env-file ../../reachkitv3/.env.local
//   npm run panel -- --env-file ../../reachkitv3/.env.local --sites zunicafe.com,savvycal.com
//   npm run panel -- --env-file ../../reachkitv3/.env.local --cap-cents 60
//   npm run panel -- --env-file ../../reachkitv3/.env.local --continue --cap-cents 300   # run the sites today's run did not reach
//   npm run panel -- --recheck --date 2026-10-07                       # judge a stored run again: 0¢, no database
//   npm run panel -- --env-file ../../reachkitv3/.env.local --keep     # leave the local database up
//
// It runs live, up to `--cap-cents` (default 100) for the whole panel, and
// writes each paid call to the box's spend log (D57). It prints each site's
// checks as pass, FAIL or review, and writes the run to
// `docs/walk/panel/<date>.json` and `<date>.md`. It exits 0 only when every
// site ran and no check failed. `--continue` keeps the sites that date's
// run already holds and counts their spend against the cap.
//
// # What it runs against
//
// The repository's own local database (`scripts/db-substrate/`), rebuilt
// from `supabase/migrations`. Of the env file it takes the two vendors' keys
// and nothing else, so the run holds no production key: nothing is written
// to production. `scripts/panel/run.ts` says what is run and what is kept.
//
// One database per worktree: a run rebuilds it, so do not run one beside
// `vitest --project db`, the layout sweep or `npm run pass` in the same
// worktree.
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

const VENDOR_KEYS = ["ANTHROPIC_API_KEY", "DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"];

/** The vendors' keys out of an env file, and no other line of it. */
function vendorKeys(file) {
  if (!existsSync(file)) throw new Error(`No env file at ${file}. The panel runs live and needs the vendor keys: pass --env-file <path>.`);
  const keys = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match !== null && VENDOR_KEYS.includes(match[1])) keys[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  for (const key of VENDOR_KEYS) {
    if (keys[key] === undefined || keys[key] === "" || keys[key].startsWith("PENDING")) throw new Error(`${key} is not set to a real key in ${file}.`);
  }
  return keys;
}

/** Every other binding the product's `env` asks of a process, as a value
 *  that reaches nothing. */
const NO_KEYS = {
  STRIPE_SECRET_KEY: "panel",
  STRIPE_WEBHOOK_SECRET: "panel",
  STRIPE_PRICE_ID: "panel",
  RESEND_API_KEY: "panel",
  MAIL_FROM: "panel@example.com",
  IP_HASH_SALT: "panel",
  OWNER_EMAILS: "panel@example.com",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1",
  HOSTED_EDGE_CNAME_TARGET: "panel.example.com",
  KILL_SWITCH: "false",
};
/** Bindings a shell may hold that would let the run reach a service. */
const NEVER = ["POSTHOG_API_KEY", "POSTHOG_HOST", "INNGEST_SIGNING_KEY", "INNGEST_EVENT_KEY", "VERCEL_API_TOKEN", "NANO_API_KEY"];

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
  const capCents = Number(flag("--cap-cents", "100"));
  if (!(capCents > 0)) throw new Error("--cap-cents takes a number of cents above 0.");
  const date = flag("--date", new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("--date takes YYYY-MM-DD.");
  const sites = (flag("--sites", "") ?? "").split(",").map((site) => site.trim()).filter(Boolean);

  const options = { root: ROOT, sites, capCents, date, resume: argv.includes("--continue"), recheck: argv.includes("--recheck") };

  // A recheck reads a stored run: it holds no key and names no database.
  const NOTHING = { ANTHROPIC_API_KEY: "panel", DATAFORSEO_LOGIN: "panel", DATAFORSEO_PASSWORD: "panel", SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_ANON_KEY: "panel", SUPABASE_SERVICE_ROLE_KEY: "panel" };
  Object.assign(process.env, NO_KEYS, options.recheck ? NOTHING : vendorKeys(path.resolve(ROOT, flag("--env-file", ".env.local"))));
  for (const key of NEVER) delete process.env[key];
  // The local database's bindings come last, over anything the shell held.
  if (!options.recheck) substrateUp();

  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
  });
  try {
    const run = await server.ssrLoadModule("/scripts/panel/run.ts");
    return options.recheck ? run.recheck(options) : await run.main(options);
  } finally {
    await server.close();
    if (!options.recheck && !argv.includes("--keep")) substrateDown();
  }
}

main().then(
  (code) => process.exit(code ?? 0),
  (error) => {
    console.error(String(error?.stack ?? error?.message ?? error));
    process.exit(1);
  }
);
