// Zero-dependency reader for the front-matter grammar's YAML subset.
//
// Ported from ReachKit v2's scripts/lib/frontmatter.mjs — not imported across
// repos, this console has no runtime dependency on that project's tree, but
// the grammar itself must match exactly: that repo's `check:registry` gate
// diffs its own generator's output byte-for-byte, and this console only ever
// reads, so it must never be a source of drift pressure on it.
//
// A deliberately small SUBSET of YAML, not a general parser: one
// `---`-fenced document at byte 0, only what the schema ever writes. Anything
// outside it is a MALFORMED front-matter block and throws — a mis-parsed
// corpus is worse than a refused one. The caller decides what "refused"
// means (extract() treats it as not-yet-migrated, the same as no front
// matter at all, rather than crashing the whole run).
//
// Grammar:
//
//   key: value                    scalar — bare token or "double-quoted string"
//   key: [A, B, C]                flow list of scalars
//   key: []                       empty flow list
//   key:                          block list, one item per "  - " line, or
//     - value                       a mapping item (used by `rests-on`):
//     - subkey: "value"               subkeys `claim`, `disposition`,
//       subkey2: value                `accepted-by`
//
// Quoting: only double-quoted strings, with `\"` and `\\` as the only
// escapes.
//
// 0.12.1 (proposal 24, S1): this is the ONE parser. The migrations used to
// carry their own copy under migrations/lib/ with a promise of lockstep;
// the two had already drifted. `upgrade` now hands migrations this module
// as `ctx.frontmatter` (split + serialize), and FM_FIELD_ORDER — the fixed
// field order every write uses and the reader's canonical order — lives
// here, once. The serializer refuses a key outside that order rather than
// drop it silently (repo convention: a wrong rewrite silently opens or
// closes a gate); `pivot` rewrites one field's extent textually for the
// same reason, and never round-trips a durable artifact through this.

const OPEN = "---\n";

/** Split `text` into { data, body }. `data` is `null` when the file has no
 *  opening `---` fence at byte 0 (not on this grammar, or not yet migrated).
 *  Throws on a block that opens with `---` but isn't valid subset YAML.
 *  @param {string} text
 *  @returns {{ data: Record<string, any> | null, body: string }} */
export function splitFrontmatter(text) {
  if (!text.startsWith(OPEN)) return { data: null, body: text };

  let close = text.indexOf("\n---\n", OPEN.length - 1);
  let afterLen = 5; // "\n---\n"
  if (close === -1) {
    if (text.endsWith("\n---")) {
      close = text.length - 4;
      afterLen = 4; // "\n---" at EOF, no trailing newline
    } else {
      throw new Error("frontmatter fence opened with '---' but never closed with a line containing only '---'");
    }
  }
  const yamlBlock = text.slice(OPEN.length, close);
  const body = text.slice(close + afterLen);
  const data = parseYamlSubset(yamlBlock);
  return { data, body };
}

const KEY_LINE = /^([a-zA-Z][a-zA-Z0-9_-]*):[ \t]?(.*)$/;
const BLOCK_ITEM_MAPPING_START = /^  - ([a-zA-Z][a-zA-Z0-9_-]*):[ \t]?(.*)$/;
const BLOCK_ITEM_SCALAR = /^  - (.*)$/;
const BLOCK_MAPPING_CONT = /^    ([a-zA-Z][a-zA-Z0-9_-]*):[ \t]?(.*)$/;

function parseYamlSubset(block) {
  const lines = block.split("\n");
  const data = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const m = KEY_LINE.exec(line);
    if (!m) throw new Error(`unparseable frontmatter line ${i + 1}: ${JSON.stringify(line)}`);
    const key = m[1];
    const rest = m[2];
    if (rest !== "") {
      data[key] = parseScalarOrFlowList(rest, i + 1);
      i++;
      continue;
    }
    // block form: the value is the run of "  - …" lines that follows.
    i++;
    const items = [];
    while (i < lines.length && BLOCK_ITEM_SCALAR.test(lines[i])) {
      const mapStart = BLOCK_ITEM_MAPPING_START.exec(lines[i]);
      if (mapStart) {
        const obj = {};
        obj[mapStart[1]] = parseScalarOrFlowList(mapStart[2], i + 1);
        i++;
        while (i < lines.length && BLOCK_MAPPING_CONT.test(lines[i])) {
          const mm = BLOCK_MAPPING_CONT.exec(lines[i]);
          obj[mm[1]] = parseScalarOrFlowList(mm[2], i + 1);
          i++;
        }
        items.push(obj);
      } else {
        const sm = BLOCK_ITEM_SCALAR.exec(lines[i]);
        items.push(parseScalarOrFlowList(sm[1], i + 1));
        i++;
      }
    }
    data[key] = items;
  }
  return data;
}

