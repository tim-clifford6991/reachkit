#!/usr/bin/env node
// scripts/page.mjs — `npm run page`. SPEC §7 (owner, D43, 2026-10-04): "the
// generation should be straightforward also from a testing side." One command
// tests a page.
//
// # Usage
//
//   npm run page -- --site reachkit.app --type listicle
//   npm run page -- --site reachkit.app --type how_to --topic "how to get cited by chatgpt"
//   npm run page -- --site reachkit.app --type qa --fresh           # rebuild the pack
//   npm run page -- --site reachkit.app --type qa --out docs/walk/pipeline-v2
//   npm run page -- --site reachkit.app --type qa --cap-cents 25 --env-file ../../reachkitv3/.env.local
//
// `--type` is one of listicle, how_to, documentation, research, qa, insights
// (also spelled current-insights), update. It builds the context pack from the site's production data, caches
// it on disk (`.review/page/packs/`), writes one page through the product's
// own stages 3 and 4, and prints the page's path, each check's result and the
// cost. A rerun reuses the cached pack unless `--fresh` is given.
//
// # The production data
//
// This box's database key is a placeholder, so the site's production rows are
// read from its committed export, `scripts/page/snapshot/<domain>.json`
// (`scripts/page/run.ts` says what it holds and how it is taken through the
// Supabase connector). The research step's reads, its searches and the
// model calls are live, inside `--cap-cents` (default 25, D43's per-page
// ceiling) and `CAPS.DRAFT_C`. Nothing is published or written to a database.
//
// # Why a loader
//
// This box's Node has no type stripping, so the repo's own Vite loads the
// TypeScript, with one module aliased for the run only — `@/lib/measure/text`,
// so the pipeline reads the snapshot's pages.
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

async function main() {
  const site = flag("--site", null);
  const type = flag("--type", null);
  if (site === null || type === null) {
    throw new Error('Usage: npm run page -- --site <domain> --type <type> [--topic "<q>"] [--fresh] [--out <dir>] [--cap-cents <n>]');
  }
  const envFile = path.resolve(ROOT, flag("--env-file", ".env.local"));
  if (!loadEnvFile(envFile) && process.env.ANTHROPIC_API_KEY === undefined) {
    throw new Error(`No env file at ${envFile} and no bindings in this shell. Pass --env-file <path>, or export them.`);
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (key === undefined || key === "" || key.startsWith("PENDING")) {
    throw new Error("ANTHROPIC_API_KEY is not set to a real key; put it in the env file.");
  }

  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: {
      alias: [
        { find: "@/lib/measure/text", replacement: path.join(ROOT, "scripts/page/measured-text.ts") },
        { find: /^@\//, replacement: `${path.join(ROOT, "src")}/` },
      ],
    },
  });
  try {
    const run = await server.ssrLoadModule("/scripts/page/run.ts");
    return await run.main({
      root: ROOT,
      site,
      type,
      topic: flag("--topic", null),
      fresh: argv.includes("--fresh"),
      outDir: path.resolve(ROOT, flag("--out", ".review/page")),
      capCents: Number(flag("--cap-cents", "25")),
    });
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
