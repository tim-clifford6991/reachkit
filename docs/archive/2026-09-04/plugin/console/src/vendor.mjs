// `factory-console vendor` — the doctrine travels natively.
//
// The marketplace install has one weakness the live test found: it lives in
// ~/.claude/plugins on ONE host, so a project checked out anywhere else has
// its corpus and none of the machinery that reads it. The owner ruled the
// vendored layout on 2026-09-02, and a shell script produced it on the first
// project; this is that script absorbed, so the layout has one generator
// and `upgrade` can refresh it.
//
// The layout, under the project's `.claude/`:
//
//   .claude/factory/VENDORED.md                  banner: version, source sha, date
//   .claude/factory/plugins/sdlc-factory/…       the plugin, whole
//   .claude/factory/console/{bin,src,package.json}
//   .claude/agents    -> factory/plugins/sdlc-factory/agents     (symlinks)
//   .claude/commands  -> factory/plugins/sdlc-factory/commands
//   .claude/skills    -> factory/plugins/sdlc-factory/skills
//   .claude/settings.json                        hooks wired to the copy;
//                                                the marketplace plugin disabled
//
// Two strings inside the copy are patched — the two places the plugin names
// its own root through `${CLAUDE_PLUGIN_ROOT}`, which a native install does
// not set: commands/console.md's binary path and commands/factory-init.md's
// template paths. Everything else is byte-identical to the source, and the
// banner says so. A copy is GENERATED: never edited in place — a fix lands in
// the central repository and the project is re-vendored, which is what
// `upgrade` does on a vendored project before it migrates the corpus.
//
// Refuses rather than guesses: a `.claude/factory` that carries no banner is
// not something this wrote and is not replaced; a real `agents/` (or
// `commands/`, `skills/`) directory that is not a symlink is the project's
// own and is not replaced; vendoring from a project's own vendored copy is a
// no-op that says so — re-vendoring needs the central clone.

import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));

export class VendorError extends Error {}

export const VENDOR_DIR = join(".claude", "factory");
export const BANNER = join(VENDOR_DIR, "VENDORED.md");
const LINKED = ["agents", "commands", "skills"];
const PLUGIN_REL = "plugins/sdlc-factory";

/** The tree this console runs from: its plugin and its own bin/src. */
export function sourceTree() {
  const consoleRoot = resolve(HERE, "..");
  const pluginRoot = resolve(consoleRoot, "..", PLUGIN_REL);
  if (!existsSync(join(pluginRoot, ".claude-plugin", "plugin.json"))) {
    throw new VendorError(`cannot find ${PLUGIN_REL} beside this console — vendor runs from a marketplace clone (or a vendored copy)`);
  }
  const version = JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8")).version;
  let sha = "unknown";
  try { sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: consoleRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* not a clone */ }
  return { consoleRoot, pluginRoot, version, sha, vendored: existsSync(resolve(consoleRoot, "..", "VENDORED.md")) };
}

/** What a project's vendored copy says about itself, or null. */
export function readBanner(root) {
  const p = join(root, BANNER);
  if (!existsSync(p)) return null;
  const text = readFileSync(p, "utf8");
  const version = text.match(/Doctrine \*\*([0-9.]+)\*\*/)?.[1] ?? null;
  const sha = text.match(/@ `([0-9a-f]+)`/)?.[1] ?? null;
  return { version, sha, text };
}

export const isVendored = (root) => existsSync(join(root, BANNER));

function hookCommand(script) {
  return `node "$CLAUDE_PROJECT_DIR/.claude/factory/plugins/sdlc-factory/hooks/${script}"`;
}

/**
 * Vendor this console's own doctrine into `root`.
 * @param {string} root  project root
 * @param {{dryRun?: boolean, today?: string}} [opts]
 */
