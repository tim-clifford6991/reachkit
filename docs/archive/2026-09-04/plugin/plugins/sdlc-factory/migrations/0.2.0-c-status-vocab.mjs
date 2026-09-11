// Doctrine 0.2.0 — one mechanical rename, and an audit of everything rule
// 2.2b forbids this migration from touching.
//
// Rule 2.3a fixed the `rests-on` disposition vocabulary to four words —
// `open`, `confirmed`, `refuted`, `undischargeable` — and named `open` the
// default. Front matter written before that fix (or ported straight from the
// old CON/ASM registry-row vocabulary, whose nearest word was `unconfirmed`)
// still says `unconfirmed`. That one word, and only that one word, is a pure
// rename: `unconfirmed` → `open`, same meaning, same position in the same
// enum. This migration makes it and nothing else.
//
// Rule 2.2b: "one status vocabulary per artifact type, and each directory
// keeps its own... these are not harmonised, because renaming N statuses is
// the no-value restructuring rule 2.2a forbids." So every OTHER legacy
// status word this migration finds — a work order still saying
// `in-progress`, `validated` or `merged`; a decision not in
// {proposed, accepted, superseded}; a CON/ASM registry row still carrying
// `struck`, `reserved`, `retired`, `removed` or `resolved` — is reported and
// left exactly as written. Renaming any of those is a human decision, not
// this script's.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
// The front-matter parser arrives as ctx.frontmatter (0.12.1) — one parser,
// the console's, never a copy beside the migrations.

export const version = "0.2.0";
export const describe = () => "rests-on's unconfirmed -> open, and a report of every other status word this doctrine does not harmonise";

const SEMANTIC_BY_PREFIX = { REQ: "requirement", BP: "blueprint", WO: "work-order", ADR: "decision", FB: "feedback" };

// Registry-row status words that predate rule 2.3's retirement of CON/ASM as
// artifacts. Reported wherever a row still carries one; never rewritten.
const LEGACY_ROW_STATUS_RE = /\b(struck|reserved|retired|removed|resolved)\b/gi;

function walk(dir) {
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_")).sort();
  } catch {
    return [];
  }
}

export async function migrate(ctx) {
  const { splitFrontmatter, serializeFrontmatter } = ctx.frontmatter;
  let renamed = 0;
  const vocabViolations = [];

  // ── mechanical rename + per-type vocabulary audit, over every migrated
  // (front-matter) file this project's config declares a directory for ──────
  for (const type of ctx.config.types.filter((t) => t.dir)) {
    const semantic = SEMANTIC_BY_PREFIX[type.id];
    if (!semantic) continue;
    const declaredVocab = ctx.config.statuses[semantic];

    for (const f of walk(join(ctx.docsRoot, type.dir))) {
      const rel = `${type.dir}/${f}`;
      const text = ctx.read(rel);
      let parsed;
      try {
        parsed = splitFrontmatter(text);
      } catch {
        continue; // malformed fence — not this migration's job to fix
      }
      if (parsed.data === null) continue; // not migrated to front-matter yet

      let touched = false;
      const rests = parsed.data["rests-on"];
      if (Array.isArray(rests)) {
        for (const row of rests) {
          if (row && typeof row === "object" && row.disposition === "unconfirmed") {
            row.disposition = "open";
            touched = true;
          }
        }
      }
      if (touched) {
        // Refuse rather than guess (same rule 0.3.0-a follows): a key
        // outside frontmatter.mjs's FIELD_ORDER would otherwise be silently
        // dropped by serializeFrontmatter. Caught per file so one stray key
        // skips only that file's rename — not the whole migration pass, and
        // not the runs after it in the same upgrade.
        let fm;
        try {
          fm = serializeFrontmatter(parsed.data);
        } catch (err) {
          ctx.log(`  ${rel}: refused — ${err.message}`);
          continue;
        }
        ctx.write(rel, fm + parsed.body);
        ctx.log(`  ${rel}: rests-on disposition "unconfirmed" -> "open"`);
        renamed++;
      }

      // Report-only: any status word this type's own declared vocabulary
      // (rule 2.2b) does not name — covers decision statuses outside
      // proposed|accepted|superseded and work-order statuses like
      // in-progress/validated/merged in one general check, rather than a
      // hardcoded word list per type.
      if (declaredVocab && typeof parsed.data.status === "string" && !declaredVocab.includes(parsed.data.status)) {
        vocabViolations.push({ file: rel, type: semantic, status: parsed.data.status, declared: declaredVocab });
      }
    }
  }

  // ── registry-row statuses: report-only, wherever the file still exists
  // (deleted-as-empty by 0.2.0-b never reaches here; archived-with-rows
  // still does, because those rows are exactly what "archived, not deleted"
  // preserved) ───────────────────────────────────────────────────────────
  const rowFindings = [];
  for (const name of ["conflicts.md", "assumptions.md"]) {
    const rel = `registry/${name}`;
    if (!ctx.exists(rel)) continue;
    const text = ctx.read(rel);
    for (const line of text.split("\n")) {
      if (!line.trim().startsWith("|")) continue;
      const words = [...line.matchAll(LEGACY_ROW_STATUS_RE)].map((m) => m[1].toLowerCase());
      if (words.length) rowFindings.push({ file: rel, words });
    }
  }
  const rowCounts = new Map();
  for (const r of rowFindings) for (const w of r.words) rowCounts.set(w, (rowCounts.get(w) || 0) + 1);

  ctx.log(`  ${renamed} rests-on row${renamed === 1 ? "" : "s"} renamed unconfirmed -> open`);
  if (vocabViolations.length) {
    ctx.log(`  ${vocabViolations.length} status word${vocabViolations.length === 1 ? "" : "s"} outside their type's declared vocabulary — refused, reported, unchanged (rule 2.2b):`);
    for (const v of vocabViolations) ctx.log(`    ✗ ${v.file}: ${v.type} status "${v.status}" — declared: [${v.declared.join(", ")}]`);
  }
  if (rowCounts.size) {
    ctx.log(`  legacy registry-row statuses found in archived tables — refused, reported, unchanged (rule 2.2b): ${[...rowCounts].map(([w, c]) => `${w} ×${c}`).join(", ")}`);
  }
}
