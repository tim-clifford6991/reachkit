// scripts/pass/weekly.ts — a stored weekly pass's derivation run again (SPEC §7 *Pages left*): the top-up, what it
// bought under `CAPS.TOPUP_C`, and the rows the fit call wrote. `run.ts` loads the snapshot and hands over here.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { CAPS, PLAN_DEPTH, TOPIC_FIT } from "@/lib/config/constants";
import { withCostContext } from "@/lib/costs";
import { deriveForPass } from "@/lib/opportunities";
import { topUpSpend } from "@/lib/market/questions/top-up-buy";
import { FREE_SCAN_POLICY_VERSION } from "@/lib/scan/ceilings";
import type { StoredReport } from "@/lib/scan/report";
import { psql } from "../local-run.mjs";
import { appendSpend } from "../spend-log.mjs";

type Bought = { source: string; cost_cents: number | string; billed_cents?: number | string | null; activity?: string; id?: string };
type Topic = { target_query: string; volume: number | null; business_fit: number | null; ready: boolean | null; unready_reason: string | null; fit_fact: unknown; status: string; family: string };

const cents = (n: number): string => `${n.toFixed(2)}¢`;
const writable = `o.status = 'open' and o.family in ('write', 'earn') and (o.business_fit is null or o.business_fit >= ${TOPIC_FIT.gate}) and not (o.ready = false and o.unready_reason in ('resting', 'out_of_reach'))`;

export async function replayWeekly(a: {
  live: boolean;
  root: string;
  site: string;
  siteId: string;
  scanId: string;
  report: StoredReport;
  loadedAt: string;
  boughtFile: string;
  kept: readonly object[];
  say: (line: string) => void;
}): Promise<number> {
  const count = (): number => Number(psql(`select count(*) from public.opportunities o where o.site_id = '${a.siteId}' and ${writable};`).trim());
  const before = count();
  const lines: string[] = [];
  console.log = (line: unknown) => void (typeof line === "string" && line.includes('"supply_pass"') && lines.push(line));
  // The weekly room the derivation had, without the stored pass's own spend before it.
  await withCostContext({ scanId: a.scanId, cap: "WEEKLY", policyVersion: FREE_SCAN_POLICY_VERSION }, (cost) => deriveForPass(cost, { tier: "weekly", siteId: a.siteId, report: a.report, hasActiveAccess: true, topUp: topUpSpend(a.scanId, FREE_SCAN_POLICY_VERSION) }));
  console.log = a.say;

  const supply = JSON.parse(lines.at(-1) ?? "{}") as { have?: number; topUp?: { fired: boolean; have: number; sources: Record<string, { offered: number; added: number }>; rejected: Record<string, number>; bought?: { seeds: string[]; cents: number; degraded?: string } } | null };
  const topUp = supply.topUp ?? null;
  const rows = JSON.parse(psql(`select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at), '[]'::jsonb) from public.fetches f where f.created_at >= '${a.loadedAt}';`).trim() || "[]") as Bought[];
  const topics = JSON.parse(psql(`select coalesce(jsonb_agg(jsonb_build_object('target_query', o.target_query, 'volume', o.volume, 'business_fit', o.business_fit, 'ready', o.ready, 'unready_reason', o.unready_reason, 'fit_fact', o.evidence->'fitFact', 'status', o.status, 'family', o.family) order by o.created_at), '[]'::jsonb) from public.opportunities o where o.site_id = '${a.siteId}' and o.created_at >= '${a.loadedAt}';`).trim() || "[]") as Topic[];
  const after = count();
  const topUpCents = rows.filter((row) => row.activity === "topup").reduce((sum, row) => sum + Number(row.cost_cents), 0);

  a.say(`\nWeekly derivation: ${before} writable before, ${after} after (PLAN_DEPTH ${PLAN_DEPTH})`);
  if (topUp === null) a.say("  top-up: not run");
  else {
    a.say(`  top-up: ${topUp.fired ? "fired" : "not fired"} at ${topUp.have}; ${Object.entries(topUp.sources).map(([n, s]) => `source ${n} offered ${s.offered}, added ${s.added}`).join("; ")}`);
    a.say(`  rejected: ${Object.entries(topUp.rejected).filter(([, n]) => n > 0).map(([why, n]) => `${why} ${n}`).join(", ") || "none"}`);
    if (topUp.bought !== undefined) a.say(`  bought: seeds ${topUp.bought.seeds.join(", ") || "none"}; ${cents(topUp.bought.cents)} of ${cents(CAPS.TOPUP_C)}${topUp.bought.degraded === undefined ? "" : `; degraded ${topUp.bought.degraded}`}`);
  }
  a.say("\nNew rows");
  for (const row of topics) a.say(`  ${row.target_query} — ${row.volume ?? "no volume"}/mo, fit ${row.business_fit ?? "unjudged"}, ${row.ready === false ? `held ${row.unready_reason}` : "ready"}; fitFact ${JSON.stringify(row.fit_fact ?? null)}`);
  a.say("\nLedger");
  for (const row of rows) a.say(`  ${row.activity ?? "?"}  ${row.source}  ${cents(Number(row.cost_cents))}`);

  const checks: [boolean, string][] = [
    [topUpCents <= CAPS.TOPUP_C, `top-up ledger rows within TOPUP_C: ${cents(topUpCents)}`],
    [topUp === null || topUp.fired === topUp.have < PLAN_DEPTH, "the top-up fires only under PLAN_DEPTH"],
    [topUpCents === 0 || topUp?.fired === true, "the top-up spends only on a short week"],
    [after >= 7 || topUp?.fired === true, `at least 7 writable, or the top-up tried: ${after}`],
  ];
  a.say("\nAcceptance");
  for (const [ok, line] of checks) a.say(`  ${ok ? "✓" : "✗"} ${line}`);

  const paid = a.live ? rows.filter((row) => Number(row.cost_cents) > 0) : [];
  if (paid.length > 0) {
    for (const row of paid) appendSpend({ script: "pass", source: row.source, cents: Number(row.cost_cents), billed: row.billed_cents === null || row.billed_cents === undefined ? undefined : Number(row.billed_cents), domain: a.site });
    const kept = [...a.kept, ...paid.map((row) => ({ ...row, id: undefined, scan_id: `issue-box:${a.scanId.slice(0, 8)}` }))];
    writeFileSync(a.boughtFile, `${JSON.stringify(kept, null, 1)}\n`);
    a.say(`\nBought now: ${cents(paid.reduce((sum, row) => sum + Number(row.cost_cents), 0))} in ${paid.length} calls, kept in ${path.relative(a.root, a.boughtFile)} and written to the spend log.`);
  }
  return checks.every(([ok]) => ok) ? 0 : 1;
}
