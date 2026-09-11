// Doctrine 0.2.0 — front-matter is derived and prepended to every legacy
// head-block artifact.
//
// A generalised port of ReachKit v2's scripts/migrate-frontmatter.mjs: same
// algorithm (read the head block above the first `## ` heading as labelled
// bullets, infer id/type/title/status/upstream-edge/depends-on/supersedes,
// prepend a `---`-fenced block, never touch a body byte), but walked over
// `ctx.config.types` instead of a hardcoded five-directory list, so a project
// whose config renames or adds a type dir is still covered.
//
// CRITICAL FIX over the reference (ReachKit v2 WO-114, still unfixed there,
// ADR-075): the reference's computeDependsOn() folded the ADR-prefixed ids
// out of a decision's `- Related:` bullet into `depends-on`, minting 28 false
// dependency cycles across that corpus. `- Related:` is a peer citation, not
// a dependency (ADR-075) — this port never folds it into depends-on, for any
// type, decision included. A decision's own upstream edge (`decides-for`)
// still reads its non-ADR ids out of the same bullet; that is a different
// field with different semantics and is unaffected by the fix.
//
// Refuses to guess, always, and logs rather than acting:
//   - rests-on          — never inferred; always written as []
//   - blocked-by        — never inferred, even when the Status bullet's own
//                          prose contains the word "blocked" — logged as a
//                          note so a human can read the clause, never turned
//                          into an edge
//   - satisfies-vs-covers — a legacy `- Satisfies:` bullet is written to the
//                          `satisfies` field (preserving what the corpus
//                          already asserted) but flagged with a per-file
//                          adjudication note, because rule 5.4's satisfies-
//                          vs-covers distinction did not exist when these
//                          bullets were written and this script cannot tell
//                          derivation-order from transcription-order apart
//   - ellipsis ranges    — `key: A … Z` is left on the bullet and reported,
//                          never expanded (would fabricate edges)
//   - unrecognised status word — the whole file is left un-migrated and
//                          reported, rather than writing a status the new
//                          per-type vocabulary (rule 2.2b) does not name
//
// Idempotent: a file already opening with `---` is skipped. `_`-prefixed
// files (templates, indexes) are skipped, never migrated.

import { readdirSync } from "node:fs";
import { join } from "node:path";
// The front-matter parser arrives as ctx.frontmatter (0.12.1) — one parser,
// the console's, never a copy beside the migrations.

export const version = "0.2.0";
export const describe = () => "front-matter is derived and prepended to every legacy head-block artifact";

// The semantic type name a front-matter node's own `type:` field carries,
// keyed by the config's uppercase prefix — matches console/src/extract/
// index.mjs's SEMANTIC_BY_PREFIX. A prefix this migration cannot name (a
// project-specific type this schema doesn't know the shape of) is skipped
// with a log line rather than guessed.
const SEMANTIC_BY_PREFIX = { REQ: "requirement", BP: "blueprint", WO: "work-order", ADR: "decision", FB: "feedback" };

// The upstream-edge field each semantic type carries, and the head-block
// bullet label it is read from. `requirement` carries neither — it is the
// root of the graph. `decision`'s bullet is `Related:` (verified against
// this repo's own pre-migration ADR files) with ADR-prefixed ids excluded —
// those are peer citations, never this decision's own upstream edge.
const UPSTREAM_FIELD_BY_TYPE = { requirement: null, blueprint: "satisfies", decision: "decides-for", "work-order": "implements", feedback: "about" };
const UPSTREAM_LABEL_BY_TYPE = { requirement: null, blueprint: "satisfies", decision: "related", "work-order": "implements", feedback: "linked" };

const SEVERITY_VOCAB = ["blocker", "major", "minor"];

const ID_TOKEN_RE = /\b([A-Z]+-[0-9]+[a-z]?)\b/g;

function walk(dir) {
  return readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_")).sort();
}

