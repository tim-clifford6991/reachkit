#!/usr/bin/env node
// scripts/retarget.mjs — `npm run retarget`. SPEC §7 (owner, D53, issue 1268):
// one of ReachKit's own live pages becomes an update topic with a new target.
//
// # Usage
//
//   npm run retarget -- --url https://content.reachkit.app/<slug> --target "best ai visibility tools for small businesses"
//   npm run retarget -- --url <live address> --target "<search>" --volume 1600
//
// It prints one SQL statement and writes nothing: this box's database key is
// a placeholder, so the statement is run through the Supabase connector
// (`scripts/retarget/run.ts` says what it adds). `--volume` is the search's
// measured monthly searches; without it the row says they were not measured.
//
// # Why a loader
//
// This box's Node has no type stripping, so the repo's own Vite loads the
// TypeScript, as `scripts/page.mjs` does.
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
  const url = flag("--url", null);
  const target = flag("--target", null);
  const volume = flag("--volume", null);
  if (url === null || target === null || target.trim() === "" || !/^https:\/\/[^/]+\/.+/.test(url)) {
    throw new Error('Usage: npm run retarget -- --url <https://live-address> --target "<search>" [--volume <monthly searches>]');
  }
  if (volume !== null && !/^\d+$/.test(volume)) throw new Error("--volume is a whole number of monthly searches.");

  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
  });
  try {
    const run = await server.ssrLoadModule("/scripts/retarget/run.ts");
    return run.main({ url, target, volume: volume === null ? null : Number(volume), at: new Date() });
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
