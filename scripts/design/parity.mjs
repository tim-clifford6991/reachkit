#!/usr/bin/env node
// Design parity: the visible strings of each canvas board, and which of them
// the shipped page carries. Strings only, never markup or pixels (DESIGN.md › Boards).
//
//   node scripts/design/parity.mjs --board Pricing --url https://reachkit.app/pricing
//   node scripts/design/parity.mjs --board Pricing --file page.html
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const BOARDS_DIR = path.join(ROOT, "docs/design/boards/canvas");
export const PARITY_DIR = path.join(ROOT, "docs/design/parity");

const SKIP = new Set(["style", "script", "svg", "head", "noscript", "template", "title", "helmet"]);
const BLOCK = new Set([
  "div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "a", "summary", "td", "th", "tr", "section",
  "header", "nav", "footer", "br", "button", "label", "main", "article", "aside", "ul", "ol", "dt", "dd",
  "figcaption", "caption", "option", "table", "details", "blockquote", "form", "input", "textarea",
  "select", "hr",
]);
const LABELLED = new Set(["input", "textarea", "button", "a"]);
// A board's own annotations: the "Other states" strip, the designer's notes and the labels over each state.
export const BOARD_ONLY = ["states", "note", "statetag"];

/** The visible strings of a document, one per block. `board` drops the board's annotations. */
export function segments(html, { board = false } = {}) {
  const out = [];
  let buf = "";
  const flush = () => {
    let text = buf.replace(/\s+/g, " ").replace(/ ([,.;:!?])/g, "$1").trim();
    if (board) text = text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
    if (/[\p{L}\p{N}]/u.test(text)) out.push(text);
    buf = "";
  };
  const walk = (node) => {
    if (node.nodeType === 3) {
      buf += node.text;
      return;
    }
    const tag = (node.rawTagName ?? "").toLowerCase();
    if (SKIP.has(tag)) return;
    if (board && BOARD_ONLY.some((c) => node.classList?.contains(c))) return;
    const block = BLOCK.has(tag);
    if (block) flush();
    else buf += " ";
    if (LABELLED.has(tag)) {
      for (const name of ["aria-label", "placeholder"]) {
        const value = node.getAttribute(name);
        if (value) out.push(...segmentsOfText(value, board));
      }
      const type = node.getAttribute("type");
      const value = node.getAttribute("value");
      if (value && (type === "submit" || type === "button")) out.push(...segmentsOfText(value, board));
    }
    for (const child of node.childNodes) walk(child);
    if (block) flush();
    else buf += " ";
  };
  walk(parse(html.replace(/<!doctype[^>]*>/i, ""), { comment: false }));
  flush();
  return out;
}

function segmentsOfText(text, board) {
  const t = (board ? text.replace(/\[[^\]]*\]/g, " ") : text).replace(/\s+/g, " ").trim();
  return /[\p{L}\p{N}]/u.test(t) ? [t] : [];
}

/** Curly quotes, dashes and odd spaces folded; reserved `.example` read as `.com` (Q2). */
export function normalise(text) {
  return text
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u00A0\u2007\u2009\u202F]/g, " ")
    .replace(/[\u00AD\u200B]/g, "")
    .replace(/\u2026/g, "...")
    .replace(/\.example\b/g, ".com")
    .toLowerCase();
}

