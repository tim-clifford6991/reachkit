// Loading and validating factory.config.json.
//
// The shipped defaults are the plugin's templates/factory.config.json — the
// single copy, deliberately. A project declares only its deviations, so the
// grammar stays owned by the doctrine rather than drifting per project.
//
// The config is validated on load and the console refuses to start on an
// invalid one. Unknown keys are an error, not a warning: a typo in a relation
// name would otherwise quietly drop a whole class of edges, and a silently
// mis-parsed corpus is worse than no console.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

import { RULES as CHECK_RULES } from "./check/rules/index.mjs";

export class ConfigError extends Error {}

/** Where the shipped defaults live, relative to this file. There is exactly
 *  one copy of the default grammar in the world (CLAUDE.md's single-copy
 *  rule); a bundled fallback beside the console was once sanctioned here and
 *  removed — it would have let a stale duplicate silently shadow the
 *  template, which is the version-skew failure this repository exists to
 *  prevent. */
export function defaultsPath() {
  const fromRepo = resolve(HERE, "../../plugins/sdlc-factory/templates/factory.config.json");
  if (existsSync(fromRepo)) return fromRepo;
  throw new ConfigError(
    "cannot find the shipped default grammar (plugins/sdlc-factory/templates/factory.config.json) — is the console detached from the marketplace?"
  );
}

