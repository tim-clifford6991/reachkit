/**
 * action-drafts.test.ts — deterministic JSON-LD drafts (launch-readiness A3).
 *
 * The schema/JSON-LD quick-win shipped with an empty draft on live trustmrr.com,
 * undercutting the paid "done-for-you draft" promise. The draft is fully
 * templatable — it must be present, valid JSON, and reflect the subject.
 */

import { describe, it, expect } from "vitest";
import { buildJsonLdDraft, fillDeterministicDrafts } from "./action-drafts";
import type { ListingFacts } from "./types";
import type { ActionCard } from "@/lib/llm/types";

const listing: ListingFacts = { name: "TrustMRR", category: "SaaS analytics", description: "Verify MRR for acquirers.", pricing: null };

function card(signalKeys: string[], draft: string | null = null): ActionCard {
  return {
    category: "seo_aso", title: "Add a JSON-LD block", why: "structured data missing",
    evidenceIds: [], evidence: [], effortMin: 20, suggestedDeadline: "2026-07-22",
    expectedOutcome: { scoreComponent: "seo", delta: 5 }, draft, draftRequiresEdit: true,
    verification: { method: "self_report", state: "pending" }, basis: "probability_based",
    confidence: 0.5, target: null, signalKeys,
  };
}

describe("buildJsonLdDraft", () => {
  it("emits a valid, parseable JSON-LD script block reflecting the subject", () => {
    const draft = buildJsonLdDraft(listing, "https://trustmrr.com/", "web");
    expect(draft).toContain('<script type="application/ld+json">');
    const json = draft.replace(/^<script[^>]*>\n/, "").replace(/\n<\/script>$/, "");
    const obj = JSON.parse(json);
    expect(obj["@type"]).toBe("SoftwareApplication");
    expect(obj.name).toBe("TrustMRR");
    expect(obj.url).toBe("https://trustmrr.com/");
    expect(obj.description).toContain("Verify MRR");
    expect(obj["@context"]).toBe("https://schema.org");
  });

  it("uses MobileApplication for app-store modes and omits unknown fields", () => {
    const draft = buildJsonLdDraft({ name: "X", category: null, description: null }, "https://apps.apple.com/x", "ios");
    const obj = JSON.parse(draft.replace(/^<script[^>]*>\n/, "").replace(/\n<\/script>$/, ""));
    expect(obj["@type"]).toBe("MobileApplication");
    expect(obj.operatingSystem).toBe("iOS");
    expect(obj.description).toBeUndefined(); // no invented fields
    expect(obj.applicationCategory).toBe("BusinessApplication"); // default when null
  });
});

describe("fillDeterministicDrafts", () => {
  it("fills a draft-less schema card and leaves others untouched", () => {
    const cards = [card(["schema_jsonld"]), card(["content_depth"]), card(["schema_jsonld"], "already written")];
    const out = fillDeterministicDrafts(cards, listing, "https://trustmrr.com/", "web");
    expect(out[0]!.draft).toContain("application/ld+json"); // filled
    expect(out[1]!.draft).toBeNull(); // non-schema untouched
    expect(out[2]!.draft).toBe("already written"); // existing draft preserved
  });

  it("no schema card → returns cards unchanged", () => {
    const cards = [card(["title_tag"])];
    expect(fillDeterministicDrafts(cards, listing, "https://x.com", "web")[0]!.draft).toBeNull();
  });
});
