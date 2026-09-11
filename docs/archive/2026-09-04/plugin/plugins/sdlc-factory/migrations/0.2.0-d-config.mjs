// Doctrine 0.2.0 — a project's own factory.config.json deviations catch up.
//
// factory.config.json declares only DEVIATIONS from the shipped default
// grammar (console/src/config.mjs merges the rest in) — so this migration
// touches the project's own file, never the plugin's shipped
// templates/factory.config.json, and only three things:
//
//   1. `types` entries for CON/ASM (the two table-shaped legacy artifact
//      types) are removed, if a project declared them explicitly. Rule 2.3
//      retires CON/ASM as artifacts; a project that still lists them as
//      `table`-shaped types would have the checker keep scraping registry
//      rows that 0.2.0-b just archived.
//   2. `grammar` is set to `"front-matter"` — but ONLY when the key is
//      absent entirely. A project that explicitly wrote `"head-block"` made
//      that choice on purpose and keeps it; this migration does not
//      overwrite an explicit declaration (rule 2.2a — not retroactive).
//   3. Every other change is a NOTE, never a write: which top-level keys the
//      0.2.0 shipped default now provides that this project's file doesn't
//      override (and therefore already inherits for free — nothing to do,
//      just worth knowing).
//
// No project config at all → the minimal file is created:
// `{ "grammar": "front-matter" }`.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const version = "0.2.0";
export const describe = () => "factory.config.json: CON/ASM types dropped, grammar defaulted to front-matter";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = dirname(HERE); // migrations/ → plugins/sdlc-factory
const CONFIG_REL = "factory.config.json";

export async function migrate(ctx) {
  if (!ctx.existsRoot(CONFIG_REL)) {
    const minimal = { grammar: "front-matter" };
    ctx.writeRoot(CONFIG_REL, JSON.stringify(minimal, null, 2) + "\n");
    ctx.log(`  ${CONFIG_REL}: none present — created the minimal { "grammar": "front-matter" }`);
    return;
  }

  const raw = ctx.readRoot(CONFIG_REL);
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    ctx.log(`  ${CONFIG_REL}: not valid JSON (${e.message}) — refusing to touch it, fix by hand first`);
    return;
  }

  let changed = false;

  if (Array.isArray(cfg.types)) {
    const before = cfg.types.length;
    cfg.types = cfg.types.filter((t) => t?.id !== "CON" && t?.id !== "ASM");
    if (cfg.types.length !== before) {
      ctx.log(`  ${CONFIG_REL}: removed ${before - cfg.types.length} retired table-type entry(ies) (CON/ASM — rule 2.3)`);
      changed = true;
    }
  }

  if (!("grammar" in cfg)) {
    cfg.grammar = "front-matter";
    ctx.log(`  ${CONFIG_REL}: grammar was absent — set to "front-matter"`);
    changed = true;
  } else if (cfg.grammar !== "front-matter") {
    ctx.log(`  ${CONFIG_REL}: grammar is explicitly "${cfg.grammar}" — left as declared (not overwritten; rule 2.2a)`);
  }

  if (changed) {
    ctx.writeRoot(CONFIG_REL, JSON.stringify(cfg, null, 2) + "\n");
  }

  // Note-only: top-level keys the 0.2.0 shipped default provides that this
  // project's own deviations file doesn't mention — already inherited via
  // console/src/config.mjs's merge, nothing to write.
  const defaultsPath = join(PLUGIN_ROOT, "templates/factory.config.json");
  if (existsSync(defaultsPath)) {
    const shipped = JSON.parse(readFileSync(defaultsPath, "utf8"));
    const newlyProvided = Object.keys(shipped).filter((k) => !(k in cfg));
    if (newlyProvided.length) {
      ctx.log(`  ${CONFIG_REL}: inherits ${newlyProvided.length} field(s) from the 0.2.0 shipped default without declaring them — ${newlyProvided.join(", ")} (informational, no action needed)`);
    }
  }
}
