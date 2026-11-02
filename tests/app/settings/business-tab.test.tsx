/** @vitest-environment jsdom */
// Settings › Your business against board SettingsIndex: each section's words, in
// order, drawing each customer's own values. A plumber and a SaaS, same labels.
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb } from "../../publish/harness";
import { CUSTOMERS, PLUMBER, SAAS, type Customer } from "./business-fixtures";

applyEnvFixture();

const db = fakeDb();
/** Tables whose queries never answer, the way a database past its deadline does. */
const stalled = new Set<string>();
const never = (): unknown =>
  new Proxy(() => undefined, { get: (_t, key) => (key === "then" ? () => undefined : never()), apply: () => never() });
const client = (): unknown =>
  new Proxy(db.client as Record<string, unknown>, {
    get: (target, key) =>
      key === "from" ? (table: string) => (stalled.has(table) ? never() : (target.from as (t: string) => unknown)(table)) : target[key as string],
  });
vi.mock("@/lib/db", () => ({ dbAdmin: client, db: client }));

const { assembleShell } = await import("@/app/(account)/app/_shell/model");
const { FIXTURE_SHELL_FACTS } = await import("@/app/(account)/app/_shell/fixture");
const { formatDate } = await import("@/app/(account)/app/_shell/format");
const { formatMoment } = await import("@/app/(account)/app/settings/next-page");
const { showsOnAPage } = await import("@/app/(account)/app/settings/on-a-page");
const { FlowPanel } = await import("@/app/(account)/app/settings/panels/FlowPanel");
const { BusinessPanel } = await import("@/app/(account)/app/settings/panels/BusinessPanel");
const { KnowledgePanel } = await import("@/app/(account)/app/settings/panels/KnowledgePanel");
const { FactsPanel } = await import("@/app/(account)/app/settings/panels/FactsPanel");
const { KnownContentPanel } = await import("@/app/(account)/app/settings/panels/KnownContentPanel");
const { WrittenFromPanel } = await import("@/app/(account)/app/settings/panels/WrittenFromPanel");
const { UNREAD_INDEX } = await import("@/app/(account)/app/settings/business-provider");

const TZ = "America/Chicago";
const WELL_LISTS = ["problems", "differentiators", "questions", "places"] as const;
const STACKED_LISTS = ["offerings", "audience", "proof", "integrations"] as const;

function mount(element: React.JSX.Element): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(element);
  return root;
}

const text = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

function exampleOf(c: Customer, pages = c.livePages) {
  return showsOnAPage({
    pages,
    claims: c.profile.lists.claims.map((item) => item.text),
    vocabulary: c.profile.lists.vocabulary.map((item) => item.text),
    lang: "en-US",
  });
}

function business(c: Customer, example = exampleOf(c)): HTMLElement {
  return mount(<BusinessPanel profile={c.profile} siteName={c.name} empty={false} example={example} timeZone={TZ} />);
}

function flow(next: Date | null, c: Customer = PLUMBER): HTMLElement {
  return mount(<FlowPanel pagesRead={c.profile.pagesRead} readAt={c.profile.readAt} next={next} timeZone={TZ} />);
}

describe.each(CUSTOMERS)("$name: How this tab shapes your pages", (c) => {
  const next = new Date("2026-10-20T21:00:00.000Z");

  it("draws three steps, the first stating this site's own read", () => {
    const root = flow(next, c);
    expect(text(root.querySelector("h2"))).toBe("How this tab shapes your pages");
    expect([...root.querySelectorAll("li strong")].map(text)).toEqual([
      "We read your site",
      "You check what we learned",
      "Every page is written from it",
    ]);
    expect(text(root.querySelector('[data-testid="settings-flow-read"]'))).toBe(
      `We read your site ${c.profile.pagesRead} pages of your site, last on ${formatDate(c.profile.readAt!, TZ)}`
    );
    expect(root.textContent).toContain("Change any line below. Nothing here is required.");
    expect(text(root.querySelector('[data-testid="settings-flow-next"]'))).toBe(`Next: ${formatMoment(next, TZ)}.`);
    const plan = root.querySelector('a[href="/app/calendar"]');
    expect(text(plan)).toBe("See this week’s pages");
  });
});

