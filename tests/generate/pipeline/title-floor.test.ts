// The floor title code builds at 0¢ from the search's own words, for the pick to fall back on.
import "../env";
import { describe, expect, it } from "vitest";
import { floorTitle } from "@/lib/generate/pipeline/title";
import { pack } from "../fixtures";

const on = (search: string, over: Parameters<typeof pack>[0] = {}) => floorTitle(pack({ target: { question: search, searches: [search] }, ...over }));

describe("floorTitle", () => {
  it("is the search sentence-cased, with the pack's year in brackets on a type whose title carries one", () => {
    expect(on("generative engine optimization examples", { type: "listicle" })).toBe("Generative engine optimization examples (2026)");
  });

  it("carries no year on a type whose title carries none", () => {
    expect(on("generative engine optimization examples", { type: "how_to" })).toBe("Generative engine optimization examples");
  });

  it("leads with D49's search term where the market holds one", () => {
    const p = pack({ type: "qa", target: { question: "ai search visibility", searches: ["ai search visibility"] } });
    expect(floorTitle({ ...p, business: { ...p.business, market: { searchTerm: "ai search visibility for small teams" } } })).toBe("Ai search visibility for small teams");
  });

  it("is null for a search shorter than a title, or one longer", () => {
    expect([on("which plan fits a small team"), on(`best ${"project management ".repeat(4)}software`)]).toEqual([null, null]);
  });

  it("is null where it reads almost the same as a page the site has", () => {
    const search = "which plan fits a small design team";
    expect(on(search, { pages: [{ url: "https://example.com/plans", title: "Which plan fits a small design team?" }] as never })).toBeNull();
    expect(on(search)).toBe("Which plan fits a small design team");
  });

  it("keeps a German search's own words and case", () => {
    expect(on("sauerteigbrot aus der backstube in düsseldorf", { type: "research", locale: { country: "DE", language: "de" } })).toBe("Sauerteigbrot aus der backstube in düsseldorf (2026)");
  });
});
