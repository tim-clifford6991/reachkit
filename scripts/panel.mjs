#!/usr/bin/env node
// scripts/panel.mjs — `npm run panel`. SPEC §0 (owner, 2026-10-07, issue
// 1304): the customer panel, a fixed set of varied real businesses run
// through a paying site's first pass. Every change to market understanding,
// the knowledge base, rivals, terms, measured searches or topics passes it,
// not only reachkit.app, before the owner is asked to measure.
//
// # Usage
//
//   npm run panel -- --env-file ../../reachkitv3/.env.local
//   npm run panel -- --env-file ../../reachkitv3/.env.local --sites zunicafe.com,savvycal.com
//   npm run panel -- --env-file ../../reachkitv3/.env.local --cap-cents 60
//   npm run panel -- --env-file ../../reachkitv3/.env.local --continue --cap-cents 300   # run the sites today's run did not reach
//   npm run panel -- --recheck --date 2026-10-07                       # judge a stored run again: 0¢, no database
//   npm run panel -- --env-file ../../reachkitv3/.env.local --keep     # leave the local database up
//
// It runs live, up to `--cap-cents` (default 100) for the whole panel, and
// writes each paid call to the box's spend log (D57). It prints each site's
// checks as pass, FAIL or review, and writes the run to
// `docs/walk/panel/<date>.json` and `<date>.md`. It exits 0 only when every
// site ran and no check failed. `--continue` keeps the sites that date's
// run already holds and counts their spend against the cap.
//
// # What it runs against
//
// The repository's own local database (`scripts/db-substrate/`), rebuilt
// from `supabase/migrations`. Of the env file it takes the two vendors' keys
// and nothing else, so the run holds no production key: nothing is written
// to production. `scripts/panel/run.ts` says what is run and what is kept.
//
// One database per worktree: a run rebuilds it, so do not run one beside
// `vitest --project db`, the layout sweep or `npm run pass` in the same
// worktree.
import path from "node:path";
import process from "node:process";
import { bindings, loadTs, substrateDown, substrateUp } from "./local-run.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf(name);
  return at === -1 || at + 1 >= argv.length ? fallback : argv[at + 1];
};

async function main() {
  const capCents = Number(flag("--cap-cents", "100"));
  if (!(capCents > 0)) throw new Error("--cap-cents takes a number of cents above 0.");
  const date = flag("--date", new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("--date takes YYYY-MM-DD.");
  const sites = (flag("--sites", "") ?? "").split(",").map((site) => site.trim()).filter(Boolean);

  const options = { root: ROOT, sites, capCents, date, resume: argv.includes("--continue"), recheck: argv.includes("--recheck") };

  bindings(options.recheck ? null : path.resolve(ROOT, flag("--env-file", ".env.local")));
  if (!options.recheck) substrateUp(ROOT);

  const { module: run, close } = await loadTs(ROOT, "/scripts/panel/run.ts");
  try {
    return options.recheck ? run.recheck(options) : await run.main(options);
  } finally {
    await close();
    if (!options.recheck && !argv.includes("--keep")) substrateDown(ROOT);
  }
}

main().then(
  (code) => process.exit(code ?? 0),
  (error) => {
    console.error(String(error?.stack ?? error?.message ?? error));
    process.exit(1);
  }
);
