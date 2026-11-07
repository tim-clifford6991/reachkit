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
// Box spend (issue 1478): where the env file holds a real `SUPABASE_URL` and
// `SUPABASE_SERVICE_ROLE_KEY`, each run also writes the spend log's last
// eight UTC days to production's `vendor_days`, one row per day, vendor and
// domain (`kind = 'box'`), so the owner's cost page shows it beside
// production's. Without the key nothing is written and nothing fails.
//
// Vercel (issue 2477): the team's Active CPU, the `reachkit` project's share
// and the function invocations, by UTC day for the last eight days and the
// month to date, from the FOCUS charges (`GET /v1/billing/charges`), read
// with the Vercel CLI's token, the one `deployer.sh` reads. A day Vercel
// reported nothing for is absent, never 0. With the database key the line
// also counts the sites the daily tick runs for and divides yesterday's
// project figure by it. Each run then mails `OWNER_EMAILS` once per billing
// month at 50%, 80% and 100% of `ACTIVE_CPU_BUDGET_CPU_HOURS_PER_MONTH`, and
// once when the last three days' mean projects past it.
//
// Plain JavaScript: the timer runs it on the box's Node, which has no type
// stripping.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { Resend } from "resend";
import { readSpend } from "./spend-log.mjs";

const DEFAULT_FILE = "/root/ops/reachkit/vendor-snapshots.jsonl";
export const DEFAULT_ENV_FILE = "/root/projects/reachkit/.env.local";
const KEYS = ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD", "ANTHROPIC_ADMIN_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "MAIL_FROM", "OWNER_EMAILS"];
const VERCEL_AUTH = "/root/.local/share/com.vercel.cli/auth.json";
const VERCEL_TEAM = "team_lFEcKlyuKD5risdEnak7iRIm";
export const VERCEL_PROJECT = "prj_QJUivDYYshplvV0enuc2oZNIjcnd";
/** Hobby's included Active CPU, the amount that soft-blocked the team on
 *  2026-11-07: the efficiency target on Pro too. A drafted default. */
export const ACTIVE_CPU_BUDGET_CPU_HOURS_PER_MONTH = 4;
const BUDGET_LEVELS = [50, 80, 100];
const DEFAULT_BUDGET_STATE = "/root/ops/reachkit/state/cpu-budget.json";
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

