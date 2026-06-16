import { describe, it, expect } from "vitest";
import {
  domainFromUrl,
  parseProposed,
  isDisqualified,
  rankByCorroboration,
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
  it("embeds the product description and forbids inventing domains", () => {
    const p = buildProposePrompt({ name: "TrustMRR", description: "verified MRR badges for SaaS" }, 6);
    expect(p).toContain("verified MRR badges for SaaS");
    expect(p).toContain("Do NOT invent domains");
    expect(p).toContain("TrustMRR");
  });
});
