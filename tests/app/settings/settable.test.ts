// tests/app/settings/settable.test.ts — BUILD §4.7, REQ-070 criteria 1 and 3
//
// WO-178 `## Test plan` rows 1 and 3, and its step 6: "`SETTABLE` ∩ exported
// keys of `src/lib/config/constants.ts` = ∅. A pinned engine parameter that
// ever becomes settable fails it."
//
// The disjointness test is the discriminating one. REQ-070 criterion 3 names a
// class — "the number of tracked questions and how they are selected, scored or
// phrased, the search locale and the country searches are run in, scan or
// publishing cadence, how many pages a day are written, cost caps, row limits,
// freshness windows, scoring weights, or which model writes a page" — and a
// test that listed those names would be a list someone has to keep. Instead it
// asserts that the two sets never meet, and reads the second of them off the
// constants module itself, so a knob added to `constants.ts` tomorrow is
// covered by a test written today.
import { describe, expect, it } from "vitest";
import { ACTIONS, SETTABLE } from "@/app/(account)/app/settings/settable";
import * as constants from "@/lib/config/constants";

describe("REQ-070 c1 — SETTABLE is the fourteen keys, closed", () => {
  it("is exactly criterion 1's list, in the order WO-178 declares it", () => {
    expect([...SETTABLE]).toEqual([
      "category",
      "competitors",
      "domain",
      "mode",
      "veto_hours",
      "publish_time",
      "time_zone",
      "publishing_enabled",
      "destinations",
      "voice_text",
      "do_not_claim",
      "notifications",
      "name",
      "email",
    ]);
  });

  it("holds fourteen keys and no duplicate", () => {
    expect(SETTABLE).toHaveLength(14);
    expect(new Set(SETTABLE).size).toBe(14);
  });
});

describe("REQ-070 c2 — ACTIONS is the seven, closed", () => {
  it("is exactly criterion 2's list", () => {
    expect([...ACTIONS]).toEqual([
      "invoices",
      "cancel",
      "resume",
      "sign_out",
      "export",
      "unpublish_all",
      "delete_account",
    ]);
  });

  it("holds seven entries and no duplicate", () => {
    expect(ACTIONS).toHaveLength(7);
    expect(new Set(ACTIONS).size).toBe(7);
  });

  it("no key is both a setting and an action", () => {
    const settings = new Set<string>(SETTABLE);
    expect(ACTIONS.filter((a) => settings.has(a))).toEqual([]);
  });
});

describe("REQ-070 c3 — no pinned engine parameter is settable", () => {
  it("SETTABLE is disjoint from the exported names of src/lib/config/constants.ts", () => {
    const pinned = new Set(Object.keys(constants));
    // Reported, not assumed (rule 5.5): the count this test actually compared
    // against is stated, so a constants module that failed to load reads as a
    // zero rather than as a pass.
    expect(pinned.size).toBeGreaterThan(0);
    expect(SETTABLE.filter((key) => pinned.has(key))).toEqual([]);
  });

  it("and disjoint case-insensitively, so a lower-cased pin is caught too", () => {
    const pinned = new Set(Object.keys(constants).map((k) => k.toLowerCase()));
    expect(SETTABLE.filter((key) => pinned.has(key.toLowerCase()))).toEqual([]);
  });
});
