// Doctrine 0.4.0 — journeys/ exists; the first journey is yours to write.
//
// A journey names a persona and the steps they take; a REQ cites the step it
// serves. Nothing about that can be inferred from an existing corpus — there
// is no reliable way to read a persona or a step sequence back out of
// requirements, blueprints or work orders that were written before journeys
// existed. Guessing one would fabricate exactly the kind of artifact rule
// 5.5 warns against: a confident, invented journey standing in for a real
// owner's account of who uses the thing and how.
//
// So this migration does the one honest thing: it makes sure the *template*
// is there, the same way `/factory-init` would have dropped it into a new
// project, so the owner has something to copy from. It never writes a real
// `journeys/JN-*.md` file, and it never touches any existing artifact —
// `persona` and `steps` are fields that only ever appear on a journey, and
// `exercises` edges are read off of `steps`, so no requirement, blueprint,
// work order, decision or feedback file has anything to gain or lose here.
//
// Refuses to guess, always:
//   - `journeys/_TEMPLATE.md` already present under docsRoot — left
//     untouched (idempotent; whatever is there may already be a first
//     draft, not the stub);
//   - no journey ever created for this project — that stays true after this
//     migration runs. Authoring one is the owner's job, not this script's.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const version = "0.4.0";
export const describe = () => "journeys/ exists; the first journey is yours to write";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = dirname(HERE); // migrations/ → plugins/sdlc-factory
const TEMPLATE_REL = "journeys/_TEMPLATE.md";

export async function migrate(ctx) {
  if (ctx.exists(TEMPLATE_REL)) {
    ctx.log(`  ${TEMPLATE_REL}: already present — left unchanged`);
    return;
  }

  const skeletonPath = join(PLUGIN_ROOT, "templates/docs-skeleton", TEMPLATE_REL);
  if (!existsSync(skeletonPath)) {
    ctx.log(`  ${TEMPLATE_REL}: refused — the plugin's own skeleton is missing at ${skeletonPath}`);
    return;
  }

  const skeleton = readFileSync(skeletonPath, "utf8");
  ctx.write(TEMPLATE_REL, skeleton);
  ctx.log(`  ${TEMPLATE_REL}: created from the plugin's skeleton — no journey file is written for you; the first one is yours to author`);
}
