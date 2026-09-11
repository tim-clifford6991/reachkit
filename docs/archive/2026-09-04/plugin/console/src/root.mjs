// A project root is a directory, not a guess.
//
// Dogfood, live 0.11.0 test on ReachKit v3: the librarian ran
// `factory-console registry sdlc-factory/docs` — the docs directory, not
// the project root. loadConfig() found no factory.config.json there, fell
// back to the shipped defaults, extract() walked `<docs>/sdlc-factory/docs/
// requirements` (nothing), the registry generator wrote five generated
// views into a stray `sdlc-factory/docs/sdlc-factory/docs/registry/
// generated/`, and --check reported 0 errors. Rule 5.5's failure mode with
// a checker's badge on: silence that reads as health.
//
// The rule: a root qualifies only when BOTH hold —
//   · `<root>/factory.config.json` exists (every /factory-init writes one,
//     even if it says only `{ "schema": null }`), and
//   · at least one declared `type.dir` exists under `<root>/<docsRoot>`.
// Anything else is refused, and the refusal names the nearest ancestor that
// does qualify — the docs directory's is two levels up — or says plainly
// that none does. Checked at the CLI boundary for every command that takes
// a root, before a byte is read or written.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadConfig } from "./config.mjs";

export class RootError extends Error {}

/**
 * Why a directory does or does not qualify as a project root.
 * @returns {{ ok: boolean, why: string, docsRoot?: string }}
 */
export function qualify(root) {
  const abs = resolve(root);
  if (!existsSync(join(abs, "factory.config.json"))) {
    return { ok: false, why: "no factory.config.json here" };
  }
  let config;
  try {
    ({ config } = loadConfig(abs));
  } catch (e) {
    // An invalid config is still a config: the root is a project root, and
    // loadConfig() will say what is wrong with the file when the command
    // reads it — that message must not be replaced by this one.
    return { ok: true, why: `factory.config.json present (${e.message.split("\n")[0]})` };
  }
  const dirs = config.types.filter((t) => t.dir).map((t) => t.dir);
  const present = dirs.filter((d) => existsSync(join(abs, config.docsRoot, d)));
  if (!present.length) {
    return {
      ok: false,
      why: `factory.config.json present, but none of its declared type directories exist under ${config.docsRoot}/ (${dirs.join(", ")})`,
      docsRoot: config.docsRoot,
    };
  }
  return { ok: true, why: `factory.config.json + ${present.length} of ${dirs.length} declared type directories under ${config.docsRoot}/`, docsRoot: config.docsRoot };
}

/** The nearest ancestor of `path` (itself first) that qualifies, or null. */
export function nearestRoot(path) {
  let dir = resolve(path);
  for (;;) {
    if (qualify(dir).ok) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/**
 * The root every root-taking command runs against, or a RootError that
 * names the nearest one that would work. Never guesses: a directory that is
 * not a project root is refused, whatever sits above or below it.
 */
export function requireRoot(path) {
  const abs = resolve(path);
  const q = qualify(abs);
  if (q.ok) return abs;
  const nearest = nearestRoot(dirname(abs));
  const hint = nearest
    ? `The nearest project root above it is ${nearest} — run the command there. (A path is the project root, never its docs directory.)`
    : "No ancestor carries factory.config.json with a declared type directory under its docsRoot — run /sdlc-factory:factory-init in the project first.";
  throw new RootError(`${abs} is not a factory project root: ${q.why}.\n${hint}`);
}