describe("Next: is the shell's next publish, and is not drawn while there is none", () => {
  const due = new Date("2026-10-20T21:00:00.000Z");
  const causes = FIXTURE_SHELL_FACTS.noPublishCauses;
  const cases = {
    // The store reads no next publish while the address waits or publishing is off.
    unconnected: { next: null, noPublishCauses: { ...causes, address_waiting: true } },
    paused: { next: null, noPublishCauses: { ...causes, publishing_paused: true } },
    // A stop outranks a time still on the row.
    stopped: { next: due, noPublishCauses: { ...causes, reachkit_stopped: true } },
  };

  it.each(Object.entries(cases))("%s: no time is named, the plan link stays", (_, facts) => {
    const shell = assembleShell({ ...FIXTURE_SHELL_FACTS, ...facts });
    const root = flow(shell.publishing.next);
    expect(root.querySelector('[data-testid="settings-flow-next"]')).toBeNull();
    expect(root.textContent).not.toContain("Next:");
    expect(text(root.querySelector('a[href="/app/calendar"]'))).toBe("See this week’s pages");
  });

  it("scheduled: the time is the shell's, in the site's zone", () => {
    const shell = assembleShell({ ...FIXTURE_SHELL_FACTS, next: due });
    expect(text(flow(shell.publishing.next).querySelector('[data-testid="settings-flow-next"]'))).toBe(
      `Next: ${formatMoment(due, TZ)}.`
    );
  });

  it("a site never read says so rather than a count", () => {
    const root = mount(<FlowPanel pagesRead={null} readAt={null} next={null} timeZone={TZ} />);
    expect(text(root.querySelector('[data-testid="settings-flow-read"]'))).toBe("We read your site Not read yet");
  });
});

describe.each(CUSTOMERS)("$name: What we know about the business", (c) => {
  it("heads the card with the business's own name and the lead", () => {
    const root = business(c);
    expect(text(root.querySelector("h2"))).toBe(`What we know about ${c.name}`);
    expect(root.textContent).toContain(
      "We read this from your site. Your next page follows any change you make."
    );
  });

  it("draws each field's label with its hint in one line, in the board's order", () => {
    const labels = [...business(c).querySelectorAll("h3")].map(text);
    expect(labels).toEqual([
      "What you do one sentence",
      "Kind of business",
      "What you sell",
      "Who you serve",
      "What you promise we may repeat these",
      "Words you use so pages sound like you",
    ]);
    const rows = [...business(c).querySelectorAll('[data-testid^="business-row-"]')].map(text);
    expect(rows).toEqual([`Tone${c.profile.tone}`, `How you refer to yourself${c.profile.person}`]);
  });

  it("every item, promises included, is a chip with its own Remove button", () => {
    const root = business(c);
    for (const value of [c.product, c.promise, c.word]) {
      expect(root.querySelector(`button[aria-label="Remove ${value}"]`)).not.toBeNull();
    }
    const promises = root.querySelector('[data-testid="business-group-claims"]');
    expect(promises?.querySelectorAll(".badge")).toHaveLength(c.profile.lists.claims.length);
    expect(promises?.querySelector("li")).toBeNull();
  });

  it("closes on the last read and the existing re-read", () => {
    const root = business(c);
    expect(text(root.querySelector('[data-testid="business-read-line"]'))).toBe(
      `Last read ${formatDate(c.profile.readAt!, TZ)} · ${c.profile.pagesRead} pages read`
    );
    expect(text(root.querySelector('[data-testid="business-read-again"]'))).toBe("Read my site again now");
  });
});

