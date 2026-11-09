// tests/app/legal/board.test.tsx — the legal screen against board `Legal`: its tabs, its
// numbered contents, the follow-up timeline, the provider table and the rights, each where
// the board draws it, and no board string missing outside the shared header and footer.
import "../../generate/env";
import { readFileSync } from "node:fs";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "@/app/(public)/privacy/page.tsx";
import TermsPage from "@/app/(public)/terms/page.tsx";
import ImprintPage from "@/app/(public)/imprint/page.tsx";
import { copy } from "@/lib/presentation/copy";
import { NURTURE_H } from "@/lib/config/constants";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";

const PAGES = [
  { Page: PrivacyPage, path: "/privacy", title: copy("legal.privacy.title"), updated: copy("legal.privacy.updated") },
  { Page: TermsPage, path: "/terms", title: copy("legal.terms.title"), updated: copy("legal.terms.updated") },
  { Page: ImprintPage, path: "/imprint", title: copy("legal.imprint.title"), updated: copy("legal.imprint.updated") },
] as const;

const privacy = parse(renderToStaticMarkup(<PrivacyPage />));
const words = (el: { toString(): string } | null | undefined): string[] => (el ? segments(el.toString()) : []);

/** The section that holds the anchored heading `id`. */
function section(id: string) {
  const heading = privacy.querySelector(`h2#${id}`);
  expect(heading, `no section #${id}`).not.toBeNull();
  return heading!.closest("section")!;
}

describe("board Legal — the tabs", () => {
  for (const { Page, path, title, updated } of PAGES) {
    it(`${path}: Privacy · Terms · Imprint under the updated line, the page's own tab current`, () => {
      const root = parse(renderToStaticMarkup(<Page />));
      const nav = root.querySelector(`nav[aria-label="${copy("legal.tabs.label")}"]`);
      expect(nav).not.toBeNull();
      const tabs = nav!.querySelectorAll("a");
      expect(tabs.map((a) => [a.text, a.getAttribute("href")])).toEqual([
        [copy("legal.privacy.title"), "/privacy"],
        [copy("legal.terms.title"), "/terms"],
        [copy("legal.imprint.title"), "/imprint"],
      ]);
      expect(tabs.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.text)).toEqual([title]);
      const html = root.toString();
      expect(html.indexOf(copy("legal.updated", { date: updated }))).toBeGreaterThan(-1);
      expect(html.indexOf(copy("legal.updated", { date: updated }))).toBeLessThan(html.indexOf(nav!.toString()));
    });
  }
});

describe("board Legal — the numbered contents list", () => {
  it("numbers each section 01, 02 … in the document's order, beside its title", () => {
    const entries = words(privacy.querySelector('[data-testid="legal-toc"] ol'));
    const titles = privacy.querySelectorAll('[data-testid="legal-document"] h2').map((h) => h.text.replace(/^\d+\.\s+/, ""));
    expect(titles.length).toBe(11);
    expect(entries).toEqual(titles.map((t, i) => `${String(i + 1).padStart(2, "0")} ${t}`));
  });

  it("the section headings keep their numbers and anchors without them", () => {
    const heading = privacy.querySelector("h2#who-we-are");
    expect(heading?.text).toBe("1. Who we are");
    expect(privacy.querySelector('a[href="#who-we-are"]')).not.toBeNull();
  });
});

describe("board Legal — the follow-up mail timeline", () => {
  it("draws Start, then one mark per follow-up the schedule sends, with its caption, in What we collect", () => {
    const figure = section("what-we-collect").querySelector('figure[data-testid="legal-follow-ups"]');
    expect(figure).not.toBeNull();
    expect(words(figure!.querySelector("ul"))).toEqual([
      `${copy("legal.follow-ups.start")} ${copy("legal.follow-ups.asked")}`,
      ...NURTURE_H.map((h, i) => `${h} h Follow-up ${i + 1}`),
    ]);
    expect(figure!.querySelector("figcaption")?.text).toBe(copy("legal.follow-ups.note"));
  });

  it("sits right under the email bullet that names the schedule, before Billing data", () => {
    const html = privacy.toString();
    const figure = html.indexOf('data-testid="legal-follow-ups"');
    expect(figure).toBeGreaterThan(html.indexOf("Your email address."));
    expect(figure).toBeLessThan(html.indexOf("Billing data."));
  });
});

describe("board Legal — the provider table", () => {
  it("is a table under its caption, one row per provider the notice names, with its one job", () => {
    const table = section("service-providers").querySelector("table");
    expect(table?.querySelector("caption")?.text).toBe(copy("legal.providers.caption"));
    const rows = table!.querySelectorAll("tbody tr").map((tr) => [tr.querySelector('th[scope="row"]')?.text, tr.querySelector("td")?.text]);
    // Each row is a name and its job; the dash the Markdown list puts between them is gone.
    expect(rows.length).toBeGreaterThanOrEqual(7);
    for (const [name, job] of rows) {
      expect(name).toMatch(/^[A-Z]\w+$/);
      expect(job).toMatch(/^[A-Z].+\.$/);
    }
    expect(rows.map(([name]) => name)).toContain("PostHog");
    expect(section("service-providers").querySelector("ul")).toBeNull();
  });
});

describe("board Legal — the rights", () => {
  it("names the six rights as badges under the heading, before the text", () => {
    const rights = section("your-rights");
    const badges = rights.querySelectorAll(".badge").map((b) => b.text);
    expect(badges).toHaveLength(6);
    expect(badges[0]).toBe("Access");
    const html = rights.toString();
    expect(html.indexOf('data-testid="legal-rights"')).toBeLessThan(html.indexOf("You can ask for access"));
  });
});

describe("board Legal — In short carries its four icons; headings none", () => {
  it("each In short item sits beside its own tile, Database, Ban, Cookie, Download, in the board's order", () => {
    const items = privacy.querySelectorAll('[data-testid="legal-summary"] li');
    expect(items.map((li) => li.querySelectorAll("svg").map((svg) => svg.classList.value.find((c) => c !== "lucide" && c.startsWith("lucide-"))))).toEqual([
      ["lucide-database"],
      ["lucide-ban"],
      ["lucide-cookie"],
      ["lucide-download"],
    ]);
    expect(items.map((li) => li.text)).toEqual(
      copy("legal.privacy.summary")
        .split("\n")
        .map((line) => line.replace(/^- /, "")),
    );
  });

  for (const { Page, path } of PAGES) {
    it(`${path}: no section heading holds an icon`, () => {
      const root = parse(renderToStaticMarkup(<Page />));
      expect(root.querySelectorAll("h2 svg")).toEqual([]);
    });
  }
});

describe("board Legal — parity", () => {
  it("the three routes leave no board string missing but the shared header's and footer's", () => {
    const board = readFileSync(boardFile("Legal"), "utf8");
    const chrome = parse(board).querySelectorAll("header, footer").flatMap((el) => segments(el.toString()));
    const shipped = PAGES.flatMap(({ Page }) => segments(renderToStaticMarkup(<Page />)));
    const { missing } = compare(board, shipped, readAllow("Legal"));
    expect(missing.filter((s) => !chrome.includes(s))).toEqual([]);
  });
});
