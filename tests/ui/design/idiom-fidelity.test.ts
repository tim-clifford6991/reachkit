// BUILD §2.1, tokens.md §9 — the idiom ported at the ruled values (#298).
// tests/ui/design/idiom-fidelity.test.ts
//
// The 2026-09-08 fidelity audit compared dev against the archived preview
// app and found the card-head chips rendering as empty tinted squares, the
// two pills missing, and asked whether the card radius had drifted to the
// idiom's proposed 18px. These are the pins for what that settled.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../../../src");
const read = (rel: string): string => readFileSync(path.join(SRC, rel), "utf8");

/** A stylesheet with its comments stripped. The idiom's header *names*
 *  `--r-card` in order to say it is not taken, so a rule about what the
 *  sheet spends has to read the declarations and not the prose. */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

describe("issue #298 — the card radius is the ruled --r-box, never the proposed 18px", () => {
  const idiom = withoutComments(read("ui/idiom/idiom.css"));

  it("every idiom surface names --r-box and no --r-card exists", () => {
    // tokens.md §9.2: `--r-card` 18px was drawn as a *second* variable so a
    // ruled value would not be re-drawn, and DECISIONS 2026-09-08 (#285)
    // keeps the two unruled values at BUILD's. So the token must not exist
    // here at all — not declared, not read.
    expect(idiom).not.toContain("--r-card");
    expect(idiom).not.toMatch(/border-radius:\s*18px/);
  });

  it("the card, the glass card and the panel all take --r-box", () => {
    for (const rule of [".rk-idiom-card", ".rk-glass", ".rk-panel"]) {
      const block = idiom.slice(idiom.indexOf(`${rule} {`));
      const radius = /border-radius:\s*([^;]+);/.exec(block.slice(0, block.indexOf("}")));
      expect(radius?.[1], `${rule} must take the ruled radius`).toBe("var(--r-box)");
    }
  });

  it("no raw pixel radius is written anywhere in the sheet", () => {
    // The three registered radii are `--r-box`, `--r-field` and `--r-pill`;
    // a literal would be a fourth by the back door.
    expect(idiom).not.toMatch(/border-radius:\s*\d/);
  });
});

describe("issue #298 — the card-head chips carry the icons the archive names", () => {
  it("the hero specimen takes `Search`, the archive's own choice", () => {
    const specimen = read("app/(public)/_landing/HeroSpecimen.tsx");
    expect(specimen).toMatch(/import \{ Search \} from "lucide-react"/);
    expect(specimen).toMatch(/icon=\{<Search /);
  });

  it("the three narrative cards take `ArrowRight`, and the same one on all three", () => {
    // The archive's own reason, kept: "the icon is the SAME on all three on
    // purpose — three different icons would assign meaning to three cards
    // whose copy is not written yet, and an icon that means something is a
    // claim."
    const landing = read("app/(public)/page.tsx");
    expect(landing).toMatch(/import \{ ArrowRight \} from "lucide-react"/);
    expect([...landing.matchAll(/icon=\{<ArrowRight /g)]).toHaveLength(3);
  });

  it("no icon is chosen that the archive does not name", () => {
    // The two the idiom's own landing page draws, and nothing else. A
    // fourth glyph is a claim about a card whose copy is still owed.
    const landing = read("app/(public)/page.tsx");
    const specimen = read("app/(public)/_landing/HeroSpecimen.tsx");
    const imported = [...`${landing}\n${specimen}`.matchAll(/import \{ ([^}]+) \} from "lucide-react"/g)]
      .flatMap((m) => m[1]!.split(",").map((name) => name.trim()))
      .sort();
    expect(imported).toEqual(["ArrowRight", "Search"]);
  });
});
