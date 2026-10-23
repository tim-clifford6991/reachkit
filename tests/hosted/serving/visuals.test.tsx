/** @vitest-environment jsdom */
// Steps and lists on a hosted page are styles of the closed block set (owner
// R1, 2026-10-22, E9): no picture, a styled list keeps its list role, the text
// is the WordPress post's own, and a quantity is never drawn unscaled.
import "../../generate/env";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HostedPage } from "@/lib/publish/destinations/hosted";
import { HostedArticle } from "@/app/(hosted)/hosted-page/[[...slug]]/article";
import { HOSTED_BODY_CLASSES } from "@/app/(hosted)/hosted-page/body-classes";
import { readIn, readingIn } from "@/lib/presentation/copy/reader";
import { copyIn } from "@/lib/presentation/copy/translated";
import { labelledIn, parseMarkdown, toHtml, type Say } from "@/lib/publish/render/markdown";

const HOW_TO = [
  ":::answer",
  "Find the main shut-off valve and close it, then drain the pipes.",
  ":::",
  "",
  "## How do you shut the water off?",
  "",
  "Three steps, in this order.",
  "",
  "1. Close the main valve.",
  "2. Open the lowest faucet in the house, and an outside tap, to drain the pipes.",
  "3. Turn off the water heater: switch off its breaker, or set the gas control to “pilot”.",
].join("\n");

const QA = [
  ":::takeaways",
  "- Most homes have one main valve, where the supply line enters.",
  "- A lever valve is closed when the handle sits across the pipe.",
  ":::",
  "",
  "## When should you call an emergency plumber?",
  "",
  "Call one straight away in any of these cases.",
  "",
  "- Water is coming through a ceiling or a wall",
  "- The main valve will not close",
  "",
  "## Where is the valve?",
  "",
  "1. In the garage, or a closet on the street side",
  "2. Beside the water heater",
].join("\n");

/** Two figures in one unit, each linked to the main site. */
const OFFERING = [
  ":::answer",
  "Plans for teams that hire every month, from [$49 a month](https://publisher.test/pricing) to [$199 a month](https://publisher.test/pricing#team).",
  ":::",
  "",
  "## How does it work?",
  "",
  "1. You write the checklist once.",
  "2. Each step gets an owner.",
  "",
  "| Plan | Price |",
  "| --- | ---: |",
  "| Starter | [$49 a month](https://publisher.test/pricing) |",
  "| Team | [$199 a month](https://publisher.test/pricing#team) |",
].join("\n");

const GERMAN = [
  "## Wie stellt man das Wasser ab?",
  "",
  "1. Den Hauptwasserhahn schließen.",
  "2. Den untersten Wasserhahn öffnen.",
  "",
  "- Wasser kommt durch die Decke",
  "- Der Hahn lässt sich nicht schließen",
].join("\n");

function hosted(bodyMd: string, over: Partial<HostedPage> = {}): HostedPage {
  const at = new Date("2026-10-19T11:00:00.000Z");
  return {
    publicationId: "pub-1",
    siteId: "site-1",
    slug: "a-page",
    title: "A page",
    heading: null,
    bodyMd,
    description: null,
    faq: [],
    grounded: null,
    made: null,
    publisher: { name: "publisher.test", category: null, timeZone: null },
    byline: null,
    publishedAt: at,
    firstPublishedAt: at,
    liveUrl: "https://content.publisher.test/a-page",
    record: { opportunityId: "opp-1", targetQuery: "a page", measuredOn: null, mode: "autopilot", liveUrl: "" },
    ...over,
  } as HostedPage;
}

const BUSINESS = { name: "Publisher", logoType: null, line: null, domain: "publisher.test" };

function render(page: HostedPage, language: "en" | "de" = "en"): Document {
  const html = readingIn(() => {
    readIn(language);
    return renderToStaticMarkup(
      <HostedArticle resolved={{ page, canonical: page.liveUrl, others: [], business: BUSINESS }} />
    );
  });
  return new DOMParser().parseFromString(html, "text/html");
}

