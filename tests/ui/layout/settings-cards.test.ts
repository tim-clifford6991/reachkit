// tests/ui/layout/settings-cards.test.ts — SPEC §4, E37, E38, E39
//
// Cards stack below `lg` on every Settings tab, and from `lg` each tab is two independent columns
// (plates F1a, F2, F3): every top-level card shares one left edge per column, columns live only
// inside a card on a `data-layout` grid, and the only card inside one is a competitor tile. Rendered
// and hydrated, light and dark; the canaries below prove the ruler sees two card columns and a card
// inside a layout grid.
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
  /** Market's competitor tiles and Your business's wells, in occupied-or-open grid tracks, or null where the tab draws none. */
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
    tilesTracks: tracks(tiles),
    wellsTracks: tracks(scope.querySelector('[data-layout="wells"]')),
  };
}

/** What a measurement breaks, as lines; empty where the tab keeps every rule. */
function offences(seen: Seen, width: number, columns = 1): string[] {
  const out: string[] = [];
  if (seen.cards === 0) out.push("no card was measured");
  const edges = seen.lefts.reduce<number[]>((kept, left) => (kept.some((edge) => Math.abs(edge - left) <= EDGE_PX) ? kept : [...kept, left]), []);
  if (edges.length > columns) out.push(`cards off the first card's left edge ${edges[0]}px: ${edges.slice(columns).join(", ")}`);
  for (const card of seen.nested) out.push(`a card inside a data-layout grid: ${card}`);
  if (seen.tilesTracks !== null) {
    if (width < 768 ? seen.tilesTracks !== 1 : width >= 1280 && seen.tilesTracks < 2)
      out.push(`the tiles have ${seen.tilesTracks} tracks at ${width}px`);
  }
  if (seen.wellsTracks !== null) {
    // Your business's lists sit side by side from 768 up; Market's sets are one row of lines (canvas v36).
    const holds = width < 768 ? seen.wellsTracks === 1 : seen.wellsTracks >= 2;
    if (!holds) out.push(`the wells have ${seen.wellsTracks} tracks at ${width}px`);
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
          // Two columns from `lg` (1024px), one below it.
          const columns = width >= 1024 ? 2 : 1;
          for (const [theme, measured] of seen) {
            expect(offences(measured, width, columns), `${href} @ ${width}px ${theme}`).toEqual([]);
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
    "two cards side by side on a one-column tab are refused",
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
    "a card inside a data-layout grid is refused",
    async () => {
      const found = await canary(
        390,
        '<div id="panel" class="stack"><section class="card"><div data-layout="pair"><div class="card">Inner</div></div></section></div>'
      );
      expect(found.some((line) => line.startsWith("a card inside a data-layout grid"))).toBe(true);
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

describe("/app/settings: a dialog holds its line's second field (plate F1a)", () => {
  it(
    "Write as holds your note and Your market holds where your buyers are, and Escape discards both",
    async () => {
      const seen = await withPage(
        1280,
        async (page) => {
          await page.goto(urlFor(SETTINGS_TAB_HREF.business));
          const out: Record<string, { second: boolean; kept: boolean }> = {};
          const pairs = [["voice-dialog-writing", "textarea[name=voice_text]"], ["setting-category-dialog", "select[name=market_locale]"]] as const;
          for (const [dialog, field] of pairs) {
            const open = async (): Promise<void> => {
              // A press before hydration is lost, so it is repeated until the dialog opens.
              for (let tries = 0; tries < 30; tries++) {
                await page.click(`[data-testid="${dialog}-change"]`);
                if (await page.locator(`[data-testid="${dialog}"][open] ${field}`).count()) return;
                await page.waitForTimeout(500);
              }
              throw new Error(`${dialog} did not open`);
            };
            await open();
            const box = page.locator(`[data-testid="${dialog}"] ${field}`);
            const before = await box.inputValue();
            if ((await box.evaluate((el) => el.tagName)) === "SELECT") {
              const other = await box.evaluate(
                (el) => Array.from((el as HTMLSelectElement).options).map((o) => o.value).find((v) => v !== (el as HTMLSelectElement).value) ?? null
              );
              if (other !== null) await box.selectOption(other);
            } else await box.fill(`${before} changed`);
            await page.keyboard.press("Escape");
            await page.waitForSelector(`[data-testid="${dialog}"]:not([open])`, { state: "attached" });
            await open();
            out[dialog] = { second: true, kept: (await page.locator(`[data-testid="${dialog}"] ${field}`).inputValue()) === before };
            await page.keyboard.press("Escape");
          }
          return out;
        },
        { extraHTTPHeaders: { Cookie: getAccountCookie() } }
      );
      expect(seen).toEqual({ "voice-dialog-writing": { second: true, kept: true }, "setting-category-dialog": { second: true, kept: true } });
    },
    PER_CASE_MS
  );
});