/** The finite set of header-bullet labels this migration recognises, derived
 *  from the project's own relations/metaFields/knownKeys config plus the
 *  handful of labels every corpus in this doctrine writes but no config key
 *  names (`status`, `severity`, `supersedes`). A label-shaped line whose
 *  label is NOT in this set still closes whatever bullet was open — it can
 *  never absorb the tail of a real field — and is reported separately rather
 *  than silently merged (ReachKit v2 WO-001b/WO-107/WO-113's defect). */
function knownBulletLabels(cfg) {
  return new Set([
    "status", "severity", "supersedes",
    ...Object.keys(cfg.relations).map((k) => k.toLowerCase()),
    ...cfg.metaFields.map((k) => k.toLowerCase()),
    ...cfg.knownKeys.map((k) => k.toLowerCase()),
    // The upstream-edge bullet labels themselves (e.g. feedback's "linked")
    // are this schema's own vocabulary, not every project's — a config that
    // never declares "Linked" as a generic relation must still recognise it
    // as the bullet that feeds `about`, or every feedback file's upstream
    // edge is silently lost to the unrecognised-label bucket.
    ...Object.values(UPSTREAM_LABEL_BY_TYPE).filter(Boolean),
  ]);
}

function extractHeaderBullets(bodyLines, known) {
  const bullets = [];
  const unrecognized = [];
  let current = null;
  let currentIsKnown = false;

  function closeCurrent() {
    if (!current) return;
    (currentIsKnown ? bullets : unrecognized).push(current);
    current = null;
  }

  for (const line of bodyLines) {
    if (/^## /.test(line)) break;
    const bm = /^- (?:\*\*)?([A-Za-z][A-Za-z ]{1,30}?):(?:\*\*)?\s*(.*)$/.exec(line);
    if (bm) {
      const rawLabel = bm[1].trim();
      const isKnown = known.has(rawLabel.toLowerCase());
      closeCurrent();
      current = { label: isKnown ? rawLabel.toLowerCase() : rawLabel, text: bm[2] };
      currentIsKnown = isKnown;
    } else if (current) {
      current.text += "\n" + line;
    }
  }
  closeCurrent();
  return { bullets, unrecognized };
}

function findBullet(bullets, label) {
  return bullets.find((b) => b.label === label);
}

function firstLineClean(text) {
  return text.split("\n")[0].replace(/\*\*/g, "").replace(/`/g, "").trim();
}

function matchVocab(cleaned, vocab) {
  const lower = cleaned.toLowerCase();
  const sorted = [...vocab].sort((a, b) => b.length - a.length);
  for (const word of sorted) {
    if (lower.startsWith(word)) {
      const next = lower[word.length];
      if (next === undefined || /[\s.,;—(\-]/.test(next)) return word;
    }
  }
  return null;
}

const RANGE_RE = /(…|\.\.\.)/;

function idsIn(text, excludeSelf) {
  const found = [];
  const seen = new Set();
  let m;
  ID_TOKEN_RE.lastIndex = 0;
  while ((m = ID_TOKEN_RE.exec(text))) {
    const id = m[1];
    if (id === excludeSelf || seen.has(id)) continue;
    seen.add(id);
    found.push(id);
  }
  return found;
}

/** depends-on, and only depends-on: the `- Depends on:` bullet, minus a
 *  leading "nothing" ("Depends on: nothing." → no edge — the idiom
 *  `supersedes` already uses, extended here). No other bullet ever
 *  contributes to this field — see this file's header on WO-114/ADR-075. */
function computeDependsOn(bullets, id) {
  const b = findBullet(bullets, "depends on");
  if (!b) return [];
  if (firstLineClean(b.text).toLowerCase().startsWith("nothing")) return [];
  return idsIn(b.text, id);
}

export async function migrate(ctx) {
  const { serializeFrontmatter } = ctx.frontmatter;
  const known = knownBulletLabels(ctx.config);
  const fileTypes = ctx.config.types.filter((t) => t.dir);

  let migrated = 0, skipped = 0;
  const edgeNotes = [];
  const adjudicationNotes = [];
  const unrecognizedLabels = [];

  for (const type of fileTypes) {
    const semantic = SEMANTIC_BY_PREFIX[type.id];
    if (!semantic) {
      ctx.log(`  ${type.dir}/: prefix "${type.id}" has no known front-matter shape — skipped entirely`);
      continue;
    }

    let files;
    try {
      files = walk(join(ctx.docsRoot, type.dir));
    } catch {
      continue;
    }

    const statusVocab = ctx.config.statuses[semantic] || [];

    for (const f of files) {
      const rel = `${type.dir}/${f}`;
      const text = ctx.read(rel);
      if (text.startsWith("---\n")) continue; // already migrated

      const idMatch = new RegExp(`^(${type.id}-[0-9]+[a-z]?)-`).exec(f);
      if (!idMatch) {
        ctx.log(`  ${rel}: filename does not start with "${type.id}-NNN-" — left unchanged`);
        skipped++;
        continue;
      }
      const id = idMatch[1];

      const lines = text.split("\n");
      const h1Idx = lines.findIndex((l) => /^# /.test(l));
      if (h1Idx === -1) {
        ctx.log(`  ${rel}: no H1 ("# ...") line — left unchanged`);
        skipped++;
        continue;
      }
      const h1Match = /^#\s+\S+\s+[—-]\s+(.+?)\s*$/.exec(lines[h1Idx]);
      if (!h1Match) {
        ctx.log(`  ${rel}: H1 did not match "# ID — Title" — left unchanged`);
        skipped++;
        continue;
      }
      const title = h1Match[1];

      const { bullets, unrecognized } = extractHeaderBullets(lines.slice(h1Idx + 1), known);
      for (const u of unrecognized) {
        unrecognizedLabels.push({ file: rel, label: u.label, text: firstLineClean(u.text).slice(0, 100) });
      }

      const statusBullet = findBullet(bullets, "status");
      let status = null, severity = null;

      if (semantic === "feedback") {
        const sevBullet = findBullet(bullets, "severity");
        if (sevBullet) severity = matchVocab(firstLineClean(sevBullet.text), SEVERITY_VOCAB);
        if (statusBullet) status = matchVocab(firstLineClean(statusBullet.text), statusVocab);
        if (!status && !severity) {
          ctx.log(`  ${rel}: neither Severity nor Status bullet yielded a value this vocabulary names — left unchanged`);
          skipped++;
          continue;
        }
        if (!status) status = statusVocab[0] || "open";
      } else {
        if (!statusBullet) {
          ctx.log(`  ${rel}: no "- Status:" bullet — left unchanged`);
          skipped++;
          continue;
        }
        status = matchVocab(firstLineClean(statusBullet.text), statusVocab);
        if (!status) {
          ctx.log(`  ${rel}: Status bullet "${firstLineClean(statusBullet.text).slice(0, 50)}" does not match ${semantic}'s vocabulary [${statusVocab.join(", ")}] — left unchanged (see 0.2.0-c for renames this migration refuses to guess)`);
          skipped++;
          continue;
        }
      }

      // ── upstream edge ──────────────────────────────────────────────────
      const upstreamField = UPSTREAM_FIELD_BY_TYPE[semantic];
      // Also the ONLY bullet a decision's peer ADR citations are ever read
      // from, and only for the upstream edge above — see this file's header
      // (WO-114/ADR-075): "- Related:" never contributes to depends-on, here
      // or anywhere else in this migration.
      const upstreamLabel = UPSTREAM_LABEL_BY_TYPE[semantic];
      let upstreamIds = [];
      if (upstreamField) {
        const b = findBullet(bullets, upstreamLabel);
        if (b) {
          if (RANGE_RE.test(b.text)) {
            edgeNotes.push({ file: rel, note: `"- ${upstreamLabel}:" uses an ellipsis range — never expanded, ${upstreamField} left []` });
          } else {
            upstreamIds = semantic === "decision" ? idsIn(b.text, id).filter((x) => !x.startsWith("ADR-")) : idsIn(b.text, id);
            if (semantic === "blueprint" && upstreamIds.length) {
              adjudicationNotes.push({ file: rel, note: `satisfies: [${upstreamIds.join(", ")}] carried forward from the legacy "- Satisfies:" bullet as-is — satisfies-vs-covers (rule 5.4) was not adjudicated by this migration; an architect should confirm this BP was cut FROM its REQ(s) rather than transcribed from existing code (ADR-072)` });
            }
          }
        } else {
          edgeNotes.push({ file: rel, note: `no "- ${upstreamLabel[0].toUpperCase()}${upstreamLabel.slice(1)}:" bullet — ${upstreamField} left []` });
        }
      }

      // ── depends-on ────────────────────────────────────────────────────
      const dependsBullet = findBullet(bullets, "depends on");
      let dependsOn = [];
      if (dependsBullet && RANGE_RE.test(dependsBullet.text)) {
        edgeNotes.push({ file: rel, note: `"- Depends on:" uses an ellipsis range — never expanded, depends-on left []` });
      } else {
        dependsOn = computeDependsOn(bullets, id);
      }

      // ── supersedes ────────────────────────────────────────────────────
      let supersedes = [];
      const supersedesBullet = findBullet(bullets, "supersedes");
      if (supersedesBullet) {
        if (RANGE_RE.test(supersedesBullet.text)) {
          edgeNotes.push({ file: rel, note: `"- Supersedes:" uses an ellipsis range — never expanded, supersedes left []` });
        } else if (!firstLineClean(supersedesBullet.text).toLowerCase().startsWith("nothing")) {
          supersedes = idsIn(supersedesBullet.text, id);
        }
      }

      // ── blocked-by: refused, always. A "BLOCKED" clause in Status is
      // noted for a human, never turned into an edge. ─────────────────────
      if (statusBullet && /\bBLOCKED\b/.test(statusBullet.text)) {
        edgeNotes.push({ file: rel, note: `Status bullet says "BLOCKED" — blocked-by is never inferred from prose; left [] for a human to read and re-file as a blocked-by edge` });
      }

      // ── rests-on: never inferred ─────────────────────────────────────
      const asmMentions = idsIn(text, id).filter((x) => x.startsWith("ASM-"));
      if (asmMentions.length) {
        edgeNotes.push({ file: rel, note: `body cites ${asmMentions.length} ASM-### token(s) (${asmMentions.join(", ")}) — rests-on not inferred, left []` });
      }

      const data = {
        id, type: semantic, title, status,
        ...(semantic === "feedback" ? { severity: severity ?? "unclassified" } : {}),
        ...(upstreamField ? { [upstreamField]: upstreamIds } : {}),
        "depends-on": dependsOn,
        "blocked-by": [],
        "rests-on": [],
        supersedes,
      };

      const fm = serializeFrontmatter(data);
      ctx.write(rel, fm + "\n" + text);
      migrated++;
    }
  }

  ctx.log(`  ${migrated} artifact${migrated === 1 ? "" : "s"} migrated to front-matter, ${skipped} left unchanged`);
  if (edgeNotes.length) {
    ctx.log(`  ${edgeNotes.length} edge note${edgeNotes.length === 1 ? "" : "s"} (fields left [] rather than guessed):`);
    for (const n of edgeNotes) ctx.log(`    ⚠ ${n.file}: ${n.note}`);
  }
  if (adjudicationNotes.length) {
    ctx.log(`  ${adjudicationNotes.length} satisfies-vs-covers adjudication note${adjudicationNotes.length === 1 ? "" : "s"} (rule 5.4 — not decided by this migration):`);
    for (const n of adjudicationNotes) ctx.log(`    ? ${n.file}: ${n.note}`);
  }
  if (unrecognizedLabels.length) {
    ctx.log(`  ${unrecognizedLabels.length} unrecognized "- Label:" bullet(s) — closed as their own boundary, folded into nothing:`);
    for (const u of unrecognizedLabels) ctx.log(`    ? ${u.file}: "- ${u.label}:" ${JSON.stringify(u.text)}`);
  }
}
