#!/usr/bin/env node
// scripts/pass/assemble.mjs — a pass's export, put back together and checked.
//
//   node scripts/pass/assemble.mjs <dir> <scanId>
//
// `scripts/pass/export.sql` builds one JSON document for a scan. The
// connector returns it to a session, not to a file, so it is fetched in
// chunks of 10,000 characters and each chunk is written down as it came:
//
//   <dir>/manifest.json   {"len": <characters>, "md5": "<of the whole document>"}
//   <dir>/md5s.txt        one line per chunk: "<i> <md5 of that chunk>"
//   <dir>/chunk-<i>.txt   the chunk's `c` column, exactly
//
// A chunk's `"` and `\` arrive as `¤` and `¬`. This turns them back, checks
// every chunk and the whole document against the checksums Postgres
// computed, parses it, and writes `scripts/pass/snapshot/<first 8>.json`.
// A chunk that does not match is named and nothing is written.
//
// One trap: a chunk whose last character is a space loses it where a tool
// trims the end of a file, and then counts 9,999 characters. Append the
// space (`printf ' ' >> chunk-<i>.txt`); the chunk need not be fetched again.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [dir, scanId] = process.argv.slice(2);
if (dir === undefined || scanId === undefined) {
  console.error("Usage: node scripts/pass/assemble.mjs <dir> <scanId>");
  process.exit(2);
}
const md5 = (text) => createHash("md5").update(text, "utf8").digest("hex");
const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
const sums = new Map(
  readFileSync(path.join(dir, "md5s.txt"), "utf8")
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length === 2)
    .map(([i, sum]) => [Number(i), sum])
);
const chunks = Math.ceil(manifest.len / 10_000);
const bad = [];
let whole = "";
for (let i = 0; i < chunks; i += 1) {
  const file = path.join(dir, `chunk-${i}.txt`);
  if (!existsSync(file) || !sums.has(i)) {
    bad.push(`${i}: missing`);
    continue;
  }
  const text = readFileSync(file, "utf8").replace(/\n$/, "").replaceAll("¤", '"').replaceAll("¬", "\\");
  if (md5(text) !== sums.get(i)) bad.push(`${i}: checksum differs (${[...text].length} characters)`);
  whole += text;
}
if (bad.length > 0) {
  console.error(`Chunks to fetch again:\n  ${bad.join("\n  ")}`);
  process.exit(1);
}
if ([...whole].length !== manifest.len || md5(whole) !== manifest.md5) {
  console.error("Every chunk matches its own checksum but the whole document does not: the rows changed between fetches. Fetch the manifest and the chunks again.");
  process.exit(1);
}
const out = path.join(path.dirname(new URL(import.meta.url).pathname), "snapshot", `${scanId.slice(0, 8)}.json`);
writeFileSync(out, `${JSON.stringify(JSON.parse(whole), null, 1)}\n`);
console.log(`${out}: ${manifest.len} characters, checksum ${manifest.md5}`);
