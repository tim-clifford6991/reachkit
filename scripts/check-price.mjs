#!/usr/bin/env node
// npm's `prebuild`: the production build refuses a crossed Stripe price, and boot makes no Stripe call
// (`docs/spec/decisions/2026-11-07-2485.md`). It runs in Vercel's build only, the one build that has a deployment's
// bindings; anywhere else it says it skipped. It prints closed names and the mismatch message, never a binding's
// value or a vendor payload. Node strips types but resolves no `@/` alias, so the repo's own Vite loads the check.
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** One line for the build log, and the exit code the build obeys: only `refused` fails it. */
export function report(result) {
  const line = JSON.stringify({
    event: "price_check",
    outcome: result.outcome,
    ...(result.reason === undefined ? {} : { reason: result.reason }),
  });
  if (result.outcome === "checked" || result.outcome === "skipped") {
    console.log(line);
    return 0;
  }
  console.error(line);
  if (result.outcome === "unchecked") return 0;
  if (result.message !== undefined) console.error(result.message);
  return 1;
}

async function check() {
  const { createServer } = await import("vite");
  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
  });
  try {
    const { checkPriceForBuild } = await server.ssrLoadModule("/src/lib/account/checkout/build-check.ts");
    return await checkPriceForBuild();
  } finally {
    await server.close();
  }
}

async function main() {
  if (process.env.VERCEL === undefined) return report({ outcome: "skipped", reason: "not-vercel" });
  try {
    return report(await check());
  } catch (error) {
    // A check that could not load is this repository's fault, not the vendor's: the build stops rather than ship unchecked.
    return report({ outcome: "refused", reason: "check-not-loaded", message: error instanceof Error ? error.name : "unknown" });
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