/** The Vercel CLI's token, as `deployer.sh` reads it; never logged. */
export function vercelToken(file = VERCEL_AUTH) {
  try {
    const token = JSON.parse(readFileSync(file, "utf8"))?.token;
    return typeof token === "string" && token !== "" ? token : undefined;
  } catch {
    return undefined;
  }
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

const round3 = (value) => Math.round(value * 1000) / 1000;
const CPU_SKU = /active.?cpu|fluid.?cpu|cpu.?duration/i;
const INVOCATION_SKU = /invocation/i;

/** A CPU quantity in CPU-seconds; `undefined` for a unit not known here. */
function toCpuSeconds(quantity, unit) {
  const u = String(unit ?? "").trim().toLowerCase();
  if (/^ms$|milli/.test(u)) return quantity / 1000;
  if (/^h$|^hrs?$|hour/.test(u)) return quantity * 3600;
  if (/^m$|^mins?$|minute/.test(u)) return quantity * 60;
  if (/^s$|^secs?$|second/.test(u)) return quantity;
  return undefined;
}

function tagsOf(row) {
  if (row?.Tags !== null && typeof row?.Tags === "object") return row.Tags;
  try {
    return typeof row?.Tags === "string" ? JSON.parse(row.Tags) : {};
  } catch {
    return {};
  }
}

const add = (bucket, key, value) => {
  bucket[key] = round3((bucket[key] ?? 0) + value);
};

/** Vercel's FOCUS charges (JSONL) as Active CPU-seconds and invocations by
 *  UTC day, team-wide and for `projectId`. A day with no row is not a key,
 *  and a field no row fed is not set: neither is ever read as 0. A CPU row
 *  in a unit not known here fails the read rather than miscount it.
 *  @returns {Record<string, import("./costs/report").VercelFigures>} */
export function readCharges(jsonl, projectId = VERCEL_PROJECT) {
  /** @type {Record<string, import("./costs/report").VercelFigures>} */
  const days = {};
  for (const line of String(jsonl).split("\n")) {
    if (line.trim() === "") continue;
    const row = JSON.parse(line);
    if (row?.ChargeCategory !== undefined && row.ChargeCategory !== "Usage") continue;
    const quantity = Number(row?.ConsumedQuantity);
    const start = Date.parse(row?.ChargePeriodStart);
    if (row?.ConsumedQuantity === null || !Number.isFinite(quantity) || Number.isNaN(start)) continue;
    const sku = `${row.SkuId ?? ""} ${row.ServiceName ?? ""}`;
    const day = new Date(start).toISOString().slice(0, 10);
    const ours = tagsOf(row).ProjectId === projectId;
    if (CPU_SKU.test(sku)) {
      const seconds = toCpuSeconds(quantity, row.ConsumedUnit);
      if (seconds === undefined) throw new Error(`Active CPU in an unknown unit: ${String(row.ConsumedUnit)}`);
      days[day] ??= {};
      add(days[day], "cpuSeconds", seconds);
      if (ours) add(days[day], "projectCpuSeconds", seconds);
    } else if (INVOCATION_SKU.test(sku)) {
      days[day] ??= {};
      add(days[day], "invocations", quantity);
    }
  }
  return days;
}

/** The line's `vercel`: the last eight UTC days and the sums of the month so far.
 *  @param {Record<string, import("./costs/report").VercelFigures>} days @param {Date} now
 *  @returns {import("./costs/report").VercelReading} */
export function vercelReading(days, now) {
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const first = new Date(today - (REPORT_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);
  const kept = {};
  const monthToDate = {};
  for (const [day, figures] of Object.entries(days).sort(([a], [b]) => a.localeCompare(b))) {
    if (day >= first) kept[day] = figures;
    if (day.startsWith(month)) for (const [key, value] of Object.entries(figures)) add(monthToDate, key, value);
  }
  return { days: kept, month, monthToDate };
}

async function vercel(keys, now) {
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const from = Math.min(Date.parse(`${now.toISOString().slice(0, 7)}-01T00:00:00.000Z`), today - (REPORT_DAYS - 1) * DAY_MS);
  const url = new URL("https://api.vercel.com/v1/billing/charges");
  url.searchParams.set("teamId", VERCEL_TEAM);
  url.searchParams.set("from", new Date(from).toISOString());
  url.searchParams.set("to", new Date(today + DAY_MS).toISOString());
  const response = await fetch(url, { headers: { Authorization: `Bearer ${keys.VERCEL_TOKEN}` }, signal: AbortSignal.timeout(REQUEST_MS) });
  const text = await response.text();
  if (!response.ok) {
    let code = "";
    try {
      code = String(JSON.parse(text)?.error?.code ?? "");
    } catch {
      // No code in the body: the status says enough.
    }
    throw new Error(`HTTP ${response.status}${code === "" ? "" : ` ${code}`}`);
  }
  return vercelReading(readCharges(text), now);
}

/** How many sites the daily tick runs for, as the service role counts them. */
export async function countSites(keys) {
  const url = `${keys.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/sites?select=id&publishing_enabled=eq.true&timezone=not.is.null`;
  const response = await fetch(url, {
    method: "HEAD",
    headers: { apikey: keys.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${keys.SUPABASE_SERVICE_ROLE_KEY}`, Prefer: "count=exact", Range: "0-0" },
    signal: AbortSignal.timeout(REQUEST_MS),
  });
  const total = Number(/\/(\d+)$/.exec(response.headers.get("content-range") ?? "")?.[1]);
  if (!response.ok || !Number.isInteger(total)) throw new Error(`HTTP ${response.status}`);
  return total;
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
  /** @type {import("./costs/report").Snapshot} */
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
  if (keys.VERCEL_TOKEN !== undefined) {
    try {
      row.vercel = await vercel(keys, now);
    } catch (error) {
      problems.push(`Vercel's billing charges could not be read: ${String(error?.message ?? error)}`);
    }
  } else {
    problems.push("Vercel: no CLI token");
  }
  if (row.vercel !== undefined && keys.SUPABASE_URL !== undefined && keys.SUPABASE_SERVICE_ROLE_KEY !== undefined) {
    try {
      const sites = await countSites(keys);
      row.vercel.sitesOnAutopilot = sites;
      const yesterday = row.vercel.days[new Date(Date.parse(now.toISOString().slice(0, 10)) - DAY_MS).toISOString().slice(0, 10)]?.projectCpuSeconds;
      if (yesterday !== undefined && sites > 0) row.vercel.cpuSecondsPerSite = round3(yesterday / sites);
    } catch (error) {
      problems.push(`the sites could not be counted: ${String(error?.message ?? error)}`);
    }
  }
  return { row, problems };
}

const hours = (seconds) => `${(seconds / 3600).toFixed(2)} CPU-hours`;
const percent = (part, whole) => `${Math.round((part / whole) * 100)}%`;

/** Month to date plus the last three complete days' mean for the rest of the
 *  month; `undefined` where none of those days was measured. */
export function projectedCpuSeconds(reading, now) {
  const mtd = reading?.monthToDate?.cpuSeconds;
  if (mtd === undefined) return undefined;
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const recent = [1, 2, 3]
    .map((back) => reading.days[new Date(today - back * DAY_MS).toISOString().slice(0, 10)]?.cpuSeconds)
    .filter((value) => value !== undefined);
  if (recent.length === 0) return undefined;
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  return mtd + (recent.reduce((sum, value) => sum + value, 0) / recent.length) * (daysInMonth - now.getUTCDate());
}

/** The mails one reading owes against the budget, and the state each marks
 *  once it is sent. Pure, so a clock double drives it. A new UTC month
 *  starts with nothing mailed. */
export function budgetStep(last, reading, now) {
  const month = now.toISOString().slice(0, 7);
  const state = last?.month === month ? { month, levels: [...(last.levels ?? [])], projected: last.projected === true } : { month, levels: [], projected: false };
  const mtd = reading?.month === month ? reading.monthToDate?.cpuSeconds : undefined;
  if (mtd === undefined) return { state, mails: [] };
  const budget = ACTIVE_CPU_BUDGET_CPU_HOURS_PER_MONTH * 3600;
  const projected = projectedCpuSeconds(reading, now);
  const project = reading.monthToDate.projectCpuSeconds;
  const body = [
    `Vercel Active CPU for the whole team, ${month} to date (UTC): ${hours(mtd)}, ${percent(mtd, budget)} of the ${ACTIVE_CPU_BUDGET_CPU_HOURS_PER_MONTH} CPU-hour monthly budget.`,
    `The reachkit project's share: ${project === undefined ? "not measured" : `${hours(project)} (${percent(project, mtd)})`}.`,
    `At the last three days' mean the month ends at ${projected === undefined ? "a figure not measured" : `${hours(projected)} (${percent(projected, budget)})`}.`,
    "",
    "The team's figure includes its other projects, and it is the one Vercel enforces. Vercel's own hard cap is Spend Management (team, Settings, Billing).",
    "`npm run costs` on the box shows the days; docs/RUNBOOK.md §8 says what to do.",
  ].join("\n");
  const mails = [];
  const crossed = BUDGET_LEVELS.filter((level) => (mtd / budget) * 100 >= level && !state.levels.includes(level));
  if (crossed.length > 0) {
    const level = Math.max(...crossed);
    mails.push({ subject: `Vercel Active CPU has passed ${level}% of this month's budget`, text: body, marks: { levels: crossed } });
  }
  const atCap = state.levels.includes(100) || crossed.includes(100);
  if (!state.projected && !atCap && projected !== undefined && projected > budget) {
    mails.push({ subject: "Vercel Active CPU is on course to pass this month's budget", text: body, marks: { projected: true } });
  }
  return { state, mails };
}

/** One send to every owner address. `true` only when Resend accepted it. */
async function sendMail(keys, mail) {
  const to = (keys.OWNER_EMAILS ?? "").split(",").map((a) => a.trim()).filter(Boolean);
  if (!keys.RESEND_API_KEY || !keys.MAIL_FROM || to.length === 0) return false;
  try {
    const { error } = await new Resend(keys.RESEND_API_KEY).emails.send({ from: keys.MAIL_FROM, to, subject: mail.subject, text: mail.text });
    return !error;
  } catch {
    return false;
  }
}

/** Mails what the reading owes and keeps what was mailed. A mail Resend did
 *  not accept is not marked, so the next hour tries again. */
/** @param {{ reading: import("./costs/report").VercelReading, keys: Record<string, string | undefined>, now?: Date, statePath?: string }} options */
export async function checkBudget({ reading, keys, now = new Date(), statePath = process.env.RK_CPU_BUDGET_STATE ?? DEFAULT_BUDGET_STATE }) {
  const last = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : null;
  const { state, mails } = budgetStep(last, reading, now);
  const said = [];
  for (const mail of mails) {
    if (await sendMail(keys, mail)) {
      state.levels = [...new Set([...state.levels, ...(mail.marks.levels ?? [])])].sort((a, b) => a - b);
      if (mail.marks.projected) state.projected = true;
      said.push(`mailed: ${mail.subject}`);
    } else {
      said.push(`not mailed, tried again next hour: ${mail.subject}`);
    }
  }
  mkdirSync(path.dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state)}\n`);
  return said;
}

/** Appends a reading that holds at least one vendor. Says whether it did. */
export function appendSnapshot(row, file = snapshotPath()) {
  if (row.dataforseo === undefined && row.anthropic === undefined && row.vercel === undefined) return false;
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

/** The spend log's lines from `since` (a UTC day) on, as box rows: one per
 *  day, vendor and domain, the price book's cents beside what the vendor
 *  billed. What it billed is the row's only where every line in it carried
 *  a charge, so a part is never read as the whole. A source is DataForSEO's
 *  when it is one of its endpoints, else the model's. */
export function boxRows(spend, since) {
  const rows = new Map();
  for (const line of spend) {
    const day = line.at.slice(0, 10);
    if (day < since) continue;
    const vendor = /^(?:\/v3\/)?(?:serp|dataforseo_labs|ai_optimization|on_page|keywords_data)\/|^dataforseo[:_]/.test(line.source) ? "dataforseo" : "anthropic";
    const domain = line.domain ?? "";
    const key = `${day}|${vendor}|${domain}`;
    const row = rows.get(key) ?? { vendor, day, kind: "box", domain, estimated_cents: 0, billed: 0, unbilled: 0, currency: "usd", source: "spend_log" };
    row.estimated_cents = Math.round((row.estimated_cents + line.cents) * 10000) / 10000;
    if (line.billed === null) row.unbilled += 1;
    else row.billed = Math.round((row.billed + line.billed) * 10000) / 10000;
    rows.set(key, row);
  }
  return [...rows.values()].map(({ billed, unbilled, ...row }) => ({ ...row, billed_cents: unbilled === 0 ? billed : null }));
}

/** Writes the box rows to production, where the keys allow. Says why not. */
export async function storeBoxRows(keys, rows) {
  if (keys.SUPABASE_URL === undefined || keys.SUPABASE_SERVICE_ROLE_KEY === undefined) return "no database key";
  if (rows.length === 0) return "nothing to write";
  const response = await fetch(`${keys.SUPABASE_URL}/rest/v1/vendor_days?on_conflict=vendor,day,kind,domain`, {
    method: "POST",
    headers: {
      apikey: keys.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${keys.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(REQUEST_MS),
  });
  return response.ok ? `${rows.length} box rows written` : `box rows not written: HTTP ${response.status}`;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const at = process.argv.indexOf("--env-file");
  const keys = { ...readKeys(at === -1 || at + 1 >= process.argv.length ? DEFAULT_ENV_FILE : process.argv[at + 1]), VERCEL_TOKEN: vercelToken() };
  const { row, problems } = await takeSnapshot(keys);
  for (const problem of problems) console.error(`vendor-snapshot: ${problem}`);
  const kept = appendSnapshot(row);
  if (row.vercel !== undefined) {
    const said = await checkBudget({ reading: row.vercel, keys }).catch((error) => [`budget not checked: ${String(error?.message ?? error)}`]);
    for (const line of said) console.error(`vendor-snapshot: ${line}`);
  }
  const since = new Date(Date.now() - (REPORT_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
  const box = await storeBoxRows(keys, boxRows(readSpend(), since)).catch((error) => `box rows not written: ${String(error?.message ?? error)}`);
  console.error(`vendor-snapshot: ${box}`);
  const d = row.dataforseo;
  console.log(
    `${row.at} ${kept ? "kept" : "not kept"}: DataForSEO ${d === undefined ? "unread" : `balance ${d.balanceCents}¢ of ${d.depositedCents}¢ deposited`}; Anthropic ${
      row.anthropic === undefined ? (keys.ANTHROPIC_ADMIN_KEY === undefined ? "no admin key" : "unread") : `${Object.keys(row.anthropic.days).length} days read`
    }; Vercel ${row.vercel === undefined ? "unread" : `${Object.keys(row.vercel.days).length} days read`}`
  );
  process.exit(kept ? 0 : 1);
}
