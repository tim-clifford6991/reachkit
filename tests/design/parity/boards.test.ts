// Every canvas board has exactly one row saying how its ship text is read.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
