// SPEC §7 (2026-10-11, issue 1397) — the note on how a page was made: its
// two numbers are the draft row's, and a row that cannot give them gives
// no note.
import { describe, expect, it } from "vitest";
import { copyIn } from "@/lib/presentation/copy/translated";
import { madeCounts, madeHtml } from "@/lib/publish/render/made";

const ON_SITE = [
  { passage: "Open from 7", url: "https://cafe.example/hours" },
  { passage: "Beans roasted weekly", url: "https://www.cafe.example/about" },
  { passage: "Order ahead", url: "https://shop.cafe.example/order" },
];

describe("the numbers are the row's own", () => {
  it("counts the facts read from the site itself, and reads the rule count stored beside them", () => {
    const meta = {
      factsUsed: [...ON_SITE, { passage: "Scored 61", url: "https://reachkit.app/scan/cafe.example" }, "an older bare passage"],
      rulesChecked: 17,
    };
    expect(madeCounts(meta, "cafe.example")).toEqual({ facts: 3, rules: 17 });
  });

  it("a row written before the rule count was stored gives no note, not today's count", () => {
    expect(madeCounts({ factsUsed: ON_SITE }, "cafe.example")).toBeNull();
    expect(madeCounts({ factsUsed: ON_SITE, rulesChecked: "19" }, "cafe.example")).toBeNull();
    expect(madeHtml({ meta: { factsUsed: ON_SITE }, domain: "cafe.example", bodyMd: "A body." })).toBe("");
  });

  it("a row with no fact from the site gives no note", () => {
    expect(madeCounts(null, "cafe.example")).toBeNull();
    expect(madeCounts({ rulesChecked: 19 }, "cafe.example")).toBeNull();
    expect(madeCounts({ factsUsed: [{ passage: "x", url: "https://rival.example/pricing" }] }, "cafe.example")).toBeNull();
    expect(madeHtml({ meta: {}, domain: "cafe.example", bodyMd: "A body." })).toBe("");
  });
});

describe("the note in a post's content", () => {
  const meta = { factsUsed: ON_SITE, rulesChecked: 19 };

  it("is one escaped paragraph, and points at the sources list only where the body ends with one", () => {
    expect(madeHtml({ meta, domain: "cafe.example", bodyMd: "A body.\n\n## Sources\n\n- [A](https://a.example)" })).toBe(
      "<p>Written with AI from 3 facts on cafe.example, checked against 19 rules before publishing. Sources are listed below.</p>\n"
    );
    expect(madeHtml({ meta, domain: "cafe.example", bodyMd: "A body." })).toBe(
      "<p>Written with AI from 3 facts on cafe.example, checked against 19 rules before publishing.</p>\n"
    );
  });

  it("a page with a single fact says so in the singular", () => {
    expect(madeHtml({ meta: { factsUsed: ON_SITE.slice(0, 1) }, domain: "cafe.example", bodyMd: "" })).toContain("from one fact on cafe.example");
  });

  it("a German site reads it in German", () => {
    const html = madeHtml({ meta, domain: "cafe.example", bodyMd: "", say: (key, vars) => copyIn("de", key, vars) });
    expect(html).toContain("aus 3 Fakten von cafe.example");
    expect(html).toContain("19 Regeln");
  });
});
