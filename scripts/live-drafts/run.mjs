#!/usr/bin/env node
// scripts/live-drafts/run.mjs — `npm run proof:live-drafts`.
//
// Issue #321, owner ruling 2026-09-22: three real drafts by the live model
// for the fixture business, every hard rule checked, spend capped at €1.35,
// nothing published. `./proof.ts` is the run; this file only starts it.
//
// # Usage
//
//   npm run proof:live-drafts                    # dry run: the arithmetic, 0c
//   npm run proof:live-drafts -- --run           # spends, cap 135c
//   npm run proof:live-drafts -- --run --max-spend 60
//   npm run proof:live-drafts -- --run --env-file ../reachkitv3/.env.local
//   npm run proof:live-drafts -- --run --regenerate 2   # the second attempt
//
// `--max-spend` is in the ledger's own cent, the unit `CAPS` and the price
// book are written in. The default, 135, is the owner's €1.35: the model is
// billed in US cents and a euro buys more than a dollar, so a run inside 135
// of them is inside €1.35 as well.
//
// # The credential
//
// The whole of `src/lib/config/env.ts`'s binding list is read from the
// environment, or from the `--env-file` (`.env.local` by default, which is
// gitignored) — a dry run needs them to parse, a live run needs
// `ANTHROPIC_API_KEY` to be a real one. It is put into
// `process.env` for `src/lib/config/env.ts` to parse and is never logged,
// never written to the output folder and never committed. A run started
// against the `PENDING_…` placeholder is refused rather than sent.
//
// # Why a loader
//
// The harness is TypeScript, because it is handed the product's own types
// and a shape that drifts must fail to compile rather than fail mid-run.
// This box's Node is built without type stripping, so the repo's own Vite —
// the same resolver `vitest.config.ts` uses, with the same `@` alias — loads
// it. Two modules are aliased for the run and only for the run:
// `@/lib/measure/text`, so the grounding read and the near-duplicate sets
// come from the fixture instead of Postgres. Nothing under `src/` is
// changed, patched or re-implemented.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf(name);
  return at === -1 || at + 1 >= argv.length ? fallback : argv[at + 1];
};

const options = {
  run: argv.includes("--run"),
  runCapCents: Number(flag("--max-spend", "135")) || 135,
  outDir: path.resolve(ROOT, flag("--out", ".review/321")),
  // The pipeline's own automatic regeneration, spent on one earlier draft
  // (owner ruling 2026-09-23): the draft number of a run already in --out.
  regenerate: argv.includes("--regenerate") ? Number(flag("--regenerate", "")) || null : null,
};
const envFile = path.resolve(ROOT, flag("--env-file", ".env.local"));

/** Reads `KEY=value` lines into `process.env` without overwriting anything
 *  the shell already set. Values are never printed — only the names of the
 *  bindings that were missing, and only when the file cannot supply them. */
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
    throw new Error(
      `ANTHROPIC_API_KEY is not set. Export it, or pass --env-file <path to a .env.local that carries it>.`
    );
  }
  if (key.startsWith("PENDING")) {
    throw new Error(
      "ANTHROPIC_API_KEY is still the PENDING_… placeholder. The real key is a Secret on the Vercel " +
        "project; put it in .env.local or export it into this shell before --run."
    );
  }
}

async function main() {
  // Both modes need the bindings: `src/lib/config/env.ts` parses them the
  // moment the pipeline is imported, and a dry run imports the pipeline in
  // order to read the caps and the rule list off it. Only a live run needs
  // the credential to be a real one.
  if (!loadEnvFile(envFile) && process.env.SUPABASE_URL === undefined) {
    throw new Error(
      `No env file at ${envFile} and no bindings in this shell. Pass --env-file <path>, or export them.`
    );
  }
  if (options.run) assertCredential();

  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: {
      alias: [
        // The one seam the run replaces. Listed before the `@` prefix so it
        // wins: Vite takes the first alias that matches.
        {
          find: "@/lib/measure/text",
          replacement: path.join(ROOT, "scripts/live-drafts/measured-text.ts"),
        },
        { find: /^@\//, replacement: `${path.join(ROOT, "src")}/` },
      ],
    },
  });

  try {
    const proof = await server.ssrLoadModule("/scripts/live-drafts/proof.ts");
    return await proof.main(options);
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
