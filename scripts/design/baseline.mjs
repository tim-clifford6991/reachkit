// Each board's parity row in its own file, so two pull requests on different boards never edit one file.
// Node built-ins only: `audit` runs scripts/hygiene.mjs with no node_modules.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const BOARDS_DIR = path.join(ROOT, "docs/design/boards/canvas");
export const PARITY_DIR = path.join(ROOT, "docs/design/parity");
const SUFFIX = ".baseline.json";

export function boardFile(board, dir = BOARDS_DIR) {
  return path.join(dir, `${board}.dc.html`);
}

export function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** The repo-relative path of a board's row, as a message names it. */
export const baselineRel = (board) => `docs/design/parity/${board}${SUFFIX}`;

/** A row's one line, as its file holds it. */
export function baselineLine({ sha256: sha, missing, components }) {
  const counts = Object.entries({ missing, components }).filter(([, v]) => v !== undefined);
  return `{ "sha256": "${sha}"${counts.map(([k, v]) => `, "${k}": ${v}`).join("")} }`;
}

/** @returns {{ sha256: string, missing?: number, components?: number } | undefined} */
export function readBaseline(board, dir = PARITY_DIR) {
  const file = path.join(dir, `${board}${SUFFIX}`);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined;
}

export function writeBaseline(board, row, dir = PARITY_DIR) {
  writeFileSync(path.join(dir, `${board}${SUFFIX}`), `${baselineLine(row)}\n`);
}

/** A row is checked only while its sha256 is its board file's, so a stale row hides that board's count. */
export function staleBaselines(boardsDir = BOARDS_DIR, parityDir = PARITY_DIR) {
  const names = (dir, ext) => readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)).sort();
  const boards = new Set(names(boardsDir, ".dc.html"));
  const out = [];
  for (const board of names(parityDir, SUFFIX)) {
    if (!boards.has(board)) out.push(`${board}: a row with no board file`);
    else {
      const sha = sha256(boardFile(board, boardsDir));
      if (sha !== readBaseline(board, parityDir).sha256) out.push(`${board}: the board file changed; commit its sha256 ${sha} to ${baselineRel(board)}`);
    }
    boards.delete(board);
  }
  for (const board of boards) out.push(`${board}: a board file with no ${baselineRel(board)}`);
  return out;
}
