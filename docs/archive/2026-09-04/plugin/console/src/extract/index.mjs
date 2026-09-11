// corpus → graph.
//
// The governing rule, from which everything else follows:
//
//     Declared links are edges. Prose references are not.
//
// A narrative corpus mentions IDs constantly in argument — ReachKit has 1,790
// declared edges against 6,559 prose mentions. Treating mentions as edges
// produces a dense, confident, false graph, so mentions are indexed
// separately and never enter `edges`.
//
// Constructs this parser cannot read — ellipsis ranges such as
// `Implements: BP-001 … BP-096` — are refused and reported, never expanded.
// Expanding that one line would fabricate roughly 140 edges. A fabricated
// edge is worse than a missing one, because the whole value proposition is
// that every claim is checkable.
//
// Artifacts come in two shapes and both are load-bearing: one file per
// artifact (`dir`) and one table row per artifact (`table`). CON and ASM are
// rows. A model assuming artifact = file loses 169 of ReachKit's 458.

import { readFileSync, readdirSync, realpathSync } from "node:fs";

import { join, relative } from "node:path";
import { readRepo, globToRegExp } from "./git.mjs";
import { scanIndex } from "./code.mjs";
import { splitFrontmatter } from "./frontmatter.mjs";
import {
  countWords, countLines, RANGE_RE, clip, SEMANTIC_BY_PREFIX, resolveTitle,
  keyAliasMap, artifactStatusTokens, registryStatusTokens, parseStatus,
  FM_UPSTREAM_FIELD_BY_TYPE, FM_EDGE_FIELDS,
} from "./shared.mjs";
import { extractFrontMatter } from "./front-matter.mjs";
import { extractHeadBlock, registryContradiction } from "./head-block.mjs";

// The two walks live in front-matter.mjs and head-block.mjs (proposal 24,
// S3); shared.mjs carries what both use. This file composes: setup, the
// walk the grammar names, then the common tail — declared edges, the
// dangling/orphan/archive health, schema, strategy layer, waves, the code
// layer, and the compact projection the checker and the viewer read.


/**
 * Parse a corpus into nodes, declared edges, a mention index, health
 * findings, the schema and the strategy layer.
 *
 * @param {string} projectRoot
 * @param {object} cfg  a validated factory.config.json
 */
