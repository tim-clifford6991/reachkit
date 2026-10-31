/** @vitest-environment jsdom */
// Settings › Market against board SettingsMarket: each section's words in the
// board's order for a plumber and a SaaS, figures from the Competitors tab's own
// readers, and an unread half never drawn as 0.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";
import type { MarketFigures } from "@/app/(account)/app/settings/market-figures";

applyEnvFixture();

const { default: SettingsMarketTab } = await import("@/app/(account)/app/settings/market/page");
const { MarketPanel } = await import("@/app/(account)/app/settings/panels/MarketPanel");
const { CompetitorsPanel } = await import("@/app/(account)/app/settings/panels/CompetitorsPanel");
const { assembleSettings } = await import("@/app/(account)/app/settings/model");
const { FIXTURE_SETTINGS_FACTS } = await import("@/app/(account)/app/settings/fixture");
const { marketFigures } = await import("@/app/(account)/app/settings/market-figures");
const { readRivals } = await import("@/app/(account)/app/_overview/rivals-provider");
const { readOverview } = await import("@/app/(account)/app/_overview/provider");
const { readPromptsAt } = await import("@/app/(account)/app/_overview/prompts-provider");
const { namedOf } = await import("@/app/(account)/app/_overview/rivals-model");
const { BATTERY } = await import("@/lib/config/constants");
const { copy } = await import("@/lib/presentation/copy");
const { resetAccount, signedInAs } = await import("../account-door");

const TZ = "America/Chicago";

function mount(element: React.JSX.Element): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(element);
  return root;
}

const text = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const icons = (el: Element | null): string[] =>
  [...(el?.querySelectorAll("svg.lucide") ?? [])].map((svg) => [...svg.classList].find((c) => c.startsWith("lucide-")) ?? "");

interface Customer {
  name: string;
  domain: string;
  category: string;
  competitors: readonly string[];
  /** Found by ReachKit; the rest were added by the customer. */
  found: readonly string[];
  figures: MarketFigures;
  sets: { searches: number; questions: number };
}

const PLUMBER: Customer = {
  name: "plumber",
  domain: "harborplumbing.example",
  category: "Plumbers in Austin, Texas",
  competitors: ["austinpipeworks.example", "capitolrooter.example"],
  found: ["austinpipeworks.example", "capitolrooter.example"],
  figures: {
    cards: {
      "austinpipeworks.example": { google: { n: 5, of: 12 }, ai: { n: 41, of: 184 } },
      "capitolrooter.example": { google: { n: 4, of: 12 }, ai: { n: 29, of: 184 } },
    },
    you: { google: { n: 1, of: 12 }, ai: { n: 11, of: 184 } },
  },
  sets: { searches: 12, questions: 23 },
};

const SAAS: Customer = {
  name: "SaaS",
  domain: "northwind.example",
  category: "invoicing software",
  competitors: ["billwise.example", "paydesk.example", "ledgerly.example"],
  found: ["billwise.example"],
  figures: {
    cards: {
      "billwise.example": { google: { n: 7, of: 12 }, ai: { n: 9, of: 40 } },
      "paydesk.example": { google: { n: 0, of: 12 }, ai: { n: 3, of: 40 } },
      // Added after the last scan.
      "ledgerly.example": null,
    },
    you: { google: { n: 2, of: 12 }, ai: { n: 5, of: 40 } },
  },
  sets: { searches: 12, questions: 5 },
};

function settingsOf(c: Customer) {
  return assembleSettings({
    ...FIXTURE_SETTINGS_FACTS,
    domain: c.domain,
    category: c.category,
    competitors: c.competitors,
    measuredRivals: c.competitors.filter((domain) => c.figures.cards[domain] !== null),
    timeZone: TZ,
    concluded: {
      category: c.category,
      categoryReason: "",
      reasons: Object.fromEntries(c.found.map((domain) => [domain, "Ranks for your searches."])),
      categoryOverridden: false,
      rivalsOverridden: false,
    },
  });
}

