#!/usr/bin/env node
// scripts/deadman.mjs — the clock outside Vercel: mails the owner when the
// product's own hosts stop answering 2xx (RUNBOOK §4, The outside check).
//
//   node scripts/deadman.mjs --env-file <file>              # one probe, then exit
//   node scripts/deadman.mjs --env-file <file> --test-mail  # one "test" mail, no probe, no state
//
// `rk-deadman.timer` runs it every 2 minutes. Each target is a `GET`, 10 s,
// redirects not followed: only a 2xx is up. A target down on 2 probes in a row
// mails `OWNER_EMAILS` once through Resend, again every 6 hours while it stays
// down, and once more when it answers 2xx. A send Resend does not accept opens
// or comments on one `[down] reachkit.app` issue with `gh` instead.
//
// State is one JSON file, `/root/ops/reachkit/state/deadman.json` or
// `RK_DEADMAN_STATE`. One log line per run names each target's status or
// error class and the outcome, never a credential.
//
// Plain JavaScript: the timer runs it on the box's Node, which has no type
// stripping.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { Resend } from "resend";

export const TARGETS = ["https://reachkit.app/", "https://reachkit.app/api/health", "https://dev.reachkit.app/api/health"];
export const ISSUE_TITLE = "[down] reachkit.app";
const REPO = "tim-clifford6991/reachkit";
const DEFAULT_STATE = "/root/ops/reachkit/state/deadman.json";
const PROBE_MS = 10_000;
const FAILURES_TO_MAIL = 2;
const REMINDER_MS = 6 * 60 * 60 * 1000;

/** One target's answer: up only on a 2xx; otherwise the status, or the error class where nothing answered. */
export async function probe(url) {
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(PROBE_MS) });
    const result = { url, up: response.status >= 200 && response.status < 300, status: response.status };
    if (!result.up) {
      // /api/health's 503 names the stale jobs or the reason it could not tell.
      const body = await response.json().catch(() => null);
      if (Array.isArray(body?.stale)) result.stale = body.stale.map(String);
      if (typeof body?.reason === "string") result.reason = body.reason;
    }
    return result;
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return { url, up: false, error: timedOut ? "timeout" : (error?.cause?.code ?? error?.name ?? "Error") };
  }
}

const why = (r) =>
  [r.status ?? r.error, r.stale?.length ? `stale jobs ${r.stale.join(", ")}` : null, r.reason ? `reason ${r.reason}` : null]
    .filter(Boolean)
    .join(", ");

function lasted(ms) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/** The next state and the mails owed, from the last state and this probe. Pure, so a clock double can drive it. */
export function step(state, results, now) {
  const targets = { ...state.targets };
  const recovered = [];
  for (const r of results) {
    const was = targets[r.url];
    if (r.up) {
      if (was?.mailedAt) recovered.push({ url: r.url, ms: now - was.since });
      delete targets[r.url];
    } else {
      targets[r.url] = { since: was?.since ?? now, failures: (was?.failures ?? 0) + 1, mailedAt: was?.mailedAt ?? null, why: why(r) };
    }
  }
  const down = Object.entries(targets).filter(([, t]) => t.failures >= FAILURES_TO_MAIL);
  const due = down.some(([, t]) => t.mailedAt === null || now - t.mailedAt >= REMINDER_MS);
  const mails = [];
  if (due) {
    const first = down.some(([, t]) => t.mailedAt === null);
    mails.push({
      urls: down.map(([url]) => url),
      subject: `${first ? "ReachKit is down" : "ReachKit is still down"}: ${down.length} of ${TARGETS.length} checks failing`,
      text: [
        "These addresses did not answer 2xx on two probes in a row from the box:",
        "",
        ...down.map(([url, t]) => `- ${url}: ${t.why} (down since ${new Date(t.since).toISOString()})`),
        "",
        "A 402 is the Vercel account; a 503 from /api/health is the jobs. The next mail is when it answers again, or a reminder in 6 hours.",
      ].join("\n"),
    });
  }
  if (recovered.length) {
    mails.push({
      urls: recovered.map((r) => r.url),
      subject: "ReachKit is back up",
      text: ["These addresses answer 2xx again:", "", ...recovered.map((r) => `- ${r.url}: down for ${lasted(r.ms)}`)].join("\n"),
    });
  }
  return { state: { targets }, mails };
}

