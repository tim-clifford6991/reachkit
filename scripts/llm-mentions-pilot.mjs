#!/usr/bin/env node
// scripts/llm-mentions-pilot.mjs — issue #920: the DataForSEO LLM Mentions
// pilot the owner ruled on 2026-09-21 to run.
//
// This is a spike. Nothing here ships to customers, nothing imports it, and
// it deliberately does **not** go through `src/lib/vendors/dataforseo/`:
// that barrel is a closed list of six functions (BUILD §6.3) and
// `tests/vendors/never-list.test.ts` fails on a seventh export. LLM Mentions
// is not on the list and must not join it before the owner has read the
// numbers this script produces. So the call is made here, by hand, against
// the documented endpoint.
//
// What it answers (SPEC §6, 2026-09-20 (c), and #920's three bullets):
//   1. What *also appearing for* looks like — the questions a domain is
//      named in, and on which engine.
//   2. What *cited pages* looks like — whether the URLs the answer cites on
//      that domain are pages we would have written, or its home page.
//   3. What it costs per domain per week, and what share of small sites
//      return nothing at all.
//   4. Whether a ten-target request bills as one request or as ten — the
//      billing question #920 raises and marks "not verified".
//
// # The money
//
// DataForSEO prices LLM Mentions pay-as-you-go: **$0.10 per API request plus
// $0.001 per returned row** (dataforseo.com/pricing/ai-optimization/llm-mentions;
// their own worked example, "$1.1 per 1,000 data rows", is $0.10 + 1000 ×
// $0.001, which agrees). One row is one mention.
//
// The plan, priced at its worst case before a penny is spent:
//
//   per domain   $0.10 request + 100 rows x $0.001 = $0.20   (ROW_LIMIT = 100)
//   20 domains   20 x $0.20                        = $4.00
//   billing probe (one request, ten targets)       = $0.20
//   ------------------------------------------------------
//   worst case                                       $4.20   (cap $5.00)
//
// That is the ceiling, not the estimate: a domain returning eight rows costs
// $0.108, and most small sites are expected to return none. The script also
// keeps a running ledger of the vendor's **own** reported `cost` and refuses
// to open a request whose worst case would carry it past `--max-spend`, so
// the cap holds even if the price list is wrong.
//
// Rows are capped rather than paged because `total_count` in the response
// gives the true breadth for free — we pay for a sample, not for the census.
//
// # Usage
//
//   node scripts/llm-mentions-pilot.mjs              # dry run: prints the
//                                                    # arithmetic, spends $0
//   node scripts/llm-mentions-pilot.mjs --run        # spends, cap $5.00
//   node scripts/llm-mentions-pilot.mjs --run --max-spend 2.50
//
// Credentials come from DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD in the
// environment, or from a `.env.local` beside the repo. They are read in one
// place, placed in one Authorization header, and never logged, never written
// to the output folder, and never committed.
//
// Raw responses land in `.llm-mentions/` — gitignored, one JSON per domain,
// so the owner can re-read the evidence without paying again.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_DIR = path.join(ROOT, ".llm-mentions");

const ENDPOINT = "https://api.dataforseo.com/v3/ai_optimization/llm_mentions/search_mentions/live";
const PRICE_PER_REQUEST = 0.1;
const PRICE_PER_ROW = 0.001;
const ROW_LIMIT = 100;
const WORST_CASE_PER_REQUEST = PRICE_PER_REQUEST + ROW_LIMIT * PRICE_PER_ROW;

const args = process.argv.slice(2);
const RUN = args.includes("--run");
const MAX_SPEND = Number(args[args.indexOf("--max-spend") + 1] || 5) || 5;

const usd = (n) => `$${n.toFixed(3)}`;

// ------------------------------------------------------------- credentials
/** The one place the login and password are read. Returns a ready
 *  Authorization header value so no caller ever holds the raw strings. */
