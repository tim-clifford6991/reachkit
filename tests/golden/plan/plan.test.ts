// Golden plans: the week `choose` commits for each customer-panel site, from
// its stored topic rows (`./panel.ts`). A change to how the week is chosen
// shows here as a diff of `<site>.md`; `vitest -u` writes the new plan once
// the diff is the one intended. 0¢.
import "../../opportunities/env";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WEEK_PLAN } from "@/lib/config/constants";
import { measured } from "@/lib/measure/measured";
import { choose, type Choice } from "@/lib/opportunities/choose";
import { contentTypeOf } from "@/lib/opportunities/content-type";
import { readOpportunity, type OpportunityRow } from "@/lib/opportunities/store";
import { AT, panelDomains, panelSite, rowOf, type PanelSite } from "./panel";

/** A site whose stored rows commit no page, the gate that holds them, and
 *  where the finding is filed. A hold that clears fails its case. */
const HELD: Readonly<Record<string, string>> = {
  "fletcherelectric.co.uk": "readiness: its only stored run (2026-10-10) has every topic ready: false, reason not stored (#1127)",
};

const FROM = AT.toISOString().slice(0, 10);
const REJECTED_SHOWN = 20;

function chosen(site: PanelSite, linkedClusters: readonly string[] = []): Choice {
  return choose({ rows: site.rows, fixRows: [], profile: site.profile, latest: null, drafted: [], cited: [], topTens: new Map(), linkedClusters, at: AT, from: FROM });
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
    "| Place | Day | Search | Type | Page | Fit | Volume | Points | Parts | Rule | Written as |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...choice.committed.map((entry) => {
      const row = byId.get(entry.opportunityId)!;
      const parts = entry.reason.parts.map((part) => `${part.part} ${part.n}`).join(" + ");
      return `| ${entry.place} | ${entry.plannedFor ?? "spare"} | ${row.target_query} | ${row.type} | ${cell(contentTypeOf(readOpportunity(row)))} | ${cell(row.business_fit)} | ${cell(row.volume)} | ${entry.reason.points} | ${parts || "—"} | ${cell(entry.reason.rule)} | ${cell(entry.writeAs)} |`;
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

/** One panel site of each kind the week must hold for. */
const KINDS: Readonly<Record<string, string>> = {
  saas: "savvycal.com",
  local: "austinplumbery.com",
  shop: "tattly.com",
  agency: "clearleft.com",
  "multi-line": "wesbos.com",
};

describe("every kind of business commits a full week from its stored supply", () => {
  for (const [kind, domain] of Object.entries(KINDS)) {
    it(`${kind} (${domain}): seven days where seven topics are ready, and every ready topic where fewer are`, () => {
      const site = panelSite(domain);
      const choice = chosen(site);
      const ready = site.rows.filter((row) => row.ready).length;
      const days = choice.committed.filter((entry) => entry.plannedFor !== null);
      expect(days).toHaveLength(Math.min(WEEK_PLAN.days, ready));
      for (const entry of choice.committed) expect(entry.reason.points).toBe(entry.reason.parts.reduce((sum, part) => sum + part.n, 0));
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

/** The offering pages among a choice's dated days. */
function offeringDays(site: Pick<PanelSite, "rows">, choice: Choice): string[] {
  const byId = new Map(site.rows.map((row) => [row.id, row]));
  return choice.committed
    .filter((entry) => entry.plannedFor !== null && entry.writeAs == null && contentTypeOf(readOpportunity(byId.get(entry.opportunityId)!)) === "offering")
    .map((entry) => byId.get(entry.opportunityId)!.target_query!);
}

describe("at most two offering pages in seven days", () => {
  it.each(panelDomains())("%s", (domain) => {
    const site = panelSite(domain);
    expect(offeringDays(site, chosen(site)).length).toBeLessThanOrEqual(2);
  });

  it("four offering searches that outrank every answer take two of the seven days", () => {
    // The plumber's stored searches whose stored SERP asks for a provider's own page.
    const plumber = panelSite("austinplumbery.com");
    const shaped = ["emergency plumber austin texas", "plumbing services austin tx", "commercial plumber austin", "austin emergency plumber"];
    const answers = [
      "how to fix a leaking pipe",
      "how to unclog a shower drain",
      "what is a backflow preventer",
      "what is a sump pump",
      "water heater making noise",
      "pipe burst in winter",
    ];
    const topic = (query: string, type: "keyword_page" | "answer_page", fit: number) => ({ query, status: "open", type, fit, volume: 100, ready: true });
    const rows = [...shaped.map((query) => topic(query, "keyword_page", 3)), ...answers.map((query) => topic(query, "answer_page", 2))].map((stored, n) => {
      const row = rowOf("austinplumbery.com", stored, n);
      return n < shaped.length ? { ...row, evidence: { ...(row.evidence as object), shape: "offering" } } : row;
    });
    const site = { ...plumber, rows };
    const days = offeringDays(site, chosen(site));
    expect(days).toHaveLength(2);
  });
});

/** The site's first two topics as live pages, refreshed: the first stalled
 *  near page one, the second not moving. Its last two topics share a cluster
 *  an AI answer linked. */
function withResults(site: PanelSite): PanelSite {
  const ready = site.rows.filter((row) => row.ready);
  const [stalled, flat] = ready;
  const linked = new Set(ready.slice(-2).map((row) => row.id));
  const refresh = (row: OpportunityRow, cause: "close" | "unmet"): OpportunityRow => {
    const url = `https://blog.${site.domain}/${row.target_query!.replaceAll(" ", "-")}`;
    const volume = (row.evidence as { volume: unknown }).volume;
    const since = measured(new Date(AT.getTime() - 60 * 86_400_000), AT);
    const evidence = { family: "improve", query: row.target_query, volume, pageUrl: url, shortfall: { kind: "due", cause, since } };
    return { ...row, id: `${row.id}:${cause}`, type: "refresh_page", family: "improve", target_ref: url, evidence };
  };
  const rows = site.rows.flatMap((row) =>
    row === stalled ? [refresh(row, "close")] : row === flat ? [refresh(row, "unmet")] : [linked.has(row.id) ? { ...row, cluster_key: "linked" } : row]
  );
  return { ...site, rows };
}

describe("each action a page's own results take is the stored rule", () => {
  for (const domain of [KINDS.saas!, KINDS.local!]) {
    it(domain, async () => {
      const site = withResults(panelSite(domain));
      await expect(render(site, chosen(site, ["linked"]))).toMatchFileSnapshot(`./results/${domain}.md`);
    });
  }
});