function market(c: Customer): HTMLElement {
  const model = settingsOf(c);
  return mount(
    <MarketPanel
      market={model.market}
      concluded={model.concluded}
      domain={model.domain}
      timeZone={TZ}
      sets={{ ...c.sets, competitors: c.competitors.length }}
    />
  );
}

function competitors(c: Customer, over: { leaders?: readonly string[]; figures?: MarketFigures; list?: readonly string[] } = {}): HTMLElement {
  const model = settingsOf(c);
  return mount(
    <CompetitorsPanel
      competitors={over.list ?? c.competitors}
      concluded={model.concluded}
      figures={over.figures ?? c.figures}
      measuredFrom={model.market.wouldTakeEffectOn}
      ownDomain={c.domain}
      leaders={over.leaders ?? []}
      detail={{ googleOn: "Monday 19 October", searches: c.sets.searches, questions: c.sets.questions }}
    />
  );
}

describe.each([PLUMBER, SAAS])("$name: Your site and market, in the board's order and words", (c) => {
  it("the title and lead, the website, then the market Found by ReachKit", () => {
    const root = market(c);
    expect(text(root.querySelector("h2"))).toBe("Your site and market");
    expect(root.textContent).toContain("Where you’re measured, and against whom.");
    expect(text(root.querySelector('[data-testid="setting-domain"]'))).toContain(`Your website${c.domain}`);
    const line = root.querySelector('[data-testid="setting-category"]');
    expect(text(line)).toBe(`${c.category}Found by ReachKit from your site. Checked again every Monday.Change`);
  });

  it("what your market sets: three wells from this account's stored counts, then the plan", () => {
    const sets = market(c).querySelector('[data-testid="market-sets"]');
    expect(text(sets?.querySelector(".eyebrow"))).toBe("What your market sets, each Monday");
    expect([...(sets?.querySelectorAll("li") ?? [])].map(text)).toEqual([
      `${c.sets.searches} searches your buyers make most`,
      `${c.sets.questions} questions we ask AI for you`,
      `${c.competitors.length} competitors to compare`,
    ]);
    expect(text(sets?.querySelector("p:last-child"))).toBe("Your plan of pages comes from these.See this week’s pages");
    expect(sets?.querySelector("a")?.getAttribute("href")).toBe("/app/calendar");
  });

  it("the two consequences, then Scan again now with its line", () => {
    const root = market(c);
    expect([...root.querySelectorAll('[data-testid="market-consequences"] li')].map(text)).toEqual([
      "Change your website: your searches are rebuilt next Monday.",
      "Change your market: we scan it again right away.",
    ]);
    expect(text(root.querySelector('[data-testid="market-remeasure-press"]'))).toBe("Scan again now");
    expect(text(root.querySelector('[data-testid="market-remeasure-line"]'))).toBe(
      "Scans your market again now. It rebuilds your searches, and your pages follow. It uses one of the few scans allowed each day."
    );
  });

  it("competitors: the lead, then one card per competitor with its own figures and its Remove", () => {
    const root = competitors(c);
    expect(text(root.querySelector("h2"))).toBe("Competitors");
    expect(text(root.querySelector('[data-testid="competitors-concluded"]'))).toBe(
      "Found by ReachKit in your market and checked every Monday. Remove or add any if you like."
    );
    for (const domain of c.competitors) {
      const card = root.querySelector(`[data-testid="competitor-${domain}"]`);
      const figures = c.figures.cards[domain];
      expect(text(card)).toContain(`${domain.slice(0, 2).toUpperCase()}${domain}${c.found.includes(domain) ? "Found by ReachKit" : "Added by you"}`);
      if (figures !== null && figures !== undefined && figures.google !== null && figures.ai !== null) {
        expect(text(card?.querySelector(`[data-testid="competitor-google-${domain}"]`))).toBe(`On Google’s first page${figures.google.n} of ${figures.google.of}`);
        expect(text(card?.querySelector(`[data-testid="competitor-ai-${domain}"]`))).toBe(`Mentioned in AI answers${figures.ai.n} of ${figures.ai.of}`);
      }
      expect(card?.querySelector("button")?.getAttribute("aria-label")).toBe(`Remove ${domain}`);
      expect(text(card?.querySelector("button"))).toBe("Remove");
    }
  });

  it("add a competitor, how many more, and You, for comparison", () => {
    const root = competitors(c);
    const add = root.querySelector('[data-testid="add-competitor"]');
    expect(text(add?.querySelector("label"))).toBe("Add a competitor");
    expect(text(add?.querySelector('[data-testid="competitors-more"]'))).toBe(`${BATTERY.COMPETITORS_MAX - c.competitors.length} more can be added`);
    expect(add?.querySelector("input")?.getAttribute("placeholder")).toBe("competitor.com");
    expect(text(add?.querySelector("button"))).toBe("Add");
    const you = root.querySelector('[data-testid="competitors-you"]');
    expect(text(you)).toBe(
      `${c.domain.charAt(0).toUpperCase()}You, for comparisonOn Google’s first page${c.figures.you.google?.n} of ${c.figures.you.google?.of}` +
        `Mentioned in ${c.figures.you.ai?.n} of ${c.figures.you.ai?.of} AI answers, last 4 weeksSee Competitors →`
    );
    expect(you?.querySelector("a")?.getAttribute("href")).toBe("/app/rivals");
  });

  it("the far larger line where one is stored, and the detail's two footnotes", () => {
    const none = competitors(c);
    expect(none.querySelector('[data-testid="competitors-leaders"]')).toBeNull();
    const root = competitors(c, { leaders: ["nationalchain.example"] });
    expect(text(root.querySelector('[data-testid="competitors-leaders"]'))).toBe(
      "Far larger in your searches, and not compared with you for now: nationalchain.example."
    );
    const detail = root.querySelector('[data-testid="settings-competitors-detail"]');
    expect(text(detail?.querySelector("summary"))).toBe("Show the detail");
    expect([...(detail?.querySelectorAll("p") ?? [])].map(text)).toEqual([
      `Google figures are from Monday 19 October: the ${c.sets.searches} searches your buyers make most. ` +
        `AI figures are the last 4 weeks of answers to the ${c.sets.questions} questions a buyer in your market might ask AI.`,
      "A competitor you add is measured from the next Monday scan. A competitor you remove is no longer compared with you; pages already planned stay planned.",
    ]);
  });
});

