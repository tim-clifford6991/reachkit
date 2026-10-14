// tests/market/questions/intent.test.ts — BUILD §6.7 step 3, issue #26
// (WO-073's `## Test plan`).
//
// The one intent classifier: deterministic, model-free, total. Pure — this
// suite stubs nothing, because there is nothing to stub.
import { describe, expect, it } from "vitest";
import path from "node:path";
import { SELECTION } from "../../../src/lib/config/constants.ts";
import type { Profile } from "../../../src/lib/market/questions/profile.ts";
import {
  classifyIntent,
  intentWeight,
  passesRelevanceGuard,
  stemKey,
} from "../../../src/lib/market/questions/select.ts";
import { QUESTIONS_DIR, runtimeImportClosure } from "./import-graph.ts";

/** A user-onboarding SaaS — BUILD §6.7's own worked example, whose seed-drift
 *  case ("employee onboarding checklist HR") the relevance guard must kill. */
const PROFILE: Profile = {
  category: "user onboarding software",
  job: "onboard new users",
  offeringType: "saas",
  audienceTerms: ["product teams", "saas companies"],
  namedRivals: ["appcues", "userpilot"],
  vocabulary: ["onboarding", "product tour", "in-app guidance", "walkthrough", "adoption"],
  brandTokens: ["acme"],
};

describe("classifyIntent — the four shapes BUILD §6.7 names, plus the own-brand drop", () => {
  it.each([
    ["best user onboarding software", "decision"],
    ["appcues vs userpilot", "decision"],
    ["userpilot alternatives", "decision"],
    ["top onboarding tools", "decision"],
    ["user onboarding software", "solution"],
    ["onboarding platform", "solution"],
    ["how to onboard new users", "problem"],
    ["user onboarding not working", "problem"],
    ["what is user onboarding", "informational"],
    ["user onboarding", "informational"],
  ])("classifies %s as %s", (keyword, intent) => {
    expect(classifyIntent(keyword, PROFILE)).toBe(intent);
  });

  it("classifyIntent/own-brand-is-token-not-substring — the customer's own name drops the search, but a longer word merely containing it does not", () => {
    expect(classifyIntent("acme pricing", PROFILE)).toBe("own_brand");
    expect(classifyIntent("Acme Onboarding", PROFILE)).toBe("own_brand");
    expect(classifyIntent("acmecorp onboarding software", PROFILE)).not.toBe("own_brand");
  });

  it("a product name that is only the category's words does not drop the market (stripe.com's stored profile, issue 1423)", () => {
    const stripe: Profile = {
      ...PROFILE,
      category: "payment processing platform",
      offeringType: "saas",
      vocabulary: ["payment gateway", "billing and subscriptions"],
      brandTokens: ["Stripe", "Payments", "Terminal", "Connect", "Billing", "Radar"],
    };
    expect(classifyIntent("payment gateway", stripe)).toBe("informational");
    expect(classifyIntent("payment processing platform", stripe)).toBe("solution");
    expect(classifyIntent("subscription billing software", stripe)).toBe("solution");
    expect(classifyIntent("stripe payments", stripe)).toBe("own_brand");
    expect(classifyIntent("stripe radar", stripe)).toBe("own_brand");
  });

  it("own-brand outranks the shape: a decision-shaped search naming the customer is still dropped", () => {
    expect(classifyIntent("best acme alternatives", PROFILE)).toBe("own_brand");
  });

  it("classifyIntent/is-total — every generated keyword returns exactly one of the five members", () => {
    const members = new Set(["decision", "solution", "problem", "informational", "own_brand"]);
    const parts = ["best", "acme", "onboarding", "vs", "", "tool", "how to", "what is", "!!", "2024", "   "];
    for (const a of parts) {
      for (const b of parts) {
        for (const c of parts) {
          expect(members.has(classifyIntent(`${a} ${b} ${c}`, PROFILE))).toBe(true);
        }
      }
    }
  });

  it("classifyIntent/is-pure-and-model-free — two identical calls return an identical value, and select.ts reaches no model, no vendor and no cost seam at runtime", () => {
    expect(classifyIntent("best onboarding tools", PROFILE)).toBe(
      classifyIntent("best onboarding tools", PROFILE)
    );

    const closure = runtimeImportClosure(path.join(QUESTIONS_DIR, "select.ts"));
    expect(closure).toContain("lib/market/questions/select.ts");
    for (const forbidden of ["lib/llm/", "lib/vendors/", "lib/costs/", "lib/egress/", "lib/db/"]) {
      expect(closure.filter((file) => file.startsWith(forbidden))).toEqual([]);
    }
  });
});

