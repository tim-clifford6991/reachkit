#!/usr/bin/env node
// scripts/d19-cost.mjs — issue 1162: what D19's tracked buyer prompts cost.
//
// A measurement, not product wiring. Nothing imports it, it reads no
// database and writes none, and as `scripts/llm-mentions-pilot.mjs` it calls
// the vendor by hand rather than through `src/lib/vendors/dataforseo/`, for
// two reasons: that seam ledgers the price book's pin, and the question here
// is what the vendor itself reports per call; and its cache would serve the
// first run's answer as the second.
//
// What it does, per site of `scripts/d19-cost/markets.json`:
//   1. generates 25 prompts from the structured market, in D19's split
//      (SPEC §6, 2026-10-02): 5 category, 7 use-case with a constraint,
//      4 persona, 4 comparison, 3 problem, 2 branded;
//   2. pre-checks each once — one Google AI Mode answer, read by Haiku for
//      the brands it names — and drops a prompt whose answer names none;
//   3. asks every kept prompt on 2 engines (Google AI Mode, ChatGPT) x 2
//      runs on the standard queue, which is what a weekly pass uses;
//   4. writes docs/walk/d19-cost.md from the vendor's own reported costs.
//
// # Usage
//
//   node scripts/d19-cost.mjs                      # dry run: the prompts and
//                                                  # the price-book estimate, 0¢
//   node scripts/d19-cost.mjs --run --env-file ../../reachkitv3/.env.local
//   node scripts/d19-cost.mjs --run --max-spend 60 # cents; the default
//   node scripts/d19-cost.mjs --report             # rewrite the doc from the
//                                                  # stored run, 0¢
//
// Every task the vendor accepted is kept in `.d19-cost/state.json`
// (gitignored) with its id, its cost and its answer, so a second `--run`
// collects what is still queued and buys only what is missing. The run keeps
// a ledger of the vendors' own reported costs and refuses to open a call
// whose worst case would carry it past `--max-spend`.
//
// Credentials (DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, ANTHROPIC_API_KEY) come
// from the environment or the `--env-file`. They are placed in request
// headers only: never logged, never stored, never committed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const STATE_DIR = path.join(ROOT, ".d19-cost");
const STATE_FILE = path.join(STATE_DIR, "state.json");
const DOC = path.join(ROOT, "docs/walk/d19-cost.md");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const RUN = flag("--run");
const REPORT = flag("--report");
const MAX_SPEND_C = Number(option("--max-spend", "60"));
const POLL_MINUTES = Number(option("--poll-min", "40"));
const ENV_FILE = path.resolve(ROOT, option("--env-file", ".env.local"));

// ── The product's own figures this measurement is read against ──────────
// Transcribed from `src/lib/config/constants.ts` (PRICE_BOOK, CAPS, BATTERY).
const PIN = { AI_MODE_STD_C: 0.06, CHATGPT_STD_C: 0.12, SERP_STD_C: 0.06, LLM_MENTIONS_REQUEST_C: 10, LLM_MENTIONS_WORST_C: 20 };
/** D19: at most a fifth of the set rotates in a quarter, and a quarter is 13 weeks. */
const ROTATION = { share: 0.2, weeks: 13 };
const WEEKLY_CAP_C = 40;
const TWELVE = 12;
const HAIKU = { model: "claude-haiku-4-5-20251001", inCentsPerM: 100, outCentsPerM: 500 };
/** The most one call is assumed to cost before it is opened, in cents —
 *  several times the pin, so the ceiling holds if the price list is wrong. */
const RESERVE_C = { ai_mode: 0.4, chatgpt: 0.8, haiku: 0.6 };
const ENGINES = ["ai_mode", "chatgpt"];
const RUNS = [1, 2];
const LOCALE = { location_name: "United States", language_code: "en" };
const PATHS = {
  ai_mode: "/v3/serp/google/ai_mode",
  chatgpt: "/v3/ai_optimization/chat_gpt/llm_scraper",
};

// ── The generator ───────────────────────────────────────────────────────

const clean = (text) => text.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
const lowerFirst = (text) => (/^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text);
const words = (text) => text.split(/\s+/).filter(Boolean).length;

