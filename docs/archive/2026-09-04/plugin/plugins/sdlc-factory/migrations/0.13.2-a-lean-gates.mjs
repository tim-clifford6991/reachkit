// Doctrine 0.13.2 — lean mode. A stated no-op, and the statement is the point.
//
// Three of this rung's four changes cannot touch a corpus at all: gates per
// wave is when a verb runs, the context pack is computed at dispatch time
// and stored nowhere, and rule 2.6's floor is an authoring bar that governs
// what the planner cuts next. The fourth, `risk:`, is a new front-matter
// field whose ABSENCE already means `normal` — the parser reads it that way
// and `high-risk-without-mutation` only ever fires on `high`.
//
// So this writes nothing, on purpose. Backfilling `risk: normal` into every
// existing order would be a rewrite of every work order in a corpus to
// state what the grammar already says by default — noise in a diff, and a
// claim ("this order was assessed and found normal") that no script is in a
// position to make. The planner makes that call when it cuts an order, from
// the seams the charter names (constitution §8).
//
// What it does instead is count and say, so the owner can see what the new
// gates will and will not report on the next `--check`. The 0.6.0-a
// precedent: a stated no-op is a migration, and history is not invented.

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const version = "0.13.2";
export const describe = () => "stated no-op: risk defaults to normal, and nothing else this rung changes lives in a corpus";

export async function migrate(ctx) {
  const woType = ctx.config.types.find((t) => t.id === "WO" && t.dir);
  if (!woType) {
    ctx.log('  no "WO" type with a "dir" in factory.config.json — nothing to count');
    return;
  }
  const dir = join(ctx.docsRoot, woType.dir);
  if (!existsSync(dir)) {
    ctx.log(`  ${woType.dir}/: not present — no work order to count`);
    return;
  }

  const { splitFrontmatter } = ctx.frontmatter;
  let total = 0, declared = 0, high = 0, done = 0, unparsed = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_")).sort()) {
    let fm;
    try { ({ data: fm } = splitFrontmatter(ctx.read(join(woType.dir, f)))); } catch { unparsed++; continue; }
    if (!fm) { unparsed++; continue; }
    total++;
    const risk = String(fm.risk ?? "").trim().toLowerCase();
    if (risk) declared++;
    if (risk === "high") high++;
    if (String(fm.status ?? "").trim().toLowerCase() === "done") done++;
  }

  ctx.log(`  ${total} work order${total === 1 ? "" : "s"} read: ${declared} declare risk (${high} high), ` +
    `${total - declared} read as normal by default — nothing written, and nothing needs to be`);
  if (high) {
    ctx.log(`  ${high} order${high === 1 ? "" : "s"} already declare risk: high — each needs a \`Mutation:\` line ` +
      "in the validation section covering it before it can reach done (high-risk-without-mutation, error)");
  }
  if (done) {
    ctx.log(`  ${done} order${done === 1 ? "" : "s"} ${done === 1 ? "is" : "are"} already done — validation is found through the ` +
      "`validates` edge from now on, which a per-order TST section satisfies exactly as before; " +
      "a wave-level section is what the NEXT wave writes");
  }
  if (unparsed) {
    ctx.log(`  ${unparsed} work order${unparsed === 1 ? "" : "s"} could not be read as front-matter — skipped, not patched around`);
  }
}
