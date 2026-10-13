#!/usr/bin/env node
// scripts/vendor-snapshot.mjs — what the vendors say we owe them, read every
// hour (SPEC §6, owner 2026-10-11, issue 1408).
//
//   node scripts/vendor-snapshot.mjs                       # one reading, appended
//   node scripts/vendor-snapshot.mjs --env-file <file>     # other keys than the box's
//
// Every cent the product records is its own estimate. This is the vendors'
// side: `rk-vendor-snapshot.timer` runs it on the hour and each run appends
// one line to `/root/ops/reachkit/vendor-snapshots.jsonl`
// (`RK_VENDOR_SNAPSHOTS=<file>` writes elsewhere):
//
//   {"at":"2026-10-11T09:00:03.412Z",
//    "dataforseo":{"balanceCents":3113.3168,"depositedCents":10100,"dayCents":48.828,"day":"2026-10-11","timezone":"Europe/Berlin"},
//    "anthropic":{"days":{"2026-10-10":412.7,"2026-10-11":96.2}}}
//
// DataForSEO: `GET /v3/appendix/user_data`, which the vendor does not charge
// for. The balance, everything ever deposited, and the vendor's own total
// for its current day, which is a day in the account's timezone.
//
// Anthropic: the organisation's cost report for the last eight UTC days,
// read only when `ANTHROPIC_ADMIN_KEY` is set. It needs an admin key; the
// key the product calls the model with cannot read it. Without the key the
// line carries no `anthropic` and `npm run costs` says AI spend is estimated.
//
// A vendor that could not be read is left out of the line and said on
// stderr. Nothing here prints a credential, and nothing here spends.
//
// Plain JavaScript: the timer runs it on the box's Node, which has no type
// stripping.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_FILE = "/root/ops/reachkit/vendor-snapshots.jsonl";
export const DEFAULT_ENV_FILE = "/root/projects/reachkitv3/.env.local";
const KEYS = ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD", "ANTHROPIC_ADMIN_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const REQUEST_MS = 20_000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The cost report is asked for today and the seven days before it. */
const REPORT_DAYS = 8;

export function snapshotPath() {
  return process.env.RK_VENDOR_SNAPSHOTS ?? DEFAULT_FILE;
}

/** The keys this script and `npm run costs` read out of an env file, and no
 *  other line of it. A key that is absent, empty or still a `PENDING…`
 *  placeholder is not a key. */
export function readKeys(file = DEFAULT_ENV_FILE) {
  const keys = {};
  if (!existsSync(file)) return keys;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match === null || !KEYS.includes(match[1])) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (value !== "" && !value.startsWith("PENDING")) keys[match[1]] = value;
  }
  return keys;
}

const finite = (value) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const cents = (usd) => Math.round(usd * 100 * 10000) / 10000;

/** DataForSEO's `user_data` answer as the snapshot keeps it, or `null` where
 *  it carries no balance. The vendor states dollars; the line holds cents. */
export function readUserData(payload) {
  const result = payload?.tasks?.[0]?.result?.[0];
  const money = result?.money;
  const balance = finite(money?.balance);
  const deposited = finite(money?.total);
  if (balance === undefined || deposited === undefined) return null;
  const day = money?.statistics?.day;
  const dayTotal = finite(day?.total);
  return {
    balanceCents: cents(balance),
    depositedCents: cents(deposited),
    ...(dayTotal === undefined || typeof day?.value !== "string" ? {} : { dayCents: cents(dayTotal), day: day.value }),
    ...(typeof result?.timezone === "string" ? { timezone: result.timezone } : {}),
  };
}

/** Anthropic's cost report buckets as cents a UTC day. `amount` is already
 *  in cents, as a decimal string; only US dollar items are summed. */
export function readCostReport(buckets) {
  const days = {};
  for (const bucket of buckets) {
    if (typeof bucket?.starting_at !== "string" || Number.isNaN(Date.parse(bucket.starting_at))) continue;
    const day = new Date(bucket.starting_at).toISOString().slice(0, 10);
    let sum = days[day] ?? 0;
    for (const item of Array.isArray(bucket.results) ? bucket.results : []) {
      const amount = Number(item?.amount);
      if (item?.currency === "USD" && Number.isFinite(amount)) sum += amount;
    }
    days[day] = Math.round(sum * 10000) / 10000;
  }
  return { days };
}