/** The buyer without its qualifying clause: "B2B SaaS founders and
 *  marketing leaders", not the sentence the conclusion stores. */
function buyerHead(buyer) {
  return lowerFirst(clean(buyer).split(/\s+(?:whose|who|seeking|that|looking)\s+/)[0]);
}

/** The job as a buyer says it of themselves, without its purpose clause:
 *  the conclusion stores it in the third person ("get their site …"). */
function jobHead(job) {
  return lowerFirst(clean(job).split(/\s+so\s+|,/)[0])
    .replace(/\btheir\b/g, "my")
    .replace(/\bthem\b/g, "me")
    .replace(/\bthey\b/g, "I");
}

const CONSTRAINTS = [
  "on a small budget",
  "without hiring an agency",
  "as a team of one",
  "within a single day of setup",
  "without an engineering team",
  "for a brand new website",
  "with a free trial",
];

/**
 * D19's set for one site: 25 prompts where the market names a category,
 * three synonyms and three rivals. A market with fewer rivals or synonyms
 * yields fewer; nothing is invented to fill a kind.
 */
export function d19Prompts(site) {
  const m = site.market;
  const category = clean(m.category);
  const buyer = buyerHead(m.buyer);
  const job = jobHead(m.job);
  const rivals = m.rivals.map((r) => clean(r.name));
  const out = [];
  const add = (kind, text) => {
    if (!out.some((p) => p.text.toLowerCase() === text.toLowerCase())) out.push({ kind, text });
  };

  add("category", `What are the best ${category} tools right now, and what is each one good at?`);
  for (const synonym of m.synonyms.slice(0, 3).map(clean)) add("category", `Which ${synonym} platforms do people actually recommend this year?`);
  add("category", `I am new to ${category}. Which products should I look at first?`);

  for (const constraint of CONSTRAINTS) add("use-case", `Which tools help me ${job} ${constraint}?`);

  add("persona", `We are ${buyer}. Which ${category} tool fits us best?`);
  add("persona", `Which ${category} software is built for ${buyer}?`);
  add("persona", `What do ${buyer} actually use for ${category}?`);
  add("persona", `I work with ${buyer}. Which ${category} product should I recommend to them?`);

  if (rivals.length >= 2) add("comparison", `How does ${rivals[0]} compare with ${rivals[1]} for ${category}?`);
  if (rivals.length >= 1) add("comparison", `What are the best alternatives to ${rivals[0]} for ${buyer}?`);
  if (rivals.length >= 3) add("comparison", `${rivals[1]} or ${rivals[2]}: which is the better choice for ${category}?`);
  if (rivals.length >= 3) add("comparison", `Which is better value for ${category}: ${rivals[0]}, ${rivals[1]} or ${rivals[2]}?`);

  add("problem", `I am struggling to ${job}. Which tools can fix that?`);
  add("problem", `Nothing I have tried helps me ${job}. What software should I try next?`);
  add("problem", `What is the fastest way to ${job}, and which products do it for me?`);

  add("branded", `What is ${site.name}, and is it any good for ${category}?`);
  if (rivals.length >= 1) add("branded", `Is ${site.name} a good alternative to ${rivals[0]} for ${category}?`);

  return out.map((p, i) => ({ n: i + 1, ...p }));
}

// ── Money ───────────────────────────────────────────────────────────────

function loadEnv() {
  if (!existsSync(ENV_FILE)) return;
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match !== null && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function loadState() {
  if (!existsSync(STATE_FILE)) return { startedAt: new Date().toISOString(), calls: {} };
  return JSON.parse(readFileSync(STATE_FILE, "utf8"));
}

let state = { startedAt: new Date().toISOString(), calls: {} };
function saveState() {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
}

let inFlightReserveC = 0;
const spentC = () => Object.values(state.calls).reduce((sum, call) => sum + (call.costC ?? 0), 0);
/** True where the call may be opened; the reservation is held until `settle`. */
function reserve(kind) {
  if (spentC() + inFlightReserveC + RESERVE_C[kind] > MAX_SPEND_C) return false;
  inFlightReserveC += RESERVE_C[kind];
  return true;
}
const settle = (kind) => {
  inFlightReserveC -= RESERVE_C[kind];
};

// ── The two vendors ─────────────────────────────────────────────────────

function dataForSeoAuth() {
  return `Basic ${Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString("base64")}`;
}

async function dataForSeo(method, apiPath, body) {
  const res = await fetch(`https://api.dataforseo.com${apiPath}`, {
    method,
    headers: { Authorization: dataForSeoAuth(), "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(60_000),
  });
  return res.json();
}

/** Every `url` string under a node, except what ChatGPT retrieved but did
 *  not cite (`search_results`) — the product's own rule for a citation. */
function urlsUnder(node, out = new Set()) {
  if (Array.isArray(node)) for (const item of node) urlsUnder(item, out);
  else if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "search_results") continue;
      if (key === "url" && typeof value === "string") out.add(value);
      else urlsUnder(value, out);
    }
  }
  return out;
}

