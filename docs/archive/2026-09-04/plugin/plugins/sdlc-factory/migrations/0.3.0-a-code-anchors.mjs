// Doctrine 0.3.0 — blueprints declare `code: []`, governing nothing is said,
// not implied.
//
// Rule 5.6 gives every blueprint a `code:` field: repo-relative path globs
// naming what it governs. A blueprint with no `code:` field is silent on
// the question, and silence reads as "nothing checked" rather than
// "nothing governed" (rule 5.5's own warning, extended to this field). This
// migration makes the silence explicit: every blueprint that has a valid
// front-matter block but no `code` key gets one, written as `code: []`.
//
// Nothing here is inferred — no glob is guessed from the blueprint's prose,
// its module section, or anything else. An architect fills `code:` in by
// hand once they've named the boundary; this migration only makes the
// field's absence loud instead of silent.
//
// Refuses to guess, always:
//   - no front-matter block at all (pre-0.2.0-a, not yet migrated) — logged
//     and skipped; 0.2.0-a runs first in the same upgrade and this file is
//     revisited on this same pass once it has front-matter, or on the next
//     upgrade if 0.2.0-a itself skipped it
//   - a front-matter block that fails to parse (malformed) — logged and
//     skipped, never patched around
//   - a blueprint whose front-matter already carries `code` (any value,
//     including `[]`) — left untouched, which is what makes this migration
//     idempotent
//
// Body bytes are never touched: only the front-matter block is
// re-serialised, and the body is reattached exactly as read.

import { readdirSync } from "node:fs";
import { join } from "node:path";
// The front-matter parser arrives as ctx.frontmatter (0.12.1) — one parser,
// the console's, never a copy beside the migrations.

export const version = "0.3.0";
export const describe = () => "blueprints declare code: [] — governing nothing is said, not implied";

function walk(dir) {
  return readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_")).sort();
}

export async function migrate(ctx) {
  const { splitFrontmatter, serializeFrontmatter } = ctx.frontmatter;
  const bpType = ctx.config.types.find((t) => t.id === "BP" && t.dir);
  if (!bpType) {
    ctx.log(`  no "BP" type with a "dir" in factory.config.json — nothing to anchor`);
    return;
  }

  let files;
  try {
    files = walk(join(ctx.docsRoot, bpType.dir));
  } catch {
    ctx.log(`  ${bpType.dir}/: not found — nothing to anchor`);
    return;
  }

  let anchored = 0, skipped = 0, alreadyAnchored = 0;

  for (const f of files) {
    const rel = `${bpType.dir}/${f}`;
    const text = ctx.read(rel);

    let data, body;
    try {
      ({ data, body } = splitFrontmatter(text));
    } catch (err) {
      ctx.log(`  ${rel}: malformed front-matter block (${err.message}) — left unchanged`);
      skipped++;
      continue;
    }

    if (data === null) {
      ctx.log(`  ${rel}: no front-matter block — left unchanged`);
      skipped++;
      continue;
    }

    if ("code" in data) {
      alreadyAnchored++;
      continue;
    }

    // Refuse rather than guess: a key outside FIELD_ORDER (frontmatter.mjs's
    // fixed, exhaustive key list) would otherwise be silently dropped by
    // serializeFrontmatter — caught here per file so one unknown key skips
    // only that file, not the whole migration pass.
    let fm;
    try {
      fm = serializeFrontmatter({ ...data, code: [] });
    } catch (err) {
      ctx.log(`  ${rel}: refused — ${err.message}`);
      skipped++;
      continue;
    }
    ctx.write(rel, fm + body);
    anchored++;
  }

  ctx.log(`  ${anchored} blueprint${anchored === 1 ? "" : "s"} gained code: [], ${alreadyAnchored} already anchored, ${skipped} left unchanged`);
}