describe("the market tab's board icons and bars", () => {
  it("MapPin on the market line; Search, Sparkles, Users wells; Calendar and Zap on the consequences", () => {
    const root = market(PLUMBER);
    expect(icons(root.querySelector('[data-testid="setting-category"]'))).toEqual(["lucide-map-pin"]);
    expect(icons(root.querySelector('[data-testid="market-sets"]'))).toEqual(["lucide-search", "lucide-sparkles", "lucide-users"]);
    expect(icons(root.querySelector('[data-testid="market-consequences"]'))).toEqual(["lucide-calendar", "lucide-zap"]);
  });

  it("each measured card: an initials avatar, the Sparkles badge, two bars at its figures, X on Remove", () => {
    const root = competitors(PLUMBER);
    for (const domain of PLUMBER.competitors) {
      const card = root.querySelector(`[data-testid="competitor-${domain}"]`);
      const figures = PLUMBER.figures.cards[domain]!;
      expect(text(card?.querySelector(".avatar.avatar-placeholder"))).toBe(domain.slice(0, 2).toUpperCase());
      expect(icons(card?.querySelector(".badge") ?? null)).toEqual(["lucide-sparkles"]);
      const bars = [...(card?.querySelectorAll("progress") ?? [])];
      expect(bars.map((bar) => [bar.getAttribute("value"), bar.getAttribute("max"), bar.getAttribute("aria-hidden")])).toEqual([
        [String(figures.google!.n), String(figures.google!.of), "true"],
        [String(figures.ai!.n), String(figures.ai!.of), "true"],
      ]);
      expect(icons(card?.querySelector("form button") ?? null)).toEqual(["lucide-x"]);
    }
  });

  it("a two-word rival is drawn by its words' initials, a one-word rival by its first two letters", () => {
    const root = competitors(PLUMBER, { list: ["www.austin-pipeworks.example", "rooter.example"] });
    const avatar = (domain: string): string => text(root.querySelector(`[data-testid="competitor-${domain}"] .avatar.avatar-placeholder`));
    expect(avatar("www.austin-pipeworks.example")).toBe("AP");
    expect(avatar("rooter.example")).toBe("RO");
  });

  it("the add card is dashed with a Users tile, and You opens with the account's initial", () => {
    const root = competitors(PLUMBER);
    const add = root.querySelector('[data-testid="add-competitor"]')?.closest("li");
    expect(add?.className).toContain("border-dashed");
    expect(icons(add ?? null)).toEqual(["lucide-users"]);
    expect(text(root.querySelector('[data-testid="competitors-you"] .avatar.avatar-placeholder'))).toBe("H");
  });

  it("a card added since the last scan draws no bar and no 0", () => {
    const root = competitors(SAAS);
    const card = root.querySelector('[data-testid="competitor-ledgerly.example"]');
    expect(card?.querySelectorAll("progress")).toHaveLength(0);
    expect(text(card)).not.toMatch(/\b0 of\b/);
  });
});

