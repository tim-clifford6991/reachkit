// The floor title code builds at 0¢ from the search's own words, for the pick to fall back on.
import "../env";
import { expect, it } from "vitest";
import { floorTitle } from "@/lib/generate/pipeline/title";
import type { ContextPack } from "@/lib/generate/pipeline/pack";
import { pack } from "../fixtures";

const team = "which plan fits a small design team";
const market = (searchTerm: string): Partial<ContextPack> => ({ business: { ...pack().business, market: { searchTerm } } });

it.each([
  ["a year type: sentence-cased, the year in brackets", "generative engine optimization examples", { type: "listicle" }, "Generative engine optimization examples (2026)"],
  ["a type with no year in its title", "generative engine optimization examples", { type: "how_to" }, "Generative engine optimization examples"],
  ["D49's search term first, where the market holds one", "ai search visibility", market("ai search visibility for small teams"), "Ai search visibility for small teams"],
  ["a search shorter than a title", "which plan fits a small team", {}, null],
  ["a search longer than a title", `best ${"project management ".repeat(4)}software`, {}, null],
  ["a page the site has that reads almost the same", team, { pages: [{ url: "https://example.com/plans", title: "Which plan fits a small design team?" }] as never }, null],
  ["no such page", team, {}, "Which plan fits a small design team"],
  ["a German search, its own words and case", "sauerteigbrot aus der backstube in düsseldorf", { type: "research", locale: { country: "DE", language: "de" } }, "Sauerteigbrot aus der backstube in düsseldorf (2026)"],
] as const)("floorTitle: %s", (_, search, over, title) => {
  expect(floorTitle(pack({ target: { question: search, searches: [search] }, ...(over as Partial<ContextPack>) }))).toBe(title);
});
