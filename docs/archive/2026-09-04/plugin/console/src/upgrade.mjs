// Fleet upgrade.
//
// The distribution half is nearly free — `/plugin marketplace update` already
// propagates doctrine changes. This is the other half, and it is the most
// under-estimated item in the plan: when the constitution changes, existing
// corpora stop conforming. Migrations rewrite them forward, exactly like
// database migrations, and --check proves the result.
//
// Two safety rails, both load-bearing:
//   · refuse to run on a dirty working tree — otherwise a rewrite is
//     indistinguishable from whatever else was in progress;
//   · one commit per project, so every rewrite is reviewable and revertible.

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { loadConfig } from "./config.mjs";
import { extract } from "./extract/index.mjs";
import { splitFrontmatter, serializeFrontmatter } from "./extract/frontmatter.mjs";
import { check, formatReport } from "./check/index.mjs";
import { isVendored, readBanner, sourceTree, vendorProject } from "./vendor.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export const VERSION_FILE = join("sdlc-factory", ".doctrine-version");

function pluginRoot() {
  const p = resolve(HERE, "../../plugins/sdlc-factory");
  if (!existsSync(p)) throw new Error("cannot find plugins/sdlc-factory — is the console detached from the marketplace?");
  return p;
}

export function doctrineVersion() {
  const manifest = JSON.parse(readFileSync(join(pluginRoot(), ".claude-plugin/plugin.json"), "utf8"));
  return manifest.version;
}

export function corpusVersion(root) {
  const f = join(root, VERSION_FILE);
  // An unstamped corpus predates versioning; every migration applies.
  return existsSync(f) ? readFileSync(f, "utf8").trim() : "0.0.0";
}

const cmp = (a, b) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};

/** Migrations are files named `<version>-<slug>.mjs`, applied in version order. */
export async function loadMigrations() {
  const dir = join(pluginRoot(), "migrations");
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".mjs")) continue;
    const m = await import(join(dir, f));
    if (!m.version || typeof m.migrate !== "function") {
      throw new Error(`migrations/${f} must export "version", "describe" and "migrate"`);
    }
    out.push({ file: f, ...m });
  }
  return out.sort((a, b) => cmp(a.version, b.version));
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function gitState(root) {
  try {
    git(root, ["rev-parse", "--git-dir"]);
  } catch {
    return { repo: false, dirty: false };
  }
  const status = git(root, ["status", "--porcelain"]);
  return { repo: true, dirty: status.length > 0, status };
}

/**
 * Upgrade one project.
 * @param {string} root
 * @param {{dryRun?: boolean, allowDirty?: boolean, commit?: boolean}} opts
 */