describe("How it shows on a page: a sentence quoted from a live page, never invented", () => {
  it("(a) the plumber's live page uses \"tankless\": that sentence, the word marked", () => {
    const root = business(PLUMBER);
    const figure = root.querySelector('[data-testid="business-example"]');
    expect(text(figure?.querySelector(".eyebrow"))).toBe("How it shows on a page");
    expect(text(figure?.querySelector('[data-testid="business-example-quote"]'))).toBe("Most tankless swaps take one day.");
    expect([...(figure?.querySelectorAll("mark") ?? [])].map(text)).toEqual(["tankless"]);
    expect(text(figure?.querySelector("figcaption"))).toBe(
      "from Words you use Example. Change a line above and your next page follows it."
    );
    const title = figure?.querySelector("a");
    expect(title?.getAttribute("href")).toBe(PLUMBER.livePages[0]!.url);
    expect(text(title)).toBe("Tankless water heater installation in Austin");
    expect(text(figure?.querySelector(".badge"))).toBe(formatDate(PLUMBER.livePages[0]!.publishedAt, TZ));
    expect(figure?.querySelector("[lang]")?.getAttribute("lang")).toBe("en-US");
  });

  it("names both lists when the sentence uses a promise and a word", () => {
    const example = exampleOf(PLUMBER, [
      { ...PLUMBER.livePages[0]!, markdown: "A tankless swap with upfront prices before work starts.\n" },
    ]);
    const figure = business(PLUMBER, example).querySelector('[data-testid="business-example"]');
    expect([...(figure?.querySelectorAll("mark") ?? [])].map(text)).toEqual([
      "tankless",
      "upfront prices before work starts",
    ]);
    expect(text(figure?.querySelector("figcaption"))).toContain("from What you promise and Words you use");
  });

  it("the SaaS's own page and its own word", () => {
    const figure = business(SAAS).querySelector('[data-testid="business-example"]');
    expect(text(figure?.querySelector('[data-testid="business-example-quote"]'))).toBe(
      "A payment reminder that goes out on day one halves that."
    );
    expect([...(figure?.querySelectorAll("mark") ?? [])].map(text)).toEqual(["payment reminder"]);
  });

  it("the newest live page that matches is the one quoted", () => {
    const older = { ...PLUMBER.livePages[0]!, url: "https://harborplumbing.example/old", publishedAt: new Date("2026-09-01T00:00:00Z") };
    const newer = { ...PLUMBER.livePages[0]!, markdown: "Our tankless team is in Austin.\n" };
    expect(exampleOf(PLUMBER, [older, newer])?.parts.map((p) => p.text).join("")).toBe("Our tankless team is in Austin.");
  });

  it("(b) live pages that use no stored promise or word: not drawn", () => {
    const pages = [{ ...PLUMBER.livePages[0]!, markdown: "# Tankless heaters\n\nWater heaters wear out; tanklessly is not a word.\n" }];
    expect(exampleOf(PLUMBER, pages)).toBeNull();
    expect(business(PLUMBER, exampleOf(PLUMBER, pages)).querySelector('[data-testid="business-example"]')).toBeNull();
    expect(business(PLUMBER, null).textContent).not.toContain("How it shows on a page");
  });

  it("(c) no live page: not drawn", () => {
    expect(exampleOf(PLUMBER, [])).toBeNull();
    expect(exampleOf(SAAS, [])).toBeNull();
  });
});

