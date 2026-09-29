#!/usr/bin/env node
// scripts/eval-content.mjs — `npm run eval:content`. Issue #1132: today's
// generation pipeline, run over a fixed set of real sites and graded, so every
// change to generation is judged on the same pages. A tool, not a gate.
//
// # Usage
//
//   npm run eval:content                          # dry run: the topics, 0¢
//   npm run eval:content -- --run                 # writes and grades, then
//                                                 # rewrites docs/walk/content-eval.md
//   npm run eval:content -- --run --only linear.app,crisp.chat
//   npm run eval:content -- --snapshot linear.app --from export.json
//                                                 # stores a domain's snapshot from a
//                                                 # connector export (snapshot.ts says how)
//   npm run eval:content -- --run --env-file ../reachkitv3/.env.local
//   npm run eval:content -- --ab [--run]          # #1153: A beside the prototype B
//                                                 # and the reference C on reachkit.app
//
// The set, and the four slots the owner fills, are `scripts/eval-content/
// set.ts`. Each domain's stored report and page text are committed under
// `scripts/eval-content/snapshot/`, so the script reads no database and
// calls no vendor. The model is the only live call, and each page — draft and
// grade — spends inside `CAPS.DRAFT_C`. Nothing is published or written to a
// customer destination.
//
// # The credential
//
// `src/lib/config/env.ts` parses the whole binding list the moment the
// pipeline is imported, so the bindings are read from the environment or from
// `--env-file` (`.env.local` by default, gitignored). A live run needs
// `ANTHROPIC_API_KEY` to be a real one and refuses the `PENDING_…`
// placeholder. Nothing here logs or writes a value.
//
// # Why a loader
//
// As `scripts/live-drafts/run.mjs`: this box's Node has no type stripping, so
// the repo's own Vite loads the TypeScript, with one module aliased for the
// run only — `@/lib/measure/text`, so the pipeline reads the snapshot's pages.
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

const options = {
  run: argv.includes("--run"),
  only: (flag("--only", "") || "").split(",").filter(Boolean),
  outDir: path.resolve(ROOT, flag("--out", ".review/eval-content")),
  tablePath: path.resolve(ROOT, "docs/walk/content-eval.md"),
};
const snapshotOf = flag("--snapshot", null);
// #1153: today's pipeline beside the 2026-09-29 prototype, on reachkit.app.
const ab = argv.includes("--ab");
const envFile = path.resolve(ROOT, flag("--env-file", ".env.local"));

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

function assertCredential() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key === undefined || key === "") {
    throw new Error("ANTHROPIC_API_KEY is not set. Export it, or pass --env-file <path to a .env.local that carries it>.");
  }
  if (key.startsWith("PENDING")) {
    throw new Error("ANTHROPIC_API_KEY is still the PENDING_… placeholder; put the real key in the env file before --run.");
  }
}

async function main() {
  if (snapshotOf === null) {
    if (!loadEnvFile(envFile) && process.env.SUPABASE_URL === undefined) {
      throw new Error(`No env file at ${envFile} and no bindings in this shell. Pass --env-file <path>, or export them.`);
    }
    if (options.run) assertCredential();
  }

  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: {
      alias: [
        { find: "@/lib/measure/text", replacement: path.join(ROOT, "scripts/eval-content/measured-text.ts") },
        { find: /^@\//, replacement: `${path.join(ROOT, "src")}/` },
      ],
    },
  });

  try {
    if (snapshotOf !== null) {
      const from = flag("--from", null);
      if (from === null) throw new Error("--snapshot needs --from <export.json>.");
      const snapshot = await server.ssrLoadModule("/scripts/eval-content/snapshot.ts");
      const taken = snapshot.takeSnapshot(snapshotOf, path.resolve(from));
      console.log(`${snapshotOf}: scan ${taken.scan.id}, ${taken.pages.length} pages stored.`);
      return 0;
    }
    if (ab) {
      const run = await server.ssrLoadModule("/scripts/eval-content/prototype/ab.ts");
      return await run.main({ run: options.run, root: ROOT, priorCents: Number(flag("--prior-cents", "0")) });
    }
    const run = await server.ssrLoadModule("/scripts/eval-content/eval.ts");
    return await run.main(options);
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
