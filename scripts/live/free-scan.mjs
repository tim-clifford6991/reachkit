// scripts/live/free-scan.mjs — one free scan against a live deployment,
// measured the way §16 milestone 3 states it: "Real domain → real report
// <60s, ≤12¢ ledgered".
//
// `free-scan.sh` is the entry point; this file is the run. It is kept out
// of `src/` on purpose — nothing the product serves imports it, and it
// holds no engine logic (ARCHITECTURE rule 1): it starts a scan the way a
// visitor starts one, waits for the row the pass writes, and reads the
// ledger back.
//
// **What is measured, and why that is the number.** REQ-003 criterion 2
// measures "the time from each scan's start to a readable report". A
// visitor's scan starts at `POST /api/scan` — the canonicaliser and
// starter — and ends when the pass leaves `running`, which is the moment
// `GET /scan/{domain}` has a report to serve (criterion 3: "the report
// replaces the progress view"). So the clock starts one line before the
// POST and stops on the first non-`running` read of the row. The stage
// stream (`GET /api/scan/{scanId}/progress`) is *not* what is timed: it is
// an in-process bus, so on a serverless deployment it is served by
// whichever instance the connection lands on, and a stream that never
// arrives would be measured as a slow scan rather than reported as what it
// is. The row is the ground truth; it is written by the pass itself.
//
// The scan's own `finished_at - created_at` is printed beside the
// wall-clock figure. It is the shorter of the two — the row is claimed
// after the request is parsed and admitted — and the difference is what
// the deployment's own overhead costs a visitor.
//
// **The two ledgers, and which one is the answer.** BUILD §6.5: "one
// `fetches` table is ledger + cache + raw store", and `withCostContext`
// rolls the pass up into `scans.cost_cents` at close. The roll-up is the
// figure the cap was actually enforced against, so it is the one printed
// as *ledgered*. The row-by-row sum over `fetches` is printed beside it as
// a floor, never as the answer: `fetches.cost_cents` is an `integer`
// column and the price book carries sub-cent prices (`SERP_STD_C` is
// 0.06¢), so twelve standard SERPs round to 0¢ on the way in — the defect
// `src/lib/costs/daily.ts` already names. `scans.cost_cents` is an
// `integer` too, so it carries the exact figure rounded once rather than
// once per row.
//
// **The seven-day window (§6.4) is the trap this script refuses to walk
// into.** A free scan of a domain this deployment measured inside
// `FREE_RESCAN_WINDOW_D` days serves the stored report, spends nothing and
// closes in milliseconds. That is correct behaviour and a worthless
// measurement, so it is reported as *no measurement* (exit 2) rather than
// as a very fast, very cheap scan.
//
// **Nothing here is pinned locally.** The target and the cap are read out
// of `src/lib/config/constants.ts` at run time, so this script cannot
// drift from the product it is checking (ARCHITECTURE rule 5).
// `tests/scan/live/free-scan-script.test.ts` is what holds that reading
// honest.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONSTANTS = path.join(HERE, "..", "..", "src", "lib", "config", "constants.ts");

/** How often the scan row is read while the pass runs. Half a second is
 *  well under the resolution anything here reports and costs the
 *  deployment one indexed primary-key read. */
const POLL_MS = 500;

/** How long to keep reading past the product's own ceiling before calling
 *  it a hang. The ceiling is the promise; this is the margin that tells a
 *  scan which overran it apart from a scan nobody is going to finish. */
const CEILING_GRACE_S = 30;

/** Exit codes. `OVER` is a real measurement that missed a bound — the
 *  finding milestone 3 acts on — and is deliberately distinct from
 *  `NO_MEASUREMENT`, which means the run produced no number at all. */
export const EXIT = Object.freeze({ WITHIN: 0, OVER: 1, NO_MEASUREMENT: 2 });

/**
 * One pinned number, read out of `constants.ts` by name.
 *
 * The alternative — importing the module — needs a TypeScript loader this
 * repository does not carry as a dependency, and inlining the number is
 * exactly the drift ARCHITECTURE rule 5 exists to stop. So the file is
 * read as text and the name must resolve exactly once: a constant that is
 * renamed, moved or duplicated stops this script rather than quietly
 * measuring against a number nobody pinned.
 */
