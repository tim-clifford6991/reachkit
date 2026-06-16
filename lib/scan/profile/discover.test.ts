import { describe, it, expect } from "vitest";
import {
  domainFromUrl,
  parseProposed,
  isDisqualified,
  rankByCorroboration,
  orderByProminence,
  buildProposePrompt,
} from "./discover";

describe("domainFromUrl", () => {
  it("extracts a registrable host, www stripped", () => {
    expect(domainFromUrl("https://www.square.com/payments")).toBe("square.com");
    expect(domainFromUrl("gocardless.com")).toBe("gocardless.com");
  });
  it("returns null for non-hosts", () => {
    expect(domainFromUrl("")).toBeNull();
    expect(domainFromUrl("localhost")).toBeNull();
  });
});

describe("parseProposed", () => {
  it("normalizes competitor names + domains, dropping invented blanks", () => {
    const raw = '{"competitors":[{"name":"Square","domain":"https://squareup.com"},{"name":"NoDomain"},{"name":""}]}';
    expect(parseProposed(raw)).toEqual([
      { name: "Square", domain: "squareup.com" },
      { name: "NoDomain", domain: null },
    ]);
  });
  it("returns [] on malformed JSON", () => {
    expect(parseProposed("nope")).toEqual([]);
  });
});

describe("isDisqualified", () => {
  it("drops the subject, its sub/parent domains, and aggregators", () => {
    expect(isDisqualified("acme.com", "acme.com")).toBe(true);
    expect(isDisqualified("blog.acme.com", "www.acme.com")).toBe(true);
    expect(isDisqualified("reddit.com", "acme.com")).toBe(true);
    expect(isDisqualified("rival.com", "acme.com")).toBe(false);
  });
});

describe("rankByCorroboration", () => {
  it("orders by how many independent signals named each domain", () => {
    const sources = new Map<string, Set<string>>([
      ["a.com", new Set(["llm"])],
      ["b.com", new Set(["llm", "alternatives", "overlap"])],
      ["c.com", new Set(["alternatives", "overlap"])],
    ]);
    expect(rankByCorroboration(["a.com", "b.com", "c.com"], sources)).toEqual([
      "b.com",
      "c.com",
      "a.com",
    ]);
  });
});

describe("buildProposePrompt", () => {
  it("embeds the description, forbids inventing domains, and demands prominence order", () => {
    const p = buildProposePrompt({ name: "TrustMRR", description: "verified MRR badges for SaaS" }, 6);
    expect(p).toContain("verified MRR badges for SaaS");
    expect(p).toContain("Do NOT invent domains");
    expect(p).toContain("MOST PROMINENT");
    expect(p).toContain("TrustMRR");
  });
});

describe("orderByProminence", () => {
  const proposed = [
    { name: "Baremetrics", domain: "baremetrics.com" }, // most prominent (LLM order)
    { name: "ChartMogul", domain: "chartmogul.com" },
    { name: "Obscure", domain: "obscure.io" }, // not in candidate set (failed verify)
  ];
  const sources = new Map<string, Set<string>>([
    ["baremetrics.com", new Set(["llm"])],
    ["chartmogul.com", new Set(["llm", "alternatives"])],
    ["openstartups.net", new Set(["alternatives", "overlap"])], // search-only
  ]);

  it("honors the LLM prominence order, then appends search-only by corroboration", () => {
    const candidateSet = new Set(["baremetrics.com", "chartmogul.com", "openstartups.net"]);
    expect(orderByProminence(proposed, candidateSet, sources)).toEqual([
      "baremetrics.com", // 1st in LLM order
      "chartmogul.com", // 2nd in LLM order
      "openstartups.net", // search-only, appended
    ]);
  });

  it("skips proposed domains that didn't survive verification", () => {
    const candidateSet = new Set(["chartmogul.com"]);
    expect(orderByProminence(proposed, candidateSet, sources)).toEqual(["chartmogul.com"]);
  });
});
