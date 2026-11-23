// scripts/pass/plan-replay.ts — a stored weekly pass's plan run again at 0¢ (`node scripts/pass/plan.mjs <file>`):
// derive's collapse over the topics as the pass found them, with the live pages read from publications whatever
// their row's status, then the Monday commit's `planWeek`. The input is `plan-export.sql`'s document; the output is
// `scripts/pass/golden/<first 8>.md`, each topic named by its place in the stored order, never by its search, so it
// can sit in the public repository.
//
// Not put back, so not replayed: the pass's new candidates and its same-question judgement (both from model calls
// kept only in `fetches`), and an absorbed search a later pass trimmed. Its research checks are not made either.
import "../../tests/opportunities/env";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { WEEK_PLAN } from "@/lib/config/constants";
import { parseStoredMarket } from "@/lib/market/infer/stored";
import { brandTokensOf, collapse, coveredTopics, topTenRowsOf, topTensOf } from "@/lib/opportunities/cluster";
import { planWeek } from "@/lib/opportunities/plan";
import type { OwnLivePage } from "@/lib/opportunities/refresh";
import { readOpportunity, setOpportunityStore, type OpportunityRow } from "@/lib/opportunities/store";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { memoryStore, newMemoryState } from "../../tests/opportunities/memory-store";

type Row = OpportunityRow & { status_changed_at: string; created_at: string };
interface Snapshot {
  scan: { id: string; site_id: string; created_at: string; finished_at: string; week_start: string | null };
  site: { id: string; domain: string; market: unknown };
  report: StoredReport;
  reports: (Pick<StoredReport, "questions" | "serps"> & { id: string; created_at: string })[];
  opportunities: Row[];
  drafts: { id: string; opportunity_id: string; state: string; title: string | null; scheduled_for: string | null; created_at: string }[];
  publications: { id: string; draft_id: string; live_url: string | null; claimed_at: string; published_at: string | null; unpublished_at: string | null }[];
}

const before = (at: string | null, start: number): boolean => at !== null && Date.parse(at) < start;

export async function main(file: string, root: string): Promise<number> {
  const snap = JSON.parse(readFileSync(file, "utf8")) as Snapshot;
  const start = Date.parse(snap.scan.created_at), now = new Date(snap.scan.finished_at);
  const own = readStoredReport(snap.report);

  // The topics as the pass found them: its own rows gone, the ones it changed open again and out of the lists they were absorbed into.
  const reopened = new Set(snap.opportunities.filter((row) => before(row.created_at, start) && !before(row.status_changed_at, start)).map((row) => row.target_query));
  const rows: Row[] = snap.opportunities
    .filter((row) => before(row.created_at, start))
    .map((row) => ({ ...(before(row.status_changed_at, start) ? row : { ...row, status: "open", plan_place: null, planned_for: null }), absorbed_queries: (row.absorbed_queries ?? []).filter((q) => !reopened.has(q)) }));
  const drafts = snap.drafts.filter((draft) => before(draft.created_at, start));
  const opportunityOf = new Map(drafts.map((draft) => [draft.id, draft.opportunity_id]));
  const pages = snap.publications.filter((p) => before(p.published_at, start) && !before(p.unpublished_at, start) && p.live_url !== null && opportunityOf.has(p.draft_id));
  const live = new Set(pages.map((p) => opportunityOf.get(p.draft_id)!));

  // Derive's collapse, as `derive/index.ts` calls it, with no new candidates.
  const topTens = new Map<string, readonly string[]>();
  for (const report of snap.reports) for (const [query, urls] of topTensOf(report)) topTens.set(query, urls);
  const market = parseStoredMarket(snap.site.market).current;
  const brandTokens = brandTokensOf(own);
  const plan = collapse({ existing: rows.map(readOpportunity), candidates: [], brandTokens, pass: { scanId: snap.scan.id, covered: coveredTopics(own, brandTokens, market) }, topTens, market, live });
  const dismissed = new Set(plan.dismiss);
  for (const row of rows) if (dismissed.has(row.id)) Object.assign(row, { status: "dismissed", ready: false });
  for (const u of plan.update) Object.assign(rows.find((row) => row.id === u.id)!, { cluster_key: u.clusterKey, absorbed_queries: [...u.absorbedQueries] });

  // The Monday commit over what the collapse left, with the commit's own arguments (`scan/weekly/commit.ts`).
  const byId = new Map(rows.map((row) => [row.id, row]));
  const topic = (id: string): string => `topic ${rows.findIndex((row) => row.id === id) + 1}`;
  const drafted = drafts.flatMap((d) => (d.scheduled_for === null || !byId.has(d.opportunity_id) ? [] : [{ date: d.scheduled_for, state: d.state, title: d.title, row: byId.get(d.opportunity_id)! }])).sort((a, b) => b.date.localeCompare(a.date));
  const livePages = pages.map((p) => ({ url: p.live_url!, publishedAt: new Date(p.published_at!), row: readOpportunity(byId.get(opportunityOf.get(p.draft_id)!)!), declined: false, facts: [] }) as unknown as OwnLivePage);
  const serps = new Map(snap.reports.flatMap((report) => [...topTenRowsOf(report)].map(([query, read]) => [query, { at: new Date(report.created_at), ...read }] as const)));
  const profile = own.market?.kind === "measured" ? own.market.value.profile : null;
  const state = newMemoryState({ profile, market, now, rows, drafted, livePages, report: own, weeklyCommit: snap.scan.week_start });
  setOpportunityStore({ ...memoryStore(state), topTenRows: async () => serps });
  const week = await planWeek(snap.site.id, { now, record: true, days: WEEK_PLAN.days });
  setOpportunityStore(null);

  const dated = week.filter((entry) => entry.plannedFor !== null).length;
  const lines = [
    `# Pass ${snap.scan.id.slice(0, 8)}, its plan replayed`,
    "",
    `${rows.length} topics held before the pass, ${live.size} behind a live page (${[...live].filter((id) => byId.get(id)?.status === "queued").length} stored queued). Week from ${week.from}: **${dated} of ${week.days} days dated**, ${week.length - dated} spares.`,
    "",
    "| Place | Day | Topic | Type | Fit |",
    "|---|---|---|---|---|",
    ...week.map((entry) => `| ${entry.place} | ${entry.plannedFor ?? "spare"} | ${topic(entry.opportunityId)} | ${byId.get(entry.opportunityId)?.type ?? "—"} | ${byId.get(entry.opportunityId)?.business_fit ?? "—"} |`),
    "",
    `Dismissed by the collapse: ${plan.dismiss.map(topic).join(", ") || "none"}.`,
    "",
  ];
  const out = path.join(root, "scripts/pass/golden", `${snap.scan.id.slice(0, 8)}.md`);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, lines.join("\n"));
  console.log(`${lines.join("\n")}\n${path.relative(root, out)}`);
  return dated === week.days ? 0 : 1;
}
