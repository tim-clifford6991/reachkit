#!/usr/bin/env node
// scripts/search-history.mjs — `npm run search-history`: each live hosted page's weekly impressions, clicks and average
// place on its own search, from Search Console's history. Read-only and 0¢; `scripts/search-history/run.ts` does the work.
//
//   npm run search-history -- --site reachkit.app --env-file <path with SUPABASE_* and GOOGLE_SEARCH_CONSOLE_KEYS>
//
// This box's Node has no type stripping, so the repo's own Vite loads the TypeScript, as `scripts/retarget.mjs` does.
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
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match !== null && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const site = flag("--site", null);
  if (site === null) throw new Error("Usage: npm run search-history -- --site <domain> [--env-file <path>]");
  loadEnvFile(path.resolve(ROOT, flag("--env-file", ".env.local")));
  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
  });
  try {
    const run = await server.ssrLoadModule("/scripts/search-history/run.ts");
    return await run.main({ site: site.trim().toLowerCase(), now: new Date() });
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
