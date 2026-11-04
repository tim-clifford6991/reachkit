// The pick with code's floor title beside the writer's: the floor is taken only where every writer title stops the
// page, and is ranked like any other where it stops the page too.
import "../env";
import { describe, expect, it } from "vitest";
import { floorTitle, titleRuleFor } from "@/lib/generate/pipeline/title";
import { pickTitle } from "@/lib/generate/rules/title";
import { pack } from "../fixtures";
import STORED from "../fixtures/titles-ecf4f99d-2026-11.json";

const search = "generative engine optimization examples";
const listicle = pack({ type: "listicle", target: { question: search, searches: [search] } });
const rule = titleRuleFor(listicle, { description: "x".repeat(140) });
const floor = floorTitle(listicle)!;
const stopping = (title: string, on = rule) => pickTitle([title], on).candidates[0]!.faults.filter((fault) => fault !== "specific");

describe("pickTitle with a floor", () => {
  it("takes the floor where every writer title stops the page: ecf4f99d's three", () => {
    const written = STORED.map((each) => each.title);
    expect(written.every((title) => stopping(title).length > 0)).toBe(true);
    const picked = pickTitle(written, rule, floor);
    expect([picked.chosen, picked.candidates.map((each) => each.title)]).toEqual([floor, [...written, floor]]);
  });

  it("takes a writer title that stops nothing, though it lacks its specific and the floor sits closer to the search", () => {
    const writer = "Generative engine optimization examples for small teams";
    expect([stopping(writer), stopping(floor)]).toEqual([[], []]);
    expect(pickTitle([STORED[2]!.title, writer], rule, floor).chosen).toBe(writer);
  });

  it("ranks a floor that stops the page like any other: behind a writer title stopping as much, ahead of one stopping more", () => {
    const compares = "peec ai vs otterly vs profound comparison";
    const versus = pack({ type: "listicle", target: { question: compares, searches: [compares] }, business: { ...listicle.business, rivals: ["peec.ai", "otterly.ai", "tryprofound.com"] } });
    const on = titleRuleFor(versus, { description: "x".repeat(140) });
    const built = floorTitle(versus)!;
    const once = "Peec AI vs Otterly vs Profound comparison for small teams";
    const twice = "Peec AI vs Otterly vs Profound comparison: the ultimate guide";
    expect([stopping(built, on), stopping(once, on), stopping(twice, on)]).toEqual([["business"], ["business"], ["banned", "business"]]);
    expect([pickTitle([once], on, built).chosen, pickTitle([twice], on, built).chosen]).toEqual([once, built]);
  });

  it("adds nothing where there is no floor, or it is a writer title already", () => {
    expect(pickTitle(STORED.map((each) => each.title), rule).candidates).toHaveLength(3);
    expect(pickTitle([floor, STORED[0]!.title], rule, floor).candidates.map((each) => each.title)).toEqual([floor, STORED[0]!.title]);
  });
});