describe("intentWeight — the pin, and the zero that drops an own-brand search", () => {
  it("intentWeight/reads-the-pin — the four weights equal SELECTION.intentWeights", () => {
    expect(intentWeight("best user onboarding software", PROFILE)).toBe(SELECTION.intentWeights.decision);
    expect(intentWeight("user onboarding software", PROFILE)).toBe(SELECTION.intentWeights.solution);
    expect(intentWeight("how to onboard new users", PROFILE)).toBe(SELECTION.intentWeights.problem);
    expect(intentWeight("what is user onboarding", PROFILE)).toBe(SELECTION.intentWeights.informational);
  });

  it("intentWeight/own-brand-weighs-zero — a caller ranking by weight drops it with no second branch", () => {
    expect(intentWeight("acme pricing", PROFILE)).toBe(0);
  });

  it("intentWeight/is-the-signature-BP-025-declares — (keyword, profile) => number, the profile required and no one-argument form", () => {
    const signature: (keyword: string, p: Profile) => number = intentWeight;
    expect(signature).toBe(intentWeight);
    expect(intentWeight.length).toBe(2);
  });
});

describe("stemKey — the near-duplicate collapse key (REQ-006 criterion 12)", () => {
  it("stemKey/collapses-the-four-differences — plural form, word order, punctuation and stop-words all produce one key", () => {
    expect(stemKey("onboarding tools")).toBe(stemKey("onboarding tool"));
    expect(stemKey("onboarding software best")).toBe(stemKey("best onboarding software"));
    expect(stemKey("appcues vs. userpilot")).toBe(stemKey("appcues vs userpilot"));
    expect(stemKey("software for user onboarding")).toBe(stemKey("software user onboarding"));
  });

  it("a difference in a content token is a different key", () => {
    expect(stemKey("user onboarding software")).not.toBe(stemKey("employee onboarding software"));
    expect(stemKey("onboarding tool")).not.toBe(stemKey("onboarding tool review"));
  });

  it("is deterministic and case-insensitive", () => {
    expect(stemKey("Best Onboarding Tools")).toBe(stemKey("best onboarding tools"));
    expect(stemKey("best onboarding tools")).toBe(stemKey("best onboarding tools"));
  });
});

describe("passesRelevanceGuard — BUILD §6.7's seed-drift kill", () => {
  it("kills BUILD's own worked example: 'employee onboarding checklist HR' dies for a user-onboarding SaaS", () => {
    expect(passesRelevanceGuard("employee onboarding checklist hr", PROFILE)).toBe(false);
  });

  it("keeps a search whose every non-generic token is supported by the profile", () => {
    expect(passesRelevanceGuard("best user onboarding software", PROFILE)).toBe(true);
    expect(passesRelevanceGuard("product tour software", PROFILE)).toBe(true);
    expect(passesRelevanceGuard("saas adoption platform", PROFILE)).toBe(true);
  });

  it("keeps a rival-brand search — the profile names the rival, and SELECTION.maxRivalBrand admits up to three of them", () => {
    expect(passesRelevanceGuard("appcues alternatives", PROFILE)).toBe(true);
    expect(passesRelevanceGuard("appcues vs userpilot", PROFILE)).toBe(true);
    expect(passesRelevanceGuard("hubspot vs salesforce", PROFILE)).toBe(false);
  });

  it("passesRelevanceGuard/empty-vocabulary-passes-nothing — a profile with no vocabulary supports nothing", () => {
    const empty: Profile = {
      category: "",
      job: "",
      offeringType: "",
      audienceTerms: [],
      namedRivals: [],
      vocabulary: [],
      brandTokens: [],
    };
    for (const keyword of ["best onboarding software", "onboarding", "best tools", ""]) {
      expect(passesRelevanceGuard(keyword, empty)).toBe(false);
    }
  });

  it("invents no vocabulary of its own — one unsupported non-generic token is enough to fail, however many are supported", () => {
    expect(passesRelevanceGuard("user onboarding software", PROFILE)).toBe(true);
    expect(passesRelevanceGuard("user onboarding software for warehouses", PROFILE)).toBe(false);
  });
});
