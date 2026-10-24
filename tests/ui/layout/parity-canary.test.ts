// The parity reading, broken on purpose. A green run in which this canary
// passes is a failed run: a ruler that reports nothing passes every board.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
