// The canvas boards draw the 2026-10-24 expert rulings (docs/spec/decisions/2026-10-24-1983.md).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { type HTMLElement, parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/presentation/copy";
import { BOARDS_DIR } from "../../../scripts/design/parity.mjs";

const raw = (name: string) => readFileSync(path.join(BOARDS_DIR, `${name}.dc.html`), "utf8");
const board = (name: string) => parse(raw(name));
const BOARDS = readdirSync(BOARDS_DIR).filter((f) => f.endsWith(".dc.html")).map((f) => f.slice(0, -".dc.html".length));

// Lucide drawings, by a path only that icon has.
const FILE_TEXT = 'd="M16 13H8';
const PENCIL = 'd="m15 5 4 4"';
const PEN_LINE = "M12 20h9M16.5 3.5";
const BUILDING_2 = 'd="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"';
const STORE = "m2 7 4.41-4.41";
const MAP = "M15 5.8v15M9 3.2v15";
const MAP_PIN = 'd="M20 10c0 4.993';
const BOOK_OPEN = 'd="M12 5v16"';
const FLAME = "M8.5 14.5A2.5";
const MESSAGE_CIRCLE_WARNING = 'd="M2.992 16.342';
const GLANCE = ["PubAnswer", "PubCompare", "PubCompareTool", "PubHowItWorks", "PubTeardown", "PubTeardowns", "PubToolMeta", "PubToolOnPage", "PubTools", "PubScans"];

/** A row of squares: an element whose children are all empty spans, `min` or more. */
function squareRows(root: HTMLElement, min: number): HTMLElement[] {
  return root.querySelectorAll("*").filter((el) => {
    const kids = el.childNodes.filter((n): n is HTMLElement => n.nodeType === 1);
    return kids.length >= min && kids.every((k) => k.rawTagName === "span" && k.innerHTML === "");
  });
}

const card = (root: HTMLElement, heading: string) => root.querySelectorAll("h3").find((h) => h.text === heading)!.closest("li, article, .card")!;

describe("the boards draw a ring for every score (E17)", () => {
  it("no board draws a half-arc gauge", () => {
    for (const name of BOARDS) {
      expect(raw(name), name).not.toContain("M10 62 A50 50 0 0 1");
      expect(raw(name), name).not.toContain("M6 32 A26 26 0 0 1");
    }
  });

  it("the unscored gallery card draws no ring, only Not scored", () => {
    const bupa = card(board("PubScans"), "Bupa");
    expect(bupa.querySelectorAll("circle")).toHaveLength(0);
    expect(bupa.text).toContain("Not scored");
    expect(bupa.text).not.toContain("—");
  });

  it("the pending score is the ring's track with a skeleton for its number", () => {
    const rings = board("PubScanning").querySelectorAll("svg").filter((svg) => svg.querySelector("circle") && svg.parentNode?.querySelector(".sk"));
    expect(rings).toHaveLength(1);
    const [ring] = rings;
    expect(ring!.querySelectorAll("circle")).toHaveLength(1);
    expect(ring!.closest(".card")!.text).toContain("Your Visibility Score");
  });

  it("the landing's real report keeps its ring and states the score, with no skeleton", () => {
    for (const name of ["PubLanding", "PubLandingPhone"]) {
      const real = board(name).querySelectorAll("a").find((a) => a.text.includes("A real free report"))!;
      expect(real.querySelectorAll("circle").length, name).toBeGreaterThan(0);
      expect(real.querySelectorAll(".sk"), name).toHaveLength(0);
      expect(real.text, name).toMatch(/Visibility Score\s*62\s*of 100/);
    }
  });
});

describe("rows of squares are bars (E18, E20–E25)", () => {
  it("PubReport's score parts are one bar each, and What holds you back draws no dot row (E19)", () => {
    const root = board("PubReport");
    const parts = root.querySelector('ul[aria-label="The four parts of the score"]')!;
    expect(parts.querySelectorAll(".track")).toHaveLength(4);
    expect(squareRows(parts, 2)).toEqual([]);
    expect(squareRows(root.querySelector("#holds summary")!, 2)).toEqual([]);
  });

  it("the glance's AI row is one bar and its 14-square row is gone (E22)", () => {
    for (const name of GLANCE) {
      const glance = board(name).querySelector('figure[aria-label="Your free report, at a glance"]')!;
      expect(glance.querySelectorAll(".track"), name).toHaveLength(1);
      expect(squareRows(glance, 2), name).toEqual([]);
    }
  });

  it("the AI linked tile on Main and AppAI is one bar, not 12 squares (E20, E23)", () => {
    for (const name of ["Main", "AppAI"]) {
      expect(raw(name), name).not.toContain("width: 22px; height: 22px");
      const tile = board(name).querySelectorAll("p").find((p) => p.text === "Your pages in AI answers" || p.text === "Pages linked by AI")!.parentNode!;
      expect(tile.querySelectorAll(".track"), name).toHaveLength(1);
    }
  });

  it("AppIssues draws one proportional bar, not a waffle (E21)", () => {
    const bar = board("AppIssues").querySelector('div[role="img"]')!;
    expect(bar.childNodes.filter((n) => n.nodeType === 1)).toHaveLength(4);
  });

  it("SettingsIndex' Written from meter is one bar (E24)", () => {
    expect(board("SettingsIndex").querySelector(".meter")!.querySelectorAll("span")).toHaveLength(1);
  });

  it("AppCompetitors draws a bar per row, not a stacked bar (E25)", () => {
    const first = board("AppCompetitors").querySelector('section[aria-labelledby="first"]')!;
    expect(first.querySelector('[role="img"]')).toBeNull();
    const rows = first.querySelectorAll("li");
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row.querySelectorAll(".track"), row.text).toHaveLength(1);
  });
});