function readAnswer(engine, result) {
  const items = Array.isArray(result?.items) ? result.items : [];
  const item = engine === "ai_mode" ? items.find((i) => i?.type === "ai_overview") : items.find((i) => i?.markdown || i?.text);
  if (item === undefined) return { answered: false, text: "", urls: [] };
  const text = item.markdown ?? item.text ?? "";
  const urls = [...urlsUnder(item)];
  return { answered: text !== "" || urls.length > 0, text, urls };
}

async function post(key, engine, prompt) {
  if (state.calls[key] !== undefined) return;
  if (!reserve(engine)) {
    console.error(`refused by --max-spend: ${key}`);
    return;
  }
  try {
    const json = await dataForSeo("POST", `${PATHS[engine]}/task_post`, [{ keyword: prompt, ...LOCALE }]);
    const task = json?.tasks?.[0];
    const call = { engine, prompt, postedAt: new Date().toISOString(), costC: (json?.cost ?? 0) * 100 };
    if (task?.status_code === 20100 && typeof task.id === "string") call.id = task.id;
    else Object.assign(call, { done: true, error: `task_post ${task?.status_code ?? json?.status_code} ${task?.status_message ?? json?.status_message ?? ""}`.trim() });
    state.calls[key] = call;
  } catch (error) {
    // Nothing is stored: whether the vendor accepted it is unknown, and the
    // reservation's worst case is counted against the run by `unknownC`.
    state.unknownC = (state.unknownC ?? 0) + RESERVE_C[engine];
    console.error(`${key}: ${String(error)}`);
  } finally {
    settle(engine);
    saveState();
  }
}

async function collect(key) {
  const call = state.calls[key];
  if (call === undefined || call.done || call.id === undefined) return;
  let json;
  try {
    json = await dataForSeo("GET", `${PATHS[call.engine]}/task_get/advanced/${encodeURIComponent(call.id)}`);
  } catch {
    return; // asked again on the next round
  }
  const task = json?.tasks?.[0];
  const code = task?.status_code;
  if (code === 40601 || code === 40602) return; // handed, or still queued
  // `task_get` is not billed. AI Mode's repeats the task's own cost in its
  // `cost` field, which reads like a second charge; the account balance did
  // not move across one (checked 2026-10-03), so only the post is counted.
  call.done = true;
  call.doneAt = new Date().toISOString();
  if (code === 20000) Object.assign(call, readAnswer(call.engine, task.result?.[0]));
  else if (code === 40102) Object.assign(call, { answered: false, text: "", urls: [] });
  else call.error = `task_get ${code} ${task?.status_message ?? ""}`.trim();
}

async function pooled(items, size, worker) {
  const queue = [...items];
  await Promise.all(Array.from({ length: size }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await worker(item);
  }));
}

