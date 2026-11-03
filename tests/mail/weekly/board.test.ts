// Board MondayMail's look in the composed Monday mail: tinted tiles, Google bars, the green and grey boxes and the heading steps,
// with every control a padded link (images off) and every filled control and box edged (forced dark).
import { parse, type HTMLElement } from "node-html-parser";
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

const { composeWeekly } = await import("../preview/kinds");
const { renderBlocksText } = await import("../../../src/lib/mail/blocks/text");
const { buildWeekly } = await import("../../../src/lib/mail/templates/weekly");
const { measured } = await import("../../../src/lib/measure/measured");
const { MAIL_TOKENS: T } = await import("../../../src/lib/mail/shell/tokens");
const { COPY } = await import("../../../src/lib/presentation/copy");

const mail = await composeWeekly();
const doc = parse(mail.html);

/** Inline style as a map, the way an inbox reads it. */
function styleOf(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (el.getAttribute("style") ?? "").split(";")) {
    const at = part.indexOf(":");
    if (at > 0) out[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  }
  return out;
}

/** The innermost cell whose text starts with `text`. */
function cellStarting(text: string): HTMLElement {
  const cells = doc.querySelectorAll("td").filter((td) => td.text.trim().startsWith(text));
  const cell = cells.at(-1);
  if (cell === undefined) throw new Error(`no cell starts with ${text}`);
  return cell;
}

/** WCAG relative-luminance contrast of two `#rrggbb` colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("board MondayMail — tiles, bars, boxes and headings", () => {
  it("pages live and pages planned are tinted tiles: accent then grey, 10px radius, 14px padding", () => {
    const tiles = doc.querySelectorAll("td").filter((td) => styleOf(td)["border-radius"] === "10px" && styleOf(td).padding === "14px");
    expect(tiles.map((td) => styleOf(td).background)).toEqual([T["--accent-bg"], T["--color-base-200"]]);
    expect(tiles[0]!.text).toContain("12");
    expect(tiles[1]!.text).toContain("7");
  });

  it("each Google step is a 10px bar filled to its share of the live pages, label above and count at its end", () => {
    const bars = doc.querySelectorAll("td").filter((td) => styleOf(td).height === "10px");
    // Found 11 of 12, Showing 5 of 12, First page 1 of 12: fill then track, each pair summing to the whole.
    expect(bars.map((td) => [td.getAttribute("width"), styleOf(td).background])).toEqual([
      ["92%", T["--color-primary"]], ["8%", T["--color-base-200"]],
      ["42%", T["--color-primary"]], ["58%", T["--color-base-200"]],
      ["8%", T["--color-primary"]], ["92%", T["--color-base-200"]],
    ]);
    const barRow = bars[0]!.closest("table")!.parentNode!.parentNode as HTMLElement;
    expect(barRow.querySelectorAll(":scope > td").at(-1)!.text.trim()).toBe("11");
    expect((barRow.previousElementSibling as HTMLElement).text.trim()).toBe(COPY["draft.ladder.found"]);
  });

  it("the biggest move up sits in the green box and the pace line in the grey one, each with its own edge", () => {
    const ok = doc.querySelector('td[data-rk-tone="ok"]')!;
    const quiet = doc.querySelector('td[data-rk-tone="quiet"]')!;
    expect(ok.text).toContain("tankless water heater austin");
    expect(quiet.text).toBe(COPY["mail.weekly.pace"]);
    expect([styleOf(ok).background, styleOf(ok).border]).toEqual([T["--ok-bg"], `1px solid ${T["--ok-line"]}`]);
    expect([styleOf(quiet).background, styleOf(quiet).border]).toEqual([T["--color-base-200"], `1px solid ${T["--color-base-300"]}`]);
    for (const box of [ok, quiet]) expect(contrast(styleOf(box).color!, styleOf(box).background!)).toBeGreaterThanOrEqual(4.5);
  });

  it("the greeting is the one 22px h1, the four sections are 16px h2s, and body text is 15px at 1.5", () => {
    const h1 = doc.querySelectorAll("h1");
    expect(h1).toHaveLength(1);
    expect(h1[0]!.text).toContain("Hi Dana");
    expect([styleOf(h1[0]!)["font-size"], styleOf(h1[0]!)["font-weight"]]).toEqual(["22px", "800"]);
    const h2 = doc.querySelectorAll("h2");
    expect(h2.map((h) => h.text)).toEqual(
      ["mail.weekly.google.title", "mail.weekly.ai.title", "mail.weekly.month", "mail.weekly.next"].map((key) => COPY[key as keyof typeof COPY].replace(/'/g, "’"))
    );
    for (const h of h2) expect(styleOf(h)["font-size"]).toBe(T["--h4"]);
    const calm = cellStarting(COPY["mail.weekly.calm"].split("{")[0]!.trim().slice(0, 12));
    expect([styleOf(calm)["font-size"], styleOf(calm)["line-height"]]).toEqual([T["--t-body"], "1.5"]);
  });
});

describe("the buttons survive images off and forced dark", () => {
  it("no link wraps an image: every control is text on a padded link", () => {
    const links = doc.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(8);
    for (const a of links) expect(a.querySelector("img"), a.text).toBeNull();
  });

  it("the mail declares itself light only, and the filled button keeps an edge and a readable label when its fill is stripped", () => {
    const schemes = doc.querySelectorAll("meta").filter((m) => /color-scheme/.test(m.getAttribute("name") ?? ""));
    expect(schemes.map((m) => [m.getAttribute("name"), m.getAttribute("content")])).toEqual([
      ["color-scheme", "light only"],
      ["supported-color-schemes", "light only"],
    ]);
    const open = doc.querySelector('a[data-rk-action="primary"]')!;
    const s = styleOf(open);
    expect(open.text).toBe(COPY["mail.weekly.action"]);
    expect(s.border).toBe(`1px solid ${s.background}`);
    expect(contrast(s.color!, s.background!)).toBeGreaterThanOrEqual(4.5);
    // An inbox that drops the fill leaves the label on the card's white.
    expect(contrast(T["--color-primary"], T["--color-base-100"])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the look changes only the HTML", () => {
  it("the plain-text twin ignores tile, bar, tone and heading level", () => {
    const at = new Date("2026-10-19T07:00:00.000Z");
    const { blocks } = buildWeekly({
      greeting: { name: "Dana", week: 3, business: "harborplumbing.example" },
      calendar: { today: "2026-10-19", time: "4:00 PM", planHref: "https://reachkit.example/app/calendar" },
      numbers: {
        live: measured(12, at),
        planned: measured(7, at),
        google: {
          steps: [{ name: "draft.ladder.found", count: measured(11, at), of: 12 }],
          early: false,
          climb: { search: "tankless water heater austin", from: 62, to: 24, climbing: true },
        },
      },
      pages: measured([], at),
      next: measured([], at),
    });
    // Every look-only field dropped, at any depth.
    const bare: unknown = JSON.parse(JSON.stringify(blocks, (key, value: unknown) => (["shape", "tone", "level", "of"].includes(key) ? undefined : value)));
    expect(bare).not.toEqual(blocks);
    expect(renderBlocksText(bare as never).text).toBe(renderBlocksText(blocks).text);
  });
});
