// Every canvas board has exactly one row saying how its ship text is read.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { boardIcons, readIcons } from "../../../scripts/design/components.mjs";
import { BOARDS_DIR, PARITY_DIR } from "../../../scripts/design/parity.mjs";

const rows = JSON.parse(readFileSync(path.join(PARITY_DIR, "boards.json"), "utf8")) as Record<string, { read: string; paths?: string[] }>;
const boards = readdirSync(BOARDS_DIR)
  .filter((f) => f.endsWith(".dc.html"))
  .map((f) => f.slice(0, -".dc.html".length));

describe("docs/design/parity/boards.json", () => {
  it("has a row for every canvas board and none for a board that is gone", () => {
    expect(boards.filter((b) => !(b in rows)), "boards with no row").toEqual([]);
    expect(Object.keys(rows).filter((b) => !boards.includes(b)), "rows with no board").toEqual([]);
  });

  it("reads each board one of four ways, and a page or hosted row names its addresses", () => {
    for (const [board, row] of Object.entries(rows)) {
      expect(["page", "mail", "hosted", "state"], board).toContain(row.read);
      if (row.read === "page" || row.read === "hosted") expect(row.paths?.length, board).toBeGreaterThan(0);
    }
  });
});

describe("docs/design/parity/icons.json", () => {
  const icons = readIcons();
  const drawn = boards.flatMap((b) => boardIcons(readFileSync(path.join(BOARDS_DIR, `${b}.dc.html`), "utf8"), icons).map((i) => ({ board: b, ...i })));

  it("names every icon a board draws", () => {
    const unnamed = drawn.filter((i) => !i.name).map((i) => `${i.board}: "${i.hash}" ${i.shape}`);
    expect([...new Set(unnamed)], "board icons with no entry").toEqual([]);
  });

  it("names a lucide-react icon file for every shape", () => {
    const lucide = (name: string) => existsSync(path.join(__dirname, "../../../node_modules/lucide-react/dist/esm/icons", `${name}.mjs`));
    expect(Object.entries(icons).filter(([, name]) => !lucide(name)), "entries naming no lucide icon").toEqual([]);
  });

  it("has no entry for a shape no board draws", () => {
    const hashes = new Set(drawn.map((i) => i.hash));
    expect(Object.keys(icons).filter((h) => !hashes.has(h)), "unused entries").toEqual([]);
  });
});