async function getJson(url, headers) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(REQUEST_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function dataForSeo(keys) {
  const auth = Buffer.from(`${keys.DATAFORSEO_LOGIN}:${keys.DATAFORSEO_PASSWORD}`).toString("base64");
  const read = readUserData(await getJson("https://api.dataforseo.com/v3/appendix/user_data", { Authorization: `Basic ${auth}` }));
  if (read === null) throw new Error("the answer carries no balance");
  return read;
}

async function anthropic(keys, now) {
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const buckets = [];
  let page;
  do {
    const url = new URL("https://api.anthropic.com/v1/organizations/cost_report");
    url.searchParams.set("starting_at", new Date(today - (REPORT_DAYS - 1) * DAY_MS).toISOString());
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");
    if (page !== undefined) url.searchParams.set("page", page);
    const body = await getJson(url, { "x-api-key": keys.ANTHROPIC_ADMIN_KEY, "anthropic-version": "2023-06-01" });
    buckets.push(...(Array.isArray(body?.data) ? body.data : []));
    page = body?.has_more === true && typeof body.next_page === "string" ? body.next_page : undefined;
  } while (page !== undefined);
  return readCostReport(buckets);
}

/** One reading of both vendors. A vendor with no key, or one that did not
 *  answer, is absent from the line; `problems` says which and why. */
export async function takeSnapshot(keys, now = new Date()) {
  const row = { at: now.toISOString() };
  const problems = [];
  if (keys.DATAFORSEO_LOGIN !== undefined && keys.DATAFORSEO_PASSWORD !== undefined) {
    try {
      row.dataforseo = await dataForSeo(keys);
    } catch (error) {
      problems.push(`DataForSEO could not be read: ${String(error?.message ?? error)}`);
    }
  } else {
    problems.push("DataForSEO: no key");
  }
  if (keys.ANTHROPIC_ADMIN_KEY !== undefined) {
    try {
      row.anthropic = await anthropic(keys, now);
    } catch (error) {
      problems.push(`Anthropic's cost report could not be read: ${String(error?.message ?? error)}`);
    }
  }
  return { row, problems };
}

/** Appends a reading that holds at least one vendor. Says whether it did. */
export function appendSnapshot(row, file = snapshotPath()) {
  if (row.dataforseo === undefined && row.anthropic === undefined) return false;
  if (!existsSync(path.dirname(file))) return false;
  appendFileSync(file, `${JSON.stringify(row)}\n`);
  return true;
}

/** The stored readings, oldest first. A torn line is skipped. */
export function readSnapshots(file = snapshotPath()) {
  if (!existsSync(file)) return [];
  const rows = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    try {
      const row = JSON.parse(line);
      if (typeof row?.at === "string" && !Number.isNaN(Date.parse(row.at))) rows.push(row);
    } catch {
      // One reading lost, not the file.
    }
  }
  return rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const at = process.argv.indexOf("--env-file");
  const keys = readKeys(at === -1 || at + 1 >= process.argv.length ? DEFAULT_ENV_FILE : process.argv[at + 1]);
  const { row, problems } = await takeSnapshot(keys);
  for (const problem of problems) console.error(`vendor-snapshot: ${problem}`);
  const kept = appendSnapshot(row);
  const d = row.dataforseo;
  console.log(
    `${row.at} ${kept ? "kept" : "not kept"}: DataForSEO ${d === undefined ? "unread" : `balance ${d.balanceCents}¢ of ${d.depositedCents}¢ deposited`}; Anthropic ${
      row.anthropic === undefined ? (keys.ANTHROPIC_ADMIN_KEY === undefined ? "no admin key" : "unread") : `${Object.keys(row.anthropic.days).length} days read`
    }`
  );
  process.exit(kept ? 0 : 1);
}
