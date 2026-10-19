/** @vitest-environment jsdom */
// Issue 1539: Overview says what an AI answer misstated of the business,
// naming both what the answer said and what the site says, with the page
// where the site says it.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MisstatedFacts } from "@/app/(account)/app/_overview/MisstatedFacts";

describe("Overview's finding of what AI answers misstate (issue 1539)", () => {
  it("names the answer's figure, the site's statement and the page it is on", () => {
    const html = renderToStaticMarkup(
      <MisstatedFacts
        findings={[{ kind: "price", aiSays: "€29", answer: "Acme plans from €29 a month.", siteSays: "€49 per month.", url: "https://acme.example/pricing" }]}
      />
    );
    const card = new DOMParser().parseFromString(html, "text/html").querySelector('[data-testid="overview-misstated"]')!;
    expect(card.textContent).toContain("An AI answer says €29. Your site says: €49 per month.");
    expect(card.textContent).toContain("Acme plans from €29 a month.");
    expect(card.querySelector("a")?.getAttribute("href")).toBe("https://acme.example/pricing");
  });
});
