#!/usr/bin/env node
// The weekly review's six outcomes, each from one fixed SELECT over [SINCE, DAY).
//
//   node scripts/outcomes.mjs --since 2026-11-02 --day 2026-11-09
//
// Takes no SQL. Connects with READONLY_DATABASE_URL (the environment, else the
// main checkout's .env.local) and opens every session read-only, so no query
// can write whatever role the URL names. A source it cannot read is printed as
// not measured with the reason, never as 0. The last line names the worst
// measured rate and its SPEC section: the one deletion candidate of the week.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const ENV_FILE = "/root/projects/reachkit/.env.local";
const KEY = "READONLY_DATABASE_URL";

const args = process.argv.slice(2);
const flag = (name) => args[args.indexOf(name) + 1];
const since = flag("--since");
const day = flag("--day");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
if (args.length !== 4 || !DATE.test(since ?? "") || !DATE.test(day ?? "") || since >= day) {
  console.error("usage: node scripts/outcomes.mjs --since YYYY-MM-DD --day YYYY-MM-DD");
  process.exit(2);
}

const inWindow = (column) => `${column} >= date '${since}' and ${column} < date '${day}'`;

// Paid: the account had access during the window (access is paid_through alone).
const PAID_SITES = `select s.id, s.setup_completed_at, u.paid_through from sites s join users u on u.id = s.user_id
  where u.deleted_at is null and u.paid_through > date '${since}' and s.setup_completed_at < date '${day}'`;

// Each query returns one row: numerator n and denominator d, or a count n alone.
const OUTCOMES = [
  { name: "free scans finished", section: "§2", sql: `select count(*) as n from scans where tier = 'free' and status in ('done', 'degraded') and not smoke and ${inWindow("finished_at")}` },
  { name: "report mails sent", section: "§2", missing: "no stored row records a sent report mail" },
  {
    name: "checkout → setup",
    section: "§5",
    sql: `select count(distinct s.id) filter (where s.setup_completed_at is not null) as n, count(distinct u.id) as d
      from users u left join sites s on s.user_id = u.id where u.checkout_session_id is not null and ${inWindow("u.created_at")}`,
  },
  {
    name: "setup → first page in 24 h",
    section: "§5",
    sql: `select count(*) filter (where exists (select 1 from drafts r where r.site_id = s.id and r.created_at <= s.setup_completed_at + interval '24 hours')) as n, count(*) as d
      from sites s where ${inWindow("s.setup_completed_at")}`,
  },
  {
    name: "days delivered per paid site",
    section: "§7",
    sql: `with paid as (${PAID_SITES}), due as (
        select p.id, g::date as d from paid p, generate_series(date '${since}', date '${day}' - 1, interval '1 day') g
        where g::date >= p.setup_completed_at::date and g::date <= p.paid_through::date)
      select count(*) filter (where exists (
          select 1 from draft_days dd join drafts r on r.site_id = dd.site_id and r.scheduled_for = dd.publish_date
          join publications pb on pb.draft_id = r.id
          where dd.site_id = due.id and dd.publish_date = due.d and dd.outcome = 'drafted' and pb.published_at is not null and pb.unpublished_at is null)) as n,
        count(*) as d, count(distinct id) as sites from due`,
  },
  { name: "sign-in → app", section: "§3", missing: "no stored row records a redeemed sign-in link or the page its session reached" },
  {
    name: "CPU ms per site per day",
    section: "§6",
    sql: `select round(sum(cpu_ms)::numeric / nullif(count(distinct (site_id, day)), 0)) as n, count(distinct (site_id, day)) as sitedays
      from job_days where site_id is not null and ${inWindow("day")}`,
  },
];

function connection() {
  let url = process.env[KEY];
  if (!url && existsSync(ENV_FILE)) url = /^\s*READONLY_DATABASE_URL\s*=\s*["']?(.*?)["']?\s*$/m.exec(readFileSync(ENV_FILE, "utf8"))?.[1];
  if (!url) return null;
  const u = new URL(url);
  // Parts in the environment, so the password is never on a command line.
  return {
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: u.pathname.slice(1) || "postgres",
    PGSSLMODE: u.searchParams.get("sslmode") ?? (["localhost", "127.0.0.1"].includes(u.hostname) ? "disable" : "require"),
    PGOPTIONS: "-c default_transaction_read_only=on -c TimeZone=UTC -c statement_timeout=20000",
  };
}

function read(env, sql) {
  const run = spawnSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-At", "-c", `select row_to_json(t) from (${sql}) t`], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });
  if (run.status !== 0) return { error: (run.stderr || run.error?.message || "psql failed").trim().split("\n")[0] };
  return { row: JSON.parse(run.stdout.trim()) };
}

function measure(env) {
  return OUTCOMES.map((o) => {
    if (o.missing) return { ...o, value: null, reason: o.missing };
    if (env === null) return { ...o, value: null, reason: `${KEY} is not set` };
    const { row, error } = read(env, o.sql);
    if (error) return { ...o, value: null, reason: error };
    const n = Number(row.n);
    if (row.d !== undefined) return Number(row.d) === 0 ? { ...o, value: null, reason: "nothing to measure in the window" } : { ...o, value: `${n} of ${row.d}${row.sites ? ` (${row.sites} sites)` : ""}`, rate: n / Number(row.d) };
    if (row.sitedays !== undefined && Number(row.sitedays) === 0) return { ...o, value: null, reason: "no site-day in job_days in the window" };
    return { ...o, value: String(n) };
  });
}

const results = measure(connection());
console.log(`Outcomes ${since} to ${day} (UTC, day excluded)\n\n| Outcome | Value | SPEC |\n|---|---|---|`);
for (const r of results) console.log(`| ${r.name} | ${r.value ?? `not measured: ${r.reason}`} | ${r.section} |`);
const worst = results.filter((r) => r.rate !== undefined).sort((a, b) => a.rate - b.rate)[0];
console.log(worst ? `\nWorst: ${worst.name} at ${Math.round(worst.rate * 100)}%, ${worst.section}` : "\nWorst: none, no rate was measured");