async function waitFor(keys) {
  const deadline = Date.now() + POLL_MINUTES * 60_000;
  for (;;) {
    const pending = keys.filter((key) => state.calls[key] !== undefined && !state.calls[key].done);
    if (pending.length === 0) return;
    if (Date.now() >= deadline) {
      console.error(`${pending.length} tasks still queued after ${POLL_MINUTES} min; run again to collect them.`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    await pooled(pending, 8, collect);
    saveState();
    console.log(`  waiting: ${keys.filter((key) => state.calls[key] !== undefined && !state.calls[key].done).length} of ${keys.length} queued`);
  }
}

/** The brands an answer names, read by Haiku — the pre-check's one model
 *  call. A company, product or tool; never a publisher cited as a source. */
async function brandsNamed(key, text) {
  if (state.calls[key] !== undefined) return;
  if (!reserve("haiku")) return;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: HAIKU.model,
        max_tokens: 300,
        temperature: 0,
        messages: [{
          role: "user",
          content: `List every software product, tool or company the answer below names as an option a buyer could choose. Reply with a JSON array of names only, [] if it names none.\n\n<answer>\n${text.slice(0, 12_000)}\n</answer>`,
        }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const json = await res.json();
    const reply = json?.content?.[0]?.text ?? "";
    const costC = ((json?.usage?.input_tokens ?? 0) * HAIKU.inCentsPerM + (json?.usage?.output_tokens ?? 0) * HAIKU.outCentsPerM) / 1e6;
    let brands = null;
    try {
      brands = JSON.parse(/\[[\s\S]*\]/.exec(reply)?.[0] ?? "null");
    } catch {
      brands = null;
    }
    state.calls[key] = { engine: "haiku", done: true, costC, brands, ...(brands === null ? { error: `unreadable reply (${res.status})` } : {}) };
  } catch (error) {
    console.error(`${key}: ${String(error)}`);
  } finally {
    settle("haiku");
    saveState();
  }
}

// ── The run ─────────────────────────────────────────────────────────────

const preKey = (site, p) => `${site.domain}|${p.n}|ai_mode|precheck`;
const brandKey = (site, p) => `${site.domain}|${p.n}|haiku|precheck`;
const runKey = (site, p, engine, run) => `${site.domain}|${p.n}|${engine}|run${run}`;

/** Kept: its pre-check answer names at least one brand. `null` while the
 *  pre-check has not been read. */
function kept(site, p) {
  const answer = state.calls[preKey(site, p)];
  if (answer === undefined || !answer.done) return null;
  if (answer.error !== undefined) return null;
  if (!answer.answered) return false;
  const brands = state.calls[brandKey(site, p)]?.brands;
  return Array.isArray(brands) ? brands.length > 0 : null;
}

async function run(sites) {
  const all = sites.flatMap((site) => d19Prompts(site).map((p) => ({ site, p })));

  console.log(`pre-check: ${all.length} prompts on AI Mode`);
  await pooled(all, 6, ({ site, p }) => post(preKey(site, p), "ai_mode", p.text));
  await waitFor(all.map(({ site, p }) => preKey(site, p)));
  await pooled(
    all.filter(({ site, p }) => state.calls[preKey(site, p)]?.answered),
    4,
    ({ site, p }) => brandsNamed(brandKey(site, p), state.calls[preKey(site, p)].text)
  );

  const asks = all
    .filter(({ site, p }) => kept(site, p) === true)
    .flatMap(({ site, p }) => RUNS.flatMap((n) => ENGINES.map((engine) => ({ key: runKey(site, p, engine, n), engine, text: p.text }))));
  console.log(`measured run: ${asks.length} asks (kept prompts x 2 engines x 2 runs); spent so far ${spentC().toFixed(2)}¢`);
  // Run 1 is posted and collected before run 2 is posted, so the second
  // ask of a prompt is a later ask and not the same batch twice.
  for (const n of RUNS) {
    const round = asks.filter((ask) => ask.key.endsWith(`run${n}`));
    await pooled(round, 6, (ask) => post(ask.key, ask.engine, ask.text));
    await waitFor(round.map((ask) => ask.key));
  }
  state.finishedAt = new Date().toISOString();
  saveState();
}

// ── The report ──────────────────────────────────────────────────────────

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const isOwn = (url, domain) => hostOf(url) === domain || hostOf(url).endsWith(`.${domain}`);
const names = (text, site) => new RegExp(`\\b${site.name.replace(/\s+/g, "\\s*")}\\b|${site.domain.replace(/\./g, "\\.")}`, "i").test(text);
const cents = (c) => `${c.toFixed(2)}¢`;
const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Wilson's 95% interval for k of n, as percentages. */
function wilson(k, n) {
  if (n === 0) return null;
  const z = 1.96;
  const p = k / n;
  const centre = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
  return { rate: p * 100, low: Math.max(0, centre - half) * 100, high: Math.min(1, centre + half) * 100 };
}
const band = (w) => (w === null ? "—" : `${w.rate.toFixed(0)}% (${w.low.toFixed(0)}–${w.high.toFixed(0)}%)`);

function siteFigures(site) {
  const prompts = d19Prompts(site);
  const calls = (suffix) => Object.entries(state.calls).filter(([key]) => key.startsWith(`${site.domain}|`) && key.endsWith(suffix)).map(([, call]) => call);
  const sum = (list) => list.reduce((total, call) => total + (call.costC ?? 0), 0);
  const pre = calls("|ai_mode|precheck");
  const haiku = calls("|haiku|precheck");
  const asks = prompts.flatMap((p) =>
    RUNS.flatMap((n) => ENGINES.map((engine) => ({ p, n, engine, call: state.calls[runKey(site, p, engine, n)] }))).filter((ask) => ask.call !== undefined)
  );
  const byEngine = Object.fromEntries(ENGINES.map((engine) => [engine, asks.filter((ask) => ask.engine === engine)]));
  const weeklyC = sum(asks.map((ask) => ask.call));
  const done = asks.filter((ask) => ask.call.done && ask.call.error === undefined);
  const answered = done.filter((ask) => ask.call.answered);
  const mentioned = (ask) => names(ask.call.text ?? "", site) || (ask.call.urls ?? []).some((url) => isOwn(url, site.domain));
  const unbranded = done.filter((ask) => ask.p.kind !== "branded");
  const branded = done.filter((ask) => ask.p.kind === "branded");
  const ownUrls = [...new Set(done.flatMap((ask) => (ask.call.urls ?? []).filter((url) => isOwn(url, site.domain))))];
  // How often the two runs of one prompt on one engine gave the same verdict.
  const pairs = prompts.flatMap((p) => ENGINES.map((engine) => RUNS.map((n) => done.find((ask) => ask.p.n === p.n && ask.engine === engine && ask.n === n)))).filter((pair) => pair.every(Boolean));
  return {
    prompts, pre, haiku, asks, byEngine, weeklyC, done, answered, mentioned, unbranded, branded, ownUrls, pairs,
    preC: sum(pre), haikuC: sum(haiku),
    keptCount: prompts.filter((p) => kept(site, p) === true).length,
    droppedCount: prompts.filter((p) => kept(site, p) === false).length,
  };
}

function report(sites) {
  const figures = new Map(sites.map((site) => [site.domain, siteFigures(site)]));
  const perCall = (engine) => {
    const list = sites.flatMap((site) => figures.get(site.domain).byEngine[engine]).filter((ask) => ask.call.done && ask.call.error === undefined);
    return list.length === 0 ? 0 : list.reduce((total, ask) => total + ask.call.costC, 0) / list.length;
  };
  const aiC = perCall("ai_mode");
  const gptC = perCall("chatgpt");
  const perPromptWeekC = RUNS.length * (aiC + gptC);
  const preChecks = sites.reduce((n, s) => n + figures.get(s.domain).pre.length, 0);
  const preCheckC = sites.reduce((n, s) => n + figures.get(s.domain).preC + figures.get(s.domain).haikuC, 0) / Math.max(1, preChecks);
  const serpsC = TWELVE * PIN.SERP_STD_C;
  const rotationC = (25 * ROTATION.share * preCheckC) / ROTATION.weeks;
  const totalC = spentC();
  const lines = [];
  const push = (...l) => lines.push(...l);

  push(
    "# D19's tracked buyer prompts — the cost, measured (issue 1162)",
    "",
    `Run ${String(state.finishedAt ?? state.startedAt).slice(0, 10)} by \`node scripts/d19-cost.mjs --run\`. Rewritten by that command; the arithmetic below is the script's, from the vendors' own reported cost of each call. Nothing in the product changed: no score, no copy, no database row.`,
    "",
    `**The run spent ${cents(totalC)}** of the 150¢ the owner allowed (${Object.values(state.calls).filter((call) => call.engine !== "haiku").length} vendor tasks, ${Object.values(state.calls).filter((call) => call.engine === "haiku").length} Haiku reads).${state.unknownC ? ` A further ${cents(state.unknownC)} at most is unaccounted: posts whose answer was never received.` : ""}`,
    "",
    "## What was run",
    "",
    "- **The set.** Templates over the structured market (`scripts/d19-cost/markets.json`, in the shape of `sites.market`): 5 category, 7 use-case with a constraint, 4 persona, 4 comparison, 3 problem, 2 branded.",
    "- **The pre-check.** Each prompt asked once on Google AI Mode; Haiku 4.5 lists the brands the answer names; a prompt whose answer names none is dropped. Paid once per prompt, not weekly.",
    "- **The measure.** Every kept prompt on 2 engines (Google AI Mode, ChatGPT) × 2 runs, on the standard queue a weekly pass uses. Run 2 was posted after run 1 was collected.",
    "- **Named** is the site's name or domain in the answer's text; **linked** is one of its pages among the answer's cited addresses.",
    "",
    "## Cost per call, as the vendor reported it",
    "",
    "| Call | Price book | Measured, per call | Calls |",
    "|---|---|---|---|",
    `| Google AI Mode, standard queue | ${cents(PIN.AI_MODE_STD_C)} | ${cents(aiC)} | ${sites.reduce((n, s) => n + figures.get(s.domain).byEngine.ai_mode.length + figures.get(s.domain).pre.length, 0)} |`,
    `| ChatGPT scraper, standard queue | ${cents(PIN.CHATGPT_STD_C)} | ${cents(gptC)} | ${sites.reduce((n, s) => n + figures.get(s.domain).byEngine.chatgpt.length, 0)} |`,
    `| Haiku reading one pre-check answer | — | ${cents(sites.reduce((n, s) => n + figures.get(s.domain).haikuC, 0) / Math.max(1, sites.reduce((n, s) => n + figures.get(s.domain).haiku.length, 0)))} | ${sites.reduce((n, s) => n + figures.get(s.domain).haiku.length, 0)} |`,
    "",
    "## Cost per site",
    "",
    `| | ${sites.map((s) => `${s.domain} (${s.role})`).join(" | ")} |`,
    `|---|${sites.map(() => "---").join("|")}|`,
    `| Prompts generated | ${sites.map((s) => figures.get(s.domain).prompts.length).join(" | ")} |`,
    `| Kept by the pre-check | ${sites.map((s) => figures.get(s.domain).keptCount).join(" | ")} |`,
    `| Dropped: the answer named no brand, or there was no answer | ${sites.map((s) => figures.get(s.domain).droppedCount).join(" | ")} |`,
    `| Pre-check, once: AI Mode | ${sites.map((s) => cents(figures.get(s.domain).preC)).join(" | ")} |`,
    `| Pre-check, once: Haiku | ${sites.map((s) => cents(figures.get(s.domain).haikuC)).join(" | ")} |`,
    `| Asks in one week (kept × 2 engines × 2 runs) | ${sites.map((s) => figures.get(s.domain).asks.length).join(" | ")} |`,
    `| …that came back answered | ${sites.map((s) => `${figures.get(s.domain).answered.length} of ${figures.get(s.domain).done.length}`).join(" | ")} |`,
    `| **Weekly cost** | ${sites.map((s) => `**${cents(figures.get(s.domain).weeklyC)}**`).join(" | ")} |`,
    "",
    `One kept prompt costs **${cents(perPromptWeekC)} a week** (2 × AI Mode + 2 × ChatGPT). A full set of 25 is **${cents(25 * perPromptWeekC)} a week**; the issue's upper size of 40 is ${cents(40 * perPromptWeekC)}.`,
    "",
    `The pre-check is ${cents(preCheckC)} a prompt, once: ${cents(25 * preCheckC)} when a site's set is first built, and ${cents(rotationC)} a week for a fifth of the set rotating each quarter. It dropped ${sites.reduce((n, s) => n + figures.get(s.domain).droppedCount, 0)} of ${preChecks} prompts.`,
    "",
    "Collecting a queued task is free. AI Mode's `task_get` repeats the task's cost in its own `cost` field; the account balance did not move across one, so only the post is counted.",
    "",
    "## Against the 40¢ weekly cap",
    "",
    "The measured rows are this run's. The other rows are the price book's pins (`src/lib/config/constants.ts`), not a reading of the production ledger: this run read no database, so what a real weekly pass settles at is not in this table.",
    "",
    "| Weekly line | Cents | Source |",
    "|---|---|---|",
    `| The 12 SERPs, standard queue | ${cents(serpsC)} | price book |`,
    `| D19: 25 prompts × 2 engines × 2 runs | ${cents(25 * perPromptWeekC)} | measured |`,
    `| D19: the quarter's rotation, pre-checked | ${cents(rotationC)} | measured |`,
    `| **The three together** | **${cents(serpsC + 25 * perPromptWeekC + rotationC)}** | |`,
    `| **Left of the ${WEEKLY_CAP_C}¢ cap** for everything else a weekly pass buys | **${cents(WEEKLY_CAP_C - serpsC - 25 * perPromptWeekC - rotationC)}** | |`,
    "",
    "What else a weekly pass buys today, and what each option would move:",
    "",
    "| Line | Cents | Source |",
    "|---|---|---|",
    `| LLM Mentions: the flat request, then up to 100 rows | ${cents(PIN.LLM_MENTIONS_REQUEST_C)}–${cents(PIN.LLM_MENTIONS_WORST_C)}; the cap is checked against ${cents(PIN.LLM_MENTIONS_WORST_C)} | price book; 10¢ for 0 rows on reachkit.app, 2026-10-02 |`,
    `| The twelve asked on the two engines, which D19 replaces | ${cents(TWELVE * (PIN.AI_MODE_STD_C + PIN.CHATGPT_STD_C))} ledgered; ${cents(TWELVE * (aiC + gptC))} at the measured prices | price book, measured |`,
    `| Up to twelve page questions: a SERP and the two engines each | ${cents(TWELVE * (PIN.SERP_STD_C + PIN.AI_MODE_STD_C + PIN.CHATGPT_STD_C))} ledgered; ${cents(TWELVE * (PIN.SERP_STD_C + aiC + gptC))} at the measured prices | price book, measured |`,
    `| With LLM Mentions' ${cents(PIN.LLM_MENTIONS_WORST_C)} still reserved, what is left for the rest | ${cents(WEEKLY_CAP_C - serpsC - 25 * perPromptWeekC - rotationC - PIN.LLM_MENTIONS_WORST_C)} | |`,
    `| D19 at 1 run instead of 2 | ${cents((25 * perPromptWeekC) / 2)} | measured |`,
    `| D19 at 40 prompts | ${cents(40 * perPromptWeekC)} | measured |`,
    "",
    `**The price book is wrong about AI Mode.** The vendor charged ${cents(aiC)} for a standard-queue AI Mode task; \`PRICE_BOOK.AI_MODE_STD_C\` is ${cents(PIN.AI_MODE_STD_C)}. Every AI Mode ask a paid pass makes on the standard queue is ledgered at ${aiC > 0 ? ((PIN.AI_MODE_STD_C / aiC) * 100).toFixed(0) : "—"}% of its cost. The ChatGPT pin matched.`,
    "",
    "## What the samples showed",
    "",
    "Unbranded prompts only; the two branded prompts are reported apart, as D19 rules. The band is Wilson's 95% interval on one week's samples; the product would report four weeks, about four times the samples.",
    "",
    `| | ${sites.map((s) => s.domain).join(" | ")} |`,
    `|---|${sites.map(() => "---").join("|")}|`,
    `| Unbranded samples | ${sites.map((s) => figures.get(s.domain).unbranded.length).join(" | ")} |`,
    `| Named or linked | ${sites.map((s) => { const f = figures.get(s.domain); return f.unbranded.filter(f.mentioned).length; }).join(" | ")} |`,
    `| Mention rate, with its band | ${sites.map((s) => { const f = figures.get(s.domain); return band(wilson(f.unbranded.filter(f.mentioned).length, f.unbranded.length)); }).join(" | ")} |`,
    `| Branded samples naming or linking it | ${sites.map((s) => { const f = figures.get(s.domain); return `${f.branded.filter(f.mentioned).length} of ${f.branded.length}`; }).join(" | ")} |`,
    `| Own pages cited (distinct) | ${sites.map((s) => figures.get(s.domain).ownUrls.length).join(" | ")} |`,
    `| Run 1 and run 2 agree on named/not, same prompt and engine | ${sites.map((s) => { const f = figures.get(s.domain); return `${f.pairs.filter((pair) => f.mentioned(pair[0]) === f.mentioned(pair[1])).length} of ${f.pairs.length}`; }).join(" | ")} |`,
    `| Run 1 and run 2 returned the identical text | ${sites.map((s) => { const f = figures.get(s.domain); return `${f.pairs.filter((pair) => pair[0].call.text === pair[1].call.text).length} of ${f.pairs.length}`; }).join(" | ")} |`,
    ""
  );

  for (const site of sites) {
    const f = figures.get(site.domain);
    const cell = (p, engine, n) => {
      const call = state.calls[runKey(site, p, engine, n)];
      if (call === undefined) return "·";
      if (!call.done) return "queued";
      if (call.error !== undefined) return "failed";
      if (!call.answered) return "no answer";
      const linked = (call.urls ?? []).some((url) => isOwn(url, site.domain));
      const named = names(call.text ?? "", site);
      return linked ? "linked" : named ? "named" : "—";
    };
    push(
      `## ${site.domain} — the set`,
      "",
      "| # | Kind | Prompt | Words | Pre-check: brands named | AI Mode 1 | AI Mode 2 | ChatGPT 1 | ChatGPT 2 |",
      "|---|---|---|---|---|---|---|---|---|",
      ...f.prompts.map((p) => {
        const brands = state.calls[brandKey(site, p)]?.brands;
        const pre = state.calls[preKey(site, p)];
        const seen = pre === undefined ? "·" : !pre.done ? "queued" : pre.error !== undefined ? "failed" : !pre.answered ? "no answer — dropped" : !Array.isArray(brands) ? "unread" : brands.length === 0 ? "0 — dropped" : `${brands.length}: ${esc(brands.slice(0, 4).join(", "))}${brands.length > 4 ? ", …" : ""}`;
        return `| ${p.n} | ${p.kind} | ${esc(p.text)} | ${words(p.text)} | ${seen} | ${cell(p, "ai_mode", 1)} | ${cell(p, "ai_mode", 2)} | ${cell(p, "chatgpt", 1)} | ${cell(p, "chatgpt", 2)} |`;
      }),
      ""
    );
    if (f.ownUrls.length > 0) push("Own pages cited:", "", ...f.ownUrls.map((url) => `- ${url}`), "");
  }
  const failed = Object.entries(state.calls).filter(([, call]) => call.error !== undefined);
  if (failed.length > 0) push("## Calls that failed", "", ...failed.map(([key, call]) => `- \`${key}\`: ${esc(call.error)} (${cents(call.costC ?? 0)})`), "");
  return `${lines.join("\n")}\n`;
}

// ── Entry ───────────────────────────────────────────────────────────────

const { sites } = JSON.parse(readFileSync(path.join(ROOT, "scripts/d19-cost/markets.json"), "utf8"));

if (!RUN && !REPORT) {
  for (const site of sites) {
    console.log(`\n${site.domain} (${site.role})`);
    for (const p of d19Prompts(site)) console.log(`  ${String(p.n).padStart(2)} ${p.kind.padEnd(10)} ${String(words(p.text)).padStart(2)}w  ${p.text}`);
  }
  const perSite = 25 * PIN.AI_MODE_STD_C + 25 * RUNS.length * (PIN.AI_MODE_STD_C + PIN.CHATGPT_STD_C);
  console.log(`\nDry run, 0¢. At the price book a site is about ${cents(perSite)} plus the Haiku reads; --run stops at ${MAX_SPEND_C}¢.`);
} else {
  state = loadState();
  if (RUN) {
    loadEnv();
    for (const name of ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD", "ANTHROPIC_API_KEY"]) {
      if ((process.env[name] ?? "PENDING").startsWith("PENDING") || process.env[name] === "") {
        console.error(`${name} is not a real credential. Pass --env-file <a .env.local that carries it>.`);
        process.exit(1);
      }
    }
    await run(sites);
  }
  writeFileSync(DOC, report(sites));
  console.log(`spent ${cents(spentC())}; wrote ${path.relative(ROOT, DOC)}`);
}