export function pin(name, source = readFileSync(CONSTANTS, "utf8")) {
  const matches = [...source.matchAll(new RegExp(`\\b${name}\\s*[:=]\\s*(\\d+(?:\\.\\d+)?)`, "g"))];
  if (matches.length !== 1) {
    throw new Error(
      `scripts/live/free-scan.mjs: expected exactly one \`${name}\` in src/lib/config/constants.ts, found ${matches.length}.`
    );
  }
  return Number(matches[0][1]);
}

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`free-scan needs ${name}. See docs/DEPLOYMENT.md §2 for where it lives.`);
  }
  return value;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** PostgREST, with the service role's two headers. `fetches` is
 *  `dbAdmin()`-only (BUILD §10 default-deny, no policy grants any
 *  request-scoped read), so nothing less than the service role can see the
 *  ledger at all. */
async function rest(base, key, query) {
  const response = await fetch(new URL(`/rest/v1/${query}`, base), {
    headers: { apikey: key, authorization: `Bearer ${key}`, accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`free-scan: ${query} returned ${response.status} ${await response.text()}`);
  }
  return response.json();
}

const SCAN_COLUMNS = "id,domain,tier,status,score,cost_cents,created_at,finished_at,stopped_reason,is_current";

/** Starts the scan the way the landing page starts it: a JSON body to the
 *  canonicaliser (`POST /api/scan`), which answers 422 on a malformed
 *  domain and 200 otherwise — with a scan id when it claimed a slot, and
 *  without one when it refused. */
async function startScan(app, domain) {
  const response = await fetch(new URL("/api/scan", app), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value: domain }),
  });
  const body = await response.json().catch(() => null);
  if (response.status === 422) {
    return { started: false, because: `the deployment reads "${domain}" as ${body?.problem ?? "malformed"}` };
  }
  if (!response.ok || body?.ok !== true) {
    return { started: false, because: `POST /api/scan answered ${response.status} ${JSON.stringify(body)}` };
  }
  if (typeof body.scanId !== "string") {
    // REQ-003 criteria 6-8: the hourly allowance, the in-flight bound, the
    // day's ceiling and the kill switch all refuse in exactly this shape.
    return { started: false, because: "the free path refused the scan (cooldown, another scan in flight, or scanning paused)" };
  }
  return { started: true, scanId: body.scanId, location: body.location };
}

function seconds(from, to) {
  return (new Date(to).getTime() - new Date(from).getTime()) / 1000;
}

function fixed(n) {
  return n.toFixed(1);
}

/**
 * One domain, start to printed numbers.
 */
