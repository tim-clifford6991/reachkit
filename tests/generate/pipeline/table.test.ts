// tests/generate/pipeline/table.test.ts — SPEC §7 (owner, D47; issue 1258):
// the listicle's comparison table is laid out by code from the pack.
//
// What a reader would notice if it broke: a rival whose page states no price
// vanishing from the comparison, or a cell that says a value is missing.
import "../env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ContextPack, PackClaim } from "../../../src/lib/generate/pipeline/pack";
import { completeTables } from "../../../src/lib/generate/pipeline/sources";
import { comparisonTable, withTable } from "../../../src/lib/generate/pipeline/table";
import { checkPlaceholderCell } from "../../../src/lib/generate/rules/cells";

/** The pack issue 1252's proof wrote its stopped listicle from: Meltwater's
 *  pricing page states no price and no feature page of its was read. */
const STORED = JSON.parse(
  readFileSync(path.join(__dirname, "../../../docs/walk/pipeline-v2/listicle.pack.json"), "utf8")
) as ContextPack;

const claim = (product: string, kind: PackClaim["kind"], passage: string): PackClaim => ({
  product,
  kind,
  passage,
  url: `https://${product}/${kind === "rival_pricing" ? "pricing" : "features"}`,
  title: product,
  readAt: STORED.builtAt,
});

function packOf(claims: PackClaim[]): ContextPack {
  const domains = [...new Set(claims.map((each) => each.product!))];
  return { ...STORED, claims, products: domains.map((domain) => ({ domain, pages: [] })) };
}

describe("the table is laid out from the pack", () => {
  it("the stored pack that left ReachKit alone now keeps both rivals, and no cell says a value is missing", () => {
    const table = comparisonTable(STORED, 2);
    expect(table?.options).toEqual(["ReachKit", "AEO Engine", "Meltwater"]);
    const rows = table!.markdown.split("\n");
    // Meltwater's pricing page states no figure, only that its pricing is
    // tailored: it keeps its row with that (D56), and the criterion it
    // lacks is left out of its cell.
    expect(rows[4]).toMatch(/Pricing: \[Custom pricing\]\(https:\/\/[^)]*meltwater/);
    expect(rows[4]).not.toContain("What it does");
    expect(rows[3]).toContain("What it does: [30-60 Articles/Month");
    expect(checkPlaceholderCell({ markdown: table!.markdown })).toBeNull();
    // The page pass has nothing to take out of it.
    expect(completeTables(table!.markdown)).toBe(table!.markdown);
  });

  it("a criterion every option states is a column; one most options lack leaves the table", () => {
    const table = comparisonTable(
      packOf([
        claim("a.example", "rival_pricing", "Plans start at €20 a month."),
        claim("a.example", "rival_features", "Tracks brand mentions in AI answers."),
        claim("b.example", "rival_features", "Weekly reports on AI visibility."),
        claim("c.example", "rival_features", "Monitors six AI engines."),
      ]),
      2
    );
    // Pricing: two of four state it — kept — so every option keeps its row.
    expect(table?.options).toHaveLength(4);
    const every = comparisonTable(
      packOf([
        claim("a.example", "rival_features", "Tracks brand mentions in AI answers."),
        claim("b.example", "rival_features", "Weekly reports on AI visibility."),
        claim("c.example", "rival_features", "Monitors six AI engines."),
        claim("c.example", "rival_pricing", "Trusted by 3000+ brands and agencies."),
      ]),
      2
    );
    // Only the business states a price: the criterion goes, the rivals stay.
    expect(every?.markdown.split("\n")[0]).toBe("| Option | What it does |");
    expect(every?.options).toHaveLength(4);
  });

  it("prices keep the currency each page states, side by side, and the table says so (D56)", () => {
    const table = comparisonTable(
      packOf([
        claim("a.example", "rival_pricing", "Trusted by 3000+ brands and agencies."),
        claim("a.example", "rival_pricing", "Plans start at $20 a month."),
        claim("a.example", "rival_features", "Tracks brand mentions in AI answers."),
        claim("b.example", "rival_pricing", "Pricing is tailored to each team; contact sales for a quote."),
        claim("b.example", "rival_features", "Weekly reports on AI visibility."),
      ]),
      2
    );
    const rows = table!.markdown.split("\n");
    expect(rows[0]).toBe("| Option | Pricing | What it does |");
    expect(rows[2]).toContain("€");
    expect(rows[3]).toContain("[Plans start at $20 a month.](https://a.example/pricing)");
    // No figure on its pricing page, but it says how it prices: a cell.
    expect(rows[4]).toContain("[Custom pricing](https://b.example/pricing)");
    expect(table?.currencies).toBe("Prices are shown in the currency each vendor publishes; none is converted.");
    expect(completeTables(table!.markdown)).toBe(table!.markdown);
    // One currency needs no such line.
    expect(comparisonTable(STORED, 2)?.currencies).toBeNull();
  });

  it("fewer than two rivals with a fact is no comparison", () => {
    expect(comparisonTable(packOf([claim("a.example", "rival_features", "Tracks brand mentions in AI answers.")]), 2)).toBeNull();
    expect(comparisonTable({ ...STORED, claims: [] }, 2)).toBeNull();
  });
});

describe("the table is dated (D52, issue 1267)", () => {
  it("says when the prices were last checked: the day the oldest of its rivals' pages was read", () => {
    expect(comparisonTable(STORED, 2)?.checked).toBe("Prices last checked 4 October 2026.");
    const older: PackClaim = { ...claim("b.example", "rival_features", "Weekly reports on AI visibility."), readAt: "2026-09-28T09:00:00.000Z" };
    const table = comparisonTable(packOf([claim("a.example", "rival_features", "Tracks brand mentions in AI answers."), older]), 2);
    expect(table?.checked).toBe("Prices last checked 28 September 2026.");
  });
});

describe("the writer writes around it", () => {
  it("the built table stands under the section's opening paragraph, in place of any the writer put there", () => {
    const body = [
      "## What should you look for?",
      "Look at price.",
      "## How do the options compare at a glance?",
      "Three options are compared.",
      "| Option | Price |\n| --- | --- |\n| Meltwater | Not stated |",
      "Each differs in scope.",
      "## Which should you choose?",
      "It depends.",
    ].join("\n\n");
    const table = comparisonTable(STORED, 2)!.markdown;
    const out = withTable(body, "How do the options compare at a glance?", table);
    expect(out).toContain(`Three options are compared.\n\n${table}\n\nEach differs in scope.\n\n## Which should you choose?`);
    expect(out).not.toContain("Not stated");
    expect(out.startsWith("## What should you look for?\n\nLook at price.")).toBe(true);
  });
});
