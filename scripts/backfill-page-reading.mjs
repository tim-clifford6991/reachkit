#!/usr/bin/env node
// scripts/backfill-page-reading.mjs — fills each live page's search reading
// from the scans already stored (`scripts/backfill-page-reading/run.ts`
// says what it reads and prints). 0¢: no vendor, no model, no database key.
//
// # Usage
//
//   node scripts/backfill-page-reading.mjs                                    # prints the two selects
//   node scripts/backfill-page-reading.mjs --pages pages.json --scans scans.json  # prints the updates
//
// This box's Node has no type stripping, so the repo's own Vite loads the
// TypeScript, as `scripts/reslug.mjs` does.
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const argv = process.argv.slice(2);

function rowsOf(flag) {
  const at = argv.indexOf(flag);
  if (at === -1 || at + 1 >= argv.length) return null;
  const rows = JSON.parse(readFileSync(argv[at + 1], "utf8"));
  if (!Array.isArray(rows)) throw new Error(`${flag} is a JSON array of the rows the select returned.`);
  return rows;
}

async function main() {
  const pages = rowsOf("--pages");
  const scans = rowsOf("--scans");
  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
  });
  try {
    const run = await server.ssrLoadModule("/scripts/backfill-page-reading/run.ts");
    return run.main({ pages, scans });
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
