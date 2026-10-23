// `/teardowns` and `/teardowns/{slug}` against boards `PubTeardowns` and
// `PubTeardown`: each board section's strings inside the matching section of
// the page, with the parity check's matcher, and the board's order. The board
// files are read here; no board string is copied into this test. The shared
// closing block is tests/app/library/learn-close.test.tsx.
import "../../generate/env";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { parse, type HTMLElement } from "node-html-parser";
import { describe, expect, it, vi } from "vitest";
import { boardFile, compare, readAllow, segments, words } from "../../../scripts/design/parity.mjs";

vi.mock("@/app/(public)/_how/examples", () => ({
  readLiveExamples: async () => ({ report: null, page: null, founder: null }),
}));

const index = await import("@/app/(public)/teardowns/page");
const { default: TeardownPage } = await import("@/app/(public)/teardowns/[site]/page");
const { TEARDOWNS } = await import("@/app/(public)/_library");
const { TEARDOWN_PARTS } = await import("@/app/(public)/_library/types");
const { copy } = await import("@/lib/presentation/copy");

function board(name: string): HTMLElement {
  return parse(readFileSync(boardFile(name), "utf8"));
}

/** The board's sections above its shared closing block. */
function boardSections(root: HTMLElement): HTMLElement[] {
  return root.querySelectorAll("main > section").filter((s) => s.getAttribute("aria-labelledby") !== "weekly-h");
}

function missing(boardName: string, boardPart: HTMLElement, shipPart: HTMLElement | null): string[] {
  expect(shipPart, `${boardName}: no matching section on the page`).not.toBeNull();
  return compare(boardPart.toString(), segments(shipPart!.toString()), readAllow(boardName)).missing;
}

/** The page's opening: its eyebrow, its heading, and the section under them. */
function opening(page: HTMLElement): HTMLElement {
  const parts = ["main article > span", "main h1", "main section"].map((q) => page.querySelector(q)?.toString() ?? "");
  return parse(`<div>${parts.join("")}</div>`);
}

const text = (el: HTMLElement | null): string => words(el?.text ?? "").join(" ");

async function teardown(slug: string): Promise<HTMLElement> {
  return parse(renderToStaticMarkup(await TeardownPage({ params: Promise.resolve({ site: slug }) })));
}

describe("/teardowns follows board PubTeardowns", () => {
  const page = parse(renderToStaticMarkup(index.default()));
  const [top, all] = boardSections(board("PubTeardowns"));

  it("the opening: the lead, the note and what every teardown reads, with its sketch", () => {
    expect(missing("PubTeardowns", top!, opening(page))).toEqual([]);
  });

  it("all teardowns: the count, the legend, and each card's hook, domain, badge and link", () => {
    expect(missing("PubTeardowns", all!, page.querySelector('section[aria-labelledby="all"]'))).toEqual([]);
  });

  it("the eyebrow counts the products the page lists", () => {
    const eyebrow = page.querySelector('section[aria-labelledby="all"] p');
    expect(eyebrow?.text).toBe(copy("teardowns.count", { count: String(TEARDOWNS.length) }));
    expect(page.querySelectorAll('section[aria-labelledby="all"] li')).toHaveLength(TEARDOWNS.length);
  });

  it("each card opens its teardown and says what changed since the first read", () => {
    const cards = page.querySelectorAll('section[aria-labelledby="all"] li a');
    expect(cards.map((a) => a.getAttribute("href"))).toEqual(TEARDOWNS.map((t) => `/teardowns/${t.slug}`));
    for (const [i, t] of TEARDOWNS.entries()) {
      const card = text(cards[i]!);
      expect(card, t.slug).toContain(words(t.hook).join(" "));
      expect(card, t.slug).toContain(words(copy("teardowns.card.read")).join(" "));
      if (t.change !== undefined) expect(card, t.slug).toContain(words(copy(`teardowns.card.change.${t.change}`)).join(" "));
    }
  });

  it("draws no RSS link, and still announces the feed in the head", () => {
    expect(page.querySelector('a[href="/teardowns/rss.xml"]')).toBeNull();
    expect(index.metadata.alternates?.types).toEqual({ "application/rss+xml": "/teardowns/rss.xml" });
  });
});

describe("/teardowns/plausible follows board PubTeardown", () => {
  const b = board("PubTeardown");
  const [top, body] = boardSections(b);

  it("the opening: the dates, the intro and the sketch with what each number marks", async () => {
    const page = await teardown("plausible");
    expect(missing("PubTeardown", top!, opening(page))).toEqual([]);
  });

  it("the four numbered parts with their chips and sketches, the takeaways, the sources and On this page", async () => {
    const page = await teardown("plausible");
    expect(missing("PubTeardown", body!, page.querySelector('[data-testid="teardown-body"]'))).toEqual([]);
  });

  it("the headings and On this page run in the board's order", async () => {
    const page = await teardown("plausible");
    const shipped = page.querySelectorAll('[data-testid="teardown-body"] h2').map(text);
    expect(shipped).toEqual(body!.querySelectorAll("article h2").map(text));
    const toc = page.querySelectorAll('[data-testid="teardown-body"] nav a').map(text);
    expect(toc).toEqual(b.querySelectorAll("aside.toc a").map(text));
  });
});

describe("every teardown numbers the reads it makes, and its contents reach each heading", () => {
  for (const t of TEARDOWNS) {
    it(t.slug, async () => {
      const page = await teardown(t.slug);
      const eyebrows = page.querySelectorAll('[data-testid="teardown-body"] article section[aria-labelledby] > div > p:first-child').map((p) => p.text);
      const parts = t.sections.flatMap((s) => (s.part === undefined ? [] : [s.part]));
      expect(eyebrows).toEqual(
        parts.map((part) =>
          copy("teardowns.part", { n: String(TEARDOWN_PARTS.indexOf(part) + 1), name: copy(`teardowns.part.${part}`) })
        )
      );
      const ids = new Set(page.querySelectorAll("[id]").map((el) => el.getAttribute("id")));
      const links = page.querySelectorAll('[data-testid="teardown-body"] nav a').map((a) => a.getAttribute("href")!.slice(1));
      expect(links).toHaveLength(t.sections.length + 2);
      for (const id of links) expect(ids.has(id), `#${id}`).toBe(true);
    });
  }
});
