// BUILD §2.1, tokens.md §9 — the idiom ported at the ruled values (#298).
// tests/ui/design/idiom-fidelity.test.ts
//
// The 2026-09-08 fidelity audit compared dev against the archived preview
// app and found the card-head chips rendering as empty tinted squares, the
// two pills missing, and asked whether the card radius had drifted to the
// idiom's proposed 18px. These are the pins for what that settled.
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TrendingUp } from "lucide-react";
import { describe, expect, it } from "vitest";
import { BrandMark, TREND_PATHS } from "@/app/(public)/_seo/og-card";
import { token } from "@/lib/mail/shell/tokens";

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

  it("each card head takes the chip the set draws on it", () => {
    expect(read("app/(public)/_landing/HeroShot.tsx")).toMatch(/icon=\{<TrendingUp /);
    expect(read("app/(public)/_landing/MatrixCard.tsx")).toMatch(/icon=\{<Bot /);
    expect(read("app/(public)/_landing/WeekCard.tsx")).toMatch(/icon=\{<Calendar /);
    expect(read("app/(public)/_landing/WeekCard.tsx")).toMatch(/icon=\{<FileText /);
  });

  it("the hero's own control carries no glyph — the set draws none on it", () => {
    // The card idiom's landing put `Search` in the hero CTA; the approved
    // set draws the field and a plain solid pill. A glyph the drawing does
    // not have is an addition, and additions are what this file catches.
    expect(read("app/(public)/_landing/ScanForm.tsx")).not.toContain("lucide-react");
  });
});

describe("issue #486 — every chip the approved set draws carries its glyph", () => {
  const CHIP = (name: string): RegExp => new RegExp(`icon=\\{<${name} size=\\{15\\}`);

  it("the brand mark is the trend glyph at stroke 2, on all four spends", () => {
    for (const rel of [
      "app/(public)/_chrome/Header.tsx",
      "app/(public)/_chrome/Footer.tsx",
      "app/(public)/signin/page.tsx",
      "app/(account)/app/layout.tsx",
    ]) {
      const source = read(rel);
      expect(source, rel).toMatch(/className="rk-wordmark-chip"[^>]*>\s*<TrendingUp size=\{15\} strokeWidth=\{2\}/);
      expect(source, rel).not.toMatch(/className="rk-wordmark-chip"[^>]*\/>/);
    }
  });

  it("the mark is the set's square: --r-field corners, --accent ground, --on-accent ink", () => {
    const css = withoutComments(read("ui/idiom/idiom.css"));
    const block = css.slice(css.indexOf(".rk-wordmark-chip {"));
    const body = block.slice(0, block.indexOf("}"));
    expect(body).toContain("border-radius: var(--r-field)");
    expect(body).toContain("background: var(--accent)");
    expect(body).toContain("color: var(--on-accent)");
  });

  it("S18's nine card heads take the set's nine glyphs (L807–821)", () => {
    const panels: Record<string, string> = {
      MarketPanel: "Globe",
      CompetitorsPanel: "Users",
      PublishingPanel: "Sparkles",
      VoicePanel: "PenLine",
      NotificationsPanel: "Bell",
      BillingPanel: "CreditCard",
      AccountPanel: "Lock",
      ContentPanel: "FileText",
      DangerZone: "Shield",
    };
    for (const [file, icon] of Object.entries(panels)) {
      expect(read(`app/(account)/app/settings/panels/${file}.tsx`), file).toMatch(CHIP(icon));
    }
  });

  it("S16's Copy-it-out head and S2's Copy link pill carry copy (L780, L577)", () => {
    expect(read("app/(account)/app/draft/[draftId]/DraftScreen.tsx")).toMatch(CHIP("Copy"));
    expect(read("app/(public)/scan/[domain]/_address/copy-link.tsx")).toMatch(/icon=\{<Copy size=\{14\}/);
  });

  it("a card head with no glyph draws no chip — the set never draws an empty one", () => {
    const head = read("ui/idiom/CardHead.tsx");
    expect(head).toMatch(/p\.icon == null \? null : \(\s*<span className="rk-head-chip"/);
  });
});

describe("issue #509 — the generated mark, the S12 figure and the tag hover, as the set draws them", () => {
  const idiom = withoutComments(read("ui/idiom/idiom.css"));
  // The stat's rung moved to the one daisyUI theme with the other component
  // re-skins (issue #548); the tag is still the idiom's own.
  const theme = withoutComments(read("ui/tailwind.css"));
  const ruleBody = (selector: string, css: string = idiom): string => {
    // Anchored at the line start, so a descendant rule whose selector ends
    // in the same text is not read as this one: `.rk-shot-tile
    // .stat-value.num` (the S1 miniature, issue #488) ends in
    // `.stat-value.num {` and is not the S12 rule this reads.
    const at = css.indexOf(`\n${selector} {`);
    expect(at, `${selector} is declared`).toBeGreaterThanOrEqual(0);
    const block = css.slice(at + 1);
    return block.slice(0, block.indexOf("}"));
  };

  it("the tab icon and the share cards draw BrandMark, and no pill is left in either", () => {
    const icon = read("app/(public)/icon.tsx");
    const card = read("app/(public)/_seo/og-card.tsx");
    expect(icon).toMatch(/<BrandMark size=\{size\.width\} \/>/);
    expect(card).toMatch(/<BrandMark size=\{\d+\} \/>/);
    for (const [rel, source] of [["icon.tsx", icon], ["og-card.tsx", card]] as const) {
      expect(source, rel).not.toContain('token("--r-pill")');
    }
  });

  it("BrandMark is the set's square: --r-field corners, --accent ground, --on-accent glyph", () => {
    const html = renderToStaticMarkup(createElement(BrandMark, { size: 32 }));
    expect(html).toContain(`border-radius:${token("--r-field")}`);
    expect(html).toContain(`background:${token("--accent")}`);
    expect(html).toContain(`stroke="${token("--on-accent")}"`);
    expect(html).toContain('stroke-width="2"');
  });

  it("the glyph keeps the set's 15-in-26 proportion", () => {
    const html = renderToStaticMarkup(createElement(BrandMark, { size: 52 }));
    expect(html).toMatch(/<svg[^>]* width="30" height="30"/);
  });

  it("its strokes are lucide's TrendingUp, the glyph every screen's mark renders", () => {
    const lucide = renderToStaticMarkup(createElement(TrendingUp));
    const drawn = [...lucide.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
    expect(drawn).toEqual([...TREND_PATHS]);
  });

  it("S12's figure computes --t-num-big at --num-weight (set `.stat-v` L192)", () => {
    const body = ruleBody(".stat-value.num", theme);
    expect(body).toContain("font-size: var(--t-num-big)");
    expect(body).toContain("font-weight: var(--num-weight)");
  });

  it("Stat's value is the element that rule reaches", () => {
    expect(read("ui/components/Stat.tsx")).toContain('className="stat-value num"');
  });

  it("ruling 8: hover raises the tag's × to full opacity and leaves the ground alone", () => {
    expect(ruleBody(".rk-tag-x")).toContain("opacity: 0.6");
    const hover = ruleBody(".rk-tag:hover .rk-tag-x");
    expect(hover).toContain("opacity: 1");
    expect(idiom).not.toMatch(/\.rk-tag:hover\s*\{/);
  });
});
