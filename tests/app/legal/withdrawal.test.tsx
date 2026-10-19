// The terms page's withdrawal section, which Checkout's consent tick links to.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TermsPage from "@/app/(public)/terms/page.tsx";

const html = renderToStaticMarkup(<TermsPage />);

/** The section from its heading to the next section heading. */
function withdrawalSection(): string {
  const start = html.search(/<h2 id="withdrawal"/);
  expect(start, "no #withdrawal heading on /terms").toBeGreaterThan(-1);
  const next = html.indexOf("<h2", start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

describe("/terms#withdrawal", () => {
  it("the contents list links to the anchor Checkout links to", () => {
    expect(html).toContain('href="#withdrawal"');
  });

  it("states the 14-day right, both ways to withdraw, and the model form", () => {
    const section = withdrawalSection();
    expect(section).toContain("within 14 days");
    expect(section).toContain("Reply to any ReachKit email");
    expect(section).toContain("use Cancel in Settings");
    expect(section).toContain("Model withdrawal form");
    expect(section).toContain("I withdraw from my contract");
    expect(section).toMatch(/<li[^>]*>Email used to pay: …<\/li>/);
  });
});
