// Issue 1536: "Peec AI vs Otterly" was stopped twice for the 17 in
// "Prices last checked 17 October 2026.", the line code lays under its table.
// Claims as stored with that draft; the business is not reachkit.app.
import "../env";
import { describe, expect, it } from "vitest";
import { fixNotes, repairMechanical } from "../../../src/lib/generate/pipeline/repair";
import { comparisonTable } from "../../../src/lib/generate/pipeline/table";
import { checkTraceableNumerals } from "../../../src/lib/generate/rules/brief";
import { pack } from "../fixtures";

const READ = "2026-10-17T07:01:20.000Z";
const CLAIMS = [
  { product: "otterly.ai", url: "https://otterly.ai/pricing", passage: "Lite $ 29 /month For solo marketers, and small teams", kind: "rival_pricing" as const },
  { product: "peec.ai", url: "https://peec.ai/pricing", passage: "Unlimited users on every plan.", kind: "rival_features" as const },
  { product: "tryprofound.com", url: "https://www.tryprofound.com/features", passage: "Up to 9 Answer Engines tracked", kind: "rival_features" as const },
].map((claim) => ({ ...claim, title: claim.product, readAt: READ }));
const PACK = pack({
  type: "listicle",
  facts: [{ passage: "Northwind is $39 a month for the whole team.", url: "https://example.com/pricing", readAt: READ }],
  claims: CLAIMS,
  products: CLAIMS.map((claim) => ({ domain: claim.product, pages: [claim.url] })),
});
const table = comparisonTable(PACK, 2);
const brief = (laid: boolean) => ({
  facts: PACK.facts.map((fact) => fact.passage),
  queries: ["otterly vs peec ai"],
  marketFacts: CLAIMS,
  ...(laid ? { laid: [table?.checked ?? ""] } : {}),
});

describe("issue 1536: a line code lays in from the pack is not the writer's figure", () => {
  it("passes the laid line, keeps it through the repair and out of the fix notes, and holds the writer's own date", () => {
    expect(table?.checked).toBe("Prices last checked 17 October 2026.");
    const page = `Otterly and Peec AI both track AI answers.\n\n${table?.markdown}\n\n${table?.checked}`;
    expect(checkTraceableNumerals({ markdown: page, brief: brief(true) })).toBeNull();
    expect(checkTraceableNumerals({ markdown: page, brief: brief(false) })).toMatchObject({ detail: { figure: "17" } });
    expect(checkTraceableNumerals({ markdown: `${page}\n\nWe looked on 17 October 2026.`, brief: brief(true) })).toMatchObject({ detail: { figure: "17" } });
    const stopped = `${page}\n\nOtterly tracks 23 engines.`;
    const repaired = repairMechanical(stopped, ["traceable_numerals"], { brief: brief(true), sources: [] });
    expect([repaired.includes(table!.checked), repaired.includes("23 engines")]).toEqual([true, false]);
    const notes = fixNotes(stopped, [{ rule: "traceable_numerals" }], brief(true));
    expect(notes[0]?.sentences).toEqual(["Otterly tracks 23 engines."]);
  });
});
