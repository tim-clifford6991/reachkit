#!/usr/bin/env node
// Applies a drafted rewrite to the copy registry, its boards, their baseline rows and exact test pins.
// Anything it cannot prove safe goes to the printed manual list and is left alone.
//
//     node scripts/copy/apply.mjs --lane L2 [--dry] rewrite-*.json
//
// Input: the §2.1 object ({ keys, boards, jsx, cuts }) or a bare array of key rows ({ key, current, proposed, board }).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { entries, isExempt } from "../lib/plain-words.mjs";
import { normalise, segments } from "../design/parity.mjs";

const KEYS = "src/lib/presentation/copy/keys";
const BOARDS = "docs/design/boards/canvas";
const BASELINE = "docs/design/parity/baseline.json";
// One lane owns a key file at a time; L3 takes every other customer partition.
const LANE_FILES = { L1: ["chrome", "meta"], L2: ["report", "offer", "bands"] };
const laneOf = (file) => Object.keys(LANE_FILES).find((l) => LANE_FILES[l].includes(file)) ?? "L3";

// A proposal that means "remove this key" also needs its call sites removed, so it is never written as text.
const DELETES = /^\s*(?:\((?:delete|cut|remove|drop)\)|delete)?\s*$/i;
const slotsOf = (text) => [...text.matchAll(/\{([\w$.-]+)\}/g)].map((m) => m[1]);
const sameSet = (a, b) => [...new Set(a)].sort().join() === [...new Set(b)].sort().join();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Board text folds curly quotes, dashes and spaces the way parity.mjs reads it.
const fold = (s) => escape(s).replace(/['‘’]/g, "['‘’]").replace(/["“”]/g, '["“”]').replace(/[-‐-―]/g, "[-‐-―]").replace(/\s+/g, "\\s+");

/** `current` as a pattern over one text node: each `{slot}` captures the board's sample value. */
function boardPattern(current) {
  const parts = current.split(/\{[\w$.-]+\}/);
  const body = parts.map(fold).join("(.+?)");
  // A text under three words must be the whole node, or "Reach" would hit "ReachKit".
  return current.trim().split(/\s+/).length < 3 ? new RegExp(`^(\\s*)${body}(\\s*)$`, "u") : new RegExp(`(?<![\\p{L}\\p{N}])()${body}()(?![\\p{L}\\p{N}])`, "u");
}

/** Rewrites one board's text nodes from `from` to `to`, carrying each slot's sample value over. */
function rewriteBoard(html, from, to) {
  const re = boardPattern(from);
  const names = slotsOf(from);
  let hits = 0;
  const out = html.replace(/>([^<]+)</g, (whole, text) => {
    const m = text.match(re);
    if (!m) return whole;
    hits++;
    const [lead, ...rest] = m.slice(1);
    const values = Object.fromEntries(names.map((n, i) => [n, rest[i]]));
    const next = lead + to.replace(/\{([\w$.-]+)\}/g, (s, n) => values[n] ?? s) + rest[rest.length - 1];
    return `>${text.slice(0, m.index)}${next}${text.slice(m.index + m[0].length)}<`;
  });
  const spans = !hits && segments(html, { board: true }).some((s) => boardPattern(normalise(from)).test(normalise(s)));
  return { html: out, hits, spans };
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [path.join(dir, d.name)] : []));
}

/**
 * @param {{ root: string, lane: string, inputs: { name: string, json: unknown }[], write?: boolean }} options
 */
