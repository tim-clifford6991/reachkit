// tests/market/setup/rivals.test.ts — BUILD §4.3, REQ-026 criteria 8, 9, 11, 12
//
// The rival set the founder leaves setup with. Every criterion below is
// quoted from REQ-026 as it stands in
// `archive/sdlc-factory-2026-09-04/corpus/docs/requirements/REQ-026.md`.
import { describe, expect, it } from "vitest";
import {
  addRival,
  clearSuggested,
  isFull,
  removeRival,
  type RivalSet,
} from "@/lib/market/setup/rivals";
import { BATTERY } from "@/lib/config/constants";
import { registrableDomain } from "@/lib/market/rivals/domains";

// The canonicalisation the *caller* performs before `addRival` sees a
// value — on the server, in `POST /api/setup/domain` and in
// `completeSetup`, because the parser imports `node:net` and the setup
// screen's client bundle cannot carry one. Calling it here is what keeps
// these tests on the real path rather than on a tidier one: "already in
// the set however it is typed" is a promise about what a person writes,
// so what a person writes is what goes in.
function canonical(input: string): string | null {
  return registrableDomain(input);
}

const OWN = "example.com";

function setOf(...entries: [string, "suggested" | "typed"][]): RivalSet {
  return entries.map(([domain, origin]) => ({ domain, origin }));
}

function fill(count: number): RivalSet {
  return Array.from({ length: count }, (_, i) => ({
    domain: `rival${i}.com`,
    origin: "suggested" as const,
  }));
}

describe('c8 — "when they type its domain, then it is added and treated identically to a suggested one"', () => {
  it("a typed domain joins the set, canonicalised, carrying its own origin", () => {
    const result = addRival([], {
      domain: canonical("https://WWW.Asana.com/pricing"),
      origin: "typed",
      ownDomain: OWN,
      resolves: true,
    });
    expect(result).toEqual({ ok: true, set: [{ domain: "asana.com", origin: "typed" }] });
  });

  it("a suggested and a typed entry differ only in origin — the domain field is the same fact", () => {
    const typed = addRival([], {
      domain: canonical("asana.com"),
      origin: "typed",
      ownDomain: OWN,
      resolves: true,
    });
    const suggested = addRival([], {
      domain: canonical("asana.com"),
      origin: "suggested",
      ownDomain: OWN,
      resolves: true,
    });
    expect(typed.ok && suggested.ok).toBe(true);
    if (!typed.ok || !suggested.ok) return;
    expect(typed.set[0]!.domain).toBe(suggested.set[0]!.domain);
  });
});

describe('c8 — "a value that is not a domain name that resolves in DNS, or is their own site, or is already in the set however it is typed, is not added, consumes none of the five, and one written line says why"', () => {
  const cases: [string, string, boolean, string][] = [
    ["not a domain", "not a domain", true, "not_a_domain"],
    ["does not resolve", "monday.com", false, "does_not_resolve"],
    ["their own site", "example.com", true, "own_domain"],
    ["their own site, written differently", "https://www.example.com/", true, "own_domain"],
    ["their own hosted subdomain", "content.example.com", true, "own_domain"],
  ];

  it.each(cases)("%s is refused with a named reason and adds nothing", (_name, written, resolves, because) => {
    const before = setOf(["asana.com", "suggested"]);
    const result = addRival(before, {
      domain: canonical(written),
      origin: "typed",
      ownDomain: OWN,
      resolves,
    });
    expect(result).toEqual({ ok: false, because });
    expect(before).toHaveLength(1);
  });

  it("already in the set however it is typed", () => {
    const before = setOf(["asana.com", "suggested"]);
    for (const written of ["asana.com", "www.asana.com", "https://asana.com/x?y=1", "ASANA.COM"]) {
      expect(
        addRival(before, {
          domain: canonical(written),
          origin: "typed",
          ownDomain: OWN,
          resolves: true,
        })
      ).toEqual({ ok: false, because: "already_present" });
    }
    expect(before).toHaveLength(1);
  });

  it("every refusal consumes none of the five — a full set is still exactly full after four refusals", () => {
    const before = fill(BATTERY.COMPETITORS_MAX);
    for (const input of ["not a domain", "example.com", "rival0.com", "asana.com"]) {
      const result = addRival(before, {
        domain: canonical(input),
        origin: "typed",
        ownDomain: OWN,
        resolves: true,
      });
      expect(result.ok).toBe(false);
    }
    expect(before).toHaveLength(BATTERY.COMPETITORS_MAX);
  });

  it("what the value *is* outranks how full the set is: their own address in a full set says own_domain", () => {
    const full = fill(BATTERY.COMPETITORS_MAX);
    expect(
      addRival(full, { domain: canonical(OWN), origin: "typed", ownDomain: OWN, resolves: true })
    ).toEqual({ ok: false, because: "own_domain" });
  });
});

describe('c9 — "when they have five, then no sixth can be added and the limit is stated on screen rather than silently enforced"', () => {
  it("the sixth is refused with set_full, and five is BATTERY.COMPETITORS_MAX", () => {
    expect(BATTERY.COMPETITORS_MAX).toBe(5);
    const full = fill(BATTERY.COMPETITORS_MAX);
    expect(isFull(full)).toBe(true);
    expect(
      addRival(full, {
        domain: canonical("asana.com"),
        origin: "typed",
        ownDomain: OWN,
        resolves: true,
      })
    ).toEqual({ ok: false, because: "set_full" });
  });

  it("four is not full — the predicate the screen states the limit from is not off by one", () => {
    expect(isFull(fill(BATTERY.COMPETITORS_MAX - 1))).toBe(false);
  });
});

describe('c12 — "every rival that came from suggestions for the replaced domain is cleared from the set, a rival they typed themselves is kept"', () => {
  it("three suggested and two typed leave exactly the two typed, in order", () => {
    const before = setOf(
      ["a.com", "suggested"],
      ["b.com", "typed"],
      ["c.com", "suggested"],
      ["d.com", "typed"],
      ["e.com", "suggested"]
    );
    expect(clearSuggested(before)).toEqual([
      { domain: "b.com", origin: "typed" },
      { domain: "d.com", origin: "typed" },
    ]);
  });

  it("clearing mutates nothing", () => {
    const before = setOf(["a.com", "suggested"]);
    clearSuggested(before);
    expect(before).toHaveLength(1);
  });
});

describe("removeRival — rejecting a suggestion", () => {
  it("removes by the canonical form of any written variant, leaving the rest in order", () => {
    const before = setOf(["a.com", "suggested"], ["b.com", "typed"]);
    expect(removeRival(before, canonical("https://www.a.com/")!)).toEqual([
      { domain: "b.com", origin: "typed" },
    ]);
  });

  it("removing something that is not in the set is not an error", () => {
    const before = setOf(["a.com", "suggested"]);
    expect(removeRival(before, "z.com")).toEqual(before);
  });
});

describe('c11 — "Given a founder with no competitors selected ... then setup completes"', () => {
  it("the empty set is a legal set: nothing here refuses it", () => {
    expect(isFull([])).toBe(false);
    expect(clearSuggested([])).toEqual([]);
  });
});