describe.each(CUSTOMERS)("$name: What buyers ask and why you", (c) => {
  const root = (): HTMLElement => mount(<KnowledgePanel knowledge={c.knowledge} answers={{}} />);

  it("is a fold with the lead, Problems you solve before How you differ", () => {
    const fold = root().querySelector("details");
    expect(text(fold?.querySelector("summary"))).toBe("What buyers ask and why you");
    expect(fold?.textContent).toContain(
      "Read from your own pages, each with the page it came from. Your pages are written from this."
    );
    const heads = [...(fold?.querySelectorAll("section h3") ?? [])].map(text);
    expect(heads.indexOf("Problems you solve")).toBe(0);
    expect(heads.indexOf("How you differ")).toBe(1);
    expect(fold?.textContent).toContain(c.knowledge.problems[0]!.text);
  });

  it("the board's four lists are wells in one grid, in board order, and the rest stack after it", () => {
    const offering = { name: "Service plan", features: [], prices: [], uses: [], source: { kind: "founder" } } as const;
    const knowledge = { ...c.knowledge, offerings: [...c.knowledge.offerings, offering] };
    const fold = mount(<KnowledgePanel knowledge={knowledge} answers={{}} />);
    const grids = fold.querySelectorAll('[data-layout="wells"]');
    expect(grids).toHaveLength(1);
    const read = WELL_LISTS.filter((name) => knowledge[name].length > 0);
    expect([...grids[0]!.querySelectorAll(":scope > [data-testid]")].map((el) => el.getAttribute("data-testid"))).toEqual(
      read.map((name) => `knowledge-${name}`)
    );
    expect(grids[0]!.querySelector(".card")).toBeNull();
    for (const name of STACKED_LISTS.filter((list) => knowledge[list].length > 0)) {
      expect(fold.querySelector(`[data-testid="knowledge-${name}"]`)).not.toBeNull();
      expect(grids[0]!.querySelector(`[data-testid="knowledge-${name}"]`)).toBeNull();
    }
  });

  it("an empty list leaves no well, and with all four empty no wells grid is drawn", () => {
    const without = (names: readonly (typeof WELL_LISTS)[number][]) =>
      mount(<KnowledgePanel knowledge={{ ...c.knowledge, ...Object.fromEntries(names.map((n) => [n, []])) }} answers={{}} />);
    const read = WELL_LISTS.filter((name) => c.knowledge[name].length > 0);
    expect(without(["problems"]).querySelectorAll('[data-layout="wells"] > section')).toHaveLength(read.length - 1);
    expect(without(WELL_LISTS).querySelector('[data-layout="wells"]')).toBeNull();
  });

  it("Five things only you know: optional, Thing 1 to Thing 5", () => {
    const form = root().querySelector('[data-testid="knowledge-answers"]');
    expect(text(form?.querySelector("h3"))).toBe("Five things only you know");
    expect(form?.textContent).toContain("Optional. Each one you add can appear on a page.");
    expect([...(form?.querySelectorAll("label > span:first-child") ?? [])].map(text)).toEqual([
      "Thing 1",
      "Thing 2",
      "Thing 3",
      "Thing 4",
      "Thing 5",
    ]);
    expect(form?.querySelectorAll("input[name]")).toHaveLength(5);
  });
});

describe.each(CUSTOMERS)("$name: Facts we can quote", (c) => {
  it("each passage word for word in quotes, with Don't quote this and its page count", () => {
    const fold = mount(<FactsPanel facts={c.facts} />).querySelector("details");
    expect(text(fold?.querySelector("summary"))).toBe("Facts we can quote");
    expect(fold?.textContent).toContain("Word for word, each linked to where we read it.");
    for (const fact of c.facts) {
      const row = [...(fold?.querySelectorAll('[data-testid="business-fact"]') ?? [])].find((li) =>
        li.textContent?.includes(fact.passage)
      );
      const line = text(row?.querySelector("p"));
      expect(line).toBe(fact.pages > 1 ? `“${fact.passage}” · on ${fact.pages} pages` : `“${fact.passage}”`);
      expect(text(row?.querySelector("button"))).toBe("Don’t quote this");
    }
  });
});

