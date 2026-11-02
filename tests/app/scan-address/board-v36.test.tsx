// Board PubReport v36 at 390, as ux-designer's review of the free report
// listed it: each drawn choice read off the rendered report, the reserved
// preview and the customer panel's stored SaaS and local reports alike.
// 0¢: nothing is measured.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse, type HTMLElement } from "node-html-parser";
import { copy } from "@/lib/presentation/copy";
import { FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import { tintOf } from "@/ui/SiteMark";
import { panelReport, renderReport } from "./panel-report";

const REPORTS = { preview: FIXTURE_REPORT, saas: panelReport("saas"), local: panelReport("local") };

describe.each(Object.entries(REPORTS))("the %s report", (_, report) => {
  const page = parse(renderReport(report));

  it("the biggest gap leads with TrendingUp on a light amber rule", () => {
    const gap = page.querySelector('[data-testid="report-gap"]')!;
    expect(gap.querySelector("svg.lucide-trending-up")).not.toBeNull();
    expect(gap.classList.contains("border-l-warning/50")).toBe(true);
  });

  it("the ring and its badge are the band's colour, the badge a soft tint", () => {
    const ring = page.querySelector(".radial-progress")!;
    const badge = ring.parentNode!.parentNode!.querySelector("p .badge")!;
    const tone = badge.classList.value.find((c) => /^badge-(primary|success|warning|error|ghost)$/.test(c))!;
    expect(badge.classList.contains("badge-soft")).toBe(true);
    const ink = { "badge-primary": "text-primary", "badge-success": "text-success", "badge-warning": "text-warning", "badge-error": "text-error", "badge-ghost": "text-base-content/70" }[tone];
    expect(ring.classList.contains(ink!)).toBe(true);
  });

  it("each closed list is a primary link, never a bordered box; the two lists carry their chevron on the left, the score's split none", () => {
    for (const id of ["verdict-split", "ai-answers-questions", "presence-absent-from"]) {
      const details = page.querySelector(`details[data-testid="${id}"]`)!;
      const summary = details.querySelector("summary")!;
      expect(details.classList.contains("collapse-arrow"), id).toBe(false);
      expect(summary.classList.contains("text-primary"), id).toBe(true);
      const chevron = summary.querySelector("svg.lucide-chevron-down");
      if (id === "verdict-split") expect(chevron, id).toBeNull();
      else expect(summary.firstChild as HTMLElement, id).toBe(chevron);
      expect(details.querySelector(".eyebrow"), id).toBeNull();
    }
  });

  it("the score's label sits at the card's left", () => {
    expect(page.querySelector('[data-testid="report-score"] .eyebrow')!.classList.contains("self-start")).toBe(true);
  });

  it("the head's date, the quote's caption and the most-searched line set only their search or date as the board does", () => {
    const meta = page.querySelector('[data-testid="report-read-as"]')!.parentNode!.querySelector("p.text-sm")!;
    expect(meta.querySelector(".num")).toBeNull();
    for (const testid of ["ai-answers-quote", "presence-most-searched"]) {
      const box = page.querySelector(`[data-testid="${testid}"]`);
      if (box === null) continue;
      const mono = box.querySelectorAll(".num");
      expect(mono, testid).toHaveLength(1);
      expect(box.text.length, testid).toBeGreaterThan(mono[0]!.text.length + 10);
    }
  });

  it("the offer is a tinted card around a white price card, its free path plain text before the link", () => {
    const link = page.querySelector('[data-testid="report-free-path"]');
    if (report.freePage === null) return expect(link).toBeNull();
    expect(link).not.toBeNull();
    expect(link!.text).toBe(copy("report.offer.free-path"));
    expect(link!.parentNode!.text.trim().startsWith(copy("report.offer.free-path.lead"))).toBe(true);
    const price = link!.parentNode!.parentNode!.parentNode!;
    expect(price.classList.contains("bg-base-100")).toBe(true);
    expect(price.closest("section")!.classList.contains("bg-(--accent-bg)")).toBe(true);
    expect(price.querySelector(".divider")).not.toBeNull();
    expect(price.querySelector("svg.lucide-shield-check")).toBeNull();
  });

  it("Site fixes and Do it yourself are bordered cards, each icon in a tinted tile; the first page's badge is the green free", () => {
    for (const [id, icon] of [["#holds", "wrench"], ["#method", "list"]] as const) {
      const details = page.querySelector(id)!;
      expect(details.classList.contains("card-border"), id).toBe(true);
      expect(details.querySelector(`summary svg.lucide-${icon}`)!.parentNode!.classList.contains("bg-(--accent-bg)"), id).toBe(true);
    }
    const free = page.querySelector('[data-testid="report-first-page"] > summary .badge');
    if (report.freePage !== null) expect(free!.classList.contains("badge-success")).toBe(true);
  });

  it("no line under the chips says the reach was not found", () => {
    expect(page.querySelector('[data-testid="report-read-where"]')).toBeNull();
    expect(page.text).not.toContain("Not found yet");
  });
});

describe("the reserved preview reads as a real scan does", () => {
  it("its reach is a chip with MapPin, after the buyer", () => {
    const chips = parse(renderReport(FIXTURE_REPORT)).querySelectorAll('[data-testid="report-read-as"] li');
    const where = chips.find((li) => li.text.trim() === copy("report.read.where.international"))!;
    expect(where.querySelector("svg.lucide-map-pin")).not.toBeNull();
    expect(chips.indexOf(where)).toBe(2);
  });
});

describe("a site's letter mark", () => {
  // The tints daisyUI can draw are the colour slots `theme.css` declares; any other slot draws grey.
  const declared = new Set(
    [...readFileSync(path.resolve(import.meta.dirname, "../../../src/ui/theme.css"), "utf8").matchAll(/--color-([a-z]+):/g)].map((m) => m[1])
  );

  it("is drawn on a tint the theme declares, for every domain", () => {
    for (const domain of ["example.com", "fernwoodtea.example", "a.io", "austinplumbery.com", "savvycal.com", "zz.example"]) {
      expect(declared.has(tintOf(domain).replace("badge-", "")), domain).toBe(true);
    }
  });
});