export function apply({ root, lane, inputs, write = true }) {
  const at = (rel) => path.join(root, rel);
  const files = new Map(readdirSync(at(KEYS)).filter((f) => f.endsWith(".ts")).map((f) => [f, readFileSync(at(`${KEYS}/${f}`), "utf8")]));
  const where = new Map();
  for (const [file, source] of files) for (const e of entries(source)) where.set(e.key, [...(where.get(e.key) ?? []), { file, ...e }]);

  const manual = [];
  const rows = inputs.flatMap(({ name, json }) => {
    const doc = Array.isArray(json) ? { keys: json } : /** @type {any} */ (json);
    for (const c of doc.cuts ?? []) manual.push({ what: c.key, why: "cut: a hand edit" });
    for (const j of doc.jsx ?? []) manual.push({ what: j.file, why: "jsx: a hand edit" });
    return [...(doc.keys ?? []).map((r) => ({ ...r, source: name })), ...(doc.boards ?? []).map((b) => ({ ...b, amend: true, source: name }))];
  });
  const proposals = new Map();
  for (const r of rows.filter((r) => !r.amend && typeof r.proposed === "string")) proposals.set(r.key, new Set([...(proposals.get(r.key) ?? []), r.proposed]));

  const applied = [];
  const edits = new Map();
  for (const r of rows.filter((r) => !r.amend)) {
    if (applied.some((a) => a.key === r.key)) continue;
    const hits = where.get(r.key) ?? [];
    const e = hits[0];
    const after = e ? files.get(e.file).slice(e.end, files.get(e.file).indexOf("]", e.end)) : "";
    const meta = [after.match(/slots:\s*\{([^}]*)\}/)?.[1], after.match(/fixedBy:\s*"([^"]*)"/)?.[1] ?? ""];
    const why =
      typeof r.proposed !== "string" ? "no proposed text"
      : DELETES.test(r.proposed) ? "delete: a hand edit (key and its call sites)"
      : r.needsRuling && !/^no\b/i.test(String(r.needsRuling)) ? "needs a ruling"
      : hits.length !== 1 ? `in ${hits.length} partitions`
      : laneOf(e.file.replace(/\.ts$/, "")) !== lane ? `${e.file} is not lane ${lane}`
      : isExempt(r.key, e.file) ? "exempt or locked"
      : e.value !== r.current ? "stale: current no longer matches"
      : meta[0] === undefined || !sameSet(slotsOf(r.proposed), slotsOf(r.current)) || !sameSet(slotsOf(r.current), [...meta[0].matchAll(/["']?([\w$.-]+)["']?\s*:/g)].map((m) => m[1])) ? "slots differ"
      : proposals.get(r.key).size > 1 ? "conflict: another proposal differs"
      : "";
    if (why) manual.push({ what: r.key, why, source: r.source });
    else {
      applied.push({ ...r, file: e.file, ownerRuled: /\bowner\b/i.test(meta[1]) });
      edits.set(e.file, [...(edits.get(e.file) ?? []), { ...e, proposed: r.proposed }]);
    }
  }

  const written = new Map();
  for (const [file, list] of edits) {
    let source = files.get(file);
    for (const e of list.sort((a, b) => b.start - a.start)) source = source.slice(0, e.start) + JSON.stringify(e.proposed).slice(1, -1) + source.slice(e.end);
    files.set(file, source);
    written.set(`${KEYS}/${file}`, source);
  }

  // Boards: each applied key on the boards its row lists, then the explicit amendments.
  const boardEdits = [...applied.map((r) => ({ ...r, from: r.current, to: r.proposed })), ...rows.filter((r) => r.amend)];
  for (const b of boardEdits) {
    for (const board of String(b.board ?? "").split(/[·,]/).map((s) => s.trim().split(/\s/)[0])) {
      const rel = `${BOARDS}/${board}.dc.html`;
      if (!board || !existsSync(at(rel))) continue;
      const { html, hits, spans } = rewriteBoard(written.get(rel) ?? readFileSync(at(rel), "utf8"), b.from, b.to);
      if (hits) written.set(rel, html);
      else if (spans || b.amend) manual.push({ what: `${board}: ${b.from}`, why: spans ? "board text spans inline tags" : "board text not found" });
    }
  }

  // Each edited board's baseline row: a new sha; missing and components stay as committed.
  let baseline = readFileSync(at(BASELINE), "utf8");
  for (const [rel, html] of written) {
    const board = rel.startsWith(BOARDS) && path.basename(rel, ".dc.html");
    if (!board) continue;
    const sha = createHash("sha256").update(html).digest("hex");
    baseline = baseline.replace(new RegExp(`("${board}": \\{ "sha256": ")[0-9a-f]+`), `$1${sha}`);
  }
  if (baseline !== readFileSync(at(BASELINE), "utf8")) written.set(BASELINE, baseline);

  // A test pin that is exactly the old text in one literal is swapped; any longer fragment left is listed.
  // Under four words a literal ("failed") is as likely another test's own value, so it is never swapped.
  for (const file of walk(at("tests"))) {
    const rel = path.relative(root, file);
    let text = readFileSync(file, "utf8");
    const before = text;
    for (const r of applied) {
      if (r.current.trim().split(/\s+/).length >= 4) for (const q of ['"', "'", "`"]) text = text.split(quote(r.current, q)).join(quote(r.proposed, q));
      const fragment = r.current.split(/\{[\w$.-]+\}/).sort((a, b) => b.length - a.length)[0].trim();
      if (fragment.split(/\s+/).length >= 4 && text.includes(fragment)) manual.push({ what: `${rel}: ${r.key}`, why: "test pins part of the old text" });
    }
    if (text !== before) written.set(rel, text);
  }

  if (write) for (const [rel, text] of written) writeFileSync(at(rel), text);
  return { applied, manual, written: [...written.keys()].sort() };
}

function quote(text, q) {
  return q === '"' ? JSON.stringify(text) : `${q}${text.replace(/\\/g, "\\\\").replaceAll(q, `\\${q}`)}${q}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const lane = args[args.indexOf("--lane") + 1];
  const paths = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--lane");
  if (!LANE_FILES[lane] && lane !== "L3") throw new Error("usage: apply.mjs --lane L1|L2|L3 [--dry] <json…>");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const inputs = paths.map((p) => ({ name: path.basename(p), json: JSON.parse(readFileSync(p, "utf8")) }));
  const { applied, manual, written } = apply({ root, lane, inputs, write: !args.includes("--dry") });
  const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  console.log(`| Key | Before | After | Source |\n|---|---|---|---|`);
  for (const r of applied) console.log(`| \`${r.key}\`${r.ownerRuled ? " (owner-ruled)" : ""} | ${cell(r.current)} | ${cell(r.proposed)} | ${r.source} |`);
  console.log(`\nmanual (${manual.length}):`);
  for (const m of manual) console.log(`- ${m.what}: ${m.why}`);
  console.log(`\nwritten: ${written.join(", ") || "none"}`);
  console.log(`applied ${applied.length}, manual ${manual.length}`);
}
