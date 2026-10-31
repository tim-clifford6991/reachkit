// SPEC §7 title specific: an informational page's title carries the page's own
// evidence, never the business's promise; the offering page still may. No model.
import "../env";
import { describe, expect, it } from "vitest";
import { titleBrief, titleRuleFor } from "../../../src/lib/generate/pipeline/title";
import { titleFaults } from "../../../src/lib/generate/rules/title";
import { pack } from "../fixtures";
import type { ContentType } from "../../../src/lib/opportunities/content-type";

const DESCRIPTION = "How answer engine optimisation and generative engine optimisation differ, what each one measures, and where a small site starts first.";

// A SaaS and a local business, each with its promise on its own pages and in its profile. The brief
// lists no lone digit on any page, so only the plumber's promise is one it could offer.
const CUSTOMERS = [
  { promise: "ReachKit publishes up to 7 pages a week across 9 answer engines.", search: "aeo vs geo", title: "AEO vs GEO: the difference in up to 7 pages a week", figure: null },
  { promise: "Our plumbers answer 24/7 and reach you in 2 hours.", search: "why is my boiler making noises", title: "Boiler noises: why they happen, fixed 24/7 in 2 hours", figure: /24\/7/ },
];

function promisePack(type: ContentType, customer: (typeof CUSTOMERS)[number]) {
  const base = pack();
  return pack({
    type,
    target: { question: customer.search, searches: [customer.search] },
    facts: [...base.facts, { ...base.facts[0]!, passage: customer.promise }],
    profile: { job: null, products: [], audience: [], promises: [customer.promise], vocabulary: [] },
  });
}

describe.each(CUSTOMERS)("a title's specific for $search", (customer) => {
  it("on a Q&A page, the brief offers no promise figure and a title carrying one has no specific", () => {
    const qa = promisePack("qa", customer);
    expect((titleBrief(qa).figures as string[]).join("\n")).not.toMatch(customer.figure ?? /\b7\b/);
    expect(titleFaults(customer.title, titleRuleFor(qa, { description: DESCRIPTION }))).toContain("specific");
  });

  it("on the offering page, the promise is still the page's own figure", () => {
    const offering = promisePack("offering", customer);
    if (customer.figure !== null) expect((titleBrief(offering).figures as string[]).join("\n")).toMatch(customer.figure);
    expect(titleFaults(customer.title, titleRuleFor(offering, { description: DESCRIPTION }))).not.toContain("specific");
  });
});
