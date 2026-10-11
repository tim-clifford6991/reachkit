// tests/site-profile/demo-phrases.test.ts — issue 1249, SPEC §5 (2026-10-04).
//
// What a customer is owed: nothing their site shows as a demo, and nothing
// their site says about another business, is written down as a fact about
// theirs.
//
// The page is reachkit.app's home page as the ledger held it on 2026-09-28
// — before any of its widgets carried a mark — cut to the parts in question.
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();

vi.mock("@/lib/llm", () => ({ llm: vi.fn() }));

const { prose } = await import("../../src/lib/measure/prose");
const { demoPhrasesOf, readablePages, readKnowledge } = await import("../../src/lib/site-profile/knowledge/extract");
const { storedKnowledgeOf } = await import("../../src/lib/site-profile/knowledge/store");
const { NO_KNOWLEDGE } = await import("../../src/lib/site-profile/knowledge/types");
const { sitePassages } = await import("../../src/lib/generate/pipeline/grounding");

const HOME = `<!DOCTYPE html><html lang="en"><body><main>
<section><div><div><h1>See what AI tells buyers about your market — and write your way in.</h1>
<p>A free scan shows where AI answers and Google search send buyers to your rivals instead of you. Then ReachKit writes one page a day to change that.</p></div>
<div class="card" data-testid="landing-inside"><div class="card-body"><div><p>Inside ReachKit</p></div>
<div><div role="tabpanel"><div><div><span class="badge">Autopilot on since Aug 12</span><span><span class="num">harbourbikes.example</span></span></div>
<ol aria-label="This week"><li><span>Mon</span><span>Measured 400 searches and 12 AI questions</span></li><li><span>Tue</span><span>How much does a bike service cost in 2026?</span></li></ol></div></div>
<div role="tabpanel"><div><div class="stat"><div class="stat-title">Discoverability Score</div><div class="stat-value"><span>47</span><span>/100</span></div></div>
<p>The same week, every week. The number moves because the pages do.</p></div></div>
<div role="tabpanel"><div><div class="alert"><p>…near the harbor: <strong>Harbour Bike Repair</strong> — a basic service is $85 — as well as Cyclefix and Spokeworks.</p></div></div></div></div>
<p>An example business. It measures no site.</p></div></div></div></section>
<section><div><div data-testid="landing-video"><div><p>See it work</p><h2>From scan to published page in one sitting.</h2></div>
<div><span aria-hidden="true"></span><span>Demo video coming soon. Everything above it is the live product.</span></div></div></div></section>
<section><div><h2>See where you stand in under a minute.</h2><p>The report is free and yours to keep. ReachKit is €49 a month, VAT included, when you want the pages written.</p></div></section>
</main></body></html>`;

// As the product reads them: one block a line.
const DEMO_LINES = [
  "Autopilot on since Aug 12harbourbikes.example",
  "MonMeasured 400 searches and 12 AI questions",
  "…near the harbor: Harbour Bike Repair — a basic service is $85 — as well as Cyclefix and Spokeworks.",
  "The same week, every week. The number moves because the pages do.",
  "Demo video coming soon. Everything above it is the live product.",
];

function page(url: string, html: string) {
  const read = prose(html);
  return { url, text: read.text, examples: read.examples };
}

const home = page("https://reachkit.app/", HOME);

describe("a demo widget is found on a page that carries no mark", () => {
  it("takes the hero's example and the empty video frame out of the home page, and keeps its claims", () => {
    for (const line of DEMO_LINES) {
      expect(home.text).not.toContain(line);
      expect(home.examples).toContain(line);
    }
    expect(home.text).toContain("ReachKit is €49 a month, VAT included");
    expect(home.text).toContain("Then ReachKit writes one page a day to change that.");
  });

  it("drops a line that names a business at a reserved example domain, and only that line", () => {
    const read = prose(
      `<main><article><p>Our API answers in 40 ms at the median.</p><ul><li>rival-one.example.net 6/9</li><li>example.com 0/9</li></ul></article></main>`
    );
    expect(read.text).toBe("Our API answers in 40 ms at the median.");
    expect(read.examples).toEqual(["rival-one.example.net 6/9", "example.com 0/9"]);
  });
});

describe("the demo phrases are the site's, kept with its profile", () => {
  const OLDER = {
    url: "https://reachkit.app/pricing",
    // A page stored with the same line and no widget around it.
    text: `${"One plan, one price, and a page written for your site every day. ".repeat(4)}\nMonMeasured 400 searches and 12 AI questions`,
  };

  it("cleans a page with a phrase another page showed as a demo", () => {
    const [read] = readablePages([OLDER], demoPhrasesOf([home]));
    expect(read?.text).toContain("One plan, one price");
    expect(read?.text).not.toContain("Measured 400 searches");
  });

  it("stores the list with the reading, and a later read without the marked page still has it", async () => {
    const first = await readKnowledge({ capHit: () => true } as never, {
      domain: "reachkit.app",
      pages: [home],
      previous: NO_KNOWLEDGE,
    });
    expect(first.knowledge.demoPhrases).toEqual(expect.arrayContaining(DEMO_LINES));

    const stored = storedKnowledgeOf(JSON.parse(JSON.stringify(first.knowledge)));
    const second = await readKnowledge({ capHit: () => true } as never, {
      domain: "reachkit.app",
      pages: [OLDER],
      previous: stored,
    });
    expect(second.knowledge.demoPhrases).toEqual(expect.arrayContaining(DEMO_LINES));
  });

  it("reads a profile stored before the list existed", () => {
    expect(storedKnowledgeOf({ pages: [], readAt: null }).demoPhrases).toEqual([]);
  });
});

describe("a gallery of other businesses is never read as this one", () => {
  const body = "Trello scored 61 of 100 and is named in 9 of 12 AI answers about project management software. ".repeat(3);
  const pages = [
    { url: "https://reachkit.app/scans", text: body },
    { url: "https://reachkit.app/scans?cat=to-do+list+app&sort=highest", text: body },
    { url: "https://reachkit.app/scan/trello.com", text: body },
    { url: "https://reachkit.app/pricing", text: "ReachKit is €49 a month, VAT included, with a page written every day. ".repeat(3) },
    // A product that scans is not a gallery.
    { url: "https://scanner.example.org/scan", text: "Scan a receipt with your phone and it is filed in under ten seconds. ".repeat(3) },
    // Issue 1393: a published page cited `/signin` as a source. An account
    // page is no site's grounding, in its own language either.
    { url: "https://reachkit.app/signin", text: "Enter your email and we send you a link that signs you in for 30 days. ".repeat(3) },
    { url: "https://cafe.example.de/konto/anmelden", text: "Melden Sie sich an, um Ihre 3 letzten Bestellungen zu sehen. ".repeat(3) },
    { url: "https://shop.example.org/cart/checkout", text: "Your order ships in 2 days once the payment has cleared. ".repeat(3) },
  ];

  it("offers the knowledge read none of them", () => {
    expect(readablePages(pages).map((each) => each.url)).toEqual([
      "https://reachkit.app/pricing",
      "https://scanner.example.org/scan",
    ]);
  });

  it("offers a page no passage from them", () => {
    const withPassages = sitePassages(pages)
      .filter((each) => each.passages.length > 0)
      .map((each) => each.page.url);
    expect(withPassages).toEqual(["https://reachkit.app/pricing", "https://scanner.example.org/scan"]);
  });
});
