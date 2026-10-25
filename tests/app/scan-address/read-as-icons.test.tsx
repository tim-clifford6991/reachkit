// Board PubReport, "We read you as": each chip draws the one icon its fact
// means (E44, E29) — Tag on what it is, MapPin on a town, Languages on the
// market measured — and the buyer chip draws none. A chip that would hold
// nothing is not drawn, nor is its icon. The customer panel's stored
// reports, a local business and a SaaS. 0¢: nothing is measured.
import { describe, expect, it } from "vitest";
import { parse } from "node-html-parser";
import type { StoredReport } from "@/lib/scan/report";
import { renderReport, walkReport } from "./panel-report";

/** A local plumber whose stored reading names its town. */
const LOCAL = walkReport("2026-10-16", "austinplumbery.com");

/** A SaaS read as selling across its country, with no buyer and no town read. */
function nationalSaas(): StoredReport {
  const report = walkReport("2026-10-16", "hubspot.com");
  const market = report.market as unknown as { value: { profile: Record<string, unknown> } };
  market.value.profile = { ...market.value.profile, reach: "national", audienceTerms: [] };
  return report;
}

/** Each read-as chip as its text and the lucide class of its icon, or null. */
function chips(report: StoredReport): { icon: string | null; text: string; attrs: Record<string, string> | null }[] {
  const list = parse(renderReport(report)).querySelector('[data-testid="report-read-as"] ul');
  expect(list, "the read-as list is drawn").not.toBeNull();
  return list!.querySelectorAll("li").map((li) => {
    expect(li.classList.value).toEqual(expect.arrayContaining(["badge", "badge-outline", "h-auto", "whitespace-normal"]));
    const svgs = li.querySelectorAll("svg");
    expect(svgs.length, "one icon at most").toBeLessThan(2);
    const svg = svgs[0];
    return {
      icon: svg === undefined ? null : (svg.classList.value.find((c) => c.startsWith("lucide-") && c !== "lucide-icon") ?? null),
      text: li.text.trim(),
      attrs: svg === undefined ? null : svg.attributes,
    };
  });
}

describe("the report's read-as chips draw the board's icons", () => {
  it("a local plumber: Tag on what it is, no icon on the buyer, MapPin on the town, Languages on the market", () => {
    const drawn = chips(LOCAL);
    expect(drawn.map((c) => c.icon)).toEqual(["lucide-tag", null, "lucide-map-pin", "lucide-languages"]);
    expect(drawn[2]!.text).toMatch(/^In and around /);
    for (const chip of drawn.filter((c) => c.attrs !== null)) {
      expect(chip.attrs).toMatchObject({ width: "14", height: "14", "stroke-width": "1.75", "aria-hidden": "true" });
    }
  });

  it("a national SaaS with no buyer read: no buyer chip, and its country-wide reach takes no MapPin", () => {
    const drawn = chips(nationalSaas());
    expect(drawn.map((c) => c.icon)).toEqual(["lucide-tag", null, "lucide-languages"]);
    expect(drawn[1]!.text).toMatch(/^Across /);
    expect(drawn.every((c) => c.text.length > 0)).toBe(true);
  });
});
