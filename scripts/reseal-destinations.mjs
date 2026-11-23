#!/usr/bin/env node
// scripts/reseal-destinations.mjs — after a root rotation (docs/RUNBOOK.md › Rotating the root secret), re-seals every
// stored destination credential under the current root, so the previous root can be dropped. 0¢. It prints counts
// only, never a credential or a key.
//
// # Usage (the owner's shell, with the target's bindings, both roots set)
//
//   node --env-file=<file> scripts/reseal-destinations.mjs           # dry run: counts, writes nothing
//   node --env-file=<file> scripts/reseal-destinations.mjs --write   # re-seals, each row guarded on the value read
//
// This box's Node has no type stripping, so the repo's own Vite loads the TypeScript, as `scripts/reslug.mjs` does.
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const write = process.argv.includes("--write");
const PAGE = 500;

async function main() {
  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
  });
  try {
    const { open } = await server.ssrLoadModule("/src/lib/publish/destinations/config/seal.ts");
    const { publishDb } = await server.ssrLoadModule("/src/lib/publish/db.ts");
    const counts = { current: 0, previous: 0, unopenable: 0, resealed: 0, skipped: 0 };
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await publishDb()
        .from("destinations")
        .select("id, config")
        .not("config", "is", null)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error !== null) throw new Error(`could not read destinations: ${error.message}`);
      for (const row of data) {
        let resealed;
        try {
          resealed = open(row.config).resealed;
        } catch {
          counts.unopenable += 1;
          continue;
        }
        if (resealed === null) {
          counts.current += 1;
          continue;
        }
        counts.previous += 1;
        if (!write) continue;
        // Only over the value just read: a credential reconnected or re-sealed meanwhile is left alone.
        const done = await publishDb()
          .from("destinations")
          .update({ config: resealed })
          .eq("id", row.id)
          .eq("config", JSON.stringify(row.config))
          .select("id");
        if (done.error !== null) throw new Error(`could not re-seal destination ${row.id}: ${done.error.message}`);
        counts[done.data.length === 1 ? "resealed" : "skipped"] += 1;
      }
      if (data.length < PAGE) break;
    }
    console.log(JSON.stringify({ mode: write ? "write" : "dry-run", ...counts }));
    return counts.unopenable === 0 ? 0 : 2;
  } finally {
    await server.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(String(error?.message ?? error));
    process.exit(1);
  }
);
