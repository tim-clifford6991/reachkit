// Doctrine 0.11.0 — altitude. Report only; writes nothing.
//
// 0.11.0 adds no field and renames nothing: it adds constitution rules 2.5,
// 2.6, 2.3b and 4.4, §4's routing map, and four checker rules that READ
// (work-order-fanout, corpus-volume, assumption-budget,
// open-assumption-on-done). There is nothing to rewrite. This migration
// exists so the `upgrade` transcript of every corpus that crosses 0.11.0
// carries its own before-numbers: the conformance report that follows this
// log prints the same ratios from the checker's read, and a number the
// checker prints from the next run onward is a number this log carries
// from before it. Same posture as 0.6.0-a-regression-note — a stated
// no-op — with a report instead of silence.
//
// Grammar-independent by construction: it counts whole-file words and
// lines (`wc -w` / `wc -l` parity, the same rule corpus-volume uses) over
// every artifact file the parser would walk — `_`-prefixed files skipped,
// subdirectories (history/) never entered — and reads two front-matter
// facts by line match: `status: approved` on a requirement, and
// `disposition: open` on any rests-on row. Work orders per requirement
// needs the edge graph, which this migration does not build; the
// conformance report below states it (work-order-fanout's coverage line).
//
// Refuses to guess, always — there is nothing here that could: a missing
// directory is logged as absent, a head-block corpus gets its word and
// line counts and a note that the front-matter reads do not apply.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const version = "0.11.0";
export const describe = () => "altitude report — live words, words/approved REQ, lines/WO, open rests-on; writes nothing";

const words = (t) => (t.match(/\S+/g) || []).length;
const lines = (t) => (t.match(/\n/g) || []).length;
const fmt = (n) => n.toLocaleString("en-US");
const q = (sorted, p) => (sorted.length ? sorted[Math.floor((sorted.length - 1) * p)] : 0);

export async function migrate(ctx) {
  const fm = ctx.config.grammar === "front-matter";
  let live = 0, files = 0, approvedReq = 0, openRows = 0;
  const woLines = [];
  const absent = [];

  for (const type of ctx.config.types) {
    if (!type.dir) continue;
    let names;
    try {
      names = readdirSync(join(ctx.docsRoot, type.dir)).sort();
    } catch {
      absent.push(type.dir);
      continue;
    }
    for (const f of names) {
      if (!f.endsWith(".md") || f.startsWith("_")) continue;
      let text;
      try {
        text = readFileSync(join(ctx.docsRoot, type.dir, f), "utf8");
      } catch {
        continue; // a subdirectory, or unreadable — never this report's problem
      }
      files++;
      live += words(text);
      if (type.id === "WO") woLines.push(lines(text));
      if (fm) {
        if (type.id === "REQ" && /^status:\s*approved\s*$/m.test(text)) approvedReq++;
        openRows += (text.match(/^\s+disposition:\s*open\s*$/mg) || []).length;
      }
    }
  }

  const sortedL = woLines.sort((a, b) => a - b);
  ctx.log(`  altitude, before 0.11.0: ${fmt(live)} live words in ${files} artifact file${files === 1 ? "" : "s"}` +
    (absent.length ? ` (absent: ${absent.join(", ")})` : ""));
  ctx.log(`  work orders: ${woLines.length} · lines median ${q(sortedL, 0.5)} / p90 ${q(sortedL, 0.9)} / max ${sortedL.at(-1) ?? 0}`);
  if (fm) {
    ctx.log(`  approved requirements: ${approvedReq} · ` +
      (approvedReq ? `${fmt(Math.round(live / approvedReq))} live words per approved requirement` : "words per approved requirement has no denominator yet"));
    ctx.log(`  open rests-on rows: ${openRows}`);
  } else {
    ctx.log("  head-block grammar — approved-requirement and rests-on reads are front-matter facts; not counted here");
  }
  ctx.log("  work orders per approved requirement: see work-order-fanout's coverage line in the report below");
  ctx.log("  nothing rewritten — 0.11.0 adds rules that read, not a field");
}
