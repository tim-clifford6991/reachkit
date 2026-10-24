// tests/ui/layout/settings-cards.test.ts — SPEC §4, E37, E38, E39
//
// Cards stack at every width on every Settings tab: every top-level card shares one left edge,
// columns live only inside a card on a `data-layout` grid, the only card inside one is a competitor
// tile, Mail's week is four tracks on a phone and seven on a desktop, and Market's tiles and wells
// fold to one track on a phone. Rendered and hydrated, light and dark; the canaries below prove
// the ruler sees two card columns, a card inside a layout grid, and a week that does not fold.
import { describe, expect, it } from "vitest";
import { SETTINGS_TABS, SETTINGS_TAB_HREF } from "@/app/(account)/app/settings/tabs";
import { getAccountCookie, getBaseURL, withPage } from "./browser";

const WIDTHS_PX = [390, 768, 1023, 1280] as const;
const THEMES = ["light", "dark"] as const;
const EDGE_PX = 1;
const PER_CASE_MS = 90_000;

interface Seen {
  readonly cards: number;
  /** Each top-level card's left edge, rounded to a pixel. */
  readonly lefts: readonly number[];
  /** Cards inside a `data-layout` grid other than `tiles`, by their first words. */
  readonly nested: readonly string[];
  /** Mail's week, in grid tracks, or null where the tab draws none. */
  readonly weekTracks: number | null;
  /** Market's competitor tiles and wells, in occupied-or-open grid tracks, or null where the tab draws none. */
  readonly tilesTracks: number | null;
  readonly wellsTracks: number | null;
}

/** Read in the page. Closure-free: `page.evaluate` serialises this function's own text. */
function measureCards(root: string): Seen {
  const panel = document.querySelector(root);
  const scope = panel ?? document.body;
  const cards = Array.from(scope.querySelectorAll(".card:not(.card .card)")).filter(
    (card) => card.getBoundingClientRect().width > 0
  );
  const week = scope.querySelector('[data-layout="week"]');
  const tiles = scope.querySelector('[data-layout="tiles"]');
  // Five competitors, the most a site tracks, whatever the fixture holds: copies of its first tile.
  const first = tiles?.querySelector(":scope > li");
  while (tiles && first && tiles.children.length < 5) tiles.appendChild(first.cloneNode(true));
  // Auto-fit collapses an empty track to 0px; only tracks with width are counted.
  const tracks = (grid: Element | null) =>
    grid === null ? null : getComputedStyle(grid).gridTemplateColumns.split(" ").filter((t) => t !== "" && t !== "0px").length;
  return {
    cards: cards.length,
    lefts: cards.map((card) => Math.round(card.getBoundingClientRect().left)),
    nested: Array.from(scope.querySelectorAll('[data-layout]:not([data-layout="tiles"]) .card')).map((card) => (card.textContent ?? "").trim().slice(0, 40)),
    weekTracks: tracks(week),
    tilesTracks: tracks(tiles),
    wellsTracks: tracks(scope.querySelector('[data-layout="wells"]')),
  };
}

/** What a measurement breaks, as lines; empty where the tab keeps every rule. */
function offences(seen: Seen, width: number): string[] {
  const out: string[] = [];
  if (seen.cards === 0) out.push("no card was measured");
  const first = seen.lefts[0] ?? 0;
  const apart = seen.lefts.filter((left) => Math.abs(left - first) > EDGE_PX);
  if (apart.length > 0) out.push(`cards off the first card's left edge ${first}px: ${apart.join(", ")}`);
  for (const card of seen.nested) out.push(`a card inside a data-layout grid: ${card}`);
  if (seen.weekTracks !== null) {
    const want = width < 768 ? 4 : 7;
    if (seen.weekTracks !== want) out.push(`the week has ${seen.weekTracks} tracks at ${width}px, not ${want}`);
  }
  if (seen.tilesTracks !== null) {
    if (width < 768 ? seen.tilesTracks !== 1 : width >= 1280 && seen.tilesTracks < 2)
      out.push(`the tiles have ${seen.tilesTracks} tracks at ${width}px`);
  }
  if (seen.wellsTracks !== null) {
    const want = width < 768 ? 1 : width === 1023 ? null : 3;
    if (want !== null && seen.wellsTracks !== want) out.push(`the wells have ${seen.wellsTracks} tracks at ${width}px, not ${want}`);
  }
  return out;
}

