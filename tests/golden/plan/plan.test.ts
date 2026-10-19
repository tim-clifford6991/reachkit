// Golden plans: the week `choose` commits for each customer-panel site, from
// its stored topic rows (`./panel.ts`). A change to how the week is chosen
// shows here as a diff of `<site>.md`; `vitest -u` writes the new plan once
// the diff is the one intended. 0¢.
import "../../opportunities/env";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { choose, type Choice } from "@/lib/opportunities/choose";
import { AT, panelDomains, panelSite, type PanelSite } from "./panel";

/** A site whose stored rows commit no page, the gate that holds them, and
 *  where the finding is filed. A hold that clears fails its case. */
const HELD: Readonly<Record<string, string>> = {
  "fletcherelectric.co.uk": "readiness: its only stored run (2026-10-10) has every topic ready: false, reason not stored (#1127)",
};

const FROM = AT.toISOString().slice(0, 10);
const REJECTED_SHOWN = 20;

function chosen(site: PanelSite): Choice {
  return choose({ rows: site.rows, fixRows: [], profile: site.profile, latest: null, drafted: [], cited: [], topTens: new Map(), at: AT, from: FROM });
}

function render(site: PanelSite, choice: Choice): string {
  return [
    `# ${site.domain}`,
    "",
    `From \`docs/walk/panel/${site.run}.json\`: ${site.rows.length} stored topics, ${choice.committed.length} committed from ${FROM}.`,
    ...(HELD[site.domain] === undefined ? [] : ["", `**Held:** ${HELD[site.domain]}.`]),
    "",
    ...week(site, choice),
  ].join("\n");
}

function week(site: PanelSite, choice: Choice): string[] {
  const byId = new Map(site.rows.map((row) => [row.id, row]));
  const cell = (value: unknown) => (value === null || value === undefined ? "—" : String(value));
  const lines = [
    "| Place | Day | Search | Type | Fit | Volume | Rule | Written as |",
    "|---|---|---|---|---|---|---|---|",
    ...choice.committed.map((entry) => {
      const row = byId.get(entry.opportunityId)!;
      return `| ${entry.place} | ${entry.plannedFor ?? "spare"} | ${row.target_query} | ${row.type} | ${cell(row.business_fit)} | ${cell(row.volume)} | ${cell(entry.rule)} | ${cell(entry.writeAs)} |`;
    }),
    "",
    "| Not chosen | Type | Fit | Volume | Reason |",
    "|---|---|---|---|---|",
    ...choice.rejected.slice(0, REJECTED_SHOWN).map((entry) => {
      const row = byId.get(entry.opportunityId)!;
      return `| ${row.target_query} | ${row.type} | ${cell(row.business_fit)} | ${cell(row.volume)} | ${entry.reason} |`;
    }),
    "",
  ];
  return lines;
}

describe("the golden week of each panel site", () => {
  for (const domain of panelDomains()) {
    it(domain, async () => {
      const site = panelSite(domain);
      const choice = chosen(site);
      await expect(render(site, choice)).toMatchFileSnapshot(`./${domain}.md`);
      // Every kind of business gets a first-day page, unless a named hold says why not.
      if (HELD[domain] === undefined) expect(choice.committed.length).toBeGreaterThanOrEqual(1);
      else expect(choice.committed).toHaveLength(0);
    });
  }
});

describe("the goldens are the customer panel's", () => {
  it("no fixture or golden is reachkit.app, and every golden is a panel site", () => {
    const domains = panelDomains();
    expect(domains).not.toContain("reachkit.app");
    const goldens = readdirSync(new URL(".", import.meta.url)).filter((file) => file.endsWith(".md"));
    expect(goldens.sort()).toEqual(domains.map((domain) => `${domain}.md`).sort());
  });

  it("a held site is a panel site", () => {
    for (const domain of Object.keys(HELD)) expect(panelDomains()).toContain(domain);
  });
});