function authorization() {
  let { DATAFORSEO_LOGIN: login, DATAFORSEO_PASSWORD: password } = process.env;
  const envFile = path.join(ROOT, ".env.local");
  if ((!login || !password) && existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const m = /^\s*(DATAFORSEO_LOGIN|DATAFORSEO_PASSWORD)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      const value = m[2].replace(/^["']|["']$/g, "");
      if (m[1] === "DATAFORSEO_LOGIN") login ||= value;
      else password ||= value;
    }
  }
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are not set (environment or .env.local).");
  }
  if (login.startsWith("PENDING")) {
    throw new Error(
      "DATAFORSEO_LOGIN is still the PENDING_OWNER_SETS_IN_VERCEL_DASHBOARD placeholder. " +
        "The real credential is a Secret on the Vercel project; export it into this shell before --run."
    );
  }
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

// ------------------------------------------------------------------ ledger
const ledger = { spent: 0, requests: 0, rows: 0 };

function affords() {
  return ledger.spent + WORST_CASE_PER_REQUEST <= MAX_SPEND + 1e-9;
}

/** One live request. `targets` is the documented `target` array — up to ten
 *  entities. Returns the parsed body and charges the ledger the vendor's own
 *  reported cost, not ours. */
async function search(auth, targets, tag) {
  const body = [{ target: targets, limit: ROW_LIMIT, tag }];
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const cost = typeof json.cost === "number" ? json.cost : WORST_CASE_PER_REQUEST;
  ledger.spent += cost;
  ledger.requests += 1;
  if (json.status_code !== 20000) {
    // The credential itself must never reach a log, and DataForSEO's error
    // messages do not carry it — but the body might carry a task echo, so
    // only the code and message are surfaced.
    return { json, cost, error: `${json.status_code} ${json.status_message}` };
  }
  return { json, cost };
}

/** The reading of one domain's response that #920 asks for. */
function summarise(json) {
  const task = json.tasks?.[0];
  const result = task?.result?.[0];
  const items = result?.items ?? [];
  const engines = new Set();
  const questions = [];
  const citedUrls = [];
  for (const item of items) {
    if (item.platform) engines.add(item.platform);
    if (item.question) {
      questions.push({
        question: item.question,
        platform: item.platform ?? null,
        model: item.model_name ?? null,
        aiSearchVolume: item.ai_search_volume ?? null,
        webSearchBased: item.is_web_search_based ?? null,
      });
    }
    for (const s of item.sources ?? []) if (s.url) citedUrls.push({ url: s.url, title: s.title ?? null, domain: s.domain ?? null });
  }
  return {
    rows: items.length,
    totalCount: result?.total_count ?? null,
    engines: [...engines],
    questions,
    citedUrls,
  };
}

/** A cited URL is a *page* when it has a path beyond `/` — the home page is
 *  the engine naming the business, a deeper path is the engine quoting
 *  something someone wrote, which is what ReachKit would be selling. */
function pageShare(citedUrls, domain) {
  const own = citedUrls.filter((c) => (c.domain ?? "").replace(/^www\./, "").endsWith(domain));
  const deep = own.filter((c) => {
    try {
      return new URL(c.url).pathname.replace(/\/+$/, "") !== "";
    } catch {
      return false;
    }
  });
  return { ownCited: own.length, deepPages: deep.length };
}

// -------------------------------------------------------------------- main
async function main() {
  const list = JSON.parse(readFileSync(path.join(ROOT, "scripts/llm-mentions-pilot.domains.json"), "utf8"));
  const domains = list.domains;

  const worstCase = domains.length * WORST_CASE_PER_REQUEST + WORST_CASE_PER_REQUEST;
  console.log(`# LLM Mentions pilot (#920)\n`);
  console.log(`price          ${usd(PRICE_PER_REQUEST)} per request + ${usd(PRICE_PER_ROW)} per row`);
  console.log(`row limit      ${ROW_LIMIT} per request  (worst case ${usd(WORST_CASE_PER_REQUEST)} a request)`);
  console.log(`domains        ${domains.length}, one request each`);
  console.log(`billing probe  1 request carrying 10 targets`);
  console.log(`worst case     ${usd(worstCase)}`);
  console.log(`cap            ${usd(MAX_SPEND)}\n`);

  if (worstCase > MAX_SPEND) {
    console.error(`Refusing: the worst case ${usd(worstCase)} is over the cap ${usd(MAX_SPEND)}.`);
    process.exit(1);
  }
  if (!RUN) {
    console.log("Dry run — nothing was requested and nothing was spent. Pass --run to spend.");
    return;
  }

  const auth = authorization();
  mkdirSync(OUT_DIR, { recursive: true });
  const report = [];

  for (const entry of domains) {
    if (!affords()) {
      console.log(`\nStopping at ${usd(ledger.spent)}: another request could pass the cap.`);
      break;
    }
    const { json, cost, error } = await search(
      auth,
      [{ domain: entry.domain, search_filter: "include", search_scope: ["sources"], include_subdomains: true }],
      `pilot-920-${entry.domain}`
    );
    writeFileSync(path.join(OUT_DIR, `${entry.domain}.json`), JSON.stringify(json, null, 2));
    if (error) {
      console.log(`${entry.domain.padEnd(28)} ERROR ${error}`);
      report.push({ ...entry, error, cost });
      continue;
    }
    const s = summarise(json);
    ledger.rows += s.rows;
    const pages = pageShare(s.citedUrls, entry.domain);
    report.push({ ...entry, ...s, ...pages, cost });
    console.log(
      `${entry.domain.padEnd(28)} rows ${String(s.rows).padStart(3)}  total ${String(s.totalCount ?? "?").padStart(5)}` +
        `  engines ${(s.engines.join(",") || "-").padEnd(18)} cited ${String(pages.ownCited).padStart(3)}` +
        ` (${pages.deepPages} deep)  ${usd(cost)}`
    );
  }

  // The billing question: ten domains, one request. If the charge comes back
  // at about $0.10 + rows it bills per request; near $1.00 it bills per target.
  let probe = null;
  if (affords()) {
    const ten = domains.slice(0, 10).map((d) => ({
      domain: d.domain,
      search_filter: "include",
      search_scope: ["sources"],
      include_subdomains: true,
    }));
    const { json, cost, error } = await search(auth, ten, "pilot-920-billing-probe");
    writeFileSync(path.join(OUT_DIR, "_billing-probe.json"), JSON.stringify(json, null, 2));
    const rows = error ? 0 : summarise(json).rows;
    probe = { cost, rows, error: error ?? null, perRequest: cost - rows * PRICE_PER_ROW };
    console.log(
      `\nbilling probe: 10 targets, one request -> ${usd(cost)} for ${rows} rows ` +
        `= ${usd(probe.perRequest)} of request charge ` +
        `(${probe.perRequest < 0.5 ? "billed per REQUEST" : "billed per TARGET"})`
    );
  }

  const answered = report.filter((r) => !r.error);
  const empty = answered.filter((r) => r.rows === 0);
  const byTier = {};
  for (const r of answered) {
    byTier[r.tier] ??= { n: 0, empty: 0, rows: 0 };
    byTier[r.tier].n += 1;
    byTier[r.tier].empty += r.rows === 0 ? 1 : 0;
    byTier[r.tier].rows += r.rows;
  }

  console.log(`\n# Totals\n`);
  console.log(`spent          ${usd(ledger.spent)} over ${ledger.requests} requests, ${ledger.rows} rows`);
  console.log(`returned none  ${empty.length} of ${answered.length} domains`);
  for (const [tier, t] of Object.entries(byTier)) {
    console.log(`  ${tier.padEnd(16)} ${t.n - t.empty}/${t.n} returned rows, ${t.rows} rows in all`);
  }
  const perDomain = answered.length ? ledger.spent / answered.length : 0;
  console.log(`\nper domain     ${usd(perDomain)} a query`);
  console.log(`weekly         ${usd(perDomain)} a customer a week = ${usd(perDomain * 52)} a year`);
  console.log(`monthly        ${usd(perDomain)} a customer a month = ${usd(perDomain * 12)} a year`);
  console.log(`\n40c weekly cap: a weekly query is ${((perDomain / 0.4) * 100).toFixed(0)}% of it.`);

  writeFileSync(
    path.join(OUT_DIR, "_summary.json"),
    JSON.stringify({ ledger, probe, byTier, report, pricedAt: { PRICE_PER_REQUEST, PRICE_PER_ROW, ROW_LIMIT } }, null, 2)
  );
  console.log(`\nRaw responses and _summary.json are in .llm-mentions/ (gitignored).`);
}

main().catch((e) => {
  console.error(String(e.message ?? e));
  process.exit(1);
});