function urlFor(href: string): string {
  const baseURL = getBaseURL();
  if (!baseURL) throw new Error("tests/ui/layout/settings-cards.test.ts: no app server is running");
  return `${baseURL}${href}`;
}

for (const tab of SETTINGS_TABS) {
  const href = SETTINGS_TAB_HREF[tab];
  describe(`${href}: cards stack, columns only inside a card (E38)`, () => {
    for (const width of WIDTHS_PX) {
      it(
        `${href} @ ${width}px, light and dark`,
        async () => {
          const seen = await withPage(
            width,
            async (page) => {
              const out: [string, Seen][] = [];
              for (const theme of THEMES) {
                await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
                await page.goto(urlFor(href));
                out.push([theme, await page.evaluate(measureCards, `[data-testid="settings-tab-panel-${tab}"]`)]);
              }
              return out;
            },
            { extraHTTPHeaders: { Cookie: getAccountCookie() } }
          );
          for (const [theme, measured] of seen) {
            expect(offences(measured, width), `${href} @ ${width}px ${theme}`).toEqual([]);
            // The week is what Mail is checked for; a tab that lost it would pass vacuously.
            if (tab === "mail") expect(measured.weekTracks, `${href} @ ${width}px ${theme}`).not.toBeNull();
            if (tab === "market") {
              expect(measured.tilesTracks, `${href} @ ${width}px ${theme}`).not.toBeNull();
              expect(measured.wellsTracks, `${href} @ ${width}px ${theme}`).not.toBeNull();
            }
          }
        },
        PER_CASE_MS
      );
    }
  });
}

const CANARY_STYLE = `<style>
  body { margin: 0; } .card { border: 1px solid; padding: 8px; }
  .two { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
  .stack { display: flex; flex-direction: column; gap: 16px; }
  .seven { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
</style>`;

async function canary(width: number, body: string): Promise<string[]> {
  const seen = await withPage(width, async (page) => {
    await page.setContent(`<!doctype html><html><head>${CANARY_STYLE}</head><body>${body}</body></html>`);
    return page.evaluate(measureCards, "#panel");
  });
  return offences(seen, width);
}

describe("the ruler sees what it is for (canaries)", () => {
  it(
    "two cards side by side, as Your business drew them at xl, are refused",
    async () => {
      const found = await canary(
        1280,
        '<div id="panel" class="two"><section class="card">Main column</section><section class="card">Written from</section></div>'
      );
      expect(found.some((line) => line.startsWith("cards off the first card's left edge"))).toBe(true);
    },
    PER_CASE_MS
  );

  it(
    "a card inside a data-layout grid, and a week of seven tracks on a phone, are refused",
    async () => {
      const found = await canary(
        390,
        '<div id="panel" class="stack"><section class="card"><div data-layout="pair"><div class="card">Inner</div></div>' +
          '<div data-layout="week" class="seven"><span>M</span></div></section></div>'
      );
      expect(found.some((line) => line.startsWith("a card inside a data-layout grid"))).toBe(true);
      expect(found).toContain("the week has 7 tracks at 390px, not 4");
    },
    PER_CASE_MS
  );

  it(
    "a card in the wells and tiles on three tracks on a phone are refused; a card in the tiles is not",
    async () => {
      const found = await canary(
        390,
        '<div id="panel" class="stack"><section class="card"><ul data-layout="tiles" class="seven"><li class="card">Rival</li></ul>' +
          '<ul data-layout="wells"><li class="card">Well</li></ul></section></div>'
      );
      expect(found).toContain("a card inside a data-layout grid: Well");
      expect(found.some((line) => line.includes("Rival"))).toBe(false);
      expect(found).toContain("the tiles have 7 tracks at 390px");
    },
    PER_CASE_MS
  );

  it(
    "cards stacked in one column pass",
    async () => {
      expect(
        await canary(768, '<div id="panel" class="stack"><section class="card">One</section><section class="card">Two</section></div>')
      ).toEqual([]);
    },
    PER_CASE_MS
  );
});
