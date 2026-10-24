// Design parity for a `state` board: the board against the arms its component test
// renders, with the same compare, verdict and baseline as a page row.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect } from "vitest";
import {
  BOARDS_DIR,
  boardFile,
  compare,
  PARITY_DIR,
  readAllow,
  segments,
  sha256,
  table,
  verdict,
} from "../../../scripts/design/parity.mjs";

export const STATE_SUMMARY_HEAD = "### Design parity (state boards)";

/** The board's screen: its `<main>`. The header and footer around it are the group layout's, which the page rows read. */
function screenOf(board: string, html: string): string {
  const from = html.indexOf("<main");
  const to = html.indexOf("</main>");
  if (from === -1 || to === -1) throw new Error(`board ${board} draws no <main>`);
  return html.slice(from, to + "</main>".length);
}

/** The board's verdict on every arm's text joined, and its summary table. */
export function stateParity(
  board: string,
  htmls: string[],
  dirs: { boards?: string; parity?: string } = {},
): { ok: boolean; message: string; table: string; missing: string[] } {
  const parityDir = dirs.parity ?? PARITY_DIR;
  const file = boardFile(board, dirs.boards ?? BOARDS_DIR);
  const baseline = JSON.parse(readFileSync(path.join(parityDir, "baseline.json"), "utf8")) as Record<
    string,
    { sha256: string; missing: number }
  >;
  const result = compare(screenOf(board, readFileSync(file, "utf8")), htmls.flatMap((html) => segments(html)), readAllow(board, parityDir));
  const { ok, message } = verdict(board, result.missing, baseline[board], sha256(file), result.unused);
  return { ok, message, table: table(board, result, baseline[board]?.missing), missing: result.missing };
}

/** Why a `state` row of boards.json would go unread: no render test, or one that never checks this board. */
export function renderProblem(board: string, row: { render?: string }): string | null {
  if (!row.render) return `${board} is a state row with no "render" test file`;
  const file = path.resolve(PARITY_DIR, "../../..", row.render);
  if (!existsSync(file)) return `${board}: ${row.render} does not exist`;
  if (!readFileSync(file, "utf8").includes(`expectStateParity("${board}"`)) return `${board}: ${row.render} never calls expectStateParity("${board}", …)`;
  return null;
}

/** Fails exactly as a `page` row of tests/ui/layout/parity.test.ts fails, and adds the board to the job summary. */
export function expectStateParity(board: string, htmls: string[], dirs: { boards?: string; parity?: string } = {}): void {
  const read = stateParity(board, htmls, dirs);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const head = existsSync(summary) && readFileSync(summary, "utf8").includes(STATE_SUMMARY_HEAD) ? "" : `${STATE_SUMMARY_HEAD}\n\n`;
    appendFileSync(summary, `${head}${read.table}\n`);
  }
  expect(read.ok, read.message).toBe(true);
}
