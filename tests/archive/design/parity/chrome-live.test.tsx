// The shipped public header and footer read as board PubLanding v36 draws them, text for text and in order.
// Articles is the footer's one entry that depends on stored rows, so it is read both ways; the store is the seam.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "node-html-parser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "@/app/(public)/_chrome/Footer";
import { Header } from "@/app/(public)/_chrome/Header";
import { copy } from "@/lib/presentation/copy";
import { boardFile, segments } from "../../../scripts/design/parity.mjs";
import { settledMarkup } from "../../app/shell/settled";
import { partOf } from "./chrome-parts";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const stored: { pages: number } = { pages: 0 };
const HOST = "content.reachkit.example";

vi.mock("@/lib/publish/destinations/hosted/store", () => ({
  hostedSiteForDomain: async () => (stored.pages === 0 ? null : { siteId: "site-own", domain: "reachkit.example", host: HOST }),
  hostedHostOfSite: async () => HOST,
  livePagesForSite: async () =>
    Array.from({ length: stored.pages }, (_, i) => ({
      title: `Article ${i}`,
      slug: `article-${i}`,
      liveUrl: `https://${HOST}/article-${i}`,
      firstPublishedAt: new Date("2026-10-01T00:00:00Z"),
    })),
}));

const board = readFileSync(boardFile("PubLanding"), "utf8");
const ARTICLES = copy("chrome.nav.articles");

beforeEach(() => {
  stored.pages = 0;
});

async function footer(): Promise<string> {
  return settledMarkup(<Footer />);
}

describe("board PubLanding v36 — the shared chrome as shipped", () => {
  it("the bar reads as the board's header, and the drawer repeats only its links, switch and Sign in", () => {
    const root = parse(renderToStaticMarkup(<Header />));
    const side = root.querySelector(".drawer-side")!;
    const drawer = segments(side.toString());
    side.remove();
    expect(segments(root.toString())).toEqual(partOf(board, "header"));
    expect(drawer.every((s) => partOf(board, "header").includes(s))).toBe(true);
  });

  it("with stored articles, the footer reads as the board's, Articles last in Learn", async () => {
    stored.pages = 2;
    const html = await footer();
    expect(segments(html)).toEqual(partOf(board, "footer"));
    expect(parse(html).querySelector(`a[href="https://${HOST}/"]`)?.text).toBe(ARTICLES);
  });

  it("with none, it is the board's footer less Articles, and no route is invented for it", async () => {
    const html = await footer();
    expect(segments(html)).toEqual(partOf(board, "footer").filter((s) => s !== ARTICLES));
    expect(html).not.toContain("/articles");
  });

  it("Cancel your contract goes to the billing screen's own cancel", async () => {
    const cancel = parse(await footer())
      .querySelectorAll("a")
      .filter((a) => a.text === copy("chrome.footer.cancel"));
    expect(cancel.map((a) => a.getAttribute("href"))).toEqual(["/app/settings/account"]);
  });
});
