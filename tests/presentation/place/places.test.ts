// tests/presentation/place/places.test.ts — BUILD §6.6, REQ-091 c2
//
// The registry half of the cold-start law: every place a value or a module
// can sit is a name, and a name has exactly one line. What is asserted here
// is the registry's shape and the standing of each seeded line — never a
// sentence, which is the owner's.
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/presentation/copy";
import { PLACES, isPlaceKey, type PlaceKey } from "@/lib/presentation/place";

const KEYS = Object.keys(PLACES) as PlaceKey[];

describe("REQ-091 c2 — every place carries a line and a holds", () => {
  it("the registry is frozen: a place cannot be added at runtime", () => {
    expect(Object.isFrozen(PLACES)).toBe(true);
  });

  it("every place names a registry key for its line and one of the four holds", () => {
    for (const key of KEYS) {
      const spec = PLACES[key];
      expect(Object.keys(COPY), `${key}.line`).toContain(spec.line);
      expect(["value", "list", "series", "module"]).toContain(spec.holds);
    }
  });

  it("a place with no value position at all is representable, and one is seeded", () => {
    // The criterion reaches it explicitly: "including one with no value
    // position at all, such as a list with no entries or a chart with no
    // series". A calendar date carrying no page is that place.
    expect(PLACES["calendar.date.page"].holds).toBe("module");
    expect(KEYS.some((k) => PLACES[k].holds === "series")).toBe(true);
  });

  it("place names are lowercase-kebab segments, so a name reads as a place", () => {
    for (const key of KEYS) expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/);
  });

  it("a string that is not a registered place is not one — the sweep fails it by name", () => {
    expect(isPlaceKey("calendar.date.page")).toBe(true);
    expect(isPlaceKey("overview.something.nobody.registered")).toBe(false);
    // The property `PlaceKey` is a union for: an arbitrary string cannot be
    // cast into a place the way it can into a branded string.
    expect(isPlaceKey("")).toBe(false);
    expect(isPlaceKey("toString")).toBe(false);
  });
});

describe("REQ-091 c2 — a fixed line is asserted, not assumed", () => {
  it("every fixedBy names a clause of the form REQ-### c#", () => {
    for (const key of KEYS) {
      const fixedBy = PLACES[key].fixedBy;
      if (fixedBy === undefined) continue;
      expect(fixedBy, key).toMatch(/^REQ-\d{3} c\d+$/);
    }
  });

  it("every place's line is tagged with the law it serves, or with the clause that fixes it", () => {
    // A line that belongs to no law and cites no clause is a sentence
    // somebody wrote next to a component, which is the arrangement ADR-011
    // exists to prevent.
    for (const key of KEYS) {
      expect(PLACES[key].fixedBy, key).toBeDefined();
    }
  });
});
