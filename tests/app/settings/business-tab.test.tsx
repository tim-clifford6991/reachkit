/** @vitest-environment jsdom */
// Settings › Your business against board SettingsIndex (canvas v36): each section's words, in
// order, drawing each customer's own values. A plumber and a SaaS, same labels.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { CUSTOMERS, PLUMBER, type Customer } from "./business-fixtures";

applyEnvFixture();

const { formatShortDay } = await import("@/app/(account)/app/_shell/format");
const { BusinessPanel } = await import("@/app/(account)/app/settings/panels/BusinessPanel");
const { KnowledgePanel } = await import("@/app/(account)/app/settings/panels/KnowledgePanel");
const { FactsPanel } = await import("@/app/(account)/app/settings/panels/FactsPanel");
const { KnownContentPanel } = await import("@/app/(account)/app/settings/panels/KnownContentPanel");
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

function business(c: Customer): HTMLElement {
  return mount(<BusinessPanel profile={c.profile} empty={false} timeZone={TZ} />);
}

const { BUSINESS_ITEM_FIELD, BUSINESS_JOB_FIELD, BUSINESS_LIST_FIELD } = await import("@/app/(account)/app/settings/panel-state");

describe.each(CUSTOMERS)("$name: What we read from your site", (c) => {
  it("heads the card with the board's title and sub-line", () => {
    const root = business(c);
    expect(text(root.querySelector("h2"))).toBe("What we read from your site");
    expect(root.textContent).toContain("Change any line. Your next page follows it.");
  });

  it("each field is a row with its bare label, in the board's order, and Tone and self-reference are not drawn", () => {
    const rows = [...business(c).querySelectorAll('[data-testid="business-job"], [data-testid="business-offering"], [data-testid^="business-group-"]')];
    expect(rows.map((row) => text(row.firstElementChild))).toEqual([
      "What you do",
      "Kind of business",
      "What you sell",
      "Who you serve",
      "What you promise",
      "Words you use",
    ]);
    const root = business(c);
    expect(c.profile.tone).not.toBeNull();
    expect(root.textContent).not.toContain("Tone");
    expect(root.textContent).not.toContain("How you refer to yourself");
    expect(root.textContent).not.toContain(c.profile.tone!);
  });

  it("Kind of business is the report's closed word where one is stored, else the read's own text; the voice summary's claim lists are not drawn", () => {
    const kinded = mount(<BusinessPanel profile={c.profile} kind="Agency or firm" empty={false} timeZone={TZ} />);
    expect(text(kinded.querySelector('[data-testid="business-offering"] p'))).toBe("Agency or firm");
    expect(text(business(c).querySelector('[data-testid="business-offering"] p'))).toBe(c.profile.offeringType ?? "");
    const item = c.profile.lists.claims[0]!;
    const withClaims = { ...c.profile, lists: { ...c.profile.lists, claimsToKeep: [item], claimsToAvoid: [item] } };
    const root = mount(<BusinessPanel profile={withClaims} empty={false} timeZone={TZ} />);
    for (const list of ["claimsToKeep", "claimsToAvoid"]) expect(root.querySelector(`[data-testid="business-group-${list}"]`)).toBeNull();
  });

  it("writes only what it draws: no field on the card can reach the tone or the self-reference", () => {
    const names = new Set([...business(c).querySelectorAll("[name]")].map((el) => el.getAttribute("name")));
    for (const name of names) expect([BUSINESS_LIST_FIELD, BUSINESS_ITEM_FIELD, BUSINESS_JOB_FIELD]).toContain(name);
  });

  it("every item, promises included, is a 44px chip with its own Remove button, and each list keeps an Add", () => {
    const root = business(c);
    for (const value of [c.product, c.promise, c.word]) {
      expect(root.querySelector(`button[aria-label="Remove ${value}"]`)?.classList.contains("size-11")).toBe(true);
    }
    const promises = root.querySelector('[data-testid="business-group-claims"]');
    expect(promises?.querySelectorAll('[data-testid="business-item"]')).toHaveLength(c.profile.lists.claims.length);
    expect(text(promises?.querySelector('[data-testid="business-open-add-claims"]'))).toBe("Add");
  });

  it("closes on the last read, its date mono in the boards' form, and the existing re-read", () => {
    const root = business(c);
    const on = `${formatShortDay(c.profile.readAt!, TZ)} ${c.profile.readAt!.getUTCFullYear()}`;
    expect(text(root.querySelector('[data-testid="business-read-line"]'))).toBe(`Last read ${on} · ${c.profile.pagesRead} pages`);
    expect(text(root.querySelector('[data-testid="business-read-line"] .num'))).toBe(on);
    expect(text(root.querySelector('[data-testid="business-read-again"]'))).toBe("Read my site again now");
  });

  it("draws no strip, no example and no written-from card (canvas v36)", () => {
    const root = business(c);
    for (const gone of ["How this tab shapes your pages", "How it shows on a page", "What every page is written from"]) {
      expect(root.textContent).not.toContain(gone);
    }
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
  it("Read my site again now carries RefreshCcw and Reword carries Pencil", () => {
    const root = business(PLUMBER);
    expect(root.querySelector('[data-testid="business-read-again"] svg.lucide-refresh-ccw')).not.toBeNull();
    expect(root.querySelector('[data-testid="business-job"] svg.lucide-pencil')).not.toBeNull();
  });

  it("no card title on this tab carries an icon", () => {
    const titles = [
      business(PLUMBER),
      mount(<KnowledgePanel knowledge={PLUMBER.knowledge} answers={{}} />),
      mount(<FactsPanel facts={PLUMBER.facts} />),
      mount(<KnownContentPanel known={{ ours: 1, site: 1, wordpress: 0, total: 2 }} />),
    ].flatMap((root) => [...root.querySelectorAll("h2, summary")]);
    expect(titles).toHaveLength(4);
    for (const title of titles) expect(title.querySelector("svg")).toBeNull();
  });
});
