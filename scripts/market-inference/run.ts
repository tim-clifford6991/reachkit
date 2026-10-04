// scripts/market-inference/run.ts — the offline dogfood test of #1185:
// ReachKit's market and rival inference, run on stored evidence only.
//
// Each domain's stored report (its AI answers, top tens and ranked
// searches) and its read pages are the committed snapshots of
// `scripts/eval-content/snapshot/`. The model is the only live call; each
// domain is inferred `RUNS` times so the table shows how stable the answer
// is, which is what the two-pass stability rule rests on. The result is
// written to `docs/walk/market-inference.md`.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { inferMarket } from "@/lib/market/infer/infer";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { readStoredReport } from "@/lib/scan/report";
import { marketEvidence } from "@/lib/scan/market-evidence";
import { readSnapshot } from "../eval-content/snapshot";
import { proofLedger } from "../page/ledger";

export const DOMAINS = ["reachkit.app", "linear.app", "plausible.io"] as const;
const RUNS = Number(process.env.MI_RUNS ?? 3);
/** The owner's ceiling for this test, in ledger cents (#1185). */
const RUN_CAP_CENTS = 50;

/** reachkit.app's pass bar, from the owner's comment on #1185. */
const AI_VISIBILITY_PRODUCTS = new Set([
  "tryprofound.com", "profound.com", "peec.ai", "otterly.ai", "athenahq.ai", "scrunchai.com",
  "rankscale.ai", "goodie.ai", "higoodie.com", "airank.dejan.ai", "llmrefs.com", "knowatoa.com",
  "promptmonitor.io", "trysight.ai", "gauge.sh", "withgauge.com", "evertune.ai", "bluefish.ai",
]);
const NOT_RIVALS = new Set(["zapier.com", "ahrefs.com", "semrush.com", "g2.com", "youtube.com", "reddit.com"]);

interface Run {
  conclusion: MarketConclusion | null;
  costCents: number;
  failure: string | null;
}

function reachkitBar(c: MarketConclusion): { pass: boolean; why: string[] } {
  const why: string[] = [];
  const category = c.category.toLowerCase();
  const aiCategory = /\bai\b|generative|llm|answer engine|geo\b/.test(category) && category !== "seo software";
  why.push(`category is AI visibility, not "SEO software": ${aiCategory ? "yes" : "no"}`);
  const aiRivals = c.rivals.filter((r) => AI_VISIBILITY_PRODUCTS.has(r.domain)).length;
  const wrong = c.rivals.filter((r) => NOT_RIVALS.has(r.domain)).map((r) => r.domain);
  why.push(`AI-visibility rivals: ${aiRivals} of ${c.rivals.length}; zapier/ahrefs-type rivals: ${wrong.length === 0 ? "none" : wrong.join(", ")}`);
  const seoExcluded = c.notOurMarket.some((m) => /seo (software|tools?|platforms?|suites?)/i.test(m));
  why.push(`"SEO software" on not-our-market: ${seoExcluded ? "yes" : "no"}`);
  return { pass: aiCategory && aiRivals >= 3 && wrong.length === 0 && seoExcluded, why };
}

const esc = (s: string): string => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

function section(domain: string, runs: readonly Run[]): string[] {
  const lines = [`## ${domain}`, ""];
  const first = runs.find((r) => r.conclusion !== null)?.conclusion ?? null;
  if (first === null) {
    lines.push(`No run concluded: ${runs.map((r) => r.failure).join("; ")}`, "");
    return lines;
  }
  lines.push(
    `- **Category:** ${first.category} — ${first.categoryReason}`,
    `- **Synonyms:** ${first.synonyms.join(" · ")}`,
    `- **Who buys:** ${first.buyer}`,
    `- **The job:** ${first.job}`,
    `- **Differentiators:** ${first.differentiators.join(" · ")}`,
    `- **Not our market:** ${first.notOurMarket.join(" · ")}`,
    "",
    "| Rival | Basis | Reason |",
    "|---|---|---|",
    ...first.rivals.map((r) => `| ${r.name} (${r.domain}) | ${r.basis} | ${esc(r.reason)} |`),
    "",
    `Across ${runs.length} runs on the same evidence:`,
    "",
    "| Run | Category | Rivals | Cost |",
    "|---|---|---|---|",
    ...runs.map((r, i) =>
      r.conclusion === null
        ? `| ${i + 1} | — (${r.failure}) | — | ${r.costCents.toFixed(2)}¢ |`
        : `| ${i + 1} | ${esc(r.conclusion.category)} | ${r.conclusion.rivals.map((x) => x.domain).join(", ")} | ${r.costCents.toFixed(2)}¢ |`
    ),
    ""
  );
  if (domain === "reachkit.app") {
    lines.push("**Pass bar (owner, #1185):**", "");
    runs.forEach((r, i) => {
      if (r.conclusion === null) return;
      const bar = reachkitBar(r.conclusion);
      lines.push(`- Run ${i + 1}: **${bar.pass ? "pass" : "fail"}** — ${bar.why.join("; ")}`);
    });
    lines.push("");
  }
  return lines;
}