export function vendorProject(root, opts = {}) {
  const src = sourceTree();
  const log = [];
  const say = (m) => log.push(m);
  const target = join(root, VENDOR_DIR);

  if (resolve(src.consoleRoot, "..") === resolve(target)) {
    throw new VendorError(`this console IS ${relative(root, target)} — re-vendoring needs the central clone (run factory-console vendor from it, or upgrade from it)`);
  }
  if (existsSync(target) && !existsSync(join(root, BANNER))) {
    throw new VendorError(`${relative(root, target)} exists but carries no VENDORED.md — not something vendor wrote, so not something it replaces`);
  }
  for (const d of LINKED) {
    const p = join(root, ".claude", d);
    if (existsSync(p) && !lstatSync(p).isSymbolicLink()) {
      throw new VendorError(`.claude/${d} is a real directory, not a link — the project's own; move it aside before vendoring`);
    }
  }

  const prior = readBanner(root);
  say(`vendor ${src.version}@${src.sha} → ${relative(root, target) || target}${prior ? ` (replacing ${prior.version}@${prior.sha})` : ""}`);

  if (opts.dryRun) {
    say("  dry run — nothing written");
    return { root, log, version: src.version, sha: src.sha, prior, written: false };
  }

  rmSync(target, { recursive: true, force: true });
  mkdirSync(join(target, "plugins"), { recursive: true });
  mkdirSync(join(target, "console"), { recursive: true });
  cpSync(src.pluginRoot, join(target, PLUGIN_REL), { recursive: true });
  for (const part of ["bin", "src", "package.json"]) {
    cpSync(join(src.consoleRoot, part), join(target, "console", part), { recursive: true });
  }

  // The two patched strings.
  const plugin = join(target, PLUGIN_REL);
  const patches = [
    ["commands/console.md", "${CLAUDE_PLUGIN_ROOT}/../../console/bin/factory-console.mjs", "$CLAUDE_PROJECT_DIR/.claude/factory/console/bin/factory-console.mjs"],
    ["commands/factory-init.md", "${CLAUDE_PLUGIN_ROOT}", "$CLAUDE_PROJECT_DIR/.claude/factory/plugins/sdlc-factory"],
  ];
  let patched = 0;
  for (const [rel, from, to] of patches) {
    const p = join(plugin, rel);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    if (text.includes(from)) { writeFileSync(p, text.split(from).join(to), "utf8"); patched++; }
  }
  say(`  copied plugin + console; patched ${patched} plugin-root string${patched === 1 ? "" : "s"}`);

  // Symlinks beside the copy.
  for (const d of LINKED) {
    const p = join(root, ".claude", d);
    if (existsSync(p) || (() => { try { lstatSync(p); return true; } catch { return false; } })()) unlinkSync(p);
    symlinkSync(join("factory", PLUGIN_REL, d), p);
  }
  say(`  linked .claude/{${LINKED.join(", ")}}`);

  // settings.json: hooks to the copy, marketplace plugin off; everything else kept.
  const settingsPath = join(root, ".claude", "settings.json");
  let settings = {};
  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, "utf8")); } catch { throw new VendorError(".claude/settings.json is not valid JSON — fix it before vendoring; this never overwrites a file it cannot read"); }
  }
  settings.hooks = {
    ...(settings.hooks || {}),
    UserPromptSubmit: [{ hooks: [{ type: "command", command: hookCommand("route-prompt.mjs"), timeout: 5 }] }],
    PreToolUse: [{ matcher: "Write|Edit|MultiEdit|NotebookEdit", hooks: [{ type: "command", command: hookCommand("guard-corpus-write.mjs"), timeout: 5 }] }],
  };
  settings.enabledPlugins = { ...(settings.enabledPlugins || {}), "sdlc-factory@timclifford": false };
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
  say("  wired hooks in .claude/settings.json; marketplace plugin disabled for this project");

  const today = opts.today || new Date().toISOString().slice(0, 10);
  writeFileSync(join(root, BANNER), [
    "# SDLC Factory — vendored copy",
    "",
    `Doctrine **${src.version}** · source \`tim-clifford6991/sdlc-factory\` @ \`${src.sha}\` · generated ${today}.`,
    "",
    "This directory and the `agents/`, `commands/`, `skills/` links beside it are",
    "**generated** by `factory-console vendor` (and refreshed by `factory-console",
    "upgrade` on a vendored project). Never edit here — a fix belongs in the",
    "central repository, then re-vendor. The two patched strings",
    "(`${CLAUDE_PLUGIN_ROOT}` → this directory) are the only deltas from source.",
    "",
  ].join("\n"), "utf8");
  say(`  wrote ${BANNER}`);

  return { root, log, version: src.version, sha: src.sha, prior, written: true };
}