/** The body as drawn: the `prose` parts the serialiser filled. */
function body(doc: Document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>("article > .prose")].filter((el) => el.querySelector("h2, p, ol, ul"));
}

const FIXTURES = [
  { name: "a how-to", page: hosted(HOW_TO), language: "en" as const },
  { name: "a Q&A", page: hosted(QA), language: "en" as const },
  { name: "an offering page", page: hosted(OFFERING, { offering: true }), language: "en" as const },
  { name: "a German page", page: hosted(GERMAN), language: "de" as const },
];

const textOf = (html: string): string => {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent!.replace(/\s+/g, " ").trim();
};

describe("steps and lists are styles of existing blocks, not pictures", () => {
  for (const { name, page, language } of FIXTURES) {
    it(`${name}: no picture, every styled list a list, every captioned figure named`, () => {
      const parts = body(render(page, language));
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts) {
        expect(part.querySelectorAll("img")).toHaveLength(0);
        expect(part.querySelectorAll("svg:not([aria-hidden='true'])")).toHaveLength(0);
        // An element with nothing to read is a shape, except a rule.
        const shapes = [...part.querySelectorAll("*")].filter((el) => el.tagName !== "HR" && el.textContent!.trim() === "");
        expect(shapes).toEqual([]);
        expect(part.querySelectorAll("[style]")).toHaveLength(0);
        for (const list of part.querySelectorAll("ol[class], ul[class]")) expect(list.getAttribute("role")).toBe("list");
        for (const figure of part.querySelectorAll("figure")) {
          if (figure.querySelector("figcaption") === null) continue;
          const id = figure.getAttribute("aria-labelledby");
          expect(id === null ? null : figure.querySelector(`#${id}`)?.tagName).toBe("FIGCAPTION");
        }
      }
    });
  }

  it("draws an ordered list as steps, styled, with the number out of its text", () => {
    const steps = render(hosted(HOW_TO)).querySelector("article ol")!;
    expect(steps.getAttribute("role")).toBe("list");
    expect(steps.className).toContain("not-prose");
    expect(steps.querySelector("li")!.textContent).toBe("Close the main valve.");
  });

  for (const { name, page, language } of FIXTURES) {
    it(`${name}: with CSS removed, the body text is the WordPress serialisation's`, () => {
      const say: Say = (key, vars) => copyIn(language, key, vars);
      const blocks = labelledIn(parseMarkdown(page.bodyMd), say);
      expect(textOf(toHtml(blocks, HOSTED_BODY_CLASSES))).toBe(textOf(toHtml(blocks)));
    });
  }

  it("a list under the paragraph that introduces it is drawn once", () => {
    const text = body(render(hosted(QA))).map((part) => part.textContent).join(" ");
    for (const item of ["Water is coming through a ceiling or a wall", "Beside the water heater"]) {
      expect(text.split(item)).toHaveLength(2);
    }
  });

  it("WordPress and copy-out lists stay unstyled, with the list role every destination carries", () => {
    const html = toHtml(parseMarkdown(HOW_TO));
    expect(html).toContain('<ol role="list"><li>Close the main valve.</li>');
    expect(html).not.toContain("class=");
  });
});

describe("a quantity is drawn to scale from stated figures, or not drawn", () => {
  it("one figure renders as text", () => {
    const doc = render(hosted("Call-outs are [$149](https://publisher.test/emergency).", { offering: true }));
    const text = body(doc).map((part) => part.textContent).join(" ");
    expect(text).toContain("Call-outs are $149.");
    expect(doc.querySelectorAll("article [style]")).toHaveLength(0);
  });

  it("two linked figures in one unit stay text and a table: no bar is drawn that no block carries", () => {
    const doc = render(hosted(OFFERING, { offering: true }));
    const parts = body(doc);
    const text = parts.map((part) => part.textContent).join(" ");
    expect(text).toContain("$49 a month");
    expect(text).toContain("$199 a month");
    for (const part of parts) {
      expect(part.querySelectorAll("[style], [width]")).toHaveLength(0);
    }
  });
});