export async function measure({ app, supabaseUrl, serviceKey, domain, targetS, capC, ceilingS, windowD, log }) {
  log(`--- ${domain}`);

  const claimedAfter = Date.now();
  const start = await startScan(app, domain);
  if (!start.started) {
    log(`no measurement   ${start.because}`);
    return { code: EXIT.NO_MEASUREMENT };
  }

  const waitUntil = claimedAfter + (ceilingS + CEILING_GRACE_S) * 1000;
  let row = null;
  for (;;) {
    const rows = await rest(supabaseUrl, serviceKey, `scans?id=eq.${start.scanId}&select=${SCAN_COLUMNS}&limit=1`);
    row = rows[0] ?? null;
    if (row !== null && row.status !== "running") break;
    if (Date.now() > waitUntil) {
      log(`no measurement   still running after ${fixed((Date.now() - claimedAfter) / 1000)} s`);
      log(`                 the ${ceilingS} s ceiling did not end it — that is a defect against REQ-003 criterion 5`);
      return { code: EXIT.NO_MEASUREMENT };
    }
    await sleep(POLL_MS);
  }
  const elapsedS = (Date.now() - claimedAfter) / 1000;

  // An `in_flight` refusal of this same domain hands back the *running*
  // scan's id rather than refusing outright, so a scan already under way
  // when this run started would otherwise be timed as if this run had
  // started it. The row's own `created_at` is what tells them apart.
  if (new Date(row.created_at).getTime() < claimedAfter - 2000) {
    log(`no measurement   joined a scan already running for ${domain} (claimed ${row.created_at})`);
    return { code: EXIT.NO_MEASUREMENT };
  }

  const ledger = await rest(
    supabaseUrl,
    serviceKey,
    `fetches?scan_id=eq.${start.scanId}&select=source,cost_cents,reserved_cents,created_at&order=created_at.asc`
  );
  const rowsCents = ledger.reduce((sum, f) => sum + f.cost_cents, 0);

  if (row.stopped_reason === "complete" && row.cost_cents === 0 && ledger.length === 0) {
    log(`no measurement   §6.4's ${windowD}-day window served the stored report: nothing was measured, nothing was spent`);
    log(`                 scan a domain this deployment has not measured in the last ${windowD} days`);
    return { code: EXIT.NO_MEASUREMENT };
  }
  if (row.status === "failed") {
    log(`no measurement   the pass failed (stopped_reason ${row.stopped_reason}) and stored no report`);
    return { code: EXIT.NO_MEASUREMENT };
  }

  const overTime = elapsedS > targetS;
  const overCap = row.cost_cents > capC;

  // The two numbers milestone 3 asks for.
  log(`elapsed          ${fixed(elapsedS)} s        target ${targetS} s     ${overTime ? "OVER" : "ok"}`);
  log(`ledgered         ${row.cost_cents} c          cap ${capC} c        ${overCap ? "OVER" : "ok"}`);

  // Everything a stage over budget or over time would be read out of.
  const serverS = row.finished_at === null ? null : seconds(row.created_at, row.finished_at);
  log(`scan             ${row.id}  status ${row.status}  stopped ${row.stopped_reason}  score ${row.score ?? "none"}`);
  log(
    `pass             claimed ${row.created_at}  finished ${row.finished_at ?? "not stamped"}` +
      (serverS === null ? "" : `  (${fixed(serverS)} s server-side)`)
  );
  log(
    `ledger           scans.cost_cents ${row.cost_cents} c is the roll-up the cap was enforced against; ` +
      `${ledger.length} fetches rows sum to ${rowsCents} c (integer column — sub-cent rows round to 0)`
  );

  if (ledger.length > 0) {
    const bySource = new Map();
    for (const f of ledger) {
      const at = bySource.get(f.source) ?? { rows: 0, cents: 0, reserved: 0, first: f.created_at, last: f.created_at };
      at.rows += 1;
      at.cents += f.cost_cents;
      at.reserved += f.reserved_cents;
      at.last = f.created_at;
      bySource.set(f.source, at);
    }
    log("");
    log("source                                        rows      c   reserved   first at");
    for (const [source, at] of [...bySource].sort((a, b) => b[1].reserved - a[1].reserved)) {
      log(
        `${source.padEnd(44)}${String(at.rows).padStart(5)}${String(at.cents).padStart(7)}` +
          `${String(at.reserved).padStart(11)}   +${fixed(seconds(row.created_at, at.first))} s`
      );
    }
  }

  if (overTime || overCap) {
    log("");
    log(`OVER BUDGET      ${[overTime ? "elapsed" : null, overCap ? "ledgered" : null].filter(Boolean).join(" and ")}`);
    return { code: EXIT.OVER };
  }
  return { code: EXIT.WITHIN };
}

export async function main(domains, log = (line) => console.log(line)) {
  if (domains.length === 0) throw new Error("usage: free-scan.sh <domain> [domain ...]");

  const source = readFileSync(CONSTANTS, "utf8");
  const targetS = pin("reportTargetS", source);
  const ceilingS = pin("reportCeilingS", source);
  const capC = pin("FREE_C", source);
  const windowD = pin("FREE_RESCAN_WINDOW_D", source);

  const app = process.env.RK_LIVE_APP_URL ?? "https://dev.reachkit.app";
  const supabaseUrl = required("SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");

  log(`app              ${app}`);
  log(`bounds           report inside ${targetS} s (ceiling ${ceilingS} s), ${capC} c ledgered`);

  let worst = EXIT.WITHIN;
  for (const domain of domains) {
    log("");
    const { code } = await measure({ app, supabaseUrl, serviceKey, domain, targetS, capC, ceilingS, windowD, log });
    if (code > worst) worst = code;
  }
  return worst;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = EXIT.NO_MEASUREMENT;
    });
}