function readJson(path, what) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    throw new ConfigError(`cannot read ${what} at ${path}: ${e.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new ConfigError(`${what} at ${path} is not valid JSON: ${e.message}`);
  }
}

// Arrays replace wholesale: a project that declares `types` declares all of
// them, rather than half-overriding a list by index. Objects merge one level
// down, so a project can retune one rule's severity or add one relation
// without restating the rest — and, more importantly, cannot silently delete
// nine relation kinds by declaring a tenth. Removing a key is explicit:
// set it to null.
function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (k === "checks" || k === "statuses" || k === "fields" || k === "relations" || k === "edges") {
      out[k] = { ...(base[k] || {}), ...v };
      if (k === "checks" && v.severity) {
        out.checks.severity = { ...(base.checks?.severity || {}), ...v.severity };
      }
      if (k === "statuses" && v.observed) {
        out.statuses.observed = { ...(base.statuses?.observed || {}), ...v.observed };
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

const TOP_KEYS = new Set([
  "docsRoot", "grammar", "types", "externalIdPrefixes", "relations", "edges", "statuses", "fields",
  "metaFields", "knownKeys", "traceability", "structureMap", "charter",
  "schema", "code", "checks", "bodyCap", "rowCap", "charterCap", "typeCheck",
  // 0.12.0 — where `factory-console pivot` archives derived artifacts, a
  // directory under docsRoot the parser never walks (rule 7.5).
  "archive",
]);
const GRAMMARS = new Set(["head-block", "front-matter"]);
// `durability` (0.12.0, rule 5.8): "durable" survives a pivot, "derived" is
// archived by one. Optional on read — a head-block corpus predates it — and
// required only by `factory-console pivot`, which refuses rather than guesses.
const TYPE_KEYS = new Set(["id", "dir", "table", "label", "durability"]);
const DURABILITY = new Set(["durable", "derived"]);
const FIELD_KEYS = new Set(["key", "type", "true", "false", "tolerate"]);
const SCHEMA_KINDS = new Set(["supabase", "prisma", "drizzle"]);
// The rule set is the checker's own list (check/rules/index.mjs) — derived
// from the rule files, never a third copy here (proposal 24, S2).
const RULES = new Set(CHECK_RULES);
// The four altitude thresholds (0.11.0), each with its shipped default in
// templates/factory.config.json: a floor on work orders per approved
// requirement (rule 2.6), a budget of live words per approved requirement
// and of lines per work order (rule 2.5), and a budget of open rests-on
// rows per approved artifact (rule 2.3b).
const CHECK_KEYS = new Set([
  "orphanType", "severity", "silentIndexThreshold",
  "workOrdersPerRequirement", "wordsPerApprovedRequirement", "linesPerWorkOrder", "openAssumptionsPerApproved",
]);
const SEVERITIES = new Set(["error", "warn", "off"]);
// The graph contract's fixed edge vocabulary (docs/design/04-p1-backbone.md
// § "The graph contract"). `cites-retired` is deliberately absent — its
// targets are retired prefixes with no node behind them, so it can never be
// judged by type. `exercises` (and the `journey` node type it names below)
// arrive with Wave 2 Task 2; the schema names them now so the shipped
// contract does not need a second migration when journeys land.
const EDGE_FIELDS = new Set([
  "satisfies", "covers", "implements", "decides-for", "about",
  "depends-on", "blocked-by", "supersedes", "validates", "exercises",
]);
const EDGE_KEYS = new Set(["from", "to"]);
// The graph's node kinds (the constitution's semantic types, front-matter
// grammar) plus the not-yet-wired "journey". `"*"` means any of these;
// `"same"` (to-side only) means "whatever the from-side resolved to".
// `charter` (0.12.0) is the one non-artifact end an edge may name: a pivot
// decision `decides-for` the charter (rule 7.5). No node is minted for it —
// `factory-console pivot` verifies that edge from the decision's own
// front-matter — so it is a contract entry, never a graph edge.
const NODE_TYPES = new Set([
  "requirement", "blueprint", "decision", "work-order", "validation", "feedback", "journey", "charter",
]);
// The six per-type status vocabularies the front-matter grammar declares
// (constitution rule 2.2b — "one status vocabulary per artifact type, and
// each directory keeps its own"). Distinct from "artifact"/"WO"/"ADR" which
// govern the head-block grammar's uppercase-prefix types.
const FM_STATUS_TYPE_KEYS = ["requirement", "blueprint", "work-order", "decision", "validation", "feedback", "journey"];

function validate(c) {
  const bad = [];
  const need = (cond, msg) => { if (!cond) bad.push(msg); };

  for (const k of Object.keys(c)) {
    if (!TOP_KEYS.has(k)) bad.push(`unknown key "${k}" (did you mean one of: ${[...TOP_KEYS].join(", ")})`);
  }

  need(typeof c.docsRoot === "string" && c.docsRoot, "docsRoot must be a non-empty string");

  // `head-block` is the prototype's grammar (bulleted head lines). A project
  // moving to derived front-matter (id/type/status/edges as YAML, TST
  // sections inside work-order bodies) declares this once; the console
  // switches its whole read path on it. See docs/design/11-config-schema.md.
  need(GRAMMARS.has(c.grammar), `grammar must be one of: ${[...GRAMMARS].join(", ")}`);

  // The planner's fan-out check runs a project's own type-checker and must not
  // guess its name. Optional: absent means the planner falls back to detection.
  if (c.typeCheck !== undefined) {
    need(typeof c.typeCheck === "string" && c.typeCheck, "typeCheck must be a non-empty string");
  }

  need(Array.isArray(c.types) && c.types.length > 0, "types must be a non-empty array");
  if (Array.isArray(c.types)) {
    const seen = new Set();
    for (const t of c.types) {
      const at = `types[${t?.id ?? "?"}]`;
      if (!t || typeof t !== "object") { bad.push(`${at} must be an object`); continue; }
      for (const k of Object.keys(t)) if (!TYPE_KEYS.has(k)) bad.push(`${at}: unknown key "${k}"`);
      if (t.durability !== undefined && !DURABILITY.has(t.durability)) bad.push(`${at}.durability must be "durable" or "derived"`);
      need(typeof t.id === "string" && /^[A-Z][A-Z0-9]*$/.test(t.id), `${at}: id must be an uppercase prefix`);
      need(typeof t.label === "string" && t.label, `${at}: label is required`);
      // The one structural rule the whole model turns on.
      const shapes = ["dir", "table"].filter((k) => t[k] !== undefined);
      need(shapes.length === 1,
        `${at}: declare exactly one of "dir" (one file per artifact) or "table" (one row per artifact) — got ${shapes.length}`);
      for (const s of shapes) need(typeof t[s] === "string" && t[s], `${at}: ${s} must be a non-empty string`);
      if (seen.has(t.id)) bad.push(`${at}: duplicate type id`);
      seen.add(t.id);
    }
  }

  need(Array.isArray(c.externalIdPrefixes), "externalIdPrefixes must be an array");
  if (Array.isArray(c.externalIdPrefixes)) {
    const ids = new Set((c.types || []).map((t) => t.id));
    for (const p of c.externalIdPrefixes) {
      need(typeof p === "string" && /^[A-Z][A-Z0-9]*$/.test(p), `externalIdPrefixes: "${p}" must be an uppercase prefix`);
      need(!ids.has(p), `externalIdPrefixes: "${p}" is also a declared type — it cannot be both`);
    }
  }

  need(c.relations && typeof c.relations === "object" && !Array.isArray(c.relations),
    "relations must be an object mapping link-line key → relation name");
  if (c.relations && typeof c.relations === "object") {
    // Explicit removal: a project drops a relation kind by setting it null.
    for (const [k, v] of Object.entries(c.relations)) if (v === null) delete c.relations[k];
    const lower = new Map();
    for (const [k, v] of Object.entries(c.relations)) {
      need(typeof v === "string" && v, `relations["${k}"]: value must be a non-empty relation name, or null to drop it`);
      const lk = k.toLowerCase();
      // Keys are matched case-insensitively, so two keys differing only in
      // case would silently shadow one another.
      if (lower.has(lk)) bad.push(`relations: "${k}" and "${lower.get(lk)}" collide case-insensitively`);
      lower.set(lk, k);
    }
  }

  // The graph contract: which node types a declared edge may join. Fixed
  // key set (EDGE_FIELDS) — a project cannot invent an eleventh relation
  // here, because edge-off-schema's whole point is judging the ten the
  // doctrine actually mints. Explicit removal, like relations: a project
  // drops a relation's schema by setting it null (edge-off-schema simply
  // never judges that rel again — dropping it does not un-declare the edge).
  need(c.edges && typeof c.edges === "object" && !Array.isArray(c.edges),
    "edges must be an object mapping relation name → {from, to}");
  if (c.edges && typeof c.edges === "object") {
    for (const [k, v] of Object.entries(c.edges)) if (v === null) delete c.edges[k];
    for (const [k, v] of Object.entries(c.edges)) {
      const at = `edges.${k}`;
      need(EDGE_FIELDS.has(k), `${at}: unknown edge name — must be one of: ${[...EDGE_FIELDS].join(", ")}`);
      if (!v || typeof v !== "object" || Array.isArray(v)) { bad.push(`${at} must be an object with "from" and "to"`); continue; }
      for (const kk of Object.keys(v)) if (!EDGE_KEYS.has(kk)) bad.push(`${at}: unknown key "${kk}"`);
      const checkEnd = (side, allowSame) => {
        const arr = v[side];
        if (!Array.isArray(arr) || arr.length === 0) { bad.push(`${at}.${side} must be a non-empty array`); return; }
        for (const t of arr) {
          const ok = t === "*" || NODE_TYPES.has(t) || (allowSame && t === "same");
          if (!ok) bad.push(`${at}.${side}: "${t}" is not a declared node type (must be one of: ${[...NODE_TYPES].join(", ")}, "*"${allowSame ? ', "same"' : ""})`);
        }
      };
      checkEnd("from", false);
      checkEnd("to", true);
    }
  }

  need(c.statuses && typeof c.statuses === "object", "statuses must be an object");
  if (c.statuses) {
    for (const k of ["artifact", "WO", "ADR", "registry"]) {
      need(Array.isArray(c.statuses[k]), `statuses.${k} must be an array`);
    }
    const obs = c.statuses.observed;
    need(obs && typeof obs === "object", "statuses.observed must be an object");
    if (obs) for (const k of ["artifact", "registry"]) {
      need(Array.isArray(obs[k]), `statuses.observed.${k} must be an array`);
    }
    for (const k of Object.keys(c.statuses)) {
      if (!["artifact", "WO", "ADR", "registry", "observed", ...FM_STATUS_TYPE_KEYS].includes(k)) {
        bad.push(`statuses: unknown key "${k}"`);
      }
    }
    for (const k of FM_STATUS_TYPE_KEYS) {
      need(Array.isArray(c.statuses[k]), `statuses.${k} must be an array`);
    }
  }

  need(c.fields && typeof c.fields === "object", "fields must be an object");
  if (c.fields) for (const [name, f] of Object.entries(c.fields)) {
    const at = `fields.${name}`;
    for (const k of Object.keys(f)) if (!FIELD_KEYS.has(k)) bad.push(`${at}: unknown key "${k}"`);
    need(f.key === name, `${at}: key must equal the field name`);
    need(f.type === "boolean", `${at}: only type "boolean" is supported`);
    need(Array.isArray(f.true) && f.true.length, `${at}.true must be a non-empty array`);
    need(Array.isArray(f.false) && f.false.length, `${at}.false must be a non-empty array`);
    if (f.tolerate !== undefined) {
      need(f.tolerate && typeof f.tolerate === "object", `${at}.tolerate must be an object`);
      for (const k of Object.keys(f.tolerate || {})) {
        if (!["true", "false"].includes(k)) bad.push(`${at}.tolerate: unknown key "${k}"`);
        else need(Array.isArray(f.tolerate[k]), `${at}.tolerate.${k} must be an array`);
      }
    }
  }

  need(Array.isArray(c.metaFields), "metaFields must be an array");
  need(Array.isArray(c.knownKeys), "knownKeys must be an array");

  need(c.traceability && typeof c.traceability === "object", "traceability must be an object");
  if (c.traceability) {
    for (const k of Object.keys(c.traceability)) {
      if (!["file", "types"].includes(k)) bad.push(`traceability: unknown key "${k}"`);
    }
    need(typeof c.traceability.file === "string", "traceability.file must be a string");
    need(Array.isArray(c.traceability.types), "traceability.types must be an array");
  }

  need(typeof c.structureMap === "string", "structureMap must be a string");
  need(typeof c.charter === "string", "charter must be a string");

  // `schema: null` is a complete, normal answer — a project without a
  // database loses the data-model view and nothing else.
  if (c.schema !== null) {
    need(c.schema && typeof c.schema === "object", 'schema must be an object or null');
    if (c.schema && typeof c.schema === "object") {
      for (const k of Object.keys(c.schema)) {
        if (!["kind", "path"].includes(k)) bad.push(`schema: unknown key "${k}"`);
      }
      need(SCHEMA_KINDS.has(c.schema.kind), `schema.kind must be one of: ${[...SCHEMA_KINDS].join(", ")}`);
      need(typeof c.schema.path === "string" && c.schema.path, "schema.path must be a non-empty string");
    }
  }

  // `code: null` switches the derived git layer off (an archive, a corpus
  // with no repository). Otherwise `root` is the git repository root,
  // relative to the project root — "." for the common case.
  if (c.code !== null) {
    need(c.code && typeof c.code === "object" && !Array.isArray(c.code), "code must be an object or null");
    if (c.code && typeof c.code === "object") {
      for (const k of Object.keys(c.code)) if (!["root"].includes(k)) bad.push(`code: unknown key "${k}"`);
      need(typeof c.code.root === "string" && c.code.root, "code.root must be a non-empty string");
    }
  }

  need(c.checks && typeof c.checks === "object", "checks must be an object");
  if (c.checks) {
    for (const k of Object.keys(c.checks)) {
      if (!CHECK_KEYS.has(k)) bad.push(`checks: unknown key "${k}"`);
    }
    const ids = new Set((c.types || []).map((t) => t.id));
    need(ids.has(c.checks.orphanType), `checks.orphanType "${c.checks.orphanType}" is not a declared type`);
    // silent-index's visibility floor (rule 5.5) — a fraction in (0, 1].
    need(
      c.checks.silentIndexThreshold === undefined ||
        (typeof c.checks.silentIndexThreshold === "number" &&
          c.checks.silentIndexThreshold > 0 &&
          c.checks.silentIndexThreshold <= 1),
      "checks.silentIndexThreshold must be a number in (0, 1]"
    );
    for (const k of ["workOrdersPerRequirement", "wordsPerApprovedRequirement", "linesPerWorkOrder"]) {
      const v = c.checks[k];
      need(v === undefined || (Number.isInteger(v) && v >= 1), `checks.${k} must be an integer >= 1`);
    }
    need(
      c.checks.openAssumptionsPerApproved === undefined ||
        (typeof c.checks.openAssumptionsPerApproved === "number" && c.checks.openAssumptionsPerApproved >= 0),
      "checks.openAssumptionsPerApproved must be a number >= 0"
    );
    need(c.checks.severity && typeof c.checks.severity === "object", "checks.severity must be an object");
    for (const [rule, sev] of Object.entries(c.checks.severity || {})) {
      if (!RULES.has(rule)) bad.push(`checks.severity: unknown rule "${rule}"`);
      if (!SEVERITIES.has(sev)) bad.push(`checks.severity["${rule}"]: must be one of ${[...SEVERITIES].join(", ")}`);
    }
    for (const rule of RULES) {
      need(c.checks.severity?.[rule] !== undefined, `checks.severity is missing rule "${rule}"`);
    }
  }

  need(c.archive === undefined || c.archive === null || (typeof c.archive === "string" && /^[A-Za-z0-9_.-]+$/.test(c.archive)),
    "archive must be a single directory name under docsRoot (or null)");

  for (const k of ["bodyCap", "rowCap", "charterCap"]) {
    need(c[k] === null || (Number.isInteger(c[k]) && c[k] > 0), `${k} must be null or a positive integer`);
  }

  if (bad.length) {
    throw new ConfigError(
      `factory.config.json is invalid — refusing to start:\n  - ${bad.join("\n  - ")}`
    );
  }
  return c;
}

/**
 * Load the effective config for a project root.
 * @param {string} projectRoot
 * @param {{configPath?: string, defaults?: string}} [opts]
 */
export function loadConfig(projectRoot, opts = {}) {
  const defaults = readJson(opts.defaults || defaultsPath(), "the shipped default grammar");
  const projectPath = opts.configPath || join(projectRoot, "factory.config.json");

  let effective = defaults;
  let source = "defaults only";
  if (existsSync(projectPath)) {
    const over = readJson(projectPath, "the project's factory.config.json");
    // Validate the deviations against the same key set before merging, so a
    // typo is reported against the file the user actually wrote.
    for (const k of Object.keys(over)) {
      if (!TOP_KEYS.has(k)) {
        throw new ConfigError(`${projectPath}: unknown key "${k}" — declare only deviations from the shipped grammar`);
      }
    }
    effective = merge(defaults, over);
    source = projectPath;
  }
  return { config: validate(effective), source, projectRoot };
}
