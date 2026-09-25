// The brand mark is one drawing, and the landing's chips carry their glyphs.
// tests/ui/design/mark-and-glyphs.test.ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandMark } from "@/app/(public)/_seo/og-card";
import { MARK_CHIP, MARK_DOME, MARK_RADIUS } from "@/lib/brand/mark";

const SRC = path.resolve(import.meta.dirname, "../../../src");
const read = (rel: string): string => readFileSync(path.join(SRC, rel), "utf8");

describe("S1 — the landing's chips carry the icons the approved set draws", () => {
  // The archive's drawings are superseded by the owner's approved screen set
  // (2026-09-08, #364/#367), and with them the two-icon rule this block used
  // to hold: the set draws a different landing, so it names different icons.
  // What the rule *is* has not changed — a screen may draw the glyphs its
  // own approved drawing names, and no others, because an icon that means
  // something is a claim.
  const LANDING_FILES = [
    "app/(public)/page.tsx",
    "app/(public)/_landing/InsideReachKit.tsx",
    "app/(public)/_landing/Features.tsx",
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

  it("the landing's glyphs, and no further one", () => {
    // S1 drew seven. The owner's ruling of 2026-09-21 (#935) replaced the
    // hero, so the hero's glyph changed with it: `TrendingUp` went with
    // `HeroShot`, and Round 11's card draws four of its own — the
    // autopilot pill (zap), the AI answer's source (message), and the two
    // halves of the work line (clock · send).
    //
    // **The rule is untouched and this row is retargeted, not loosened:**
    // a screen may draw the glyphs its own approved drawing names and no
    // others, because an icon that means something is a claim. The list is
    // still exact and still a closed set.
    //
    // The 2026-09-24 order (#1067, board `R12-1-Landing`) draws the four
    // feature cards' glyphs — bot, search, shield, file — and the fix
    // list's check; the steps carry numbers, not glyphs, so `Users` and
    // `Calendar` went with the old step cards.
    expect(iconsImported()).toEqual([
      "Bot",
      "Check",
      "Clock",
      "FileText",
      "MessageSquare",
      "Play",
      "Search",
      "Send",
      "ShieldCheck",
      "Zap",
    ]);
  });

  it("the four feature cards take bot, search, shield and file, in that order (#1067)", () => {
    const source = read("app/(public)/_landing/Features.tsx");
    const order = [...source.matchAll(/body: "landing\.feature\.\w+\.body", Icon: (\w+)/g)].map((m) => m[1]);
    expect(order).toEqual(["Bot", "Search", "ShieldCheck", "FileText"]);
  });

  it("each card head takes its glyph, at lucide stroke 1.75", () => {
    expect(read("app/(public)/_landing/InsideReachKit.tsx")).toMatch(/<Zap size=\{16\} strokeWidth=\{1\.75\}/);
    expect(read("app/(public)/_landing/InsideReachKit.tsx")).toMatch(/<MessageSquare size=\{16\} strokeWidth=\{1\.75\}/);
    expect(read("app/(public)/_landing/Features.tsx")).toMatch(/<Icon size=\{16\} strokeWidth=\{1\.75\}/);
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
    ]) {
      const source = read(file);
      expect(source, file).toMatch(/from "@\/app\/_brand\/Brand"/);
      expect(source, file).not.toContain("rounded-field bg-primary text-primary-content");
      // Nor the drawing that replaced it (#982): the dome, the fade and
      // the chip's violet are `lib/brand/mark.ts`'s alone.
      expect(source, file).not.toContain("linearGradient");
      expect(source, file).not.toContain("#5b4be0");
    }
    // The sign-in screen stopped drawing the brand itself with #1025: it
    // stands under the public header like every other public screen, and
    // a second brand inside its form half would say the name twice.
    expect(read("app/(public)/signin/page.tsx")).not.toContain("linearGradient");
    // The two generated pictures read it too, rather than carrying a
    // second mark as `og-card.tsx` did until #982.
    const card = read("app/(public)/_seo/og-card.tsx");
    expect(card).toMatch(/from "@\/lib\/brand\/mark"/);
    expect(card).not.toContain("#5b4be0");
  });

  it("S2's Copy link pill carries copy (L577)", () => {
    expect(read("app/(public)/scan/[domain]/_address/copy-link.tsx")).toMatch(/<Copy size=\{16\} strokeWidth=\{1\.75\}/);
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
    // It was a lucide glyph on an `--color-primary` square with its own geometry
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
