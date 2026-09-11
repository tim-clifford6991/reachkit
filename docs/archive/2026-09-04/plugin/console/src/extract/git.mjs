// Reads a git work tree: HEAD, tracked files, and commit log with WO
// references and refused ranges. The one rule: a range expression
// (`WO-145..147`, `WO-001...WO-003`, `WO-001…003`) is recorded verbatim in
// `ranges` and never expanded into `refs` — neither endpoint leaks out. A
// half-expanded range would fabricate a citation the commit never made.
//
// Pure with respect to the repo: every git invocation is read-only
// (`rev-parse`, `ls-files`, `log`). The only state is a module-level cache
// keyed on repo root, re-read only when HEAD has moved.

import { execFileSync } from "node:child_process";

const RECORD_SEP = "\x1e";
const FIELD_SEP = "\x1f";
const LOG_FORMAT = `${RECORD_SEP}%H${FIELD_SEP}%h${FIELD_SEP}%cI${FIELD_SEP}%s${FIELD_SEP}%b`;

const WO_ID = /\bWO-(\d{3})([a-z])?\b/g;
const WO_RANGE = /WO-\d{3}[a-z]?\s*(?:\.\.\.?|…)\s*(?:WO-)?\d{3}[a-z]?/g;
const NAME_STATUS = /^([AMDTUXB]|[RC]\d{0,3})\t(.+)$/;

const cache = new Map(); // root → { head, repo }

function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

/** Cheap: HEAD sha, or null when `dir` is not inside a git work tree. */
export function repoHead(dir) {
  try {
    return git(dir, ["rev-parse", "HEAD"]);
  } catch {
    return null;
  }
}

// The remainder after the four leading fields is body text followed by
// name-status lines, run together with no unambiguous separator (a
// multi-line body's own newlines look just like the blank line git inserts
// before the trailer). So classify line by line: a name-status line matches
// NAME_STATUS; every other line is body text, in original order.
function splitBodyAndFiles(remainder) {
  const bodyLines = [];
  const files = [];
  for (const line of remainder.split("\n")) {
    const m = NAME_STATUS.exec(line);
    if (m) {
      const parts = m[2].split("\t");
      files.push(parts[parts.length - 1]);
    } else if (line) {
      bodyLines.push(line);
    }
  }
  return { body: bodyLines.join("\n"), files };
}

function parseRefsAndRanges(text) {
  const ranges = [];
  const rangeSpans = [];
  WO_RANGE.lastIndex = 0;
  let rm;
  while ((rm = WO_RANGE.exec(text))) {
    ranges.push(rm[0]);
    rangeSpans.push([rm.index, rm.index + rm[0].length]);
  }

  const refs = [];
  const seen = new Set();
  WO_ID.lastIndex = 0;
  let m;
  while ((m = WO_ID.exec(text))) {
    const inRange = rangeSpans.some(([start, end]) => m.index >= start && m.index < end);
    if (inRange) continue;
    const id = `WO-${m[1]}${m[2] ?? ""}`;
    if (seen.has(id)) continue;
    seen.add(id);
    refs.push(id);
  }
  return { refs, ranges };
}

function parseLog(root) {
  const raw = execFileSync(
    "git",
    ["log", "--no-color", `--format=${LOG_FORMAT}`, "--name-status"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );

  const commits = [];
  for (const record of raw.split(RECORD_SEP)) {
    if (!record) continue;
    const parts = record.split(FIELD_SEP);
    const [sha, short, date, subject] = parts;
    const remainder = parts.slice(4).join(FIELD_SEP);
    const { body, files } = splitBodyAndFiles(remainder);
    const { refs, ranges } = parseRefsAndRanges(`${subject}\n${body}`);

    commits.push({
      sha,
      short,
      // git's %cI renders a zero UTC offset as a bare "Z" (since git 2.x);
      // normalize to "+00:00" so the field is always numeric-offset ISO-8601.
      date: date.endsWith("Z") ? `${date.slice(0, -1)}+00:00` : date,
      subject: subject.trim(),
      refs,
      ranges,
      files,
    });
  }
  return commits;
}

/** null when `dir` is not inside a git work tree. */
export function readRepo(dir) {
  let root;
  try {
    root = git(dir, ["rev-parse", "--show-toplevel"]);
  } catch {
    return null;
  }

  const head = repoHead(root);
  const cached = cache.get(root);
  if (cached && cached.head === head) return cached.repo;

  // `git ls-files` reads the INDEX, not HEAD — a file that has been
  // `git add`ed but not yet committed is already "tracked" here, even though
  // the cache below is keyed on HEAD's sha. That is by design, not a bug:
  // this cache only invalidates on a new commit ("the corpus is the
  // checkpoint" — docs/design/04-p1-backbone.md), so a newly staged file
  // becomes visible to code anchors at the next commit, not the moment it is
  // added.
  const tracked = git(root, ["ls-files"]).split("\n").filter(Boolean).sort();
  const commits = parseLog(root);
  const repo = { root, head, tracked, commits };

  cache.set(root, { head, repo });
  return repo;
}

/** `**` → `.*`, `*` → `[^/]*`, `?` → `[^/]`, anchored `^…$`. */
export function globToRegExp(glob) {
  const pattern = glob
    .split("**")
    .map((seg) =>
      seg
        .split("*")
        .map((piece) =>
          piece
            .split("?")
            .map((chunk) => chunk.replace(/[.+^${}()|[\]\\]/g, "\\$&"))
            .join("[^/]")
        )
        .join("[^/]*")
    )
    .join(".*");
  return new RegExp(`^${pattern}$`);
}
