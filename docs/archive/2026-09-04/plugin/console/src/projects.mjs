// The project registry — ~/.factory/projects.json.
//
// Each project parses independently; nothing is shared between them but the
// doctrine version. The registry is the only piece of state the console owns,
// and it holds no corpus data — just where the corpora are.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, basename } from "node:path";

export const REGISTRY_DIR = join(homedir(), ".factory");
export const REGISTRY_PATH = join(REGISTRY_DIR, "projects.json");

const tilde = (p) => (p.startsWith(homedir()) ? "~" + p.slice(homedir().length) : p);
export const expand = (p) => (p.startsWith("~") ? join(homedir(), p.slice(1)) : resolve(p));

export function readRegistry() {
  if (!existsSync(REGISTRY_PATH)) return { projects: [] };
  try {
    const r = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
    return { projects: Array.isArray(r.projects) ? r.projects : [] };
  } catch (e) {
    throw new Error(`${REGISTRY_PATH} is not valid JSON: ${e.message}`);
  }
}

export function writeRegistry(reg) {
  mkdirSync(REGISTRY_DIR, { recursive: true });
  writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2) + "\n");
}

/** Is this directory a factory project? */
export function isProject(root) {
  return existsSync(join(root, "sdlc-factory", "docs")) || existsSync(join(root, "sdlc-factory", "CLAUDE.md"));
}

export function register(path, name) {
  const root = expand(path);
  if (!isProject(root)) {
    throw new Error(`${root} has no sdlc-factory/ — run /factory-init there first`);
  }
  const reg = readRegistry();
  const stored = tilde(root);
  const existing = reg.projects.find((p) => expand(p.path) === root);
  if (existing) {
    if (name && name !== existing.name) {
      existing.name = name;
      writeRegistry(reg);
      return { action: "renamed", project: existing };
    }
    return { action: "already-registered", project: existing };
  }
  const project = { name: name || basename(root), path: stored };
  reg.projects.push(project);
  writeRegistry(reg);
  return { action: "registered", project };
}

export function unregister(path) {
  const root = expand(path);
  const reg = readRegistry();
  const before = reg.projects.length;
  reg.projects = reg.projects.filter((p) => expand(p.path) !== root);
  writeRegistry(reg);
  return before - reg.projects.length;
}

/**
 * The list the console shows as tabs: every registered project, plus the one
 * we were invoked in if it is not registered — so `/console` in a fresh
 * project works before anybody has thought about the registry.
 *
 * The tab for `cwdRoot` — the project the console was actually started
 * against — always lands at index 0, which is also the default `?p=`. A
 * registered project kept its registry position here until dogfood finding
 * F5: `factory-console ~/Projects/timclifford.dev` served whatever project
 * happened to sort first in ~/.factory/projects.json (reachkit.app) at `/`,
 * with timclifford.dev only reachable at `?p=1` — invisible unless you
 * already knew to look. Every other tab keeps registry order behind it.
 */
export function tabsFor(cwdRoot) {
  const reg = readRegistry();
  const tabs = reg.projects
    .map((p) => ({ name: p.name, path: p.path, root: expand(p.path), registered: true }))
    .filter((p) => isProject(p.root));
  if (cwdRoot && isProject(cwdRoot)) {
    const idx = tabs.findIndex((t) => t.root === cwdRoot);
    if (idx > 0) {
      tabs.unshift(tabs.splice(idx, 1)[0]);
    } else if (idx === -1) {
      tabs.unshift({ name: basename(cwdRoot), path: tilde(cwdRoot), root: cwdRoot, registered: false });
    }
    // idx === 0: already at the front — nothing to do.
  }
  return tabs;
}