export async function upgradeProject(root, opts = {}) {
  const log = [];
  const target = doctrineVersion();
  const current = corpusVersion(root);
  const result = { root, from: current, to: target, applied: [], log, skipped: null, changed: [] };

  if (cmp(current, target) >= 0) {
    // Even a corpus already at the target may carry a vendored copy behind
    // this console's own sha (a fix rung with no migration) — refresh it.
    if (isVendored(root)) {
      const banner = readBanner(root);
      const src = sourceTree();
      const self = src.vendored && resolve(src.consoleRoot, "..") === resolve(root, ".claude", "factory");
      if (!self && !(banner?.version === src.version && banner?.sha === src.sha)) {
        const g0 = gitState(root);
        if (g0.repo && (!g0.dirty || opts.allowDirty)) {
          const r = vendorProject(root, { dryRun: !!opts.dryRun });
          for (const line of r.log) log.push(line);
          if (!opts.dryRun && opts.commit !== false && r.written) {
            git(root, ["add", ".claude"]);
            if (git(root, ["diff", "--cached", "--name-only"])) {
              git(root, ["commit", "-m", `chore(doctrine): re-vendor .claude/factory ${r.prior?.version ?? "?"} → ${r.version}@${r.sha}`]);
              result.commit = git(root, ["rev-parse", "--short", "HEAD"]);
            }
          }
          result.skipped = `already at doctrine ${current}; vendored copy refreshed`;
          return result;
        }
      }
    }
    result.skipped = `already at doctrine ${current}`;
    return result;
  }

  const g = gitState(root);
  if (!g.repo) {
    result.skipped = "not a git repository — refusing to rewrite a corpus that cannot be reverted";
    return result;
  }
  if (g.dirty && !opts.allowDirty) {
    result.skipped = "working tree is dirty — commit or stash first, so the migration is the only thing in the diff";
    return result;
  }

  // A vendored project (0.12.0) carries its own copy of the doctrine under
  // .claude/factory; the corpus migration below would otherwise leave that
  // copy a version behind the corpus it reads. Re-vendor first — from this
  // console's own tree, which is the newer one by construction when this
  // runs from the central clone. Running from the project's own vendored
  // copy cannot refresh itself and says so.
  let revendored = null;
  if (isVendored(root)) {
    const banner = readBanner(root);
    const src = sourceTree();
    if (src.vendored && resolve(src.consoleRoot, "..") === resolve(root, ".claude", "factory")) {
      log.push(`vendored copy ${banner?.version ?? "?"} left as it is — this console is that copy; re-vendor from the central clone`);
    } else if (banner?.version === src.version && banner?.sha === src.sha) {
      log.push(`vendored copy already ${src.version}@${src.sha}`);
    } else {
      const r = vendorProject(root, { dryRun: !!opts.dryRun });
      for (const line of r.log) log.push(line);
      revendored = r;
    }
  }

  const { config } = loadConfig(root);
  const migrations = (await loadMigrations()).filter(
    (m) => cmp(m.version, current) > 0 && cmp(m.version, target) <= 0
  );
  if (!migrations.length) {
    log.push("no corpus migrations between these versions — stamping only");
  }

  // `changed` holds paths under docsRoot (what nearly every migration
  // touches); `rootChanged` holds paths relative to the project root itself
  // — so far only factory.config.json (0.2.0-d), which lives outside
  // docsRoot and therefore outside `config.docsRoot`'s own merge/validate
  // path. Both need staging at commit time; they're kept separate because
  // they resolve against different bases.
  const changed = new Set();
  const rootChanged = new Set();
  const ctx = {
    root,
    docsRoot: join(root, config.docsRoot),
    config,
    dryRun: !!opts.dryRun,
    read: (rel) => readFileSync(join(root, config.docsRoot, rel), "utf8"),
    exists: (rel) => existsSync(join(root, config.docsRoot, rel)),
    write: (rel, text) => {
      changed.add(rel);
      if (!opts.dryRun) {
        const abs = join(root, config.docsRoot, rel);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, text);
      }
    },
    // A delete still needs staging — `git add <path>` on a path that no
    // longer exists but was tracked stages the removal, same as `git rm`.
    remove: (rel) => {
      changed.add(rel);
      if (!opts.dryRun) {
        const abs = join(root, config.docsRoot, rel);
        if (existsSync(abs)) unlinkSync(abs);
      }
    },
    // Root-relative counterparts, for the one file every project keeps
    // outside docsRoot: factory.config.json.
    existsRoot: (rel) => existsSync(join(root, rel)),
    readRoot: (rel) => readFileSync(join(root, rel), "utf8"),
    writeRoot: (rel, text) => {
      rootChanged.add(rel);
      if (!opts.dryRun) {
        const abs = join(root, rel);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, text);
      }
    },
    log: (m) => log.push(m),
    // 0.12.1 — the one front-matter parser, handed to migrations rather than
    // copied beside them (proposal 24, S1).
    frontmatter: { splitFrontmatter, serializeFrontmatter },
  };

  for (const m of migrations) {
    log.push(`applying ${m.file} — ${m.describe ? m.describe() : m.version}`);
    await m.migrate(ctx);
    result.applied.push(m.version);
  }

  result.changed = [...changed, ...rootChanged];

  if (!opts.dryRun) {
    writeFileSync(join(root, VERSION_FILE), target + "\n");
  }

  // Prove the result conforms. This is what makes the upgrade safe: without
  // it, "upgrade every project with one command" silently breaks the older
  // ones.
  //
  // Config is reloaded here rather than reusing the `config` migrations ran
  // against: 0.2.0-d can flip factory.config.json's own `grammar` from
  // head-block to front-matter, and proving conformance against the grammar
  // the corpus now declares (not the one it declared before this run) is the
  // whole point of this step — checking front-matter output against a
  // head-block-grammar config would misreport nearly everything 0.2.0-a just
  // wrote.
  //
  // On a dry run nothing was written, so this reads the corpus as it stands
  // — including its original, unmigrated config. Say so rather than let it
  // read as a post-migration verdict.
  const { config: configAfter } = opts.dryRun ? { config } : loadConfig(root);
  const graph = extract(root, configAfter);
  // `root` is passed through so this proof runs the same undeclared-
  // directory scan every other real caller gets (check/index.mjs) — the
  // upgrade's own conformance check is exactly the place a directory a
  // migration just renamed, or failed to declare a type for, should be
  // caught.
  const verdict = check(graph, configAfter, root);
  result.check = verdict;
  result.report = formatReport(verdict, configAfter, {
    root: opts.dryRun ? `${root}  [BEFORE — dry run wrote nothing]` : root,
  });

  if (!opts.dryRun && opts.commit !== false) {
    const files = [...changed].map((rel) => join(config.docsRoot, rel)).concat([...rootChanged]);
    if (revendored?.written) files.push(".claude");
    git(root, ["add", ...files, VERSION_FILE]);
    const staged = git(root, ["diff", "--cached", "--name-only"]);
    if (staged) {
      const body = [
        `chore(doctrine): migrate corpus to ${target}`,
        "",
        ...result.applied.map((v) => `  · ${v}`),
        ...(revendored?.written ? [`  · re-vendored .claude/factory ${revendored.prior?.version ?? "?"} → ${revendored.version}@${revendored.sha}`] : []),
        "",
        `${changed.size + rootChanged.size} file${changed.size + rootChanged.size === 1 ? "" : "s"} rewritten. ` +
        `Conformance after: ${verdict.bySeverity.error} error, ${verdict.bySeverity.warn} warn.`,
      ].join("\n");
      git(root, ["commit", "-m", body]);
      result.commit = git(root, ["rev-parse", "--short", "HEAD"]);
    } else {
      log.push("nothing to commit — the corpus already satisfied every migration");
    }
  }

  return result;
}
