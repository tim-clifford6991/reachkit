// Doctrine 0.8.0 — `ui:` moves into front-matter.
//
// The 2026-08-29 pre-flight audit found the front-matter grammar's worst
// seam: the doctrine told planners to write `- UI: yes` as a head bullet
// (work-orders/_TEMPLATE.md), while extractFrontMatter() read only the YAML
// block and hardcoded `ui: false` on every node. Rule 7.3's UX-preview gate
// — the librarian's fourth `done` condition — was therefore mechanically
// unenforceable: the console's "UI gated" pill could never light, and
// `field-vocabulary` could never fire. 0.8.0 makes front-matter the field's
// one home (`ui: yes` / `ui: no`), the parser reads it, and this migration
// carries the existing bullets up.
//
// This rewrites work-order files of FRONT-MATTER corpora only:
//
//   ---                       ---
//   status: approved          status: approved
//   ---                  →    ui: yes
//   - UI: yes                 ---
//   (bullet removed — front-matter is now the one copy; a surviving bullet
//    would be the second copy rule 2.4 forbids)
//
// A head-block corpus is untouched: its grammar still reads `- UI:` head
// lines, and 0.1.0 already normalised those.
//
// Refuses to guess, always:
//   - a value other than exactly yes/no (0.1.0 normalised these; anything
//     else今 is prose drift) — bullet left in place, logged, and
//     `field-vocabulary` keeps reporting it;
//   - a file already carrying `ui:` in front-matter — skipped (idempotent),
//     and a disagreeing leftover bullet is logged, never adjudicated;
//   - a file with no front-matter fence — not yet migrated to 0.2.0's
//     grammar; left for that migration's own path, never half-rewritten;
//   - a WO with no UI bullet at all — nothing written: an absent `ui:` reads
//     as false at parse time, and inventing a declaration nobody made is
//     exactly what every migration in this set refuses to do.

import { readdirSync } from "node:fs";
import { join } from "node:path";

export const version = "0.8.0";
export const describe = () => "ui: moves from a head bullet into front-matter (front-matter grammar only)";

const TRUE = new Set(["yes"]);
const FALSE = new Set(["no"]);

export async function migrate(ctx) {
  if (ctx.config.grammar !== "front-matter") {
    ctx.log("  head-block grammar — `- UI:` head lines are that grammar's own field; nothing to migrate");
    return;
  }
  const woType = ctx.config.types.find((t) => t.id === "WO" && t.dir);
  if (!woType) {
    ctx.log("  no file-shaped WO type in this project's config — nothing to migrate");
    return;
  }

  let files;
  try {
    files = readdirSync(join(ctx.docsRoot, woType.dir)).sort();
  } catch {
    ctx.log(`  no ${woType.dir}/ directory — nothing to migrate`);
    return;
  }

  let rewritten = 0, unmapped = 0;

  for (const f of files) {
    if (!f.endsWith(".md") || f.startsWith("_")) continue;
    const rel = `${woType.dir}/${f}`;
    const text = ctx.read(rel);
    const lines = text.split("\n");

    if (lines[0] !== "---") continue; // pre-0.2.0 file — not this migration's problem
    const fenceEnd = lines.indexOf("---", 1);
    if (fenceEnd === -1) continue; // malformed fence — the parser reports it; never half-rewrite

    const hasUiField = lines.slice(1, fenceEnd).some((l) => /^ui\s*:/.test(l));

    // The head region: after the fence, above the first `## ` heading —
    // the only place the old grammar put the bullet.
    let headEnd = lines.findIndex((l, i) => i > fenceEnd && l.startsWith("## "));
    if (headEnd === -1) headEnd = lines.length;

    let bulletAt = -1, bool = null, rawValue = null;
    for (let i = fenceEnd + 1; i < headEnd; i++) {
      const m = lines[i].replace(/\*\*/g, "").match(/^\s*-\s+[Uu][Ii]\s*:\s*(.*)$/);
      if (!m) continue;
      bulletAt = i;
      rawValue = m[1].replace(/[*`]/g, "").trim();
      const word = (rawValue.toLowerCase().match(/^[a-z]+/) || [""])[0];
      bool = TRUE.has(word) && rawValue.toLowerCase() === word ? "yes"
           : FALSE.has(word) && rawValue.toLowerCase() === word ? "no"
           : null;
      break; // first bullet decides; a second is drift for field-vocabulary
    }

    if (bulletAt === -1) continue; // no bullet, nothing declared — write nothing

    if (hasUiField) {
      ctx.log(`  ${rel}: front-matter already carries ui: — leftover \`- UI:\` bullet left for a human`);
      unmapped++;
      continue;
    }
    if (!bool) {
      // Refuse to guess. A wrong boolean silently opens or closes a gate.
      ctx.log(`  ${rel}: cannot map "UI: ${(rawValue || "").slice(0, 60)}" — left unchanged`);
      unmapped++;
      continue;
    }

    const out = [...lines];
    out.splice(bulletAt, 1);
    // Insert after status: when present (the template's order), else at the
    // fence — position is cosmetic; the parser reads keys, not order.
    const statusAt = out.slice(1, fenceEnd).findIndex((l) => /^status\s*:/.test(l));
    out.splice(statusAt === -1 ? fenceEnd : statusAt + 2, 0, `ui: ${bool}`);
    ctx.write(rel, out.join("\n"));
    rewritten++;
  }

  ctx.log(`  ${rewritten} work order${rewritten === 1 ? "" : "s"} rewritten` +
    (unmapped ? `, ${unmapped} left for a human` : ""));
}
