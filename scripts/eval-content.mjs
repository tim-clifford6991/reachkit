#!/usr/bin/env node
// scripts/eval-content.mjs — `npm run eval:content`. What is left of the
// content evaluation (#1132) since the pipeline became five stages (SPEC §7,
// D41): a page is tested with `npm run page` (D43), and this script keeps the
// tools that read stored text.
//
// # Usage
//
//   npm run eval:content -- --snapshot linear.app --from export.json
//                                                 # stores a domain's snapshot from a
//                                                 # connector export (snapshot.ts says how);
//                                                 # --as <name> stores a frozen copy
//   npm run eval:content -- --ab --regrade [--fetch | --run] [--round 1] [--cap-cents 50]
//                                                 # #1158: a stored round graded again —
//                                                 # code checks at 0¢; --fetch reads the
//                                                 # evidence (free); --run judges the pairs
//   npm run eval:content -- --rules [--baseline]  # issue 1187: each hard rule's false
//                                                 # positives on stored text; no model, 0¢
//   npm run eval:content -- --prose [--cached]    # issue 1390: the prose check's counts on
//                                                 # stored pages and on pages people wrote;
//                                                 # --cached reads no page again. 0¢
//   npm run eval:content -- --prose --write [--sites a,b] [--cap-cents 75]
//                                                 # one page a proof site through the write
//                                                 # call, the prose check and its fix call
//   npm run eval:content -- --prose --judge       # reachkit.app's stored pages against
//                                                 # pages written now from the same packs
//
// The runs that wrote pages through the retired pipeline — the set's own
// run, `--ab`, `--round2` and `--repair` — went with it (D41, D43: "Round
// 2's remaining pairs are skipped"). Their stored rounds stay under
// `scripts/eval-content/snapshot/` and `docs/walk/`.
//
// # The credential
//
// `src/lib/config/env.ts` parses the whole binding list the moment product
// code is imported, so the bindings are read from the environment or from
// `--env-file` (`.env.local` by default, gitignored). `--regrade --run`
// needs `ANTHROPIC_API_KEY` to be a real one. Nothing here logs a value.
//
// # Why a loader
//
// This box's Node has no type stripping, so the repo's own Vite loads the
// TypeScript.
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

const run = argv.includes("--run");
const snapshotOf = flag("--snapshot", null);
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
  if (snapshotOf === null && !argv.includes("--prose")) {
    if (!loadEnvFile(envFile) && process.env.SUPABASE_URL === undefined) {
      throw new Error(`No env file at ${envFile} and no bindings in this shell. Pass --env-file <path>, or export them.`);
    }
    if (run) assertCredential();
  }

  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: {
      alias: [
        { find: /^@\//, replacement: `${path.join(ROOT, "src")}/` },
      ],
    },
  });

  try {
    if (snapshotOf !== null) {
      const from = flag("--from", null);
      if (from === null) throw new Error("--snapshot needs --from <export.json>.");
      const snapshot = await server.ssrLoadModule("/scripts/eval-content/snapshot.ts");
      const taken = snapshot.takeSnapshot(snapshotOf, path.resolve(from), flag("--as", snapshotOf));
      console.log(`${snapshotOf}: scan ${taken.scan.id}, ${taken.pages.length} pages stored.`);
      return 0;
    }
    if (argv.includes("--ab") && argv.includes("--regrade")) {
      const round = await server.ssrLoadModule("/scripts/eval-content/round.ts");
      return await round.main({
        run,
        fetch: argv.includes("--fetch"),
        root: ROOT,
        round: Number(flag("--round", "1")),
        capCents: Number(flag("--cap-cents", "50")),
      });
    }
    if (argv.includes("--prose") && (argv.includes("--write") || argv.includes("--judge"))) {
      if (!loadEnvFile(envFile)) throw new Error(`No env file at ${envFile}. Pass --env-file <path to a .env.local that carries the model key>.`);
      assertCredential();
      const write = await server.ssrLoadModule("/scripts/eval-content/prose-write.ts");
      return await write.main({
        root: ROOT,
        sites: (flag("--sites", "") ?? "").split(",").filter(Boolean),
        capCents: Number(flag("--cap-cents", "75")),
        judge: argv.includes("--judge"),
      });
    }
    if (argv.includes("--prose")) {
      const prose = await server.ssrLoadModule("/scripts/eval-content/prose.ts");
      return await prose.main({ root: ROOT, tablePath: path.resolve(ROOT, "docs/walk/prose-gate.md"), fetch: !argv.includes("--cached") });
    }
    if (argv.includes("--rules")) {
      const rules = await server.ssrLoadModule("/scripts/eval-content/rules.ts");
      return await rules.main({
        root: ROOT,
        tablePath: path.resolve(ROOT, "docs/walk/rule-review.md"),
        baseline: argv.includes("--baseline"),
      });
    }
    throw new Error("Pass --rules, --prose, --ab --regrade, or --snapshot <domain> --from <export.json>. A page is tested with `npm run page`.");
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
