#!/usr/bin/env node
// scripts/rescore.mjs — `npm run rescore`. Every stored scan and site rival
// set scored again by the current code, from what was stored (owner ruling
// 2026-10-14, issue 1426). `docs/RUNBOOK.md` says when it is run.
//
// # Usage
//
//   npm run rescore -- --from <export.json>                 # dry run: the before and after
//   npm run rescore -- --from <export.json> --apply         # also writes the statements
//   npm run rescore -- --from <part-1.json>,<part-2.json>   # an export taken in batches
//
// `<export.json>` is `scripts/rescore/export.sql`'s document. This box holds
// no production database key, so the export is read through the Supabase
// connector and `--apply` writes the change as SQL for the connector to run
// (`--out`, default `.review/rescore/apply.sql`). Nothing here reaches a
// vendor, a model or a site: the network is refused before a scan is read.
//
// # Why a loader
//
// This box's Node has no type stripping, so the repo's own Vite loads the
// TypeScript, as `scripts/page.mjs` does.
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf(name);
  return at === -1 || at + 1 >= argv.length ? fallback : argv[at + 1];
};

async function main() {
  const from = flag("--from", null);
  if (from === null) throw new Error("Usage: npm run rescore -- --from <export.json> [--apply] [--out <file.sql>]");
  const version = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();

  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
  });
  try {
    const run = await server.ssrLoadModule("/scripts/rescore/run.ts");
    return run.main({
      from: from.split(",").map((file) => path.resolve(file)),
      apply: argv.includes("--apply"),
      out: path.resolve(flag("--out", path.join(ROOT, ".review", "rescore", "apply.sql"))),
      version,
      at: new Date(),
    });
  } finally {
    await server.close();
  }
}

main().then(
  (code) => process.exit(code ?? 0),
  (error) => {
    console.error(String(error?.stack ?? error?.message ?? error));
    process.exit(1);
  }
);
