// tests/presentation/place/places.test.ts — BUILD §6.6, REQ-091 c2
//
// The registry half of the cold-start law: every place a value or a module
// can sit is a name, and a name has exactly one line. What is asserted here
// is the registry's shape and the standing of each seeded line — never a
// sentence, which is the owner's.
import { describe, expect, it } from "vitest";
import { AWAITING_COPY, COPY, type CopyKey } from "@/lib/presentation/copy";
import { OWNER_OWED } from "@/lib/presentation/copy/registry";
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

  it("a line still owed is recorded as owed, so it cannot render as a blank", () => {
    // "Where a sibling requirement already fixes the wording for a place,
    // that fixed line is the one line and must itself say both things."
    // Until the owner writes it, the key is on one of the two standing
    // lists — and neither of them renders as nothing: an owner-owed key
    // makes `copy()` throw, the marker renders as itself.
    const owed: CopyKey[] = [];
    const awaiting: CopyKey[] = [];
    const written: CopyKey[] = [];
    for (const key of KEYS) {
      const line = PLACES[key].line;
      if (OWNER_OWED.includes(line)) owed.push(line);
      else if (AWAITING_COPY.includes(line)) awaiting.push(line);
      else written.push(line);
      // An owner-owed line is empty, and that is the point: `copy()`
      // refuses it, so `account()` throws naming the key rather than
      // handing the place a blank. What is asserted is that the key
      // exists and has a standing — not that a sentence has been written.
      expect(Object.keys(COPY), key).toContain(line);
    }
    // Rule 5.5 — the suite states its own coverage rather than passing
    // quietly. Five places today: one line written, four still the owner's.
    console.log(
      `tests/presentation/place: ${KEYS.length} place(s) seeded — ` +
        `${written.length} line(s) written, ${awaiting.length} awaiting copy, ${owed.length} owner-owed`
    );
    expect(KEYS.length).toBe(5);
    expect(written.length).toBe(1);
    expect(owed.length + awaiting.length).toBe(4);
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
