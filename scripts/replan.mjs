#!/usr/bin/env node
// scripts/replan.mjs — `npm run replan`. SPEC §7 *Re-plan follows each planner
// deploy* (owner, 2026-11-16): one site's week re-committed from its stored
// rows by this checkout's planner, at 0¢.
//
//   npm run replan -- --site <domain> [--from <YYYY-MM-DD>] --dry-run [--env-file <file>]
//   npm run replan -- --site <domain> [--from <YYYY-MM-DD>] --apply   [--env-file <file>]
//
// `--dry-run` prints the site's committed week and the week the planner would
// commit, and writes nothing. `--apply` commits it, unguarded: a week with
// fewer dated days is committed too. `--from` defaults to the first date no
// draft holds and no daily run can have claimed. No pass runs and nothing is bought.
//
// This box's Node has no type stripping, so the repo's own Vite loads the
// TypeScript, as `scripts/retarget.mjs` does.
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const argv = process.argv.slice(2);
const flag = (name) => {
  const at = argv.indexOf(name);
  return at === -1 || at + 1 >= argv.length ? null : argv[at + 1];
};

async function main() {
  const site = flag("--site");
  const from = flag("--from");
  const apply = argv.includes("--apply");
  if (site === null || apply === argv.includes("--dry-run") || (from !== null && !/^\d{4}-\d{2}-\d{2}$/.test(from))) {
    throw new Error("Usage: npm run replan -- --site <domain> [--from <YYYY-MM-DD>] (--dry-run | --apply) [--env-file <file>]");
  }
  if (flag("--env-file") !== null) process.loadEnvFile(flag("--env-file"));
  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
  });
  try {
    const run = await server.ssrLoadModule("/scripts/replan/run.ts");
    return await run.main({ domain: site, from, apply, now: new Date() });
  } finally {
    await server.close();
  }
}

main().then(
  (code) => process.exit(code ?? 0),
  (error) => {
    console.error(String(error?.message ?? error));
    process.exit(1);
  }
);
