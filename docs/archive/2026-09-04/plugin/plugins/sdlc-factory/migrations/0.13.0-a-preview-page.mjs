// Doctrine 0.13.0 — the preview sign-off happens on a published page (rule 7.3).
//
// A preview is now two things: the sheet file in the corpus, which is the
// record, and that same sheet published as an artifact, which is the owner's
// door. The URL and version are recorded in the work order's `## Log` and in
// the components.md row the sheet registers.
//
// One thing here is mechanical and one is not, and the split is the whole
// design of this file:
//
//   (a) `design/components.md` gains a `Preview` column. That is a table
//       shape, not a judgement: widen the header, widen the separator, pad
//       every existing row with `—`. Idempotent — a table that already has
//       the column is left exactly as it is. Refused, and logged, on any
//       table this cannot recognise: a header row whose cell count and the
//       separator's disagree is a hand-edited table, and a migration that
//       guesses at one corrupts it.
//
//   (b) Work orders get NOTHING written. The log line
//       `- <date> preview — design-guardian — v<n> — <url>` names a page
//       that does not exist until someone publishes the sheet, and a URL
//       is exactly the kind of value rule 1.2 forbids inventing. So this
//       counts the `ui: yes` work orders already at `approved` or `done`
//       whose logs carry no such line, names them, and stops. They are the
//       `preview-without-url` findings the checker will now report every
//       run until `/design` republishes each sheet — a standing, visible
//       gap, which is the correct outcome for work built against a preview
//       nobody could open.
//
// The `Signed-off:` bullet is likewise left alone. 0.13.0 gives it a
// `— v<n>` tail naming the version the owner's word was given on; an
// existing bullet's date predates any version, and appending one would
// fabricate the fact the tail exists to record.

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const version = "0.13.0";
export const describe = () => "components.md gains a Preview column; ui: yes work orders with no published preview are named, never invented";

const COMPONENTS_REL = "design/components.md";

/** Split one markdown table row into its cells, keeping the outer pipes off. */
function cells(line) {
  const t = line.trim();
  return t.slice(1, -1).split("|").map((c) => c.trim());
}

const isTableRow = (l) => l.trim().startsWith("|") && l.trim().endsWith("|");
const isSeparator = (l) => isTableRow(l) && cells(l).every((c) => /^:?-{1,}:?$/.test(c));

export async function migrate(ctx) {
  // ── (a) components.md gains a Preview column ─────────────────────────
  if (!ctx.exists(COMPONENTS_REL)) {
    ctx.log(`  ${COMPONENTS_REL}: not present — nothing to widen`);
  } else {
    const text = ctx.read(COMPONENTS_REL);
    const lines = text.split("\n");
    const headerAt = lines.findIndex((l, i) => isTableRow(l) && !isSeparator(l) && isSeparator(lines[i + 1] || ""));
    if (headerAt === -1) {
      ctx.log(`  ${COMPONENTS_REL}: refused — no header/separator pair found; widen the table by hand (rule 7.3)`);
    } else if (cells(lines[headerAt]).some((c) => c.toLowerCase() === "preview")) {
      ctx.log(`  ${COMPONENTS_REL}: already carries a Preview column — left as it is`);
    } else {
      const width = cells(lines[headerAt]).length;
      if (cells(lines[headerAt + 1]).length !== width) {
        ctx.log(`  ${COMPONENTS_REL}: refused — header has ${width} cells, separator has ` +
          `${cells(lines[headerAt + 1]).length}; a hand-edited table is not this script's to rewrite`);
      } else {
        let widened = 0, skipped = 0;
        for (let i = headerAt; i < lines.length; i++) {
          if (!isTableRow(lines[i])) {
            // The table ends at the first non-row line — a components.md may
            // hold prose or a second table below it, neither of them ours.
            if (i > headerAt + 1) break;
            continue;
          }
          const c = cells(lines[i]);
          if (c.length !== width) { skipped++; continue; }
          if (i === headerAt) c.push("Preview");
          else if (i === headerAt + 1) c.push("---");
          else c.push("—");
          lines[i] = `| ${c.join(" | ")} |`;
          if (i > headerAt + 1) widened++;
        }
        ctx.write(COMPONENTS_REL, lines.join("\n"));
        ctx.log(`  ${COMPONENTS_REL}: Preview column added — ${widened} component row${widened === 1 ? "" : "s"} ` +
          `padded with —${skipped ? `, ${skipped} ragged row${skipped === 1 ? "" : "s"} left untouched` : ""}`);
      }
    }
  }

  // ── (b) ui: yes work orders in implementation — named, never written ──
  const woType = ctx.config.types.find((t) => t.id === "WO" && t.dir);
  if (!woType) {
    ctx.log('  no "WO" type with a "dir" in factory.config.json — no work order can be read');
    return;
  }
  const dir = join(ctx.docsRoot, woType.dir);
  if (!existsSync(dir)) {
    ctx.log(`  ${woType.dir}/: not present — no work order to read`);
    return;
  }

  const { splitFrontmatter } = ctx.frontmatter;
  const IN_IMPLEMENTATION = new Set(["approved", "done"]);
  const naked = [];
  let unparsed = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_")).sort()) {
    const raw = ctx.read(join(woType.dir, f));
    let fm, body;
    try {
      ({ data: fm, body } = splitFrontmatter(raw));
    } catch {
      unparsed++;
      continue;
    }
    if (!fm) { unparsed++; continue; }
    const ui = String(fm.ui ?? "").trim().toLowerCase();
    const status = String(fm.status ?? "").trim().toLowerCase();
    if (ui !== "yes" || !IN_IMPLEMENTATION.has(status)) continue;
    const logged = (body || "").split("\n").some(
      (l) => /^\s*[-*]\s/.test(l) && /\bpreview\b/i.test(l) && /https?:\/\/\S+/.test(l)
    );
    if (!logged) naked.push(`${fm.id || f} (${status})`);
  }

  if (unparsed) {
    ctx.log(`  ${unparsed} work order${unparsed === 1 ? "" : "s"} could not be read as front-matter — skipped, not patched around`);
  }
  if (naked.length) {
    ctx.log(`  ${naked.length} ui: yes work order${naked.length === 1 ? "" : "s"} in implementation with no published preview: ` +
      `${naked.join(", ")} — nothing written (a URL is not this script's to invent, rule 1.2). ` +
      "Republish each sheet with /design; `preview-without-url` reports them until you do");
  } else {
    ctx.log("  every ui: yes work order in implementation already logs a published preview");
  }
}
