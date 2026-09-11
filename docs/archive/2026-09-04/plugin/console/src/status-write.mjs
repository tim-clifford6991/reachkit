// The one mutation this console is ever allowed to make: an artifact's
// `status:` field, and nothing else.
//
// It exists because the read-only console had one honest gap — an owner
// reading a journey and satisfied with it had to leave the tool to flip one
// word. ADR-003 records the decision. The guard rails are deliberately
// narrow and all of them live here or in serve.mjs's POST route:
//
//   * front-matter grammar only. A head-block corpus is REFUSED, not
//     guessed at — the head-block `- **Status:** approved` bullet has
//     wrapping and bold-marker variants this module would have to
//     re-derive, and a migration's own rule applies: refuse rather than
//     guess. Those corpora keep the pre-0.9 behaviour exactly.
//   * one line changes. The rewrite is a line splice inside the fence; every
//     other byte of the file, front matter included, is preserved.
//   * the caller must say what it thinks the current value is. The corpus is
//     written by agents concurrently with a browser tab being open, so a
//     blind write would silently clobber an agent's transition. A mismatch
//     is a conflict, reported, never resolved by preference.
//
// Vocabulary validation is NOT here: it needs the project's config and the
// node's type, both of which the route already holds. This module's contract
// is "rewrite this file's status line safely"; deciding whether the value is
// legal for that artifact type is the route's job.

import { readFileSync, writeFileSync } from "node:fs";

import { splitFrontmatter } from "./extract/frontmatter.mjs";

const OPEN = "---\n";

/** A status token safe to write bare. Every value in every shipped
 *  vocabulary is of this shape (`approved`, `pass-with-findings`); anything
 *  else is refused rather than quoted, because a status that needs quoting
 *  is a sign the caller is writing something that is not a status. */
const BARE_TOKEN = /^[A-Za-z][A-Za-z0-9_-]*$/;

export class StatusWriteError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Locate the front-matter fence exactly as splitFrontmatter() does, so the
 * two can never disagree about where the block ends. Returns null when the
 * file has no fence at byte 0.
 */
function fenceBounds(text) {
  if (!text.startsWith(OPEN)) return null;
  let close = text.indexOf("\n---\n", OPEN.length - 1);
  if (close === -1) {
    if (!text.endsWith("\n---")) return null;
    close = text.length - 4;
  }
  return { start: OPEN.length, end: close };
}

/**
 * Return `raw` with its front-matter `status:` value changed from `from` to
 * `to`, or throw a StatusWriteError explaining why it would not be safe.
 *
 * Pure — takes and returns text, touches no filesystem — so the whole
 * refusal matrix is testable without a corpus on disk.
 *
 * @param {string} raw   the artifact file's current full text
 * @param {string} from  the status the caller believes is currently set
 * @param {string} to    the status to write
 * @returns {string}     the new full text
 */
export function rewriteStatus(raw, from, to) {
  if (!BARE_TOKEN.test(String(to || ""))) {
    throw new StatusWriteError("BADVALUE", `refused: ${JSON.stringify(to)} is not a bare status token`);
  }

  const bounds = fenceBounds(raw);
  if (!bounds) {
    throw new StatusWriteError("NOFM",
      "refused: this artifact has no front-matter block. The console writes the front-matter grammar only — " +
      "a head-block corpus must be migrated with `factory upgrade` first.");
  }

  // Parse before touching anything: a malformed block throws here rather
  // than being spliced into something differently malformed.
  let data;
  try {
    ({ data } = splitFrontmatter(raw));
  } catch (e) {
    throw new StatusWriteError("MALFORMED", `refused: ${e.message}`);
  }
  if (!data) {
    throw new StatusWriteError("NOFM", "refused: this artifact has no front-matter block.");
  }

  const current = data.status == null ? null : String(data.status);
  if (current !== (from == null ? null : String(from))) {
    throw new StatusWriteError("CONFLICT",
      `refused: this artifact's status is now ${JSON.stringify(current)}, not ${JSON.stringify(from)} — ` +
      "something else wrote it while this page was open. Reload and try again.");
  }
  if (current === to) return raw; // already there; a no-op write is not a failure

  const block = raw.slice(bounds.start, bounds.end);
  const lines = block.split("\n");
  const at = lines.findIndex((l) => /^status:(?:[ \t].*)?$/.test(l));
  if (at === -1) {
    throw new StatusWriteError("NOSTATUS", "refused: no `status:` line in this artifact's front matter.");
  }
  lines[at] = `status: ${to}`;
  return raw.slice(0, bounds.start) + lines.join("\n") + raw.slice(bounds.end);
}

/**
 * Apply rewriteStatus() to a file. The path must already have been validated
 * against the project's docs root by the caller — this module never resolves
 * a path itself, so it cannot become a second, weaker traversal check that
 * drifts from serve.mjs's.
 */
export function writeStatus(absPath, from, to) {
  const raw = readFileSync(absPath, "utf8");
  const next = rewriteStatus(raw, from, to);
  if (next !== raw) writeFileSync(absPath, next, "utf8");
  return next;
}
