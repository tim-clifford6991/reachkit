// BUILD §2.1, tokens.md §9 — the idiom ported at the ruled values (#298).
// tests/ui/design/idiom-fidelity.test.ts
//
// The 2026-09-08 fidelity audit compared dev against the archived preview
// app and found the card-head chips rendering as empty tinted squares, the
// two pills missing, and asked whether the card radius had drifted to the
// idiom's proposed 18px. These are the pins for what that settled.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandMark } from "@/app/(public)/_seo/og-card";
import { MARK_CHIP, MARK_DOME, MARK_RADIUS } from "@/lib/brand/mark";

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

  it("the card and the panel take --r-box", () => {
    // The glass card left this sheet with the sign-in screen (issue #549):
    // it is drawn on the page in `rounded-(--r-box)`, the same radius read
    // from the same token, and there is no rule here to measure.
    for (const rule of [".rk-idiom-card", ".rk-panel"]) {
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

describe("S1 — the landing's chips carry the icons the approved set draws", () => {
  // The archive's drawings are superseded by the owner's approved screen set
  // (2026-09-08, #364/#367), and with them the two-icon rule this block used
  // to hold: the set draws a different landing, so it names different icons.
  // What the rule *is* has not changed — a screen may draw the glyphs its
  // own approved drawing names, and no others, because an icon that means
  // something is a claim.
  const LANDING_FILES = [
    "app/(public)/page.tsx",
    "app/(public)/_landing/HeroShot.tsx",
    "app/(public)/_landing/MatrixCard.tsx",
    "app/(public)/_landing/WeekCard.tsx",
    "app/(public)/_landing/ScanForm.tsx",
  ] as const;

  /** Every lucide name the landing imports, deduplicated. */
  function iconsImported(): string[] {
    const source = LANDING_FILES.map((rel) => read(rel)).join("\n");
    const names = [...source.matchAll(/import \{ ([^}]+) \} from "lucide-react"/g)].flatMap((m) =>
      m[1]!.split(",").map((name) => name.trim())
    );
    return [...new Set(names)].sort();
  }

  it("the set's seven glyphs, and no eighth", () => {
    // S1 draws: the growth card's chip (trend), the matrix card's chip
    // (bot), the This-week card's chip (cal) and its panel's (file), the
    // video block's play control, and the three step cards' chips
    // (search · users · cal, L549 — issue #486).
    expect(iconsImported()).toEqual(["Bot", "Calendar", "FileText", "Play", "Search", "TrendingUp", "Users"]);
  });

  it("the three step cards take search, users and cal, in that order (L549)", () => {
    const page = read("app/(public)/page.tsx");
    const order = [...page.matchAll(/landing\.step\.\d\.body", Icon: (\w+)/g)].map((m) => m[1]);
    expect(order).toEqual(["Search", "Users", "Calendar"]);
  });

  it("each card head takes its glyph, at lucide stroke 1.75", () => {
    expect(read("app/(public)/_landing/HeroShot.tsx")).toMatch(/<TrendingUp size=\{16\} strokeWidth=\{1\.75\}/);
    expect(read("app/(public)/_landing/MatrixCard.tsx")).toMatch(/<Bot size=\{16\} strokeWidth=\{1\.75\}/);
    expect(read("app/(public)/_landing/WeekCard.tsx")).toMatch(/<Calendar size=\{16\} strokeWidth=\{1\.75\}/);
    expect(read("app/(public)/_landing/WeekCard.tsx")).toMatch(/<FileText size=\{20\} strokeWidth=\{1\.75\}/);
  });

  it("the hero's own control carries no glyph — the set draws none on it", () => {
    // The card idiom's landing put `Search` in the hero CTA; the approved
    // set draws the field and a plain solid pill. A glyph the drawing does
    // not have is an addition, and additions are what this file catches.
    expect(read("app/(public)/_landing/ScanForm.tsx")).not.toContain("lucide-react");
  });
});

describe("issue #486 — every chip the approved set draws carries its glyph", () => {

  it("the brand mark is the Round 9 Fade chip, drawn in exactly one file (#936, #982)", () => {
    // **This row used to assert the markup in each of the four files that
    // drew it.** Four identical copies is what it was really recording,
    // and the mark is about to be replaced — the owner's logo round
    // (`R7-L1`, `R8-*`, `R9-*` on the 2026-09-20 canvas) is open — so
    // #936 moved it into one file and this asserts that instead. What it
    // is protecting is stronger than before: not "the four agree" but
    // "there is one, and there is nothing else to disagree with it".
    // **The mark changed, and the rule did not.** #936 moved four copies
    // of a lucide glyph on a `bg-primary` span into one file so the mark
    // the owner was choosing could be swapped in one edit; #982 is that
    // edit. What this row asserts is the same claim as before — there is
    // one drawing — now against the drawing that replaced it. The chip is
    // part of the `<svg>` rather than a span around it, so the span's
    // classes are gone on purpose.
    const brand = read("app/_brand/Brand.tsx");
    expect(brand).toMatch(/from "@\/lib\/brand\/mark"/);
    expect(brand).not.toContain("rounded-field bg-primary text-primary-content");
    expect(brand).not.toContain("lucide-react");
    // The geometry itself is not restated here — it is `mark.ts`'s.
    const mark = readFileSync(path.join(SRC, "lib/brand/mark.ts"), "utf8");
    expect(mark).toContain("linearGradient");
    expect(mark).toContain("MARK_DOME");
  });

  it("nothing else draws the mark — a second copy is a second mark (#936)", () => {
    // The swap the logo round is heading for has to be one edit. Every
    // file that shows the brand reaches for `Brand` or `BrandMark`; none
    // of them spells the tile or the glyph again.
    for (const file of [
      "app/(public)/_chrome/Header.tsx",
      "app/(public)/_chrome/Footer.tsx",
      "app/(account)/app/layout.tsx",
      "app/(account)/app/_shell/TopBar.tsx",
      "app/(public)/signin/page.tsx",
    ]) {
      const source = read(file);
      expect(source, file).toMatch(/from "@\/app\/_brand\/Brand"/);
      expect(source, file).not.toContain("rounded-field bg-primary text-primary-content");
      // Nor the drawing that replaced it (#982): the dome, the fade and
      // the chip's violet are `lib/brand/mark.ts`'s alone.
      expect(source, file).not.toContain("linearGradient");
      expect(source, file).not.toContain("#5b4be0");
    }
    // The two generated pictures read it too, rather than carrying a
    // second mark as `og-card.tsx` did until #982.
    const card = read("app/(public)/_seo/og-card.tsx");
    expect(card).toMatch(/from "@\/lib\/brand\/mark"/);
    expect(card).not.toContain("#5b4be0");
  });

  it("S2's Copy link pill carries copy (L577)", () => {
    expect(read("app/(public)/scan/[domain]/_address/copy-link.tsx")).toMatch(/<Copy size=\{16\} strokeWidth=\{1\.75\}/);
  });

  it("a card head with no glyph draws no chip — the set never draws an empty one", () => {
    const head = read("ui/idiom/CardHead.tsx");
    expect(head).toMatch(/p\.icon == null \? null : \(\s*<span className="rk-head-chip"/);
  });
});

describe("issue #509 — the generated mark and the S12 figure, as the set draws them", () => {

  it("the share cards draw BrandMark, and the tab icon is the committed set (#982)", () => {
    // The tab icon was `icon.tsx`, an `ImageResponse` drawn at request
    // time. The owner's ruling asks for a real `.ico` and a real 180px
    // PNG, which that cannot serve, so the icons are committed files made
    // by `scripts/brand/render.mjs` from the one drawing — and
    // `tests/app/seo/metadata.test.tsx` holds those bytes to it.
    const card = read("app/(public)/_seo/og-card.tsx");
    expect(card).toMatch(/<BrandMark size=\{\d+\} \/>/);
    expect(card).not.toContain('token("--r-pill")');
    for (const file of ["icon.svg", "icon.ico", "apple-icon.png"]) {
      expect(existsSync(path.join(SRC, "app/(public)", file)), file).toBe(true);
    }
    // And the generators they replaced are gone, not left beside them.
    for (const file of ["icon.tsx", "apple-icon.tsx"]) {
      expect(existsSync(path.join(SRC, "app/(public)", file)), file).toBe(false);
    }
  });

  it("the generated mark is the Round 9 Fade chip, from the one drawing (#982)", () => {
    // It was a lucide glyph on an `--accent` square with its own geometry
    // written in `og-card.tsx`. The owner's 2026-09-21 ruling replaced the
    // mark, and #982 made `lib/brand/mark.ts` the only place its shape and
    // its violet are written — so this asserts the generated picture reads
    // from there rather than re-stating any of it.
    const html = renderToStaticMarkup(createElement(BrandMark, { size: 32 }));
    expect(html).toContain(`rx="${MARK_RADIUS}"`);
    expect(html).toContain(`fill="${MARK_CHIP}"`);
    expect(html).toContain(`d="${MARK_DOME}"`);
    // The fade is a real gradient, which is the standing rule's whole
    // point: the small sizes are this drawing scaled, never redrawn.
    expect(html).toContain("<linearGradient");
    expect(html).toContain("stop-opacity");
  });

  it("the mark scales by its box, not by a second set of numbers", () => {
    // One `viewBox`, whatever pixel size a canvas asks for — so 16 and 180
    // are the same drawing and there is nothing to keep in step.
    for (const size of [16, 32, 180]) {
      const html = renderToStaticMarkup(createElement(BrandMark, { size }));
      expect(html).toContain(`width="${size}" height="${size}"`);
      expect(html).toContain('viewBox="0 0 64 64"');
    }
  });
});
