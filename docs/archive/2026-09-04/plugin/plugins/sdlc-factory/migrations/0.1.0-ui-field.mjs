// Doctrine 0.1.0 — the `UI:` field becomes one key and one boolean.
//
// Finding 1 of 20-findings-reachkit.md. Measured on ReachKit v2: the value
// appeared as `no` ×85, `true` ×8, `yes` ×7, `n` ×2 and `touches` ×1, under
// two key casings (`UI:` ×95, `ui:` ×8). Rule 9c — the UX preview gate —
// cannot be evaluated mechanically against that, and a gate that cannot be
// evaluated is not a gate.
//
// This rewrites the head block of work-order files only:
//
//   - ui: true                                     →  - UI: yes
//   - **UI: touches**                              →  - UI: yes
//   - UI: no — if yes: Preview: …/WO-007.html      →  - UI: no
//   - UI: yes — Preview: x.html | signed-off: 5/8  →  - UI: yes
//                                                     - Preview: x.html
//                                                     - Signed-off: 5/8
//
// It deliberately does NOT touch prose, tables, or anything below the first
// `## ` heading — only the declared field. Nothing that cannot be mapped with
// certainty is rewritten; unknown values are left alone and reported, and
// `field-vocabulary` keeps flagging them.

import { readdirSync } from "node:fs";
import { join } from "node:path";

export const version = "0.1.0";
export const describe = () => "UI: becomes one key and one boolean (yes/no)";

const TRUE = new Set(["yes", "true", "touches"]);
const FALSE = new Set(["no", "n", "false"]);
// Longest tail still readable as a preview clause rather than an argument.
// A path, an optional "(planned)" and a sign-off date fit inside this.
const PREVIEW_CLAUSE_MAX = 120;

export async function migrate(ctx) {
  const woType = ctx.config.types.find((t) => t.id === "WO" && t.dir);
  if (!woType) {
    ctx.log("no file-shaped WO type in this project's config — nothing to migrate");
    return;
  }

  let files;
  try {
    files = readdirSync(join(ctx.docsRoot, woType.dir)).sort();
  } catch {
    ctx.log(`no ${woType.dir}/ directory — nothing to migrate`);
    return;
  }

  let rewritten = 0, unmapped = 0;

  for (const f of files) {
    // `_TEMPLATE.md` and `_INDEX.md` are not artifacts — the parser skips
    // them and so does this. A template's `UI: yes/no` placeholder would
    // otherwise be "migrated" into a default of `yes`.
    if (!f.endsWith(".md") || f.startsWith("_")) continue;
    const rel = `${woType.dir}/${f}`;
    const text = ctx.read(rel);
    const lines = text.split("\n");

    // The head block: everything above the first `## ` heading. The parser
    // reads link lines from here and nowhere else, so this is the only
    // region whose meaning this migration is allowed to change.
    const headEnd = lines.findIndex((l) => l.startsWith("## "));
    const limit = headEnd === -1 ? lines.length : headEnd;

    let touched = false;
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (i >= limit) { out.push(raw); continue; }

      const m = raw.replace(/\*\*/g, "").match(/^(\s*-\s+)([Uu][Ii])\s*:\s*(.*)$/);
      if (!m) { out.push(raw); continue; }

      const [, bullet, , rest] = m;

      // A bullet may wrap. Join its continuation lines into one logical value
      // before deciding anything — otherwise a wrapped field looks like prose
      // and a rewrite orphans half the sentence.
      let last = i;
      let joined = rest;
      while (last + 1 < limit && /^\s+\S/.test(lines[last + 1]) && !/^\s*-\s+[A-Za-z]/.test(lines[last + 1])) {
        joined += " " + lines[last + 1].trim();
        last++;
      }
      const value = joined.replace(/\*\*/g, "").replace(/[*`]/g, "").trim();
      const word = (value.toLowerCase().match(/^[a-z]+/) || [""])[0];
      const tail = value.slice(word.length).replace(/^[\s—–\-|,.:]+/, "");

      // What follows the boolean must be the preview clause and nothing else.
      // Where it is an argument instead — "UI: touches …, but only by deleting
      // a private helper … not a rule 9c work order" — the prose contradicts
      // the token, and no mechanical reading of it is trustworthy. Refuse,
      // and let field-vocabulary keep reporting it.
      // A tail that *opens* with the preview clause may still carry an
      // argument after it — WO-061 measured 330 characters of reasoning
      // between the path and the sign-off date. Extracting a field from that
      // does not lose the prose, it launders it: the value stops looking
      // wrong, so `field-vocabulary` stops reporting it. Length is the
      // cheapest honest proxy for "this is a clause, not a paragraph".
      const tailIsPreviewClause =
        tail === "" ||
        (tail.length <= PREVIEW_CLAUSE_MAX &&
          (/^if\s+yes\b/i.test(tail) || /^preview\s*:/i.test(tail) || /^signed[-\s]?off\b/i.test(tail)));

      let bool = TRUE.has(word) ? "yes" : FALSE.has(word) ? "no" : null;

      if (!bool || !tailIsPreviewClause) {
        // Refuse to guess. A wrong boolean here silently opens or closes a
        // gate, which is worse than leaving the line for a human.
        ctx.log(`  ${rel}: cannot map "UI: ${value.slice(0, 60)}${value.length > 60 ? "…" : ""}" — left unchanged`);
        for (let k = i; k <= last; k++) out.push(lines[k]);
        i = last;
        unmapped++;
        continue;
      }

      out.push(`${bullet}UI: ${bool}`);
      touched = true;

      // The preview clause becomes its own lines. Keep it only when the
      // boolean is true; on a `no` it was template residue.
      if (bool === "yes") {
        const preview = value.match(/([\w./-]+\/previews\/[\w.-]+\.html)(\s*\([^)]*\))?/i);
        const signed = value.match(/signed[-\s]?off\s*:?\s*([^|]+?)\s*$/i);
        if (preview) out.push(`${bullet}Preview: ${preview[1]}${preview[2] || ""}`);
        if (signed) {
          const d = signed[1].trim();
          if (d && !/^date$/i.test(d)) out.push(`${bullet}Signed-off: ${d}`);
        }
      }
      i = last;
    }

    if (touched) {
      ctx.write(rel, out.join("\n"));
      rewritten++;
    }
  }

  ctx.log(`  ${rewritten} work order${rewritten === 1 ? "" : "s"} rewritten` +
    (unmapped ? `, ${unmapped} value${unmapped === 1 ? "" : "s"} left for a human` : ""));
}