export function extract(projectRoot, cfg) {
  const DOCS = join(projectRoot, cfg.docsRoot);

  const typeIds = cfg.types.map((t) => t.id);
  const allPrefixes = [...typeIds, ...cfg.externalIdPrefixes];
  const external = new Set(cfg.externalIdPrefixes);
  if (cfg.grammar === "front-matter") {
    // TST is a real node type under this grammar (derived from `## TST-###`
    // headings), not a cited-but-nodeless external prefix — a dangling TST
    // id is now a genuine defect. CON/ASM are the opposite: constitution
    // rule 2.3 retired them as node types, so a `cites-retired` entry naming
    // one is history, not a defect — mirrors ReachKit v2's build-registry.mjs
    // classifyUnresolvedEdges() split between "retired" and "defect".
    external.delete("TST");
    external.add("CON");
    external.add("ASM");
  }
  const ID_RE = new RegExp(`\\b(${allPrefixes.join("|")})-(\\d{3})([a-z])?\\b`, "g");

  const fileTypes = cfg.types.filter((t) => t.dir);
  const tableTypes = cfg.types.filter((t) => t.table);
  // The seed applies one combined prefix regex in every directory, so a
  // mis-filed BP inside requirements/ keeps its own ID and takes the
  // directory's type — which is exactly how you notice it.
  const FILE_RE = new RegExp(`^(${fileTypes.map((t) => t.id).join("|")})-(\\d{3})([a-z])?`);

  const KEY_ALIAS = keyAliasMap(cfg);
  const STATUS_TOKENS = artifactStatusTokens(cfg);
  const ROW_TOKENS = registryStatusTokens(cfg);
  const metaCapture = new Set(cfg.metaFields);
  const uiFields = Object.values(cfg.fields);

  const nodes = new Map();
  const edges = [];
  const journeys = new Map();
  const isFrontMatter = cfg.grammar === "front-matter";
  const mentions = new Map();
  const fieldVocab = new Map();   // field name → Map(value → count)
  const keyCase = new Map();      // as-written key → count
  const health = { rangeLines: [], dangling: new Map(), orphans: [], vocab: {}, fieldCarriers: {}, tstHeadings: [], archived: new Map() };

  // The charter's own id (front-matter `id:`), read early so the declared-
  // edge pass below can recognise a citation of it. Null when there is no
  // charter or it carries no front-matter — then nothing is special-cased.
  let charterId = null;
  try {
    const ch = splitFrontmatter(readFileSync(join(DOCS, cfg.charter), "utf8"));
    if (ch.data && typeof ch.data.id === "string" && ch.data.id) charterId = ch.data.id;
  } catch { /* no charter yet */ }

  // ---- the archive (0.12.0, rule 7.5) -------------------------------------
  // `factory-console pivot` moves derived artifacts under
  // `<docsRoot>/<cfg.archive>/<date>-<slug>/…`. Nothing under it is walked
  // as a node — the parser walks declared type directories only, which is
  // what keeps archived files out of the graph by construction — but their
  // ids are collected, by filename, so a citation from a surviving artifact
  // to an archived id is reported by pivot-relink as *archived* (the fix is
  // named) rather than by dangling-id as merely missing (error).
  const archive = { dir: cfg.archive || null, present: false, sets: [], ids: new Set() };
  if (archive.dir) {
    const archiveAbs = join(DOCS, archive.dir);
    let sets = [];
    try {
      sets = readdirSync(archiveAbs, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
      archive.present = true;
    } catch { /* no archive — most corpora never pivot */ }
    const ID_FILE = /^([A-Z]+-\d{3}[a-z]?)/;
    const walkIds = (dir) => {
      let ents = [];
      try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        if (e.isDirectory()) walkIds(join(dir, e.name));
        else if (e.name.endsWith(".md")) {
          const m = e.name.match(ID_FILE);
          if (m) archive.ids.add(m[1]);
        }
      }
    };
    for (const s of sets) {
      archive.sets.push(s);
      walkIds(join(archiveAbs, s));
    }
  }

  const idsOn = (s) => {
    const o = [];
    let m;
    ID_RE.lastIndex = 0;
    while ((m = ID_RE.exec(s))) o.push(m[0]);
    return o;
  };
  const noteMention = (from, text) => {
    for (const t of new Set(idsOn(text))) {
      if (t === from) continue;
      if (!mentions.has(t)) mentions.set(t, new Set());
      mentions.get(t).add(from);
    }
  };

  // ---- one file per artifact ---------------------------------------------
  if (isFrontMatter) {
    // Front-matter grammar: id/type/status/title and typed edges come from a
    // `---`-fenced YAML block, not bulleted head lines. CON/ASM are not
    // scraped here at all (see the "one table row" section below) — under
    // this grammar they are `rests-on`/`blocked-by` states on the owning
    // artifact, not standalone nodes (constitution rule 2.3).
    extractFrontMatter({ fileTypes, DOCS, FILE_RE, cfg, nodes, edges, health, noteMention, journeys, fieldVocab });
  } else {
    extractHeadBlock({ fileTypes, tableTypes, DOCS, FILE_RE, cfg, nodes, edges, health, noteMention, fieldVocab, keyCase, metaCapture, uiFields, KEY_ALIAS, STATUS_TOKENS, ROW_TOKENS, idsOn });
  }

  // ---- declared edges ----------------------------------------------------
  const seen = new Set();
  const declared = [];
  for (const e of edges) {
    const k = `${e.from}>${e.to}>${e.rel}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (!nodes.has(e.to)) {
      // An external prefix (TST) is cited by design and has no artifact
      // behind it — that is not a dangling ID.
      if (external.has(e.to.split("-")[0])) continue;
      // The charter is a legitimate, node-less target — a pivot decision
      // `decides-for` it (rule 7.5). Its id is whatever the charter file's
      // own front-matter says (`PROJECT` by convention); the citation mints
      // no edge and is never dangling.
      if (e.to === charterId) continue;
      // An archived id is not dangling — the file exists, under archive/,
      // and pivot-relink is the rule that reports the citation (0.12.0).
      if (archive.ids.has(e.to)) {
        if (!health.archived.has(e.to)) health.archived.set(e.to, []);
        health.archived.get(e.to).push({ from: e.from, rel: e.rel });
        continue;
      }
      if (!health.dangling.has(e.to)) health.dangling.set(e.to, []);
      health.dangling.get(e.to).push(e.from);
      continue;
    }
    declared.push(e);
  }

  // `checks.orphanType` is always declared in the config's uppercase prefix
  // ("REQ"); front-matter nodes carry the semantic name ("requirement") as
  // their `type` instead, so the comparison has to go through the same map
  // used to derive that name from a file's directory.
  const orphanType = isFrontMatter ? (SEMANTIC_BY_PREFIX[cfg.checks.orphanType] || cfg.checks.orphanType) : cfg.checks.orphanType;
  // Under the front-matter grammar, only a `satisfies` edge FROM a blueprint
  // discharges a requirement orphan — rule 5.4: `covers` is derivation's
  // sibling, "true and useful, but not an authorising ancestor", and a
  // `depends-on`/`about`/`cites-retired` mention is weaker still. The
  // head-block grammar's `cited` set stays "any declared edge" unchanged
  // (gate.mjs pins its exact numbers against the legacy prototype).
  const citedForOrphan = isFrontMatter
    ? new Set(declared.filter((e) => e.rel === "satisfies" && nodes.get(e.from)?.type === "blueprint").map((e) => e.to))
    : new Set(declared.map((e) => e.to));
  for (const n of nodes.values()) {
    if (n.type === orphanType && !citedForOrphan.has(n.id)) health.orphans.push(n.id);
  }

  // ---- registry contradiction (head-block grammar only) — head-block.mjs
  const uniqReg = isFrontMatter ? [] : registryContradiction({ cfg, DOCS, nodes });

  // ---- generated drift (front-matter grammar only) -----------------------
  // Cross-checks this console's own parse against
  // docs/registry/generated/graph.json — the file scripts/build-registry.mjs
  // projects from the same front-matter this parser reads. Not configurable:
  // that path is build-registry.mjs's own fixed convention, the same way
  // `registry/generated` is not a config choice for the generator itself.
  // Only ids present in BOTH sides are compared (a node absent from one side
  // is a migration/staleness question the drift check does not adjudicate);
  // an absent generated/graph.json is a notice, not a defect — plenty of
  // front-matter corpora will never run `npm run registry`.
  let generatedDrift = { present: false, mismatches: [] };
  if (isFrontMatter) {
    try {
      const gen = JSON.parse(readFileSync(join(DOCS, "registry/generated/graph.json"), "utf8"));
      const genNodes = gen.nodes || {};
      const mismatches = [];
      for (const [id, n] of nodes) {
        const g = genNodes[id];
        if (!g || g.status === undefined) continue;
        if (g.status !== n.status) mismatches.push({ id, parsed: n.status, generated: g.status });
      }
      generatedDrift = { present: true, mismatches };
    } catch { /* no generated/graph.json yet — reported by the checker as a notice, not here */ }
  }

  // ---- schema ------------------------------------------------------------
  const { tables, schemaNote } = readSchema(projectRoot, cfg.schema);

  // ---- strategy layer ----------------------------------------------------
  let charter = "";
  try {
    charter = clip(readFileSync(join(DOCS, cfg.charter), "utf8"), cfg.charterCap).text;
  } catch { /* no charter yet */ }

  const modules = [];
  try {
    const sm = readFileSync(join(DOCS, cfg.structureMap), "utf8");
    for (const line of sm.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("|") || t.includes("---")) continue;
      const c = t.split("|").slice(1, -1).map((x) => x.trim());
      if (c.length < 3 || /^Module/i.test(c[0])) continue;
      if (!/`/.test(c[0])) continue;
      modules.push({ path: c[0].replace(/`/g, ""), resp: c[1].replace(/<!--.*?-->/g, "").trim(), bp: c[2] });
    }
  } catch { /* no structure map yet */ }

  // ---- waves (front-matter grammar convention: registry/waves.md) --------
  // Not itself an artifact type — no node, no edges. A markdown table naming
  // which work orders belong to which wave and whether it is still open:
  // `| Wave | Goal | Work orders | Status |`. The current wave is the last
  // `open` row in file order (a WO's own `wave:` meta is the per-node half
  // of this; wave-off-record is what checks the two agree). Not a config
  // key — same fixed-convention posture as `registry/generated/graph.json`
  // above: a corpus without the file is a real, quiet zero.
  //
  // The Work orders cell may carry a MoSCoW annotation per id —
  // `WO-001 (Must), WO-002 (Should)` — because `/wave propose` writes the
  // cell that way (`commands/wave.md`, `skills/wave-planning/SKILL.md`).
  // Each comma-separated entry is read as one WO id (`WO-\d{3}[a-z]?`) plus
  // an optional trailing `(Must|Should|Could|Won't)`; `wos` stays bare ids
  // (wave-off-record and everything else reads it unannotated), the
  // annotations land separately in `priorities` (`{}` when none appear).
  const WAVE_WO_ID_RE = /\b(WO-\d{3}[a-z]?)\b/;
  const WAVE_PRIORITY_RE = /\((Must|Should|Could|Won't)\)/;
  // `present` distinguishes the file not existing yet from it existing with
  // zero data rows — both produce `list: []` here, but wave-off-record's
  // notice reads different words for the two (dogfood finding 1: "no file"
  // and "file with nothing in it yet" are not the same fact for an owner).
  let waves = { current: null, list: [], present: false };
  if (isFrontMatter) {
    try {
      const wtxt = readFileSync(join(DOCS, "registry/waves.md"), "utf8");
      const rows = [];
      for (const line of wtxt.split("\n")) {
        const t = line.trim();
        // The separator row (`|---|:--|--:|`) is pipes, colons, dashes and
        // whitespace only — a data row that merely contains "---" in a cell
        // (a goal like "Ship the A --- B bridge") also has letters, so this
        // guard doesn't drop it the way a bare `.includes("---")` would.
        if (!t.startsWith("|") || /^[\s|:-]+$/.test(t)) continue;
        const c = t.split("|").slice(1, -1).map((x) => x.trim());
        if (c.length < 4 || /^Wave$/i.test(c[0])) continue;
        const wos = [];
        const priorities = {};
        if (c[2]) {
          for (const entry of c[2].split(",")) {
            const idm = entry.trim().match(WAVE_WO_ID_RE);
            if (!idm) continue;
            wos.push(idm[1]);
            const pm = entry.match(WAVE_PRIORITY_RE);
            if (pm) priorities[idm[1]] = pm[1];
          }
        }
        rows.push({ id: c[0], goal: c[1], wos, priorities, status: c[3].toLowerCase() });
      }
      const openRows = rows.filter((r) => r.status === "open");
      waves = { current: openRows.length ? openRows[openRows.length - 1].id : null, list: rows, present: true };
    } catch { /* no registry/waves.md yet */ }
  }

  // ---- code layer (derived, never declared by hand) ----------------------
  // git is the event stream 8090 gets from a webhook. Commit messages citing
  // WO-### are declared links (the doctrine mandates them) — prose in a
  // commit body is no more an edge than prose in a document; only the id
  // token is read. Ranges are refused, as everywhere else.
  let code = { present: false };
  if (cfg.code) {
    const repo = readRepo(join(projectRoot, cfg.code.root));
    if (repo) {
      // `repo.root` comes back from `git rev-parse --show-toplevel`, which
      // resolves symlinks (macOS's /tmp → /private/tmp among them); realpath
      // DOCS the same way before computing the relative path, or a project
      // rooted under a symlinked tmp dir gets a docsPrefix full of "../".
      let realDocs;
      try {
        realDocs = realpathSync(DOCS);
      } catch {
        realDocs = DOCS;
      }
      const docsPrefix = relative(repo.root, realDocs).replace(/\\/g, "/");
      const commits = [];
      const unresolved = {};
      const ranges = [];
      for (const c of repo.commits) {
        const wo = [];
        for (const ref of c.refs) {
          if (nodes.has(ref)) wo.push(ref);
          else unresolved[ref] = (unresolved[ref] || 0) + 1;
        }
        commits.push({ h: c.short, d: c.date, s: clip(c.subject, 120).text, wo, files: c.files });
        for (const text of c.ranges) ranges.push({ h: c.short, text });
      }

      const anchors = {};
      const anchoredFiles = new Set();
      for (const n of nodes.values()) {
        if (!n.code || !n.code.length) continue;
        // Compiled once per node rather than once per (node, tracked file)
        // pair — globToRegExp is pure per glob string, so re-running it
        // inside the filter recompiled the same regex for every tracked
        // file on every anchored node.
        const res = n.code.map(globToRegExp);
        const files = repo.tracked.filter((f) => res.some((re) => re.test(f))).sort();
        anchors[n.id] = { globs: n.code, files };
        for (const f of files) anchoredFiles.add(f);
      }

      // The code index: imports and routes over the same tracked-file list,
      // scanned once and shared by every anchor below. Blast radius is
      // deliberately shallow — the controller's ruling: direct importers
      // only, one hop, and a file that is itself anchored never counts
      // towards its own blast radius even when it imports another anchored
      // file. `anchors[id].routes` uses the identical one-hop rule in the
      // other direction: a route's page file counts if it IS an anchored
      // file, or if it directly imports one.
      const idx = scanIndex(repo.root, repo.tracked);
      const importsByFrom = new Map(); // file → Set(files it imports)
      const importsByTo = new Map();   // file → Set(files that import it)
      for (const [from, to] of idx.imports) {
        if (!importsByFrom.has(from)) importsByFrom.set(from, new Set());
        importsByFrom.get(from).add(to);
        if (!importsByTo.has(to)) importsByTo.set(to, new Set());
        importsByTo.get(to).add(from);
      }
      for (const [id, a] of Object.entries(anchors)) {
        const anchoredSet = new Set(a.files);
        const importers = new Set();
        for (const f of a.files) {
          for (const from of importsByTo.get(f) || []) {
            if (!anchoredSet.has(from)) importers.add(from);
          }
        }
        a.blast = importers.size;
        const routeSet = new Set();
        for (const r of idx.routes) {
          const imports = importsByFrom.get(r.file);
          const reaches = anchoredSet.has(r.file) || (imports && [...imports].some((t) => anchoredSet.has(t)));
          if (reaches) routeSet.add(r.route);
        }
        a.routes = [...routeSet].sort();
      }

      code = {
        present: true,
        head: repo.head,
        root: cfg.code.root,
        docsPrefix,
        commits,
        unresolved,
        ranges,
        anchors,
        index: idx,
        counts: {
          commits: commits.length,
          cited: commits.filter((c) => c.wo.length > 0).length,
          anchored: anchoredFiles.size,
        },
      };
    }
  }

  // ---- assemble ----------------------------------------------------------
  const statusCounts = (t) => {
    const c = {};
    for (const n of nodes.values()) if (n.type === t) c[n.status || "unset"] = (c[n.status || "unset"] || 0) + 1;
    return c;
  };

  // Front-matter nodes carry semantic type names ("requirement", "validation",
  // …) rather than the config's uppercase prefixes, and `validation` has no
  // entry in `cfg.types` at all — it exists only as struct derived from a
  // work order's own body. Keys for per-type counts and statuses are drawn
  // from the nodes actually produced, not from the config, whenever this
  // grammar is in play.
  const countKeys = isFrontMatter ? [...new Set([...nodes.values()].map((n) => n.type))].sort() : typeIds;

  const counts = {
    total: nodes.size,
    declaredEdges: declared.length,
    mentionPairs: [...mentions.values()].reduce((a, s) => a + s.size, 0),
  };
  for (const t of countKeys) counts[t] = [...nodes.values()].filter((n) => n.type === t).length;

  const primaryField = uiFields[0]?.key;

  // silent-index (rule 5.5) coverage: for every edge-shaped field, how many
  // of ALL nodes in the corpus carry it — the same "whole graph" denominator
  // build-registry.mjs's own computeGraphCoverage() uses for graph.json's
  // `coverage` block, deliberately including types (e.g. `validation`) that
  // structurally can never carry the field, because that dilution is exactly
  // what makes a near-zero fraction visible as near-zero.
  const fieldCoverage = {};
  if (isFrontMatter) {
    for (const field of [...FM_EDGE_FIELDS, "rests-on", "code", "exercises"]) {
      fieldCoverage[field] = { carrying: health.fieldCarriers[field]?.size || 0, total: nodes.size };
    }
  }

  return {
    counts,
    status: Object.fromEntries(countKeys.map((t) => [t, statusCounts(t)])),
    nodes: [...nodes.values()].map((n) => ({
      i: n.id, y: n.type, t: n.title, s: n.status, u: n.ui ? 1 : 0,
      m: n.meta, f: n.file, b: n.body, z: n.bytes,
      // 0.11.0 — whole-file words and lines (file-shaped nodes only; a
      // table row or a TST section has neither) and the node's rests-on
      // rows (front-matter grammar only; `[]` elsewhere).
      ...(typeof n.words === "number" ? { w: n.words, l: n.lines } : {}),
      a: n.restsOn ?? [],
    })),
    edges: declared.map((e) => [e.from, e.to, e.rel]),
    journeys: Object.fromEntries(journeys),
    waves,
    tables, schemaNote, charter, charterId, modules, code,
    archive: { dir: archive.dir, present: archive.present, sets: archive.sets, ids: [...archive.ids].sort() },
    uiVocab: Object.fromEntries(fieldVocab.get(primaryField) || []),
    fieldVocab: Object.fromEntries([...fieldVocab].map(([k, v]) => [k, Object.fromEntries(v)])),
    keyCase: Object.fromEntries([...keyCase].filter(([k]) => KEY_ALIAS[k.toLowerCase()])),
    // Front-matter nodes carry a semantic type name ("requirement", …)
    // rather than the config's uppercase prefix (`t.id`) — SEMANTIC_BY_PREFIX
    // above is the only place that knows the two name the same thing. `key`
    // exposes that mapping so any consumer (this console's own client script
    // included) can index G.counts / G.status / a node's own `y` field
    // correctly regardless of grammar, rather than re-deriving or
    // duplicating the mapping client-side. `null` when a declared type has
    // no front-matter representation at all — CON/ASM are retired as node
    // types under this grammar (constitution rule 2.3): a corpus can still
    // list them in `types` for a legacy tile, but zero nodes will ever carry
    // that key, which is a real zero, not an unresolved lookup.
    types: cfg.types.map((t) => ({
      id: t.id, label: t.label, shape: t.dir ? "dir" : "table",
      key: isFrontMatter ? (SEMANTIC_BY_PREFIX[t.id] || null) : t.id,
    })),
    externalIdPrefixes: cfg.externalIdPrefixes,
    health: {
      dangling: Object.fromEntries(health.dangling),
      archived: Object.fromEntries(health.archived),
      orphanREQ: health.orphans,
      registry: uniqReg,
      ranges: health.rangeLines,
      tstHeadings: health.tstHeadings,
      vocab: health.vocab,
      generatedDrift,
      fieldCoverage,
    },
    mc: Object.fromEntries([...mentions].map(([k, v]) => [k, v.size])),
  };
}

function readSchema(projectRoot, schema) {
  if (!schema) return { tables: [], schemaNote: null };
  if (schema.kind !== "supabase") {
    return {
      tables: [],
      schemaNote: `No adapter for schema.kind "${schema.kind}" yet — the data-model view is empty. Only "supabase" is implemented.`,
    };
  }
  const tables = [];
  try {
    for (const f of readdirSync(join(projectRoot, schema.path)).sort()) {
      if (!f.endsWith(".sql")) continue;
      const sql = readFileSync(join(projectRoot, schema.path, f), "utf8");
      const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_.]+)\s*\(([\s\S]*?)\n\)/gi;
      let m;
      while ((m = re.exec(sql))) {
        const name = m[1].replace(/^public\./, "");
        const cols = m[2]
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("--"))
          .map((l) => {
            const cm = l.match(/^([a-z_]+)\s+([a-z0-9 ()]+)/i);
            if (!cm) return null;
            const r = l.match(/references\s+([a-z_.]+)/i);
            return {
              n: cm[1], t: cm[2].trim(),
              p: /primary key/i.test(l) ? 1 : 0,
              f: r ? r[1].replace(/^public\./, "") : null,
            };
          })
          .filter(Boolean);
        tables.push({ n: name, c: cols, mig: f });
      }
    }
  } catch {
    return { tables: [], schemaNote: `schema.path "${schema.path}" not found — the data-model view is empty.` };
  }
  return { tables, schemaNote: null };
}