describe("Content we already know about: three places, and a blog not read is never 0", () => {
  const fold = (wordpress: number | null) =>
    mount(<KnownContentPanel known={{ ours: 12, site: 34, wordpress, total: 46 }} />).querySelector("details");

  it("states the total and each place with its own count", () => {
    const root = fold(0);
    expect(text(root?.querySelector("summary"))).toBe("Content we already know about");
    expect(text(root?.querySelector('[data-testid="settings-known-total"]'))).toBe("46 pages, from three places:");
    expect([...(root?.querySelectorAll("li") ?? [])].map(text)).toEqual([
      "12 pages we wrote",
      "34 pages on your site",
      "0 posts on your blog",
    ]);
  });

  it("one bar: the pages we wrote out of every page known", () => {
    const meter = fold(0)?.querySelector("progress");
    expect(meter?.classList.contains("progress")).toBe(true);
    expect([meter?.getAttribute("value"), meter?.getAttribute("max")]).toEqual(["12", "46"]);
  });

  it("a blog that was not read says so, never 0", () => {
    const blog = text(fold(null)?.querySelector('[data-testid="settings-known-wordpress"]'));
    expect(blog).toBe("Posts on your blog: not read");
    expect(fold(null)?.textContent).not.toContain("0 posts on your blog");
  });

  it("a bar over 12 wrote, 34 site and 5 blog posts is 12 of 51", () => {
    const meter = mount(<KnownContentPanel known={{ ours: 12, site: 34, wordpress: 5, total: 51 }} />).querySelector("progress");
    expect([meter?.getAttribute("value"), meter?.getAttribute("max")]).toEqual(["12", "51"]);
  });

  it("a blog not read is not counted in the bar", () => {
    expect(fold(null)?.querySelector("progress")?.getAttribute("max")).toBe("46");
  });

  it("with nothing known on a connected blog, no bar is drawn", () => {
    const root = mount(<KnownContentPanel known={{ ours: 0, site: 0, wordpress: 0, total: 0 }} />);
    expect(root.querySelector("progress")).toBeNull();
  });

  it("an index that could not be read says nothing is known yet, never 0", () => {
    const root = mount(<KnownContentPanel known={UNREAD_INDEX} />);
    expect(root.querySelector('[data-testid="settings-known-empty"]')).not.toBeNull();
    expect(root.querySelector("progress")).toBeNull();
    expect(root.querySelector('[data-testid="settings-known-content"]')?.textContent).not.toMatch(/\b0\b/);
  });
});

describe("icons (ux 2026-10-24 E24, E28, S1)", () => {
  it("the strip's three tiles are Globe, Building2 and FileText", () => {
    const icons = [...flow(null).querySelectorAll("li svg")];
    expect(icons).toHaveLength(3);
    ["lucide-globe", "lucide-building-2", "lucide-file-text"].forEach((name, at) => expect(icons[at]?.classList.contains(name)).toBe(true));
  });

  it("Read my site again now carries RefreshCw", () => {
    expect(business(PLUMBER).querySelector('[data-testid="business-read-again"] svg.lucide-refresh-cw')).not.toBeNull();
  });

  it("no card title on this tab carries an icon", () => {
    const titles = [
      business(PLUMBER),
      mount(<WrittenFromPanel profile={PLUMBER.profile} />),
      mount(<KnowledgePanel knowledge={PLUMBER.knowledge} answers={{}} />),
      mount(<FactsPanel facts={PLUMBER.facts} />),
      mount(<KnownContentPanel known={{ ours: 1, site: 1, wordpress: 0, total: 2 }} />),
    ].flatMap((root) => [...root.querySelectorAll("h2, summary")]);
    expect(titles).toHaveLength(5);
    for (const title of titles) expect(title.querySelector("svg")).toBeNull();
  });
});

const { LIVE_ACCOUNT, resetAccount, signedInAs } = await import("../account-door");
const { default: BusinessTab } = await import("@/app/(account)/app/settings/page");
const { copy } = await import("@/lib/presentation/copy");

