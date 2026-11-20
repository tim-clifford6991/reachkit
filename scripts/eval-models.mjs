#!/usr/bin/env node
// scripts/eval-models.mjs: the model evaluation's harness core. The product's own `llm()` runs with
// `@anthropic-ai/sdk` swapped, for files under `src/` only, for `scripts/eval-models/transport.ts`.
//
//   node scripts/eval-models.mjs --plan  --site opportunity-typing --tier haiku --model claude-haiku-5-5 --repeat 3
//   node scripts/eval-models.mjs --fake  --site opportunity-typing --tier haiku --cap-cents 10 --repeat 100
//   node scripts/eval-models.mjs --prove-isolation
//   node scripts/eval-models.mjs --report
//   node scripts/eval-models.mjs --live  ... (spends: the ledger refuses past min(--cap-cents, 5,900¢) and after the deadline)
//
// `--plan` prices every call and sends none. `--fake` books each call at its `max_tokens` in a separate ledger and
// sends none. Only `--live` reads the env file, and only `ANTHROPIC_API_KEY` from it; every other binding the product
// requires is a placeholder, so no DataForSEO, Supabase, Stripe or mail credential is in the process. Ledgers and
// cases live under /root/ops/reachkit/eval/, never inside the repository.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const EVAL_DIR = "/root/ops/reachkit/eval";
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf(name);
  return at === -1 || at + 1 >= argv.length ? fallback : argv[at + 1];
};
const MODES = ["live", "fake", "plan", "report", "prove-isolation"];

const PLACEHOLDERS = {
  SUPABASE_URL: "https://eval.invalid",
  SUPABASE_ANON_KEY: "PENDING_eval",
  SUPABASE_SERVICE_ROLE_KEY: "PENDING_eval",
  STRIPE_SECRET_KEY: "PENDING_eval",
  STRIPE_WEBHOOK_SECRET: "PENDING_eval",
  STRIPE_PRICE_ID: "PENDING_eval",
  RESEND_API_KEY: "PENDING_eval",
  MAIL_FROM: "eval@example.com",
  DATAFORSEO_LOGIN: "PENDING_eval",
  DATAFORSEO_PASSWORD: "PENDING_eval",
  ANTHROPIC_API_KEY: "PENDING_eval",
  IP_HASH_SALT: "PENDING_eval",
  KILL_SWITCH: "false",
  OWNER_EMAILS: "eval@example.com",
  NEXT_PUBLIC_APP_URL: "https://eval.invalid",
  HOSTED_EDGE_CNAME_TARGET: "eval.invalid",
};
const STRIPPED = /^(SUPABASE_|STRIPE_|RESEND_|DATAFORSEO_|ANTHROPIC_|NANO_|INNGEST_|VERCEL_|POSTHOG_|GOOGLE_|DATABASE_URL$)/;

/** The one key a live run needs, read from the env file without loading anything else in it. */
function anthropicKey(file) {
  if (!existsSync(file)) throw new Error(`No env file at ${file}.`);
  const line = readFileSync(file, "utf8").split("\n").find((l) => /^\s*ANTHROPIC_API_KEY\s*=/.test(l));
  const key = line?.replace(/^\s*ANTHROPIC_API_KEY\s*=\s*/, "").trim().replace(/^["']|["']$/g, "");
  if (!key || key.startsWith("PENDING")) throw new Error("ANTHROPIC_API_KEY is not set to a real key in the env file.");
  return key;
}

function insideRepo(file) {
  const rel = path.relative(ROOT, path.resolve(file));
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

async function main() {
  const modes = MODES.filter((m) => argv.includes(`--${m}`));
  if (modes.length !== 1) throw new Error(`Pass exactly one of ${MODES.map((m) => `--${m}`).join(", ")}.`);
  const mode = modes[0];
  const ledgerFile = path.resolve(flag("--ledger", path.join(EVAL_DIR, mode === "fake" ? "fake-ledger.jsonl" : "ledger.jsonl")));
  if (insideRepo(ledgerFile)) throw new Error("The ledger lives outside the repository (it is public).");
  if (mode === "live" && path.basename(ledgerFile) !== "ledger.jsonl") throw new Error("A live run books into the one ledger.jsonl.");

  for (const name of Object.keys(process.env)) if (STRIPPED.test(name)) delete process.env[name];
  Object.assign(process.env, PLACEHOLDERS);
  if (mode === "live") process.env.ANTHROPIC_API_KEY = anthropicKey(path.resolve(ROOT, flag("--env-file", ".env.local")));
  process.env.NANO_API_KEY = process.env.ANTHROPIC_API_KEY;

  const transport = path.join(ROOT, "scripts/eval-models/transport.ts");
  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
    // Bundled rather than left to Node, so the plugin below sees `src/`'s import of it.
    ssr: { noExternal: ["@anthropic-ai/sdk"] },
    plugins: [
      {
        name: "eval-models-transport",
        enforce: "pre",
        resolveId: (source, importer) =>
          source === "@anthropic-ai/sdk" && importer?.startsWith(path.join(ROOT, "src") + path.sep) ? transport : null,
      },
    ],
  });
  try {
    const run = await server.ssrLoadModule("/scripts/eval-models/run.ts");
    return await run.main({
      mode,
      ledgerFile,
      capCents: Number(flag("--cap-cents", "5900")),
      site: flag("--site", "opportunity-typing"),
      tier: flag("--tier", "haiku"),
      model: flag("--model", null),
      repeat: Number(flag("--repeat", "1")),
    });
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
