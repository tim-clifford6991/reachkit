// Doctrine 0.2.0 — the three hand-authored registries retire.
//
// Rule 2.3: a conflict is a `blocked-by` edge, an assumption is a `rests-on`
// row — CON and ASM are states carried on the owning artifact's own front
// matter, not files. `registry/traceability.md`, `registry/conflicts.md` and
// `registry/assumptions.md` are the pre-0.2.0 hand-authored registries this
// retires; `registry/generated/*` (built by the librarian from front-matter,
// never hand-edited — rule 5.1) is what replaces them.
//
// Two outcomes per file, decided by one byte comparison against the OLD
// 0.1.0 skeleton stub (the empty header-and-table-row template every fresh
// project started from, reconstructed from git history at commit f268525^ —
// before this doctrine dropped the three files from
// templates/docs-skeleton/registry/ in favour of generated/):
//
//   - byte-identical to the stub → the project never populated it. Delete —
//     there is nothing here to preserve.
//   - anything else → it has real rows. NEVER deleted. Prepend a dated
//     ⛔ ARCHIVED banner naming the superseding generated/ path and stating
//     that no new CON-###/ASM-### is allocated, here or anywhere (rule 2.3).
//     The pattern is ReachKit v2's own archived registries
//     (sdlc-factory/docs/registry/{traceability,conflicts,assumptions}.md
//     there), condensed: this runs unattended across many projects, so the
//     banner states the fact and the citation, not a narrative investigation.
//
// Also creates `registry/generated/` (with the README from this plugin's own
// docs-skeleton) wherever it does not exist yet — the destination the banner
// points a reader at.
//
// Idempotent: a file already carrying the ⛔ ARCHIVED marker at its top is
// left alone; the README is only (re)written when missing or stale.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const version = "0.2.0";
export const describe = () => "the pre-0.2.0 hand-authored registries are deleted (empty) or archived (populated)";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = dirname(HERE); // migrations/ → plugins/sdlc-factory

// The OLD 0.1.0 skeleton stubs, byte-for-byte — `git show f268525^:plugins/
// sdlc-factory/templates/docs-skeleton/registry/<name>.md`. A project's file
// is deleted only when it matches one of these EXACTLY; any deviation at all
// (even one added row) routes to archive instead.
const OLD_STUBS = {
  "traceability.md":
`# Traceability Registry

> Owned by the librarian. One row per REQ, carrying the whole chain.
>
> **Rule 1: the artifact file wins.** This registry is the copy. Where they
> disagree, \`--check\` reports the row here as the thing to fix, never the file.
>
> Statuses here must match the artifact's own \`- Status:\` line exactly.

| REQ | Status | BP IDs | WO IDs | TST results | FB IDs | Notes |
|---|---|---|---|---|---|---|
`,
  "conflicts.md":
`# Conflict Registry

> Rule 5: a conflict freezes every dependent artifact until it is resolved.
> Never resolve one silently, even when one side seems obviously right.
>
> Each row is an artifact in its own right — \`CON-###\` — parsed from this
> table, not from a file. The first column must be the bare ID and the header
> row must begin with \`ID\`, or the parser will not see the rows.

| ID | Artifacts | Description, evidence, and the ruling applied | Detected by | Status |
|---|---|---|---|---|
`,
  "assumptions.md":
`# Assumption Registry

> Rule 4: if proceeding requires an assumption, log it here as \`ASM-###\` with
> status \`unconfirmed\` and surface it in the same reply. An unconfirmed
> assumption blocks the \`approved\` status of anything that depends on it.
>
> Each row is an artifact — \`ASM-###\` — parsed from this table. The first
> column must be the bare ID and the header row must begin with \`ID\`.

| ID | Assumption | Made by | Affects | Blocks, precisely | Status |
|---|---|---|---|---|---|
`,
};

// The generated/ path each superseded file points a reader at, and whether
// its own rows carry a CON-###/ASM-### id worth disclaiming.
const SUPERSEDES = {
  "traceability.md": { by: "generated/traceability.md", idPrefix: null },
  "conflicts.md": { by: "generated/blocked.md", idPrefix: "CON" },
  "assumptions.md": { by: "generated/assumptions.md", idPrefix: "ASM" },
};

const ARCHIVE_MARKER = "⛔ ARCHIVED";
// How far down to look for it: enough for a title and a blank line above the
// banner, short enough that a mention of the marker in a table row is not one.
const ARCHIVE_HEAD_LINES = 20;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function banner(name, content) {
  const { by, idPrefix } = SUPERSEDES[name];
  const lines = [
    `> # ${ARCHIVE_MARKER} ${today()} — superseded by [\`${by}\`](${by})`,
    ">",
    `> This file predates the 0.2.0 front-matter migration. The live index is`,
    `> [\`${by}\`](${by}), projected from every artifact's own front-matter and`,
    `> never hand-edited (constitution rule 5.1 — an index that is authored can`,
    `> lie; an index that is derived cannot).`,
  ];
  if (idPrefix) {
    lines.push(
      `> No new \`${idPrefix}-###\` is allocated, here or anywhere — ${idPrefix === "CON" ? "a conflict is a \`blocked-by\` edge" : "an assumption is a \`rests-on\` row"}`,
      "> on the artifact that declares it now (constitution rule 2.3).",
    );
  }
  lines.push(
    ">",
    "> The rows below are frozen history. Do not add to them, and do not cite",
    "> them as current.",
    "",
    "",
  );
  return lines.join("\n") + content;
}

export async function migrate(ctx) {
  let deleted = 0, archived = 0, alreadyArchived = 0, absent = 0;

  for (const name of Object.keys(OLD_STUBS)) {
    const rel = `registry/${name}`;
    if (!ctx.exists(rel)) {
      absent++;
      continue;
    }
    const content = ctx.read(rel);

    // A corpus that archived by hand before this migration existed keeps its
    // H1 above the banner, so "the banner is the first line" is the wrong
    // test — it reports such a file as unarchived and stacks a second banner
    // on it. The marker anywhere in the head region is the fact being tested.
    if (content.split("\n", ARCHIVE_HEAD_LINES).some((l) => l.includes(ARCHIVE_MARKER))) {
      alreadyArchived++;
      continue;
    }

    if (content === OLD_STUBS[name]) {
      ctx.remove(rel);
      ctx.log(`  ${rel}: byte-identical to the 0.1.0 stub — deleted`);
      deleted++;
      continue;
    }

    ctx.write(rel, banner(name, content));
    ctx.log(`  ${rel}: has real rows — archived, never deleted (superseded by ${SUPERSEDES[name].by})`);
    archived++;
  }

  // registry/generated/README.md — created wherever missing or stale.
  const readmePath = join(PLUGIN_ROOT, "templates/docs-skeleton/registry/generated/README.md");
  const readme = readFileSync(readmePath, "utf8");
  const genRel = "registry/generated/README.md";
  const existing = ctx.exists(genRel) ? ctx.read(genRel) : null;
  if (existing !== readme) {
    ctx.write(genRel, readme);
    ctx.log(`  ${genRel}: ${existing === null ? "created" : "refreshed"} from this plugin's docs-skeleton`);
  }

  ctx.log(`  registries: ${deleted} deleted (empty), ${archived} archived (had rows), ${alreadyArchived} already archived, ${absent} not present`);
}