function parseScalarOrFlowList(raw, lineNo) {
  const t = raw.trim();
  if (t === "[]") return [];
  if (t.startsWith("[") && t.endsWith("]")) {
    const inner = t.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((s) => parseScalarOrFlowList(s.trim(), lineNo));
  }
  if (t.startsWith('"')) {
    if (!t.endsWith('"') || t.length < 2) {
      throw new Error(`unterminated quoted string on frontmatter line ${lineNo}: ${JSON.stringify(raw)}`);
    }
    return t
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return t;
}

// Canonical field order for the front-matter grammar — the reader's order
// (extract/index.mjs) and the writer's (serializeFrontmatter below), one
// list. `code`, `persona`, `steps`, `wave`, `ui` are this doctrine's own
// additions to the ReachKit v2 order this was ported from (0.3.0, 0.4.0,
// 0.5.0, 0.8.0); ReachKit's generator has none of them and ignores them.
export const FM_FIELD_ORDER = [
  "id", "type", "title", "status", "ui", "severity", "origin",
  "satisfies", "covers", "implements", "decides-for", "about",
  "depends-on", "blocked-by", "cites-retired", "rests-on", "supersedes",
  "code", "persona", "steps", "wave",
];

const QUOTED_SCALAR_FIELDS = new Set(["title", "persona"]);

function quote(s) {
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** @param {Record<string, any>} data
 *  @returns {string} */
export function serializeFrontmatter(data) {
  // Refuse rather than guess (repo convention — a migration that silently
  // drops a key is a wrong rewrite, and a wrong rewrite silently opens or
  // closes a gate). FM_FIELD_ORDER is the fixed, exhaustive key list every
  // write uses; a key outside it would otherwise vanish from the file with
  // no trace, because the loop below only ever visits FM_FIELD_ORDER's own
  // keys.
  for (const k of Object.keys(data)) {
    if (!FM_FIELD_ORDER.includes(k)) {
      throw new Error(`frontmatter key "${k}" is not in FM_FIELD_ORDER — refusing to serialise (it would be dropped)`);
    }
  }
  const lines = ["---"];
  for (const key of FM_FIELD_ORDER) {
    if (!(key in data)) continue;
    const val = data[key];
    if (key === "rests-on") {
      const rows = val;
      if (!Array.isArray(rows)) throw new Error("rests-on must be an array");
      if (rows.length === 0) { lines.push("rests-on: []"); continue; }
      lines.push("rests-on:");
      for (const row of rows) {
        lines.push(`  - claim: ${quote(row.claim)}`);
        lines.push(`    disposition: ${row.disposition}`);
        lines.push(`    accepted-by: ${quote(row["accepted-by"])}`);
      }
      continue;
    }
    if (key === "steps") {
      const rows = val;
      if (!Array.isArray(rows)) throw new Error("steps must be an array");
      if (rows.length === 0) { lines.push("steps: []"); continue; }
      lines.push("steps:");
      for (const row of rows) {
        lines.push(`  - step: ${quote(row.step)}`);
        // Always written, `exercises: []` when empty — a step that
        // exercises nothing yet is a fact worth stating explicitly, not
        // omitting (the same posture `rests-on: []` takes above).
        lines.push(`    exercises: [${(row.exercises || []).join(", ")}]`);
      }
      continue;
    }
    if (Array.isArray(val)) { lines.push(`${key}: [${val.join(", ")}]`); continue; }
    lines.push(QUOTED_SCALAR_FIELDS.has(key) ? `${key}: ${quote(val)}` : `${key}: ${val}`);
  }
  lines.push("---");
  return lines.join("\n") + "\n";
}
