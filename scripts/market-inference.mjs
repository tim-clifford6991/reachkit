#!/usr/bin/env node
// scripts/market-inference.mjs — the offline dogfood test of #1185.
//
//   node scripts/market-inference.mjs                 # dry run: the evidence, 0¢
//   node scripts/market-inference.mjs --run           # infers, then rewrites
//                                                     # docs/walk/market-inference.md
//   node scripts/market-inference.mjs --run --env-file ../reachkitv3/.env.local
//   node scripts/market-inference.mjs --run --only reachkit.app   # prints, writes nothing
//
// Reads the committed snapshots of `scripts/eval-content/snapshot/`, so it
// reads no database and calls no vendor; the model is the only live call,
// under a 50¢ run ceiling. As `scripts/eval-content.mjs`, the repo's own Vite
// loads the TypeScript, because this box's Node has no type stripping.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const argv = process.argv.slice(2);
const at = argv.indexOf("--env-file");
const envFile = path.resolve(ROOT, at === -1 ? ".env.local" : argv[at + 1]);
const run = argv.includes("--run");
const onlyAt = argv.indexOf("--only");
const only = onlyAt === -1 ? [] : argv[onlyAt + 1].split(",");

if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match !== null && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}
if (run && (process.env.ANTHROPIC_API_KEY ?? "PENDING").startsWith("PENDING")) {
  console.error("ANTHROPIC_API_KEY is not a real key. Pass --env-file <a .env.local that carries it>.");
  process.exit(1);
}

const server = await createServer({
  configFile: false,
  root: ROOT,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false, watch: null },
  resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
});
try {
  const mod = await server.ssrLoadModule("/scripts/market-inference/run.ts");
  process.exitCode = await mod.main({ root: ROOT, run, only });
} catch (error) {
  console.error(String(error?.stack ?? error));
  process.exitCode = 1;
} finally {
  await server.close();
}
