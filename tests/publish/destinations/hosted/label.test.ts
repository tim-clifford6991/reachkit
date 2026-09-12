// tests/publish/destinations/hosted/label.test.ts — SPEC §5 (2026-09-12)
//
// The subdomain label the customer chooses. §5: "onboarding step 3 offers a
// subdomain label the customer chooses (default `content`), refusing an
// invalid … label in one written line".
//
// The rows that matter are the ones a permissive check would pass: a label
// with a dot in it is two labels and not a subdomain of their domain; a
// label that is only a hyphen composes a host no resolver will answer for;
// and an empty one composes `.example.com`, which is the shape that turns a
// customer's own apex into our address.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOSTED_LABEL,
  checkLabel,
  hostFor,
  normaliseLabel,
} from "@/lib/publish/destinations/hosted/label";

describe('§5 — "a subdomain label the customer chooses (default `content`)"', () => {
  it("the default is `content`, so a founder who chooses nothing keeps the address this product always served at", () => {
    expect(DEFAULT_HOSTED_LABEL).toBe("content");
  });

  it("an ordinary label is accepted and composes the host under their own domain", () => {
    for (const label of ["blog", "content", "news", "learn", "a", "guide-2026"]) {
      const checked = checkLabel(label);
      expect(checked, label).toEqual({ ok: true, label });
      expect(hostFor({ label, domain: "example.com" })).toBe(`${label}.example.com`);
    }
  });

  it("a host is case-insensitive, so what they typed and what is stored are one name", () => {
    expect(normaliseLabel("  Blog. ")).toBe("blog");
    expect(checkLabel("BLOG")).toEqual({ ok: true, label: "blog" });
    expect(hostFor({ label: "BLOG", domain: "example.com" })).toBe("blog.example.com");
  });
});

describe('§5 — "refusing an invalid … label in one written line"', () => {
  it("refuses everything that is not one DNS label", () => {
    for (const label of [
      "", // nothing typed
      "   ", // nothing but space
      "blog.news", // two labels: not a subdomain of their domain
      "-blog", // leading hyphen
      "blog-", // trailing hyphen
      "bl og", // a space inside
      "blog/", // a path
      "blög", // not an ASCII label
      "b".repeat(64), // one over what a DNS label may hold
    ]) {
      expect(checkLabel(label), label).toEqual({ ok: false, because: "not_a_label" });
    }
  });

  it("63 characters is a label and 64 is not — the boundary, not near it", () => {
    expect(checkLabel("b".repeat(63)).ok).toBe(true);
    expect(checkLabel("b".repeat(64)).ok).toBe(false);
  });

  it('"taken" is never decided here: this module reads no row', () => {
    // The row-shaped refusal has one home (`hostname.ts`), so a string
    // check that guessed at it would be a second answer to one question.
    for (const label of ["blog", "", "-x"]) {
      const checked = checkLabel(label);
      expect(checked.ok ? null : checked.because).not.toBe("taken");
    }
  });
});

describe("no host this module composes has an empty first label", () => {
  it("an unusable label falls back to the default rather than composing `.domain`", () => {
    for (const label of ["", "   ", "-", "a.b", null]) {
      const host = hostFor({ label, domain: "example.com" });
      expect(host, String(label)).toBe(`${DEFAULT_HOSTED_LABEL}.example.com`);
      expect(host.startsWith("."), String(label)).toBe(false);
    }
  });

  it("it composes on the customer's own domain and never on a ReachKit one", () => {
    for (const domain of ["example.com", "shop.acme.co.uk"]) {
      expect(hostFor({ label: "blog", domain })).toBe(`blog.${domain}`);
      expect(hostFor({ label: "blog", domain })).not.toContain("reachkit.app");
    }
  });
});