/** The home page's title and first heading, as the crawl read them. */
function headlineOf(pages: readonly { url: string; title: string; h1: string }[], domain: string): string | null {
  const home = pages.find((p) => p.url === `https://${domain}/` || p.url === `https://${domain}`);
  if (home === undefined) return null;
  return home.h1 !== "" && !home.title.includes(home.h1) ? `${home.title} — ${home.h1}` : home.title;
}

export async function main(a: { root: string; run: boolean; only: readonly string[] }): Promise<number> {
  const ledger = proofLedger(RUN_CAP_CENTS);
  const results = new Map<string, Run[]>();
  let n = 0;
  for (const domain of DOMAINS.filter((d) => a.only.length === 0 || a.only.includes(d))) {
    const snapshot = readSnapshot(domain);
    const report = readStoredReport(snapshot.report);
    const evidence = marketEvidence({
      domain,
      siteName: snapshot.siteProfile?.siteName ?? null,
      headline: headlineOf(snapshot.pages, domain),
      pages: snapshot.pages.map((p) => ({ url: p.url, title: p.title, text: p.text })),
      products: snapshot.siteProfile?.products ?? [],
      claims: snapshot.siteProfile?.claims ?? [],
      report,
    });
    console.log(
      `${domain}: ${evidence.pages.length} pages, ${evidence.answers.length} answers, ${evidence.topTens.length} top-ten domains, ${evidence.ownSearches.length} own searches`
    );
    if (!a.run) continue;
    const runs: Run[] = [];
    for (let i = 0; i < RUNS; i += 1) {
      n += 1;
      const cost = ledger.contextFor(n);
      const outcome = await inferMarket(cost, evidence);
      runs.push(
        outcome.kind === "measured"
          ? { conclusion: outcome.value, costCents: cost.spentCents(), failure: null }
          : { conclusion: null, costCents: cost.spentCents(), failure: outcome.kind === "unmeasured" ? (outcome.because ?? outcome.reason) : "zero" }
      );
      console.log(`  run ${i + 1}: ${runs[i]?.conclusion?.category ?? runs[i]?.failure}; ${cost.spentCents().toFixed(2)}¢`);
    }
    results.set(domain, runs);
  }
  if (!a.run || a.only.length > 0) return 0;

  const lines = [
    "# Market and rival inference — the offline dogfood test (#1185)",
    "",
    `Run ${new Date().toISOString().slice(0, 10)} by \`node scripts/market-inference.mjs --run\`, on stored evidence only: each site's stored report (its AI answers with the domains they cited, its measured top tens and its ranked searches) and the pages its scans read, from the committed snapshots in \`scripts/eval-content/snapshot/\`. No vendor was called and nothing was written to the database. The one live call is the inference itself (\`src/lib/market/infer/infer.ts\`, Haiku 4.5), ${RUNS === 1 ? "made once per site" : `made ${RUNS} times per site on the same evidence to show how stable it is`}. Rivals are only what survives the checks in \`concludeRivals()\`: products, never a publisher, aggregator or platform, never the site itself.`,
    "",
    `Total spend: ${ledger.spentCents().toFixed(2)}¢ of the ${RUN_CAP_CENTS}¢ allowed.`,
    "",
  ];
  for (const domain of DOMAINS) lines.push(...section(domain, results.get(domain) ?? []));
  const out = path.join(a.root, "docs/walk/market-inference.md");
  writeFileSync(out, `${lines.join("\n").trimEnd()}\n`);
  console.log(`wrote ${out}; ${ledger.spentCents().toFixed(2)}¢`);
  return 0;
}
