// Doctrine 0.12.0 — durability classes and the archive (rules 5.8, 7.5).
//
// Nothing in a corpus carries the class: the config does, per type, and the
// shipped default now declares it for all six types. Two things a corpus
// may lack and this backfills, refusing to guess on the one that is a
// decision:
//
//   (a) `archive/.gitkeep` — the directory `factory-console pivot` writes
//       into, installed from the plugin's own skeleton the way 0.5.0-a
//       installed registry/waves.md. Never a file inside it: a pivot is a
//       real decision, not something a script infers.
//   (b) a project whose factory.config.json declares its own `types`
//       (every head-block corpus; the gate archive) gets one log line per
//       type lacking `durability` and NOTHING written — which types survive
//       a pivot is the owner's call (the CON/ASM notice in 0.5.0-a is the
//       precedent). `pivot` refuses such a project until the owner declares.
//
// Refuses to guess, always: an existing archive/ is left as it is; a config
// that fails to parse gets the notice skipped rather than a wrong read.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const version = "0.12.0";
export const describe = () => "durability classes: install archive/.gitkeep; notice for a project-declared types list without durability";

export async function migrate(ctx) {
  const rel = `${ctx.config.archive || "archive"}/.gitkeep`;
  if (ctx.exists(rel) || ctx.exists(ctx.config.archive || "archive")) {
    ctx.log(`  ${ctx.config.archive || "archive"}/ already present — left as it is`);
  } else {
    ctx.write(rel, "");
    ctx.log(`  installed ${rel} — the directory factory-console pivot archives into (rule 7.5)`);
  }

  if (ctx.existsRoot("factory.config.json")) {
    let own = null;
    try { own = JSON.parse(ctx.readRoot("factory.config.json")); } catch { own = null; }
    if (own && Array.isArray(own.types)) {
      const missing = own.types.filter((t) => t && t.dir && !t.durability).map((t) => t.id);
      if (missing.length) {
        ctx.log(`  factory.config.json declares its own types without a durability class: ${missing.join(", ")} — ` +
          `declare "durable" or "derived" per type before factory-console pivot can run here (rule 5.8); nothing written — which types survive a pivot is the owner's call`);
      } else {
        ctx.log("  factory.config.json's own types all carry a durability class");
      }
    }
  }
}