/** One send to every owner address. Resolves `true` only when Resend accepted it. */
async function sendMail(env, mail) {
  const to = (env.OWNER_EMAILS ?? "").split(",").map((a) => a.trim()).filter(Boolean);
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || to.length === 0) return false;
  try {
    const { error } = await new Resend(env.RESEND_API_KEY).emails.send({ from: env.MAIL_FROM, to, subject: mail.subject, text: mail.text });
    return !error;
  } catch {
    return false;
  }
}

export function ghCli(args) {
  const done = spawnSync("gh", args, { encoding: "utf8" });
  return { ok: done.status === 0, stdout: done.stdout ?? "" };
}

/** Mail failed, so GitHub's own notification carries it: one open issue, commented on after the first. */
function fileIssue(gh, mail) {
  const body = `Resend did not accept this mail, so it is here.\n\n**${mail.subject}**\n\n${mail.text}`;
  const listed = gh(["issue", "list", "--repo", REPO, "--state", "open", "--json", "number,title", "--search", `"${ISSUE_TITLE}" in:title`]);
  if (!listed.ok) return false;
  let open;
  try {
    open = JSON.parse(listed.stdout).find((issue) => issue.title === ISSUE_TITLE);
  } catch {
    return false;
  }
  const args = open
    ? ["issue", "comment", String(open.number), "--repo", REPO, "--body", body]
    : ["issue", "create", "--repo", REPO, "--title", ISSUE_TITLE, "--body", body];
  return gh(args).ok;
}

/** One run. Every side effect but the network is passed in, so a test drives it with doubles. */
/** @param {{ argv?: string[], env?: Record<string, string | undefined>, now?: number, statePath?: string, gh?: (args: string[]) => { ok: boolean, stdout: string }, log?: (line: string) => void }} [options] */
export async function run({ argv = [], env = process.env, now = Date.now(), statePath = env.RK_DEADMAN_STATE ?? DEFAULT_STATE, gh = ghCli, log = console.log } = {}) {
  if (argv.includes("--test-mail")) {
    const at = new Date(now).toISOString();
    const sent = await sendMail(env, { subject: "ReachKit deadman: test", text: `A test from the box at ${at}. When ReachKit stops answering, the mail comes from here.` });
    log(JSON.stringify({ event: "deadman", at, outcome: sent ? "test-mail" : "mail-failed" }));
    return sent ? 0 : 1;
  }
  const last = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : { targets: {} };
  const results = await Promise.all(TARGETS.map(probe));
  const { state, mails } = step(last, results, now);
  let outcome = results.every((r) => r.up) ? "up" : "down";
  for (const mail of mails) {
    const mailed = await sendMail(env, mail);
    if (!mailed) outcome = "mail-failed";
    else if (outcome !== "mail-failed") outcome = "mailed";
    // Delivered by mail or by issue, the alert is marked; neither, and the next probe tries again.
    if (mailed || fileIssue(gh, mail)) for (const url of mail.urls) if (state.targets[url]) state.targets[url].mailedAt = now;
  }
  mkdirSync(path.dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state)}\n`);
  log(JSON.stringify({ event: "deadman", at: new Date(now).toISOString(), outcome, targets: results.map(({ url, up, status, error, stale }) => ({ url, up, status, error, stale })) }));
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const argv = process.argv.slice(2);
  const envFile = argv.indexOf("--env-file");
  if (envFile !== -1) process.loadEnvFile(argv[envFile + 1]);
  process.exitCode = await run({ argv });
}
