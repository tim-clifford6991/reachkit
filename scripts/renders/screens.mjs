// scripts/renders/screens.mjs — which approved picture a screen id is (issue #404)
//
// `docs/archive/2026-09-11/approved/README.md` carries the one table that says S12 is
// `overview`, and the twenty renders sit beside it as
// `full-set/screens/<key>-light.png`. This reads that table rather than
// keeping a second copy of it: the day an artifact is re-lifted and a key
// is renamed, the composer follows without an edit here, and a key that
// stops existing fails loudly instead of composing a blank.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const REPO = path.resolve(import.meta.dirname, "../..");
const INDEX_MD = path.join(REPO, "docs/archive/2026-09-11/approved/README.md");
const SCREENS_DIR = path.join(REPO, "docs/archive/2026-09-11/approved/full-set/screens");

/**
 * Every `| S<id> | \`key\` |` row of the approved set's own index, as a map
 * from screen id to the key its renders are named after.
 */
export function approvedKeys() {
  const keys = new Map();
  for (const line of readFileSync(INDEX_MD, "utf8").split("\n")) {
    const row = line.match(/^\|\s*(S\d+)\s*\|\s*`([a-z0-9]+)`\s*\|/i);
    if (row) keys.set(row[1], row[2]);
  }
  if (keys.size === 0) {
    throw new Error(`scripts/renders/screens.mjs: no S<id> rows in ${INDEX_MD}`);
  }
  return keys;
}

/**
 * The approved render for a screen id, or `null` where the set has none.
 *
 * Light only. The set is "twenty light and four dark" — light is the arm
 * that is complete, so it is the arm every side-by-side is drawn against.
 */
export function approvedRender(screen, keys = approvedKeys()) {
  const key = keys.get(screen);
  if (key === undefined) return null;
  const file = path.join(SCREENS_DIR, `${key}-light.png`);
  return existsSync(file) ? { key, file } : null;
}
