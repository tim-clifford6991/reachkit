// Helpers shared by both grammars' walks and by extract() itself — one
// module (proposal 24, S3). The head-block walk is frozen in head-block.mjs
// and the front-matter walk lives in front-matter.mjs; nothing here knows
// which grammar is calling.

import { FM_FIELD_ORDER } from "./frontmatter.mjs";
export { FM_FIELD_ORDER };

// 0.11.0 — corpus-volume reads these. Whole-file counts, `wc -w` / `wc -l`
// parity: whitespace-split tokens, and newline count. Recorded at parse time
// so the checker never re-reads a file the parser already has in hand.
export const countWords = (text) => (text.match(/\S+/g) || []).length;
export const countLines = (text) => (text.match(/\n/g) || []).length;

export const RANGE_RE = /(…|\.\.\.)/;

export const clip = (s, n) => (n && s.length > n ? { text: s.slice(0, n), full: s.length } : { text: s, full: s.length });

// The semantic type name a front-matter artifact's own `type:` field carries,
// keyed by the config's uppercase prefix — matches ReachKit v2's
// scripts/lib/frontmatter.mjs TYPE_BY_DIR exactly (that repo's directories
// and this config's type ids name the same five kinds). Used both to label a
// front-matter node when its own file has no front matter yet (title-only
// fallback) and to translate `checks.orphanType` (declared as "REQ") into the
// semantic key ("requirement") front-matter nodes actually carry.
export const SEMANTIC_BY_PREFIX = { REQ: "requirement", BP: "blueprint", WO: "work-order", ADR: "decision", FB: "feedback", JN: "journey" };

/**
 * Title resolution chain, shared by both grammars: front-matter `title:` →
 * first `# ` heading → line 0. A corpus mid-migration to front-matter has
 * files that open with a `---` fence even while the project is still
 * configured for `head-block` — previously read as line 0, i.e. literally
 * "---". `preParsedData` lets the front-matter path skip re-parsing a block
 * it has already read; pass nothing to let this function detect the fence
 * itself.
 */
export function resolveTitle(text, lines, preParsedData) {
  let data = preParsedData;
  if (data === undefined && text.startsWith("---\n")) {
    try {
      data = splitFrontmatter(text).data;
    } catch {
      data = null;
    }
  }
  if (data && typeof data.title === "string" && data.title.trim()) return data.title.trim();
  const heading = lines.find((l) => l.startsWith("# "));
  const src = heading ?? (lines[0] || "");
  return src
    .replace(/^#\s*/, "")
    .replace(/^[A-Z]+-\d{3}[a-z]?\s*[—–-]\s*/, "")
    .trim();
}

/** Case-insensitive key lookup after bold markers have been stripped. */
export function keyAliasMap(cfg) {
  const keys = [
    ...Object.keys(cfg.relations),
    "Status",
    ...Object.keys(cfg.fields),
    ...cfg.metaFields,
    ...cfg.knownKeys,
  ];
  return Object.fromEntries(keys.map((k) => [k.toLowerCase(), k]));
}

/**
 * The status words the parser recognises in an artifact's head lines.
 * Ordered: declared vocabularies first, in config order, then the words
 * observed in real corpora but not declared. Order is significant — the
 * fallback pass returns the first token found anywhere in the line.
 */
export function artifactStatusTokens(cfg) {
  const s = cfg.statuses;
  const out = [];
  for (const list of [s.artifact, s.WO, s.ADR, s.registry, s.observed.artifact]) {
    for (const t of list) if (!out.includes(t)) out.push(t);
  }
  return out;
}

export function registryStatusTokens(cfg) {
  const s = cfg.statuses;
  const out = [];
  for (const list of [s.registry, s.observed.registry]) {
    for (const t of list) if (!out.includes(t)) out.push(t);
  }
  return out;
}

export function parseStatus(raw, tokens) {
  const c = raw.replace(/[*`_]/g, "").trim().toLowerCase();
  // Clean: the line *is* the status word, or opens with it followed by a
  // separator ("approved — 2026-08-10").
  for (const t of tokens) {
    if (c === t || (c.startsWith(t) && /^[\s—,.\-]/.test(c.slice(t.length)))) {
      return { status: t, clean: true };
    }
  }
  // Dirty: the word appears somewhere inside a sentence. Recorded as the
  // status, but flagged — the corpus is telling us the field is prose.
  for (const t of tokens) if (new RegExp(`\\b${t}\\b`).test(c)) return { status: t, clean: false };
  return { status: null, clean: false };
}

// Canonical field order and upstream-edge map for the front-matter grammar —
// kept in lockstep with ReachKit v2's scripts/lib/frontmatter.mjs FIELD_ORDER
// and build-registry.mjs UPSTREAM_FIELD_BY_TYPE, byte for byte on the field
// names — with one exception: `code` (globs anchoring an artifact to its
// implementation) is this doctrine's own addition, appended after
// `supersedes`; ReachKit's generator has no such field and ignores it.
// `persona`/`steps` (Wave 2 Task 2) are the journey type's own fields —
// `steps` is an array of `{ step, exercises }` rows, read with the same
// block-mapping grammar `rests-on` already uses, and its `exercises` ids
// mint `[journey, requirement, "exercises"]` edges below rather than being
// folded into FM_EDGE_FIELDS (which is scalar-array-of-ids per field; a
// step's own free-text label has no analogue there).
// `wave` (Wave 3 Task 3) is a scalar, not an edge field — it names the row
// in `registry/waves.md` this work order belongs to, read the same way
// `persona` is: a bare string, surfaced in node meta (`Wave`) for the
// client, never itself an edge (there is no node named "W1" for one to
// target). Appended last, after `steps`.
// FM_FIELD_ORDER itself lives in ./frontmatter.mjs (0.12.1) — the reader's and
// the writer's order are one list.
export const FM_UPSTREAM_FIELD_BY_TYPE = {
  requirement: null, blueprint: "satisfies", decision: "decides-for",
  "work-order": "implements", feedback: "about",
};
// The array-of-id fields minted as edges. `rests-on` is deliberately absent:
// its entries are `{claim, disposition, accepted-by}` objects (assumption
// rows), not artifact ids — there is no node for an edge to target, so it is
// read (never crashes) but never becomes a graph edge. In FIELD_ORDER's own
// order, so edge order is deterministic rather than object-key order.
export const FM_EDGE_FIELDS = FM_FIELD_ORDER.filter((f) =>
  ["satisfies", "covers", "implements", "decides-for", "about", "depends-on", "blocked-by", "cites-retired", "supersedes"].includes(f)
);

// `## TST-###` (and `TST-003-R`, `TST-021-R2`, …) headings inside a
// migrated work order's body become `validation` nodes — mirrors ReachKit
// v2's build-registry.mjs TST_HEADING_RE exactly. TST has no directory of
// its own; containment in a work order's body IS the structure.
export const TST_HEADING_RE = /^#{1,3}\s+(TST-\d+(?:-R\d*)?)\s+[—-]\s*(.+?)\s*$/gm;
// Same shape, un-anchored to a stream, for testing one line at a time.
export const TST_HEADING_RE_ONE = /^#{1,3}\s+(TST-\d+(?:-R\d*)?)\s+[—-]\s*(.+?)\s*$/;
// A heading whose first token *is* a TST id — the only near-miss worth
// reporting. `### Repairs after TST-042` mentions one; it does not claim to be
// one, and firing on it would bury the two headings that do.
export const TST_NEAR_MISS_RE = /^#{1,6}\s+TST-\d+\S*.*$/gm;
