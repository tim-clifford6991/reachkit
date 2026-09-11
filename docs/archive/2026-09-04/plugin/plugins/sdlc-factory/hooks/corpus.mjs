// Shared knowledge for both hooks: where a corpus is, who owns each part of
// it, and which verb gets you there.
//
// The ownership table below is a transcription of constitution §4's agent
// table, not a second opinion about it. If §4 changes, this changes in the
// same commit — the same "one repository, one release" rule the parser and
// the grammar already live under. A hook that enforces a stale ownership map
// is worse than no hook, because it refuses correct work with confidence.

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const DEFAULT_DOCS_ROOT = "sdlc-factory/docs";

/**
 * The directories that hold artifacts — the files an agent authors and the
 * checker parses. Guarded on both creation and edit: inventing `REQ-045.md`
 * out of a conversation, with no analyst and no review rounds, is the exact
 * failure this hook exists to stop.
 */
export const ARTIFACT_DIRS = new Set([
  "requirements", "journeys", "blueprints", "decisions", "work-orders", "feedback",
]);

/**
 * Directories that are generated or curated rather than authored. Guarded
 * only once the file already exists — creating them is what `/factory-init`
 * does, from the main model, before any agent exists to do it. See
 * `guard-corpus-write.mjs` for why that asymmetry is the whole scaffolding
 * exemption.
 */
export const CURATED_DIRS = new Set(["registry", "design"]);

/**
 * Written by `factory-console pivot` alone, from the shell — never by an
 * agent, never by the main session (constitution rule 7.5, 0.12.0). Refused
 * on creation and on edit, whoever asks: an archive is the record of a
 * decision, and a record that can be edited after the fact is not one.
 */
export const ARCHIVE_DIRS = new Set(["archive"]);

/** Never guarded, wherever they sit: scaffolding furniture, not corpus. */
export const EXEMPT_FILES = new Set(["_TEMPLATE.md", ".gitkeep", "README.md", "00-project.md", "CLAUDE.md"]);

/**
 * Per-directory ownership, from constitution §4.
 *
 * Two agents are deliberately universal rather than listed per row:
 *
 *   librarian — §4 gives it "`registry/`, statuses", and a status lives in
 *     the front matter of the artifact it describes, so a librarian edit
 *     lands in every type directory by design.
 *   reviewer  — §4 gives it "nothing" to own, but its job is leaving typed
 *     open questions ON another agent's artifact, and its tool list carries
 *     Edit for exactly that. Blocking it would break rule 3.4's two rounds.
 */
export const UNIVERSAL_AGENTS = ["librarian", "reviewer"];

export const OWNERS = {
  requirements: ["requirements-analyst"],
  journeys: ["requirements-analyst"],
  blueprints: ["architect"],
  decisions: ["architect"],
  // The planner authors a work order, the implementer appends its `## Log`,
  // and the validator writes the verdict that gates `done` into it. The
  // design-guardian is the fourth: rule 7.3 has it log the published
  // preview's URL and version there, and its UI-fit pass leaves
  // `REVIEW(placement)` lines under the WO's own `## Open questions`. All
  // four are correct writers of the same file at different stages.
  "work-orders": ["planner", "implementer", "validator", "design-guardian"],
  feedback: ["feedback-triage"],
  design: ["design-guardian"],
  registry: [],
};

/** The verb that would have done this properly — quoted back in the refusal,
 *  because "you should have used an agent" is not actionable and "run
 *  `/require`" is. */
export const VERBS = {
  requirements: "/require (new) · /relink or /requirement-cleanup (existing)",
  journeys: "/require",
  blueprints: "/expand-requirement (or /factory, which drives it)",
  decisions: "/decide",
  "work-orders": "/workorder · /implement · /validate",
  feedback: "/feedback",
  design: "/design",
  registry: "/sync · /wave · /factory (its state report)",
  archive: "factory-console pivot --decision ADR-### (from the shell; no verb writes here)",
};

/** Read `docsRoot` out of a project's config, tolerating anything unreadable
 *  — a malformed config must not make this hook throw and block a write. */
function docsRootOf(projectRoot) {
  try {
    const cfg = JSON.parse(readFileSync(join(projectRoot, "factory.config.json"), "utf8"));
    if (typeof cfg.docsRoot === "string" && cfg.docsRoot) return cfg.docsRoot;
  } catch { /* no config, or not JSON — fall through to the default */ }
  return DEFAULT_DOCS_ROOT;
}

/**
 * Find the corpus a path belongs to by walking up from it, or null.
 *
 * Walks rather than string-matching `/sdlc-factory/docs/` so a project that
 * declares a different `docsRoot` is still protected — and so a path that
 * merely CONTAINS those words somewhere unrelated is not.
 */
export function findCorpus(filePath) {
  if (!filePath || !isAbsolute(filePath)) return null;
  let dir = dirname(resolve(filePath));
  for (let i = 0; i < 40; i++) {
    for (const root of [docsRootOf(dir), DEFAULT_DOCS_ROOT]) {
      const docs = resolve(join(dir, root));
      const rel = relative(docs, resolve(filePath));
      if (rel && !rel.startsWith("..") && !isAbsolute(rel) && existsSync(docs)) {
        return { projectRoot: dir, docsRoot: root, docsAbs: docs, rel };
      }
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/** True when this project has a corpus at all — the switch that keeps both
 *  hooks completely inert in every non-factory repository. */
export function hasCorpus(cwd) {
  if (!cwd) return null;
  for (const root of [docsRootOf(cwd), DEFAULT_DOCS_ROOT]) {
    const docs = resolve(join(cwd, root));
    if (existsSync(docs)) return { projectRoot: cwd, docsRoot: root, docsAbs: docs };
  }
  return null;
}

/**
 * What kind of corpus file this is: `artifact`, `curated`, or `exempt`.
 * `zone` is the first path segment under the docs root, which is what the
 * ownership and verb tables are keyed on.
 */
export function classify(rel) {
  const parts = rel.split(sep).filter(Boolean);
  const file = parts[parts.length - 1] || "";
  const zone = parts.length > 1 ? parts[0] : "";
  // The archive is judged first: even a README.md or _TEMPLATE.md under it
  // is the record a pivot wrote, never furniture (rule 7.5).
  if (ARCHIVE_DIRS.has(zone)) return { kind: "archive", zone, file };
  if (EXEMPT_FILES.has(file)) return { kind: "exempt", zone, file };
  if (ARTIFACT_DIRS.has(zone)) return { kind: "artifact", zone, file };
  if (CURATED_DIRS.has(zone)) return { kind: "curated", zone, file };
  return { kind: "exempt", zone, file };
}

/**
 * Does `agentType` name an agent allowed to write in `zone`?
 *
 * Matched as a substring rather than by equality because the value the
 * harness reports for a plugin agent may or may not carry a `sdlc-factory:`
 * namespace, and guessing wrong in the strict direction would refuse every
 * legitimate agent write. Wrong in this direction merely lets a
 * similarly-named agent through, which is a far cheaper mistake.
 */
export function isOwner(agentType, zone) {
  if (!agentType) return false;
  const a = String(agentType).toLowerCase();
  const allowed = [...UNIVERSAL_AGENTS, ...(OWNERS[zone] || [])];
  return allowed.some((name) => a.includes(name));
}

/** Read the hook's stdin payload. Returns null on anything unreadable — both
 *  hooks treat that as "fail open", never as a reason to block. */
export async function readPayload() {
  try {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return null;
  }
}