describe("not measured is never 0", () => {
  const model = settingsOf(SAAS);

  it("a competitor added since the last scan reads when it is measured from, on both lines", () => {
    const card = competitors(SAAS).querySelector('[data-testid="competitor-ledgerly.example"]');
    const from = `Checked from ${model.market.wouldTakeEffectOn}.`;
    expect(text(card?.querySelector('[data-testid="competitor-google-ledgerly.example"]'))).toBe(`On Google’s first page${from}`);
    expect(text(card?.querySelector('[data-testid="competitor-ai-ledgerly.example"]'))).toBe(`Mentioned in AI answers${from}`);
  });

  it("marketFigures leaves a competitor the last scan did not measure without figures", () => {
    const card = { rivals: [{ domain: "billwise.example", count: 0 }], you: { domain: "", count: 3 }, of: 12, noRival: true };
    const figures = marketFigures({ competitors: ["billwise.example", "ledgerly.example"], measured: ["billwise.example"], firstPage: card, named: card });
    expect(figures.cards["billwise.example"]).toEqual({ google: { n: 0, of: 12 }, ai: { n: 0, of: 12 } });
    expect(figures.cards["ledgerly.example"]).toBeNull();
    expect(marketFigures({ competitors: ["billwise.example"], measured: null, firstPage: card, named: card }).cards["billwise.example"]).toBeNull();
  });

  it("an unread half reads not measured, with no bar, on the card and on You", () => {
    const unread = { rivals: [], you: { domain: "", count: 0 }, of: 0, noRival: false };
    const read = { rivals: [{ domain: "billwise.example", count: 7 }], you: { domain: "", count: 2 }, of: 12, noRival: false };
    const figures = marketFigures({ competitors: ["billwise.example"], measured: ["billwise.example"], firstPage: read, named: unread });
    const root = competitors(SAAS, { list: ["billwise.example"], figures });
    const card = root.querySelector('[data-testid="competitor-billwise.example"]');
    expect(text(card?.querySelector('[data-testid="competitor-ai-billwise.example"]'))).toBe("Mentioned in AI answersnot checked yet");
    expect(card?.querySelectorAll("progress")).toHaveLength(1);
    expect(text(root.querySelector('[data-testid="competitors-you-ai"]'))).toBe("Mentioned in AI answers not checked yet");
  });

  it("an unread count draws no well rather than a 0", () => {
    const model_ = settingsOf(PLUMBER);
    const root = mount(
      <MarketPanel market={model_.market} domain={model_.domain} timeZone={TZ} sets={{ searches: null, questions: null, competitors: 2 }} />
    );
    expect([...root.querySelectorAll('[data-testid="market-sets"] li')].map(text)).toEqual(["2 competitors to compare"]);
  });
});