describe("the facts card is its own read: when it fails or stalls only that card says so", () => {
  const OTHER_CARDS = ["settings-business-knowledge", "settings-known-content"];
  const DOMAIN = "harborplumbing.example";
  const has = (doc: Document, id: string): boolean => doc.querySelector(`[data-testid="${id}"]`) !== null;

  async function settled(tree: React.ReactNode): Promise<Document> {
    const stream = await renderToReadableStream(tree, { onError: () => undefined });
    await stream.allReady;
    return new DOMParser().parseFromString(await new Response(stream).text(), "text/html");
  }

  /** Real ticks, so the boundary's read starts before the fake clock moves. */
  async function until(done: () => boolean): Promise<void> {
    for (let turn = 0; turn < 200 && !done(); turn++) await new Promise((resolve) => setImmediate(resolve));
    expect(done()).toBe(true);
  }

  function seed(): void {
    db.reset();
    stalled.clear();
    signedInAs({ ...LIVE_ACCOUNT, domain: DOMAIN });
    db.seed("sites", [
      { id: LIVE_ACCOUNT.siteId, user_id: LIVE_ACCOUNT.userId, domain: DOMAIN, mode: "autopilot", veto_hours: 24, publish_time: "09:00", timezone: "America/Chicago", publishing_enabled: true },
    ]);
    db.seed("users", [
      { id: LIVE_ACCOUNT.userId, email: "owner@harborplumbing.example", name: "A Plumber", pending_email: null, pending_email_sent_at: null, deleted_at: null, notify: {}, created_at: "2026-01-01T00:00:00.000Z", paid_through: "2026-12-01T00:00:00.000Z", cancelled_at: null, plan_status: "active" },
    ]);
    // A measured scan, so the facts read reaches the page text.
    db.seed("scans", [{ id: "scan-1", site_id: LIVE_ACCOUNT.siteId, domain: DOMAIN, tier: "deep", created_at: "2026-10-01T00:00:00.000Z" }]);
  }
  const failures = (warn: { mock: { calls: unknown[][] } }, read: string) =>
    warn.mock.calls.map(([line]) => JSON.parse(String(line))).filter((line) => line.event === "settings_read_failed" && line.read === read);

  afterEach(() => {
    vi.useRealTimers();
    resetAccount();
    vi.restoreAllMocks();
  });

  it("answers every card while every read answers", async () => {
    seed();
    const doc = await settled(await BusinessTab());
    expect(has(doc, "settings-unread-business")).toBe(false);
    expect(has(doc, "settings-unread-facts")).toBe(false);
    for (const id of ["settings-business-facts", ...OTHER_CARDS]) expect(has(doc, id), id).toBe(true);
  });

  it("a facts read that rejects leaves only the facts card on the plain line", async () => {
    seed();
    db.unreadable.add("fetches");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const doc = await settled(await BusinessTab());
    expect(doc.querySelector('[data-testid="settings-unread-facts"]')?.textContent).toBe(copy("settings.panel.unread"));
    expect(has(doc, "settings-business-facts")).toBe(false);
    expect(has(doc, "settings-unread-business")).toBe(false);
    for (const id of OTHER_CARDS) expect(has(doc, id), id).toBe(true);
    expect(doc.querySelector("h2")).not.toBeNull();
    expect(failures(warn, "businessFacts")).toHaveLength(1);
    expect(failures(warn, "business")).toHaveLength(0);
  });

  it("a facts read that never answers times out at 4,000 ms, and only its card says so", async () => {
    seed();
    stalled.add("fetches");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const tree = await BusinessTab();
    const rendering = settled(tree);
    await until(() => db.queries.some((query) => query.table === "scans" && query.columns === "id, domain"));
    await vi.advanceTimersByTimeAsync(3_999);
    expect(failures(warn, "businessFacts")).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(failures(warn, "businessFacts")).toEqual([
      { event: "settings_read_failed", read: "businessFacts", detail: "Error: settings read timed out: businessFacts" },
    ]);
    const doc = await rendering;
    expect(has(doc, "settings-unread-facts")).toBe(true);
    expect(has(doc, "settings-unread-business")).toBe(false);
    for (const id of OTHER_CARDS) expect(has(doc, id), id).toBe(true);
  });

  it("when the business read itself stalls, the whole tab is the one plain line, as before", async () => {
    seed();
    stalled.add("site_profile_edits");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const page = BusinessTab();
    await vi.advanceTimersByTimeAsync(4_000);
    const doc = await settled(await page);
    expect(has(doc, "settings-unread-business")).toBe(true);
    expect(has(doc, "settings-unread-facts")).toBe(false);
    expect(failures(warn, "business")).toHaveLength(1);
  });
});
