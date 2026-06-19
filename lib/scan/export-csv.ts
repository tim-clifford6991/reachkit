/**
 * CSV export of a report payload (ChannelIntel Phase 4) — the paid "exportable
 * lists" deliverable. PURE: turns a ReportPayload into a multi-section CSV
 * (competitors, keyword gap, demand pockets, the ranked playbook). Sections are
 * separated by a blank line and a `# Section` marker so the single file opens
 * cleanly and is easy to split.
 */

import type { ReportPayload } from "@/lib/scan/report";

/** RFC-4180 field escaping: quote when the value has a comma, quote, or newline. */
function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: Array<string | number | null | undefined>): string {
  return cells.map(cell).join(",");
}

/** Serialize a report's market analysis into a multi-section CSV string. */
export function reportToCsv(payload: ReportPayload): string {
  const lines: string[] = [];
  const market = payload.market;

  lines.push("# Competitors");
  lines.push(row(["domain", "organic_keywords", "etv", "referring_domains", "authority"]));
  if (market) {
    const profiles = [market.cohort.self, ...market.cohort.competitors];
    for (const p of profiles) {
      lines.push(row([p.domain, p.seo?.organicKeywords, p.seo?.etv, p.seo?.referringDomains, p.seo?.authority]));
    }
  }

  lines.push("");
  lines.push("# Keyword gap (rivals rank, you don't)");
  lines.push(row(["keyword", "volume", "rivals_ranking", "best_rival_position"]));
  for (const k of market?.gap.keywordGap ?? []) {
    lines.push(row([k.keyword, k.volume, k.rivalsRanking, k.bestRivalPosition]));
  }

  lines.push("");
  lines.push("# Demand pockets");
  lines.push(row(["surface", "threads", "score"]));
  for (const d of market?.gap.demandPockets ?? []) {
    lines.push(row([d.surface, d.count, Math.round(d.score)]));
  }

  lines.push("");
  lines.push("# Distribution playbook (ranked)");
  lines.push(row(["rank", "kind", "title", "impact", "ease", "competition", "score", "why"]));
  (market?.plan.items ?? []).forEach((it, i) => {
    lines.push(
      row([
        i + 1,
        it.kind,
        it.title,
        Math.round(it.impact * 100),
        Math.round(it.ease * 100),
        Math.round(it.competition * 100),
        Math.round(it.score * 100),
        it.why,
      ]),
    );
  });

  return lines.join("\n") + "\n";
}
