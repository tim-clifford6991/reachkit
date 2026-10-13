#!/usr/bin/env node
// scripts/costs.mjs — `npm run costs`. SPEC §6 (owner, 2026-10-11, issue
// 1408; D57, issue 1286).
//
//   npm run costs                         # today and the last 7 days
//   npm run costs -- --stored             # no fresh vendor reading first
//   npm run costs -- --ledger <file>      # production spend from a file
//   npm run costs -- --env-file <file> --log <file> --snapshots <file>
//
// Billed (what the vendors say, `scripts/vendor-snapshot.mjs`) beside
// recorded (the production `fetches` ledger and the box's test spend log),
// for today and each of the last 7 days, and the day judged against D34's
// €2. `scripts/costs/report.ts` does the sums and says what is printed.
//
// It first takes one fresh reading of the vendors, which costs nothing, so
// today's billed figure is not up to an hour old. It spends nothing.
//
// Production spend is read from the database when the env file holds a real
// `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Where it does not,
// `--ledger <file>` takes the rows as JSON instead; `docs/RUNBOOK.md` §8 has
// the query that makes the file.
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";
import { readSpend, spendLogPath } from "./spend-log.mjs";
import { appendSnapshot, DEFAULT_ENV_FILE, readKeys, readSnapshots, snapshotPath, takeSnapshot } from "./vendor-snapshot.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf(name);
  return at === -1 || at + 1 >= argv.length ? fallback : argv[at + 1];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE = 1000;

const number = (value) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value));

/** `--ledger`: a JSON array of `{ day, source, cost_cents, billed_cents }`. */
function ledgerFromFile(file) {
  return JSON.parse(readFileSync(file, "utf8")).map((row) => ({
    day: String(row.day).slice(0, 10),
    source: String(row.source),
    cents: number(row.cost_cents ?? row.cents) ?? 0,
    billed: number(row.billed_cents ?? row.billed),
  }));
}

/** The paid `fetches` rows of the eight days, read as the service role. */
async function ledgerFromDatabase(keys, now) {
  const since = new Date(Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`) - 7 * DAY_MS).toISOString();
  const read = async (withBilled) => {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const url = new URL(`${keys.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/fetches`);
      url.searchParams.set("select", withBilled ? "source,cost_cents,billed_cents,created_at" : "source,cost_cents,created_at");
      url.searchParams.set("created_at", `gte.${since}`);
      if (withBilled) url.searchParams.set("or", "(cost_cents.gt.0,billed_cents.gt.0)");
      else url.searchParams.set("cost_cents", "gt.0");
      url.searchParams.set("order", "created_at.asc,id.asc");
      const response = await fetch(url, {
        headers: { apikey: keys.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${keys.SUPABASE_SERVICE_ROLE_KEY}`, Range: `${from}-${from + PAGE - 1}` },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
      const page = await response.json();
      rows.push(...page);
      if (page.length < PAGE) return rows;
    }
  };
  let rows;
  try {
    rows = await read(true);
  } catch (error) {
    // The migration that adds `billed_cents` may not be applied yet.
    if (!String(error?.message).includes("billed_cents")) throw error;
    rows = await read(false);
  }
  return rows.map((row) => ({ day: new Date(row.created_at).toISOString().slice(0, 10), source: String(row.source), cents: number(row.cost_cents) ?? 0, billed: number(row.billed_cents) }));
}

async function main() {
  const now = new Date();
  const keys = readKeys(path.resolve(flag("--env-file", DEFAULT_ENV_FILE)));
  const snapshotFile = flag("--snapshots", snapshotPath());
  const snapshots = readSnapshots(snapshotFile);
  if (!argv.includes("--stored")) {
    const { row, problems } = await takeSnapshot(keys, now);
    for (const problem of problems) console.error(`costs: ${problem}`);
    if (row.dataforseo !== undefined || row.anthropic !== undefined) {
      appendSnapshot(row, snapshotFile);
      snapshots.push(row);
    }
  }

  let ledger = null;
  const ledgerFile = flag("--ledger", null);
  try {
    if (ledgerFile !== null) ledger = ledgerFromFile(ledgerFile);
    else if (keys.SUPABASE_URL !== undefined && keys.SUPABASE_SERVICE_ROLE_KEY !== undefined) ledger = await ledgerFromDatabase(keys, now);
  } catch (error) {
    console.error(`costs: the production ledger could not be read: ${String(error?.message ?? error)}`);
  }

  const spendFile = flag("--log", spendLogPath());
  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
  });
  try {
    const { reconcile, render } = await server.ssrLoadModule("/scripts/costs/report.ts");
    const spend = readSpend(spendFile);
    console.log(`${spendFile}: ${spend.length} paid calls recorded; ${snapshotFile}: ${snapshots.length} vendor readings\n`);
    console.log(render(reconcile({ spend, ledger, snapshots, adminKey: keys.ANTHROPIC_ADMIN_KEY !== undefined, now })));
  } finally {
    await server.close();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(String(error?.stack ?? error?.message ?? error));
    process.exit(1);
  }
);
