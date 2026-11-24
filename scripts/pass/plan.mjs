#!/usr/bin/env node
// `node scripts/pass/plan.mjs <plan-export document>`: a weekly pass's plan replayed at 0¢ (`plan-replay.ts`); it
// exits 0 only where the week dates every day. Node resolves no `@/` alias, so the repo's own Vite loads the replay.
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const file = process.argv[2];
if (file === undefined) {
  console.error("Usage: node scripts/pass/plan.mjs <file from scripts/pass/plan-export.sql>");
  process.exit(2);
}
const { createServer } = await import("vite");
const server = await createServer({
  configFile: false,
  root: ROOT,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false, watch: null },
  resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
});
try {
  const { main } = await server.ssrLoadModule("/scripts/pass/plan-replay.ts");
  process.exitCode = await main(path.resolve(file), ROOT);
} finally {
  await server.close();
}
