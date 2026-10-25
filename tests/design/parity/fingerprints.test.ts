// A baseline row is checked only while its sha256 is its board file's, so a stale row hides that board's count.
import { appendFileSync, copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BOARDS_DIR, boardFile, PARITY_DIR, sha256 } from "../../../scripts/design/parity.mjs";

type Baseline = Record<string, { sha256: string }>;

function stale(baseline: Baseline, dir: string): string[] {
  const out: string[] = [];
  for (const [board, row] of Object.entries(baseline)) {
    const file = boardFile(board, dir);
    if (!existsSync(file)) out.push(`${board}: a row with no board file`);
    else if (sha256(file) !== row.sha256) out.push(`${board}: the board file changed; commit the line CI prints for it`);
  }
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".dc.html"))) {
    const board = f.slice(0, -".dc.html".length);
    if (!(board in baseline)) out.push(`${board}: a board file with no row`);
  }
  return out;
}

describe("docs/design/parity/baseline.json fingerprints", () => {
  it("carries every board file's current sha256, and a row for every board", () => {
    const baseline = JSON.parse(readFileSync(path.join(PARITY_DIR, "baseline.json"), "utf8")) as Baseline;
    expect(stale(baseline, BOARDS_DIR)).toEqual([]);
  });

  it("names a board whose file changed by one byte, a board with no row, and a row with no board", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fingerprints-"));
    copyFileSync(boardFile("Pricing"), boardFile("Pricing", dir));
    const baseline: Baseline = { Pricing: { sha256: sha256(boardFile("Pricing")) } };
    expect(stale(baseline, dir)).toEqual([]);
    appendFileSync(boardFile("Pricing", dir), " ");
    copyFileSync(boardFile("Legal"), boardFile("Legal", dir));
    expect(stale({ ...baseline, Gone: { sha256: "" } }, dir)).toEqual([
      "Pricing: the board file changed; commit the line CI prints for it",
      "Gone: a row with no board file",
      "Legal: a board file with no row",
    ]);
  });
});
