// tests/app/review/stored.ts — a panel site's week as the store would hold
// it after a commit: `choose`'s rows written to the plan columns, and every
// row held back unready. Not a suite. 0¢.
import { choose, type Choice } from "@/lib/opportunities/choose";
import type { OpportunityRow } from "@/lib/opportunities/store";
import { AT, panelSite, type PanelSite } from "../../golden/plan/panel";

export const FROM = AT.toISOString().slice(0, 10);

/** The week the golden plans print, from the same input. */
export function chosen(site: PanelSite): Choice {
  return choose({ rows: site.rows, fixRows: [], profile: site.profile, latest: null, drafted: [], cited: [], topTens: new Map(), at: AT, from: FROM });
}

/** The site's rows with the week committed into them. */
export function storedRows(domain: string): OpportunityRow[] {
  const site = panelSite(domain);
  const byId = new Map(chosen(site).committed.map((entry) => [entry.opportunityId, entry]));
  return site.rows.map((row) => {
    const entry = byId.get(row.id);
    if (entry === undefined) return { ...row, unready_reason: row.ready ? null : "unready" };
    return { ...row, plan_place: entry.place, planned_for: entry.plannedFor, plan_write_as: entry.writeAs, plan_reason: entry.reason };
  });
}
