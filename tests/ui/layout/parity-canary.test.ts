// The parity reading, broken on purpose. A green run in which this canary
// passes is a failed run: a ruler that reports nothing passes every board.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareComponents } from "../../../scripts/design/components.mjs";
import { boardStrings, compare, segments, sha256, verdict } from "../../../scripts/design/parity.mjs";

const BOARD = path.resolve(__dirname, "../../design/parity/fixtures/Board.dc.html");
const html = readFileSync(BOARD, "utf8");
const sha = sha256(BOARD);
const strings = boardStrings(html);
const page = (texts: string[]) => `<main>${texts.map((t) => `<p>${t}</p>`).join("")}</main>`;

describe("parity canary: a page that drops one board string fails the reading", () => {
  it("a page that carries every board string holds a baseline of 0", () => {
    const { missing } = compare(html, segments(page(strings)));
    expect(verdict("Board", missing, { sha256: sha, missing: 0 }, sha).ok).toBe(true);
  });

  it("the same page without one string fails, naming it", () => {
    const dropped = strings.find((s) => s.startsWith("€49 a month"))!;
    const { missing } = compare(html, segments(page(strings.filter((s) => s !== dropped))));
    const result = verdict("Board", missing, { sha256: sha, missing: 0 }, sha);
    expect(result.ok).toBe(false);
    expect(result.message).toContain(dropped);
  });
});

// The canvas's older FileText shape, as icons.json names it.
const FILE_TEXT =
  '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path></svg>';
const RING = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none"></circle></svg>';
const lucide = (name: string) => `<svg class="lucide lucide-${name}" viewBox="0 0 24 24"><path d="M0 0"></path></svg>`;
const componentBoard = `<main><p>Board</p>${FILE_TEXT.repeat(3)}${RING}<div class="track"></div></main>`;
const componentPage = `<main><p>Board</p>${lucide("file-text").repeat(2)}<progress class="progress"></progress></main>`;

describe("parity canary: a page that drops a board component fails the reading", () => {
  it("names one missing FileText and the missing ring, and leaves the strings' count alone", () => {
    const parts = compareComponents(componentBoard, [componentPage]);
    expect(parts.missing).toEqual(["icon:file-text", "ring"]);
    expect(parts.matched).toEqual(["progress"]);
    const result = verdict("Board", parts.missing, { sha256: sha, missing: 0, components: 0 }, sha, parts.unused, "components");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("2 board components missing");
    expect(compare(componentBoard, segments(componentPage)).missing).toEqual([]);
  });

  it("a page that draws every board component holds a components baseline of 0", () => {
    const parts = compareComponents(componentBoard, [`${componentPage}${lucide("file-text")}<div class="radial-progress"></div>`]);
    expect(verdict("Board", parts.missing, { sha256: sha, missing: 0, components: 0 }, sha, parts.unused, "components").ok).toBe(true);
  });
});
