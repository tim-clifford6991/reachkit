#!/usr/bin/env node
// scripts/reslug.mjs — `npm run reslug`. SPEC §6 (2026-10-18, issue 1545):
// unpublished Write and Earn topics of a site not in English get the slug
// their language writes (`scripts/reslug/run.ts` says what it reads and
// writes). 0¢.
//
// # Usage
//
//   npm run reslug                      # prints the select to run through the connector
//   npm run reslug -- --rows rows.json  # prints the dry report and the updates
//
// # Why a loader
//
// This box's Node has no type stripping, so the repo's own Vite loads the
// TypeScript, as `scripts/retarget.mjs` does.
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const argv = process.argv.slice(2);
const at = argv.indexOf("--rows");
const file = at === -1 || at + 1 >= argv.length ? null : argv[at + 1];

async function main() {
  const rows = file === null ? null : JSON.parse(readFileSync(file, "utf8"));
  if (rows !== null && !Array.isArray(rows)) throw new Error("--rows is a JSON array of the rows the select returned.");
  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
  });
  try {
    const run = await server.ssrLoadModule("/scripts/reslug/run.ts");
    return run.main({ rows });
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
