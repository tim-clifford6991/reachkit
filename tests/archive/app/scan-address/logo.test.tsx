// Board PubReport v36: the scanned site's own mark sits at 56px left of the
// domain h1 — its stored logo from our origin, else its first letter on the
// domain's tint. The domain is always written beside it.

// The "still reading" line's leaf asks the router to refresh.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "node-html-parser";
import { describe, expect, it, vi } from "vitest";
import { ReportView } from "@/app/(public)/scan/[domain]/_address/report-view";
import { FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import { tintOf } from "@/ui/SiteMark";

function head(hasLogo: boolean | undefined) {
  const html = renderToStaticMarkup(
    React.createElement(ReportView, {
      state: { report: FIXTURE_REPORT, notice: null, control: { kind: "none" }, correction: { offered: true, as: "first" }, hasLogo },
    })
  );
  const h1 = parse(html).querySelector("h1")!;
  return { h1, mark: h1.parentNode!.querySelector("span[aria-hidden]")! };
}

describe("the scanned site's mark beside the domain", () => {
  const domain = FIXTURE_REPORT.domain;

  it("a stored logo is drawn from the logo route at 56px", () => {
    const { h1, mark } = head(true);
    const img = mark.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(`/scans/logo/${domain}`);
    expect(img.getAttribute("width")).toBe("56");
    expect(img.getAttribute("height")).toBe("56");
    expect(mark.classList.contains("size-14")).toBe(true);
    expect(h1.text).toBe(domain);
  });

  it("with none stored, the first letter stands in on the domain's tint, and no picture is asked for", () => {
    for (const hasLogo of [false, undefined]) {
      const { h1, mark } = head(hasLogo);
      expect(mark.querySelector("img")).toBeNull();
      expect(mark.text).toBe(domain[0]!.toUpperCase());
      expect(mark.classList.contains(tintOf(domain))).toBe(true);
      expect(mark.classList.contains("size-14")).toBe(true);
      expect(h1.text).toBe(domain);
    }
  });
});