describe("{n} more can be added: the limit minus the set", () => {
  const list = (n: number) => Array.from({ length: n }, (_, i) => `rival-${i}.example`);

  it("one below the limit, one more can be added", () => {
    const root = competitors(PLUMBER, { list: list(BATTERY.COMPETITORS_MAX - 1) });
    expect(text(root.querySelector('[data-testid="competitors-more"]'))).toBe("1 more can be added");
  });

  it("at the limit the add card is not drawn", () => {
    const root = competitors(PLUMBER, { list: list(BATTERY.COMPETITORS_MAX) });
    expect(root.querySelector('[data-testid="add-competitor"]')).toBeNull();
    expect(root.textContent).not.toContain("more can be added");
  });
});

describe("board SettingsMarket, on the account the layout sweep reads", () => {
  beforeEach(() => signedInAs());
  afterEach(() => resetAccount());

  async function route(): Promise<{ html: string; root: HTMLElement }> {
    const html = renderToStaticMarkup(await SettingsMarketTab());
    const root = document.createElement("div");
    root.innerHTML = html;
    return { html, root };
  }

  it("each card's figures are the Competitors tab's own: first page from readRivals, AI from the month's reading", async () => {
    const [{ root }, rivals, overview] = await Promise.all([route(), readRivals(), readOverview()]);
    const named = namedOf(await readPromptsAt(overview.months?.reading?.week ?? null));
    expect(rivals.firstPage.rivals.length).toBeGreaterThan(0);
    for (const row of rivals.firstPage.rivals) {
      const card = root.querySelector(`[data-testid="competitor-${row.domain}"]`);
      expect(text(card?.querySelector(`[data-testid="competitor-google-${row.domain}"]`))).toBe(
        `${copy("settings.competitors.google")}${row.count} of ${rivals.firstPage.of}`
      );
      const ai = named.rivals.find((r) => r.domain === row.domain)?.count ?? 0;
      expect(text(card?.querySelector(`[data-testid="competitor-ai-${row.domain}"]`))).toBe(`${copy("settings.competitors.ai")}${ai} of ${named.of}`);
    }
    expect(text(root.querySelector('[data-testid="competitors-you-google"]'))).toBe(
      `${copy("settings.competitors.google")}${rivals.firstPage.you.count} of ${rivals.firstPage.of}`
    );
    expect(text(root.querySelector('[data-testid="competitors-you-ai"]'))).toBe(
      copy("settings.competitors.you.ai", { n: String(named.you.count), of: String(named.of), weeks: "4" })
    );
  });

  it("the far larger line names the gap module's leaders", async () => {
    const [{ root }, overview] = await Promise.all([route(), readOverview()]);
    expect(overview.rivals.leaders.domains.length).toBeGreaterThan(0);
    expect(text(root.querySelector('[data-testid="competitors-leaders"]'))).toBe(
      copy("settings.competitors.leaders", { names: overview.rivals.leaders.domains.join(", ") })
    );
  });

  it("every board string is on the screen but for sample data, rulings and the Settings frame", async () => {
    const { html } = await route();
    const { missing } = compare(readFileSync(boardFile("SettingsMarket"), "utf8"), segments(html), readAllow("SettingsMarket"));
    // Drawn by the shell and the Settings layout, not by this tab.
    const frame = [
      "ReachKit", "Overview", "This week", "Settings", "Publishing on",
      "What you’re measured as, how pages go out, and your account.",
      "Your business", "Market and competitors", "Publishing", "Your voice", "Mail", "Billing", "Account",
    ];
    expect(missing.filter((s: string) => !frame.includes(s))).toEqual([]);
  });
});
