// scripts/local-run.mjs — what `npm run panel` and `npm run free-scan` share:
// a process that runs the product's own code live against the vendors, on
// the repository's own local database (`scripts/db-substrate/`), rebuilt from
// `supabase/migrations`, holding no production key.
//
// Of an env file it takes the vendors' keys and nothing else. Every other
// binding the product's `env` asks for is a value that reaches nothing, and
// a binding the shell may hold that would let the run reach a service is
// removed.
//
// Plain JavaScript, because the `.mjs` launchers run on this box's Node,
// which has no type stripping; the Vite-loaded TypeScript imports it too.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

export const VENDOR_KEYS = ["ANTHROPIC_API_KEY", "DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"];

/** The vendors' keys out of an env file, and no other line of it. */
export function vendorKeys(file) {
  if (!existsSync(file)) throw new Error(`No env file at ${file}. The run is live and needs the vendor keys: pass --env-file <path>.`);
  const keys = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match !== null && VENDOR_KEYS.includes(match[1])) keys[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  for (const key of VENDOR_KEYS) {
    if (keys[key] === undefined || keys[key] === "" || keys[key].startsWith("PENDING")) throw new Error(`${key} is not set to a real key in ${file}.`);
  }
  return keys;
}

/** Every other binding the product's `env` asks of a process, as a value
 *  that reaches nothing. */
export const NO_KEYS = {
  STRIPE_SECRET_KEY: "panel",
  STRIPE_WEBHOOK_SECRET: "panel",
  STRIPE_PRICE_ID: "panel",
  RESEND_API_KEY: "panel",
  MAIL_FROM: "panel@example.com",
  IP_HASH_SALT: "panel",
  OWNER_EMAILS: "panel@example.com",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1",
  HOSTED_EDGE_CNAME_TARGET: "panel.example.com",
  KILL_SWITCH: "false",
};
/** Bindings a shell may hold that would let the run reach a service. */
export const NEVER = ["POSTHOG_API_KEY", "POSTHOG_HOST", "INNGEST_SIGNING_KEY", "INNGEST_EVENT_KEY", "VERCEL_API_TOKEN", "NANO_API_KEY"];

/** A recheck reads a stored run: it holds no key and names no database. */
export const NOTHING = { ANTHROPIC_API_KEY: "panel", DATAFORSEO_LOGIN: "panel", DATAFORSEO_PASSWORD: "panel", SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_ANON_KEY: "panel", SUPABASE_SERVICE_ROLE_KEY: "panel" };

/** The process's bindings: the vendors' keys (or none, for a recheck), the
 *  bindings that reach nothing, and none that reach a service. */
export function bindings(envFile) {
  Object.assign(process.env, NO_KEYS, envFile === null ? NOTHING : vendorKeys(envFile));
  for (const key of NEVER) delete process.env[key];
}

export function substrateUp(root) {
  const out = execFileSync("bash", [path.join(root, "scripts/db-substrate/up.sh"), "--run"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  // The local database's bindings come last, over anything the shell held.
  for (const line of out.split("\n")) {
    const match = /^export ([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match !== null) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? "")) {
    throw new Error("scripts/db-substrate/up.sh did not name a local database; nothing was run.");
  }
}

export function substrateDown(root) {
  try {
    execFileSync("bash", [path.join(root, "scripts/db-substrate/down.sh")], { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
  } catch {
    console.error("The local database could not be stopped: run scripts/db-substrate/down.sh.");
  }
}

/** A TypeScript module of the repository, loaded through its Vite with the
 *  `@/` alias, and the server to close after. */
export async function loadTs(root, file) {
  const { createServer } = await import("vite");
  const server = await createServer({
    configFile: false,
    root,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(root, "src")}/` }] },
  });
  return { module: await server.ssrLoadModule(file), close: () => server.close() };
}

// ── The local database ─────────────────────────────────────────────────────

/** SQL run on the local database, and refused on any other. */
export function psql(sql) {
  const url = process.env.DATABASE_URL;
  if (url === undefined || !/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    throw new Error("DATABASE_URL does not name the local database; nothing was run.");
  }
  return execFileSync("psql", [url, "-q", "-v", "ON_ERROR_STOP=1", "-At", "-f", "-"], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, PGOPTIONS: "-c client_min_messages=warning" },
  });
}

/** The local database emptied and migrated from `supabase/migrations`. */
export function rebuild(root) {
  psql("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
  const dir = path.join(root, "supabase/migrations");
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) psql(readFileSync(path.join(dir, file), "utf8"));
  psql("notify pgrst, 'reload schema';");
}

export async function waitForSchema() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const url = `${process.env.SUPABASE_URL}/rest/v1/scans?select=health&limit=1`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    const ok = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } }).then((r) => r.ok, () => false);
    if (ok) return;
    if (Date.now() > deadline) throw new Error("The local database never served the migrated schema.");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/** The run's commit, short. */
export function commitOf(root) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}
