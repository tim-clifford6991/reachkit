// A baseline row is checked only while its sha256 is its board file's, so a stale row hides that board's count.
import { appendFileSync, copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { staleBaselines } from "../../../scripts/design/baseline.mjs";
import { boardFile, readBaseline, sha256, writeBaseline } from "../../../scripts/design/parity.mjs";

describe("per-board baseline fingerprints, read by scripts/hygiene.mjs", () => {
  it("names a board whose file changed by one byte, a board with no row, and a row with no board", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fingerprints-"));
    copyFileSync(boardFile("Pricing"), boardFile("Pricing", dir));
    writeBaseline("Pricing", { ...readBaseline("Pricing")!, sha256: sha256(boardFile("Pricing")) }, dir);
    expect(staleBaselines(dir, dir)).toEqual([]);
    appendFileSync(boardFile("Pricing", dir), " ");
    copyFileSync(boardFile("Legal"), boardFile("Legal", dir));
    writeBaseline("Gone", { sha256: "" }, dir);
    expect(staleBaselines(dir, dir)).toEqual([
      "Gone: a row with no board file",
      `Pricing: the board file changed; commit its sha256 ${sha256(boardFile("Pricing", dir))} to docs/design/parity/Pricing.baseline.json`,
      "Legal: a board file with no docs/design/parity/Legal.baseline.json",
    ]);
  });

  it("reads back the one line it writes", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fingerprints-"));
    writeBaseline("Board", { sha256: "ab", missing: 2, components: 3 }, dir);
    expect(readBaseline("Board", dir)).toEqual({ sha256: "ab", missing: 2, components: 3 });
    expect(readBaseline("Absent", dir)).toBeUndefined();
  });
});