/** Words, with inner punctuation kept (4:00, 1,200, harborplumbing.com) and outer punctuation dropped. */
export function words(text) {
  return normalise(text).match(/[\p{L}\p{N}€$£%]+(?:['.:,/&+-][\p{L}\p{N}€$£%]+)*/gu) ?? [];
}

const N = 3;
export const COVERAGE = 0.8;

function grams(ws, n) {
  const out = [];
  for (let i = 0; i + n <= ws.length; i++) out.push(ws.slice(i, i + n).join(" "));
  return out;
}

/** The ship side as an index: 1-, 2- and 3-grams per segment, never across one. */
export function shipIndex(texts) {
  const index = new Set();
  for (const text of texts) {
    const ws = words(text);
    for (let n = 1; n <= N; n++) for (const g of grams(ws, n)) index.add(g);
  }
  return index;
}

/** A string of 3+ words matches at 80% of its 3-grams; a shorter one must appear as written. */
export function matches(text, index) {
  const ws = words(text);
  if (ws.length === 0) return true;
  if (ws.length < N) return index.has(ws.join(" "));
  const gs = grams(ws, N);
  return gs.filter((g) => index.has(g)).length / gs.length >= COVERAGE;
}

/** The deduplicated strings a board draws. */
export function boardStrings(html) {
  const seen = new Set();
  const out = [];
  for (const s of segments(html, { board: true })) {
    const key = words(s).join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

// One line per string: `string<TAB>reason`; the reason cites a ruling, a decision file or an issue.
export const CITATION =
  /owner \d{4}-\d{2}-\d{2}|\b(?:DESIGN|SPEC) (?:§\d+|\d{4}-\d{2}-\d{2})|\b[DEGQR]\d{1,2}\b|#\d{3,}|docs\/spec\/decisions\/\S+\.md|\bsample data\b/i;

export function parseAllow(text) {
  return text
    .split("\n")
    .map((line, i) => ({ line, n: i + 1 }))
    // A comment has no tab; a board string that starts with "#" (a Markdown heading) still has its reason.
    .filter(({ line }) => line.trim() !== "" && !(line.startsWith("#") && !line.includes("\t")))
    .map(({ line, n }) => {
      const [string = "", reason = "", ...rest] = line.split("\t");
      return { n, string: string.trim(), reason: reason.trim(), extra: rest.length };
    });
}

export function readAllow(board, dir = PARITY_DIR) {
  const file = path.join(dir, `${board}.allow`);
  return existsSync(file) ? parseAllow(readFileSync(file, "utf8")) : [];
}

/**
 * One board against its ship text: what matched, what an allow line excuses, what is missing,
 * and every allow line that excuses nothing because its string ships or the board does not draw it.
 * @param {string} boardHtml
 * @param {string[]} shipTexts
 * @param {{ string: string, n?: number }[]} [allow]
 * @returns {{ matched: string[], allowed: string[], missing: string[], unused: { string: string, n?: number, ships: boolean }[] }}
 */
export function compare(boardHtml, shipTexts, allow = []) {
  const index = shipIndex(shipTexts);
  const key = (s) => words(s).join(" ");
  const allowed = new Set(allow.map((a) => key(a.string)));
  /** @type {{ matched: string[], allowed: string[], missing: string[], unused: { string: string, n?: number, ships: boolean }[] }} */
  const result = { matched: [], allowed: [], missing: [], unused: [] };
  const drawn = new Set();
  for (const s of boardStrings(boardHtml)) {
    drawn.add(key(s));
    if (matches(s, index)) result.matched.push(s);
    else if (allowed.has(key(s))) result.allowed.push(s);
    else result.missing.push(s);
  }
  const shipped = new Set(result.matched.map(key));
  for (const a of allow) {
    const k = key(a.string);
    if (shipped.has(k) || !drawn.has(k)) result.unused.push({ string: a.string, n: a.n, ships: shipped.has(k) });
  }
  return result;
}

/** Where an unused allow line is, and why it goes. */
export function unusedLine(board, u) {
  return `docs/design/parity/${board}.allow:${u.n ?? "?"} ${u.string} (delete it: ${u.ships ? "the string ships" : "the board does not draw it"})`;
}

export function boardFile(board, dir = BOARDS_DIR) {
  return path.join(dir, `${board}.dc.html`);
}

export function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

export function baselineLine(board, sha, missing) {
  return `"${board}": { "sha256": "${sha}", "missing": ${missing} }`;
}

/**
 * A board's count against `baseline.json`: never up, and every gain committed.
 * A changed board file passes with its new count; the next PR on its route commits it.
 * @param {string} board
 * @param {string[]} missing
 * @param {{ sha256: string, missing: number } | undefined} entry
 * @param {string} sha
 * @param {{ string: string, n?: number, ships: boolean }[]} [unused]
 * @returns {{ ok: boolean, message: string }}
 */
export function verdict(board, missing, entry, sha, unused = []) {
  if (unused.length > 0) {
    return { ok: false, message: `${board}: an allow line excuses nothing.\n${unused.map((u) => `  - ${unusedLine(board, u)}`).join("\n")}` };
  }
  const line = baselineLine(board, sha, missing.length);
  const list = missing.map((s) => `  - ${s}`).join("\n");
  if (!entry) return { ok: false, message: `${board} has no row in docs/design/parity/baseline.json. Commit:\n${line}` };
  if (entry.sha256 !== sha) {
    return { ok: true, message: `${board}: the board file changed; ${missing.length} missing now. The next pull request on its route commits:\n${line}` };
  }
  if (missing.length > entry.missing) {
    return { ok: false, message: `${board}: ${missing.length} board strings missing, baseline ${entry.missing}. Missing:\n${list}` };
  }
  if (missing.length < entry.missing) {
    return { ok: false, message: `${board}: ${missing.length} missing, below its baseline of ${entry.missing}. Lock the gain in docs/design/parity/baseline.json:\n${line}` };
  }
  return { ok: true, message: `${board}: ${missing.length} missing, as its baseline.` };
}

/** The table a job summary and the CLI print for one board. */
export function table(board, result, baseline) {
  const lines = [
    `#### ${board}`,
    "",
    "| matched | missing | allowed | baseline |",
    "|---|---|---|---|",
    `| ${result.matched.length} | ${result.missing.length} | ${result.allowed.length} | ${baseline ?? "—"} |`,
    "",
  ];
  for (const s of result.missing) lines.push(`- missing: ${s}`);
  if (result.missing.length > 0) lines.push("");
  for (const u of result.unused) lines.push(`- unused allow line: ${unusedLine(board, u)}`);
  if (result.unused.length > 0) lines.push("");
  return lines.join("\n");
}

async function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? undefined : argv[i + 1];
  };
  const board = arg("--board");
  const url = arg("--url");
  const file = arg("--file");
  if (!board || (!url && !file) || (url && !/^https?:\/\//.test(url))) {
    console.error("usage: node scripts/design/parity.mjs --board <Board> (--url https://… | --file page.html) [--boards dir] [--allow dir]");
    return 2;
  }
  const boardsDir = arg("--boards") ?? BOARDS_DIR;
  const boardPath = boardFile(board, boardsDir);
  if (!existsSync(boardPath)) {
    console.error(`no board ${board} in ${boardsDir}`);
    return 2;
  }
  let html;
  if (url) {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    html = await res.text();
  } else {
    html = readFileSync(file, "utf8");
  }
  const result = compare(readFileSync(boardPath, "utf8"), segments(html), readAllow(board, arg("--allow") ?? PARITY_DIR));
  const baselineFile = path.join(PARITY_DIR, "baseline.json");
  const baseline = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, "utf8"))[board]?.missing : undefined;
  console.log(table(board, result, baseline));
  for (const u of result.unused) console.warn(`warning: unused allow line ${unusedLine(board, u)}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
