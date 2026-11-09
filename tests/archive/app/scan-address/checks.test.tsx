/** @vitest-environment jsdom */
// SPEC §9 on the free report: the eight technical checks beside the three
// problem cards, as Site fixes lists them: only what needs work or could not
// run. What a customer sees before the engine reports a check, on a measured
// zero, and the exact lines they paste.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { measured, measuredZero, unmeasured } from "@/lib/measure/measured";
import { copy } from "@/lib/presentation/copy";
import { CheckCards, fixesOf } from "@/app/(public)/scan/[domain]/_problems/cards";
import { cardsOf } from "@/app/(public)/scan/[domain]/_problems/model";
import { FIXTURE_COLD_START_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import {
  CHECK_ORDER,
  checkCardsOf,
  readingsOf,
  VIEWPORT_LINE,
  type CheckReading,
} from "@/app/(public)/scan/[domain]/_problems/checks";

const AT = new Date("2026-09-14T06:00:00.000Z");
const found = (n: number, extra: Partial<CheckReading> = {}): CheckReading => ({
  count: measured(n, AT),
  severity: measured("mid", AT),
  ...extra,
});
/** An element standing where a value would sit, holding only the dash. */
const dashes = (markup: string): number => {
  const root = document.createElement("div");
  root.innerHTML = markup;
  return [...root.querySelectorAll("*")].filter((el) => el.children.length === 0 && el.textContent === copy("unmeasured.dash")).length;
};
const html = (readings: Parameters<typeof checkCardsOf>[0]): string =>
  renderToStaticMarkup(<CheckCards cards={fixesOf([], checkCardsOf(readings)).checks} />);
const DOERS = [copy("check.doer.free-fix"), copy("check.doer.reachkit-rewrites"), copy("check.doer.reachkit-writes")];

describe("a check the scan has not reported", () => {
  const markup = html({});

  it("every one of the eight has a row and the grey-dot legend, and no fix chip: nothing was found to fix", () => {
    expect(markup.split("data-check=").length - 1).toBe(CHECK_ORDER.length);
    expect(markup).toContain(copy("check.legend"));
    for (const doer of DOERS) expect(markup).not.toContain(doer);
  });

  it("is absent with its why-line: no count, no dash", () => {
    expect(dashes(markup)).toBe(0);
    expect(markup).not.toContain("<pre");
  });

  it("a reported-but-unmeasured check is absent the same way", () => {
    const one = html({ slow_pages: { count: unmeasured("undeterminable", AT), severity: unmeasured("undeterminable", AT) } });
    expect(dashes(one)).toBe(0);
    expect(one).toContain("couldn");
    expect(one).not.toContain("<pre");
  });
});

describe("a measured check", () => {
  it("a zero is not listed, and where every check ran there is no grey-dot legend", () => {
    const every = Object.fromEntries(CHECK_ORDER.map((c) => [c, found(2)]));
    const markup = html({ ...every, broken_links: { count: measuredZero(0, AT), severity: measured("low", AT) } });
    expect(markup).not.toContain('data-check="broken_links"');
    expect(markup.split("data-check=").length - 1).toBe(CHECK_ORDER.length - 1);
    expect(markup).not.toContain(copy("check.legend"));
  });

  it("a check that found something carries who fixes it", () => {
    const root = document.createElement("div");
    root.innerHTML = html({ slow_pages: found(3) });
    expect(root.querySelector('[data-check="slow_pages"]')?.textContent).toContain(copy("check.doer.free-fix"));
  });

  it("phone: the viewport line pastes verbatim, with its copy control", () => {
    const [card] = checkCardsOf({ phone_usability: found(4) }).filter((c) => c.check === "phone_usability");
    expect(card?.fix).toEqual({ kind: "paste", lines: [VIEWPORT_LINE] });
    expect(html({ phone_usability: found(4) })).toContain(copy("problem.paste.label"));
  });

  it("sitemap: the robots Sitemap line names the address the engine found, and nothing else", () => {
    const cards = checkCardsOf({ sitemap: found(1, { sitemapUrl: "https://example.com/sitemap.xml" }) });
    expect(cards.find((c) => c.check === "sitemap")?.fix).toEqual({
      kind: "paste",
      lines: ["Sitemap: https://example.com/sitemap.xml"],
    });
  });

  it("no line on any check can block a crawler, and ReachKit's checks carry none", () => {
    const every = Object.fromEntries(CHECK_ORDER.map((c) => [c, found(3, { sitemapUrl: "https://example.com/s.xml" })]));
    const cards = checkCardsOf(every);
    const lines = cards.flatMap((c) => (c.fix.kind === "paste" ? c.fix.lines : []));
    expect(lines.some((line) => /disallow|noindex/i.test(line))).toBe(false);
    for (const check of ["page_titles", "meta_descriptions", "structured_data"] as const) {
      expect(cards.find((c) => c.check === check)?.fix.kind).toBe("doer_only");
    }
  });
});

describe("the report reads the stored checks (#570), the same counts the dashboard reads", () => {
  it("a check that ran carries its stored count; one that could not run is absent", () => {
    const readings = readingsOf(
      {
        pagesChecked: 40,
        checkedPages: null,
        stoppedBy: "complete",
        issues: [
          { check: "slow_pages", ran: true, count: 3, over: 40, unit: "pages", severity: "critical", doer: "free_fix", pages: null },
          { check: "broken_links", ran: true, count: 0, over: 120, unit: "links", severity: "nothing_to_fix", doer: "free_fix", pages: null },
          { check: "sitemap", ran: false, because: "sitemap_unreadable" },
        ],
      },
      AT
    );
    expect(readings.slow_pages).toEqual({ count: measured(3, AT), severity: measured("high", AT) });
    expect(readings.broken_links?.count.kind).toBe("zero");
    expect(readings.sitemap).toBeUndefined();
    expect(readingsOf(null, AT)).toEqual({});
  });
});

describe("Site fixes with nothing to list keeps its place in one line", () => {
  const zeros = cardsOf(FIXTURE_COLD_START_REPORT, []);
  const allPass = Object.fromEntries(CHECK_ORDER.map((c) => [c, { count: measuredZero(0, AT), severity: measured("low", AT) }]));

  it("counts what ran and passed: the problems measured and the checks that ran", () => {
    expect(zeros.every((card) => card.fix.kind === "none_needed")).toBe(true);
    expect(fixesOf(zeros, checkCardsOf(allPass)).line).toBe(copy("problem.section.none", { n: String(zeros.length + CHECK_ORDER.length) }));
  });

  it("a check that couldn't run is listed under its grey dot instead, and with nothing run there is no line", () => {
    expect(fixesOf(zeros, checkCardsOf({})).line).toBe(copy("problem.section.sub.checks", { checks: String(CHECK_ORDER.length) }));
    expect(fixesOf([], []).line).toBeNull();
  });
});
