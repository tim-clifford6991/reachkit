#!/usr/bin/env node
// scripts/voice-reset.mjs — clears each stored voice that describes a failed
// read (`scripts/voice-reset/run.ts` says what it reads and prints). 0¢: no
// vendor, no model, no database key.
//
// # Usage
//
//   node scripts/voice-reset.mjs                                              # prints the two selects
//   node scripts/voice-reset.mjs --profiles profiles.json --sites sites.json  # prints the count and the updates
//
// This box's Node has no type stripping, so the repo's own Vite loads the
// TypeScript, as `scripts/backfill-page-reading.mjs` does.
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
  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
  });
  try {
    const run = await server.ssrLoadModule("/scripts/voice-reset/run.ts");
    return run.main({ profiles: rowsOf("--profiles"), sites: rowsOf("--sites") });
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
