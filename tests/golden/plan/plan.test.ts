// Golden plans: the week `choose` commits for each customer-panel site, from
// its stored topic rows (`./panel.ts`). A change to how the week is chosen
// shows here as a diff of `<site>.md`; `vitest -u` writes the new plan once
// the diff is the one intended. 0¢.
import "../../opportunities/env";
import { readdirSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { PLAN_DEPTH, WEEK_PLAN } from "@/lib/config/constants";
import { measured, unmeasured } from "@/lib/measure/measured";
import { choose, type Choice } from "@/lib/opportunities/choose";
import { clusterKey, collapse } from "@/lib/opportunities/cluster";
import { contentTypeOf } from "@/lib/opportunities/content-type";
import { LEDGER_SOURCES, supplyLedger } from "@/lib/opportunities/derive/ledger";
import { sourceOf } from "@/lib/opportunities/derive/topics";
import { pageForDay, planFirstWeek, planWeek } from "@/lib/opportunities/plan";
import { assessReadiness } from "@/lib/opportunities/readiness";
import { readOpportunity, setOpportunityStore, type OpportunityRow } from "@/lib/opportunities/store";
import type { OwnLivePage } from "@/lib/opportunities/refresh";
import { canonicalUrl } from "@/lib/measure/page-reading";
import { memoryStore, newMemoryState, type MemoryState } from "../../opportunities/memory-store";
import { AT, panelDomains, panelSite, SITE_ID, storedSerps, type PanelSite } from "./panel";

/** A site whose stored rows commit no page, the gate that holds them, and
 *  where the finding is filed. A hold that clears fails its case. */
const HELD: Readonly<Record<string, string>> = {
};

const FROM = AT.toISOString().slice(0, 10);
const REJECTED_SHOWN = 20;

function chosen(site: PanelSite, linkedClusters: readonly string[] = []): Choice {
  return choose({ rows: site.rows, fixRows: [], profile: site.profile, market: site.market, cited: [], topTens: new Map(), linkedClusters, at: AT, from: FROM });
}

function render(site: PanelSite, choice: Choice): string {
  return [
    `# ${site.domain}`,
    "",
    `From \`scripts/panel/runs/${site.run}.json\`: ${site.rows.length} stored topics, ${choice.committed.length} committed from ${FROM}.`,
    "",
    supplyLine(site, choice),
    ...(HELD[site.domain] === undefined ? [] : ["", `**Held:** ${HELD[site.domain]}.`]),
    "",
    ...week(site, choice),
  ].join("\n");
}

/** What the pass's ledger would store for these rows, and the stored topics by source. */
function supplyLine(site: PanelSite, choice: Choice): string {
  const { short } = supplyLedger({ stages: {}, rows: site.rows.map(readOpportunity) });
  const brands = [...site.profile.brandTokens, ...site.market.rivals.map((rival) => rival.name)];
  const counts = new Map<string, number>();
  for (const row of site.rows) {
    const source = sourceOf(row.target_query ?? "", { brands });
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  const bySource = LEDGER_SOURCES.flatMap((source) => (counts.has(source) ? [`${source} ${counts.get(source)}`] : [])).join(", ");
  return `Supply: ${choice.committed.length} of ${PLAN_DEPTH} committed, short ${short}; stored topics ${bySource}.`;
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

// The weeks above are chosen from every stored row; production first runs derive's collapse over them, where a
// published page's row still reads `queued`. A topic joined to a live page stays as its update, never dismissed.
function liveWeek(domain: string, absorbed: readonly number[] = []) {
  const site = panelSite(domain);
  const live = new Set(site.rows.filter((row) => row.ready).slice(0, 2).map((row) => row.id));
  const others = site.rows.filter((row) => !live.has(row.id)).map((row) => row.target_query!);
  // As production's chained joins stored them: every other topic of the site, then searches nothing links to the page.
  const list = (n: number) => [...others, ...Array.from({ length: n }, (_, i) => `unlinked search ${i}`)].slice(0, n);
  const held = site.rows.map((row) => (live.has(row.id) ? { ...row, status: "queued", absorbed_queries: list(absorbed[[...live].indexOf(row.id)] ?? 0) } : row));
  const topTens = new Map([...storedSerps(domain)].map(([query, read]) => [query, read.rows.slice(0, 10).flatMap((row) => (row.url === undefined ? [] : [canonicalUrl(row.url)]))]));
  // Each row holds its key as production writes it, one row per key as the index allows.
  const keyed = held.map((row, i) => ({ ...row, cluster_key: held.findIndex((other) => clusterKey(other.target_query, site.profile.brandTokens) === clusterKey(row.target_query, site.profile.brandTokens)) === i ? clusterKey(row.target_query, site.profile.brandTokens) : null }));
  const plan = collapse({ existing: keyed.map(readOpportunity), candidates: [], brandTokens: site.profile.brandTokens, topTens, market: site.market, live });
  const gone = new Set(plan.dismiss);
  const after: OpportunityRow[] = held.map((row) => ({ ...row, absorbed_queries: [...(plan.update.find((u) => u.id === row.id)?.absorbedQueries ?? row.absorbed_queries)] }));
  const open = after.filter((row) => row.status === "open" && !gone.has(row.id));
  const pages = after.filter((row) => live.has(row.id)).map((row) => ({ url: `https://${domain}/${row.id}`, publishedAt: new Date(AT.getTime() - 5 * 86_400_000), row: readOpportunity(row), declined: false }) as unknown as OwnLivePage);
  const choice = choose({ rows: open, fixRows: [], profile: site.profile, market: site.market, cited: [], topTens, linkedClusters: [], live: pages, at: AT, from: FROM });
  return { site, live, held: keyed, plan, gone, open, choice };
}

describe("a site whose first topics are live pages, stored queued, commits its week from what the collapse leaves", () => {
  for (const [kind, domain] of Object.entries(KINDS)) {
    it(`${kind} (${domain})`, async () => {
      const { site, live, held, plan, gone, open, choice } = liveWeek(domain);
      const updates = plan.update.filter((u) => u.absorbedQueries.length > 0).map((u) => `${held.find((row) => row.id === u.id)?.target_query}${live.has(u.id) ? " (live)" : ""}: ${u.absorbedQueries.join(", ")}`);
      const lines = [`Live, stored queued: ${held.filter((row) => live.has(row.id)).map((row) => row.target_query).join("; ")}.`, `Absorbed: ${updates.join("; ") || "none"}.`, `Dismissed: ${held.filter((row) => gone.has(row.id)).map((row) => row.target_query).join("; ") || "none"}.`, "", ...week({ ...site, rows: open }, choice)];
      await expect(lines.join("\n")).toMatchFileSnapshot(`./results/live/${domain}.md`);
      // A search joined to a live page is held by an open update of it, never absorbed into the page and dismissed.
      expect(plan.update.filter((u) => live.has(u.id))).toEqual([]);
      // Losers are dismissed last, so no update takes a key another open or queued row still holds.
      expect(plan.update.filter((u) => held.some((row) => row.id !== u.id && row.cluster_key !== null && row.cluster_key === u.clusterKey))).toEqual([]);
      // Live rows holding 77 and 31 searches a chain of joins stored bind no topic: the week is the one they would leave.
      const long = liveWeek(domain, [77, 31]);
      expect(long.choice.committed.filter((entry) => entry.plannedFor !== null)).toHaveLength(WEEK_PLAN.days);
      expect([long.plan.dismiss, long.choice.committed.map((entry) => entry.opportunityId)]).toEqual([plan.dismiss, choice.committed.map((entry) => entry.opportunityId)]);
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

describe("the bakery and the electrician commit pages once readiness runs over their stored topics", () => {
  afterEach(() => setOpportunityStore(null));

  it.each(["baeckerei-hinkel.de", "fletcherelectric.co.uk"])("%s", async (domain) => {
    const site = panelSite(domain);
    // Every row unassessed, in the band the run did not store; readiness decides the rest.
    const rows = site.rows.map((row) => ({ ...row, ready: false, unready_reason: "not_assessed", fit_band: "winnable" }));
    const state = newMemoryState({ profile: site.profile, market: site.market, now: AT, rows });
    const serps = storedSerps(domain);
    setOpportunityStore({ ...memoryStore(state), topTenRows: async () => serps });
    const days = (await planFirstWeek(SITE_ID, AT)).filter((entry) => entry.plannedFor !== null);
    const held = state.rows.filter((row) => !row.ready).map((row) => `${row.target_query}: ${row.unready_reason}`);
    expect(days.length, held.join("; ")).toBeGreaterThanOrEqual(1);
  });
});

describe("a week whose rows all go unready mid-week is committed again from the date", () => {
  afterEach(() => setOpportunityStore(null));

  it("every panel site's Wednesday takes a row the week left out, where one is ready, and its week runs from that date", async () => {
    const midweek = new Date(AT.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
    const lines = ["| Site | Ready left out | Wednesday's page | Week from Wednesday |", "|---|---|---|---|"];
    for (const domain of panelDomains()) {
      const site = panelSite(domain);
      const state = newMemoryState({ profile: site.profile, market: site.market, now: AT, rows: site.rows.map((row) => ({ ...row })) });
      // The stored readiness stands, as in the goldens above; only the week's own rows go unready.
      setOpportunityStore({ ...memoryStore(state), topTenRows: async () => storedSerps(domain), setReadiness: async () => {} });
      const week = new Set((await planWeek(SITE_ID, { now: AT, from: FROM })).map((entry) => entry.opportunityId));
      for (const row of state.rows) if (week.has(row.id)) Object.assign(row, { ready: false, unready_reason: "resting" });
      const left = state.rows.filter((row) => row.ready && row.status === "open").length;
      const page = await pageForDay(SITE_ID, midweek, AT);
      const days = state.rows.filter((row) => row.planned_for != null && row.planned_for >= midweek).sort((a, b) => a.plan_place! - b.plan_place!);
      expect([page === null, (state.recommits ?? []).length]).toEqual([left === 0, left === 0 ? 0 : 1]);
      if (page !== null) expect([week.has(page.id), days[0]?.id, days[0]?.planned_for]).toEqual([false, page.id, midweek]);
      lines.push(`| ${domain} | ${left} | ${page?.targetQuery ?? "none"} | ${page === null ? "unchanged" : days.map((row) => row.target_query).join("; ")} |`);
    }
    await expect(lines.join("\n") + "\n").toMatchFileSnapshot("./results/recommit.md");
  });

  it("a recommit for a resting day keeps the later days where Monday put them, once per date, and no two rows share a place", async () => {
    const site = panelSite("austinplumbery.com");
    const monday = async () => {
      const state = newMemoryState({ profile: site.profile, market: site.market, now: AT, rows: site.rows.map((row) => ({ ...row })) });
      setOpportunityStore({ ...memoryStore(state), topTenRows: async () => storedSerps(site.domain), setReadiness: async () => {} });
      return { state, days: (await planWeek(SITE_ID, { now: AT, from: FROM })).flatMap((e) => (e.plannedFor === null ? [] : [e.plannedFor])) };
    };
    // The date's row and the spares rest, so its run recommits.
    const short = (state: MemoryState, date: string) => {
      for (const row of state.rows) if (row.plan_place != null && (row.planned_for == null || row.planned_for === date)) Object.assign(row, { ready: false, unready_reason: "resting" });
      return pageForDay(SITE_ID, date, AT, true);
    };
    const { state, days } = await monday();
    const later = () => state.rows.filter((row) => row.planned_for != null && row.planned_for > days[3]!).map((row) => [row.id, row.plan_place, row.planned_for]);
    const before = later();
    expect([before.length, await short(state, days[3]!) === null]).toEqual([3, false]);
    expect(later()).toEqual(before);
    expect([await short(state, days[3]!), await short(state, days[4]!)].map((page) => page === null)).toEqual([true, false]);
    expect((state.recommits ?? []).map((r) => r.date)).toEqual([days[3], days[4]]);
    // Production, 26 Nov: a live page published nine days ago answers a dated row's question, so its day writes another topic.
    const twin = state.rows.find((row) => row.planned_for === days[5])!, page = { url: `https://${site.domain}/live`, publishedAt: new Date(AT.getTime() - 9 * 86_400_000), row: readOpportunity({ ...twin, id: "live" }), declined: false };
    state.livePages = [page as unknown as OwnLivePage];
    expect([await pageForDay(SITE_ID, days[5]!, AT, true)].map((o) => [o === null, o?.id === twin.id])).toEqual([[false, false]]);
    // And its repeat: a dated roundup whose title nearly copies a week-old live page's, on another search.
    const repeat = Object.assign(state.rows.find((row) => row.planned_for === days[6])!, { type: "listed_page", target_query: "best emergency plumber austin", title: "Best Emergency Plumber in Austin: 5 Answers" });
    state.livePages = [{ ...page, url: `https://${site.domain}/best`, title: "Best emergency plumber in Austin: 6 options compared", row: readOpportunity({ ...repeat, id: "best", target_query: "most reliable emergency plumbing services austin" }) } as unknown as OwnLivePage];
    expect((await pageForDay(SITE_ID, days[6]!, AT, true))?.id).not.toBe(repeat.id);
    const second = await monday();
    await short(second.state, second.days[1]!);
    const places = second.state.rows.flatMap((row) => (row.plan_place == null ? [] : [row.plan_place]));
    expect(new Set(places).size).toBe(places.length);
  });
});

describe("two stored market changes join the ranked week and take its earliest dates, freshest first", () => {
  it.each(Object.entries(KINDS))("%s (%s)", async (_kind, domain) => {
    const site = panelSite(domain), base = site.rows.find((row) => row.ready && row.family === "write")!;
    const hot = (id: string, search: string, age: number): OpportunityRow => {
      const reason = { signal: "news" as const, event: search, date: new Date(AT.getTime() - age * 86_400_000).toISOString().slice(0, 10), a: "a.example", b: "b.example", key: `news:${id}`, detectedOn: FROM };
      // As the Monday offer stores it (`src/lib/hot/offer.ts`).
      return { ...base, id, type: "keyword_page", target_query: search, target_ref: id, title: search, business_fit: 3, fit_band: "reach", volume: null, evidence: { family: "write", query: search, volume: unmeasured<number>("not_attempted", AT), rival: null, hot: { claims: [], reason, changes: true } } };
    };
    const timely = { ...site, rows: [...site.rows, hot("timely-older", "zephyr rule change explained for buyers", 10), hot("timely-fresh", "what the quasar 5.2 launch means for buyers", 3)] };
    const choice = chosen(timely);
    await expect(render(timely, choice)).toMatchFileSnapshot(`./results/timely/${domain}.md`);
    expect(choice.committed.slice(0, 2).map((entry) => [entry.opportunityId, entry.reason.hot?.key])).toEqual([["timely-fresh", "news:timely-fresh"], ["timely-older", "news:timely-older"]]);
  });
});

describe("a reworded roundup of the products a live roundup names is that page's, and a comparison of two is not", () => {
  afterEach(() => setOpportunityStore(null));

  it("savvycal.com", async () => {
    const site = panelSite("savvycal.com"), base = site.rows.find((row) => row.family === "write")!;
    const row = (id: string, type: string, search: string): OpportunityRow => ({ ...base, id, type, target_query: search, title: null, ready: false, unready_reason: "not_assessed", evidence: { ...(base.evidence as object), query: search } } as OpportunityRow);
    const roundup = { source: "reachkit", ref: "roundup", url: "https://savvycal.com/blog/roundup", title: "Six tools side by side", headings: ["How we chose", "SavvyCal", "Calendly", "Acuity Scheduling", "Koalendar", "LunaCal", "YouCanBook.me", "Which to pick"], live: true, publishedAt: new Date(AT.getTime() - 40 * 86_400_000) };
    const state = newMemoryState({ profile: site.profile, market: site.market, now: AT, rows: [row("reworded", "listed_page", "top booking tools for consultants"), row("pair", "comparison_page", "savvycal vs calendly")], report: { domain: "savvycal.com" } as never, knownContent: [roundup as never] });
    setOpportunityStore(memoryStore(state));
    await assessReadiness(SITE_ID, { at: AT, now: AT });
    await expect(state.rows.map((r) => `${r.target_query}: ${r.ready ? "placed" : `held, ${r.unready_reason}`}`).join("\n") + "\n").toMatchFileSnapshot("./results/covered.md");
  });
});