describe("How it works states the pages it read as text (E36)", () => {
  it("the research card draws no bar strip, and 38 pages read stays", () => {
    const research = board("PubHowItWorks").querySelector("#research")!;
    const bars = research.querySelectorAll("*").filter((el) => {
      const kids = el.childNodes.filter((n): n is HTMLElement => n.nodeType === 1);
      return kids.filter((k) => (k.getAttribute("style") ?? "").includes("width: 7px; height: 11px")).length >= 3;
    });
    expect(bars).toEqual([]);
    expect(research.text).toContain("38 pages read");
  });
});

describe("a page sketch is an icon band (E16)", () => {
  it("each sketch on the five boards holds FileText, no skeleton bars, primary on the free page or today", () => {
    for (const name of ["Main", "Plan", "Pricing", "PubHowItWorks", "PubReport"]) {
      const sketches = board(name).querySelectorAll(".thumb");
      expect(sketches.length, name).toBeGreaterThan(0);
      for (const sketch of sketches) {
        expect(sketch.querySelectorAll("span"), name).toHaveLength(0);
        expect(sketch.innerHTML, name).toContain(FILE_TEXT);
      }
      const primary = sketches.filter((s) => (s.getAttribute("style") ?? "").includes("color: #5b4be0"));
      expect(primary, name).toHaveLength(1);
      expect(primary[0]!.closest("li")!.getAttribute("style"), name).toContain("solid #5b4be0");
    }
  });

  it("the landing's live page well is the band, not skeleton lines", () => {
    for (const name of ["PubLanding", "PubLandingPhone"]) {
      const live = board(name).querySelectorAll("span").find((s) => s.text === "A real page ReachKit wrote, live now")!.parentNode!;
      expect(live.querySelectorAll(".sk"), name).toHaveLength(0);
      expect(live.querySelector(".well")!.innerHTML, name).toContain(FILE_TEXT);
    }
  });
});

describe("icons are structural only (E26, E27, E29)", () => {
  it("hosted groups draw one BookOpen, step tiles are the number only, and the gas line has no Flame", () => {
    const groups = board("HostedIndex").querySelectorAll(".tile");
    expect(groups).toHaveLength(4);
    for (const tile of groups) expect(tile.innerHTML).toContain(BOOK_OPEN);
    for (const name of ["HostedArticle", "HostedService"]) {
      expect(board(name).querySelectorAll("ol.steps .tile"), name).toHaveLength(0);
      expect(raw(name), name).not.toContain(FLAME);
    }
    expect(board("HostedArticle").querySelectorAll("ul.check .tile")).toHaveLength(2);
  });

  it("no FAQ question and no Legal section heading carries a tile; Legal's four In short tiles stay", () => {
    for (const name of ["PubHowItWorks", "PubLanding", "PubLandingPhone"]) {
      expect(board(name).querySelectorAll("summary .tile"), name).toHaveLength(0);
    }
    const legal = board("Legal");
    expect(legal.querySelectorAll("section[aria-labelledby] > div > .tile")).toHaveLength(0);
    expect(legal.querySelectorAll(".tile")).toHaveLength(4);
  });

  it("Edit this page draws Pencil, Your business draws Building2, the Maps note draws MapPin", () => {
    for (const name of ["AppDraft", "PageDetail"]) {
      const edit = board(name).querySelectorAll("button").find((b) => b.text.trim() === "Edit this page")!;
      expect(edit.innerHTML, name).toContain(PENCIL);
      expect(raw(name), name).not.toContain(PEN_LINE);
    }
    for (const name of ["PubLanding", "PubLandingPhone"]) {
      expect(raw(name), name).not.toContain(STORE);
      expect(raw(name), name).toContain(BUILDING_2);
    }
    for (const name of ["PubLanding", "PubLandingPhone", "PubHowItWorks"]) {
      expect(raw(name), name).not.toContain(MAP);
      const note = board(name).querySelectorAll("*").filter((el) => el.text.includes("Searches with a map show") && el.querySelector("svg")).at(-1)!;
      expect(note.innerHTML, name).toContain(MAP_PIN);
    }
  });

  it("Setup1's Where your buyers are is a MapPin band beside its words, not a map drawing (E30)", () => {
    const figure = board("Setup1").querySelector('figure[aria-label^="Where your buyers are"]')!;
    expect(figure.querySelectorAll("svg")).toHaveLength(1);
    const band = figure.querySelector('.well[aria-hidden="true"]')!;
    expect(band.innerHTML).toContain(MAP_PIN);
    expect(band.text).toBe("");
    expect(figure.text).toContain(copy("setup.place.preview.line"));
  });
});

describe("the edit arm and the stop page draw what ships (E31, #2002 V4)", () => {
  it("AppDraft draws the editor's format toolbar, its buttons named as the editor names them, in its order", () => {
    const bar = board("AppDraft").querySelector('section[aria-label="Editor"] [role="toolbar"]')!;
    const names = bar.querySelectorAll("button").map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(
      (["heading", "bold", "italic", "link", "list", "quote", "table"] as const).map((k) => copy(`draft.editor.format.${k}`)),
    );
  });

  it("Veto's failed chip is warning-edged MessageCircleWarning, and its expired chip is neutral", () => {
    const chips = board("Veto").querySelectorAll(".sq");
    const failed = chips.find((c) => c.innerHTML.includes(MESSAGE_CIRCLE_WARNING))!;
    expect(failed.getAttribute("style")).toContain("border: 1px solid #e7a35c");
    expect(chips.filter((c) => (c.getAttribute("style") ?? "").includes("#fbe9e5"))).toHaveLength(0);
    expect(chips.filter((c) => (c.getAttribute("style") ?? "").includes("background: #fff3e6"))).toHaveLength(0);
  });
});
