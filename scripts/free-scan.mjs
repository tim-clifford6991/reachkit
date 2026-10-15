#!/usr/bin/env node
// scripts/free-scan.mjs — `npm run free-scan` (issue 1438; owner, 2026-10-15:
// "for cafes and plumbers, run locally for testing"). The free scan a
// stranger runs from the landing page, run off production on sites named
// here, and what each one got written down.
//
// # Usage
//
//   npm run free-scan -- --env-file ../../reachkitv3/.env.local --sites laynescafe.co.uk,flintplumb.com
//   npm run free-scan -- --env-file ../../reachkitv3/.env.local --sites a.com --cap-cents 40
//   npm run free-scan -- --recheck --date 2026-10-15     # score a stored run again: 0¢, no database
//   npm run free-scan -- --env-file ../../reachkitv3/.env.local --sites a.com --keep   # leave the local database up
//
// It runs live, up to `--cap-cents` (default 100) for the whole run, and
// writes each paid call to the box's spend log (D57). A site is started only
// while the cap still holds a whole free scan's cap (`CAPS.FREE_C`). It
// writes the run to `docs/walk/free/<date>.json` and `<date>.md`; a second
// run on the same date adds its sites to that date's files.
//
// `--recheck` scores that date's stored scans again with the current code,
// through the production re-score's own path (`rescoreRow`, issue 1433), and
// writes `<date>.recheck.md`: the before and after a scoring change makes.
//
// # What it runs against
//
// The repository's own local database (`scripts/db-substrate/`), rebuilt
// from `supabase/migrations`, as `npm run panel` does (`scripts/local-run.mjs`).
// Of the env file it takes the two vendors' keys and nothing else: nothing
// is written to production. One database per worktree: do not run it beside
// `npm run panel`, `vitest --project db` or the layout sweep.
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
  const recheck = argv.includes("--recheck");
  if (!recheck && sites.length === 0) throw new Error("--sites takes the domains to scan, comma-separated.");

  const options = { root: ROOT, sites, capCents, date, recheck };
  bindings(recheck ? null : path.resolve(ROOT, flag("--env-file", ".env.local")));
  if (!recheck) substrateUp(ROOT);

  const { module: run, close } = await loadTs(ROOT, "/scripts/free-scan/run.ts");
  try {
    return recheck ? run.recheck(options) : await run.main(options);
  } finally {
    await close();
    if (!recheck && !argv.includes("--keep")) substrateDown(ROOT);
  }
}

main().then(
  (code) => process.exit(code ?? 0),
  (error) => {
    console.error(String(error?.stack ?? error?.message ?? error));
    process.exit(1);
  }
);
