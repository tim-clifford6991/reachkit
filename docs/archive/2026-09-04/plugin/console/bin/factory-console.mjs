#!/usr/bin/env node
//
// One parser, several modes — so the viewer and the checker can never
// disagree about what the corpus says.
//
//   factory-console                serve the viewer
//   factory-console --check        conformance run, exit 1 on an error finding
//   factory-console --json         emit the graph for other tools
//   factory-console register       add this directory to ~/.factory/projects.json
//   factory-console upgrade --all  migrate every registered corpus forward

import { resolve } from "node:path";

import { loadConfig, ConfigError } from "../src/config.mjs";
import { extract } from "../src/extract/index.mjs";
import { check, formatReport } from "../src/check/index.mjs";
import { computeImpact } from "../src/impact.mjs";
import { computePack, formatPack } from "../src/pack.mjs";
import { serve } from "../src/serve.mjs";
import { readRegistry, register, unregister, tabsFor, expand, isProject } from "../src/projects.mjs";
import { upgradeProject, doctrineVersion, corpusVersion } from "../src/upgrade.mjs";
import { emitRegistry, checkDrift, outputDir } from "../src/registry/index.mjs";
import { computeNext, formatNext } from "../src/next.mjs";
import { requireRoot, RootError } from "../src/root.mjs";
import { pivotProject, PivotError } from "../src/pivot.mjs";
import { vendorProject, VendorError } from "../src/vendor.mjs";
import { relative } from "node:path";

const USAGE = `factory-console — read-only console for an SDLC Factory corpus

  factory-console [path]              serve the viewer (default port 4319)
  factory-console --check [path]      conformance run; exit 1 on an error finding
  factory-console --json [path]       write the graph to stdout
  factory-console pack WO-042 [path]          the reading list for one dispatch (rule 4.5)
  factory-console impact WO-042 [path]        what WO-042's commits land on
  factory-console impact <file> [path]        what a bare file path lands on
  factory-console next [path]         the state-derived next action for the pipeline
  factory-console register [path]     add a project to ~/.factory/projects.json
  factory-console unregister [path]   remove one
  factory-console projects            list them
  factory-console upgrade [path]      migrate one corpus to the installed doctrine
  factory-console upgrade --all       migrate every registered corpus
  factory-console pivot [path] --decision ADR-###   archive derived artifacts, keep durable ones, relink (rule 7.5)
  factory-console vendor [path]       copy this doctrine + console into <path>/.claude/factory (self-contained on any host)
  factory-console registry [path]         write docs/registry/generated/* (only command that writes)
  factory-console registry --check [path] diff generated output against disk; exit 1 on drift

  --port N       serve on a specific port
  --write        allow status changes from the viewer (front-matter corpora only)
  --no-open      do not launch a browser
  --name N       label for register
  --dry-run      upgrade: show what would change, write nothing
  --allow-dirty  upgrade: proceed on a dirty working tree (not recommended)
  --no-commit    upgrade, pivot: rewrite files but do not commit
  --decision ADR-###   pivot: the accepted decision that decides-for the charter (required)
  --slug NAME    pivot: the archive set's name (default: the decision's title)
`;

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port" || a === "--name" || a === "--decision" || a === "--slug") flags[a.slice(2)] = argv[++i];
    else if (a.startsWith("--")) flags[a.slice(2).replace(/-/g, "_")] = true;
    else positional.push(a);
  }
  return { flags, positional };
}

// Every root-taking command goes through here, and a path that is not a
// project root is refused before anything reads or writes — the dogfood
// case was the docs directory, which read as an empty, clean corpus and
// wrote generated views into a stray nested tree (src/root.mjs).
function rootFrom(positional, i = 0) {
  return requireRoot(positional[i] ? expand(positional[i]) : process.cwd());
}

function die(msg, code = 2) {
  console.error(msg);
  process.exit(code);
}

const { flags, positional } = parseArgs(process.argv.slice(2));
const command = ["register", "unregister", "projects", "upgrade", "registry", "impact", "pack", "next", "pivot", "vendor"].includes(positional[0]) ? positional.shift() : null;

if (flags.help || flags.h) {
  console.log(USAGE);
  process.exit(0);
}

try {
  switch (command) {
    case "register": {
      const r = register(positional[0] || process.cwd(), flags.name);
      console.log(`${r.action}: ${r.project.name} → ${r.project.path}`);
      break;
    }
    case "unregister": {
      const n = unregister(positional[0] || process.cwd());
      console.log(n ? "removed from the registry" : "was not in the registry");
      break;
    }
    case "projects": {
      const reg = readRegistry();
      if (!reg.projects.length) {
        console.log("no projects registered — run `factory-console register` inside one");
        break;
      }
      console.log(`doctrine ${doctrineVersion()}\n`);
      for (const p of reg.projects) {
        const root = expand(p.path);
        const ok = isProject(root);
        console.log(`  ${p.name.padEnd(24)} ${p.path.padEnd(40)} ${ok ? `corpus ${corpusVersion(root)}` : "MISSING"}`);
      }
      break;
    }
    case "upgrade": {
      const targets = flags.all
        ? tabsFor(null).map((t) => t.root)
        : [rootFrom(positional)];
      if (!targets.length) die("no registered projects to upgrade");

      let failures = 0;
      for (const root of targets) {
        console.log(`\n${"═".repeat(72)}\n${root}`);
        const r = await upgradeProject(root, {
          dryRun: !!flags.dry_run,
          allowDirty: !!flags.allow_dirty,
          commit: !flags.no_commit,
        });
        if (r.skipped) {
          console.log(`  skipped — ${r.skipped}`);
          continue;
        }
        console.log(`  ${r.from} → ${r.to}${flags.dry_run ? "  (dry run — nothing written)" : ""}`);
        for (const line of r.log) console.log(`  ${line}`);
        if (r.commit) console.log(`  committed ${r.commit}`);
        console.log(r.report);
        if (r.check.exitCode) failures++;
      }
      if (failures) {
        console.error(`\n${failures} project${failures === 1 ? "" : "s"} still have error-severity findings.`);
        process.exit(1);
      }
      break;
    }
    case "vendor": {
      const root = rootFrom(positional);
      const r = vendorProject(root, { dryRun: !!flags.dry_run });
      for (const line of r.log) console.log(line);
      break;
    }
    case "pivot": {
      const root = rootFrom(positional);
      const r = await pivotProject(root, {
        decision: typeof flags.decision === "string" ? flags.decision : null,
        slug: typeof flags.slug === "string" ? flags.slug : undefined,
        dryRun: !!flags.dry_run,
        commit: !flags.no_commit,
      });
      for (const line of r.log) console.log(line);
      if (r.commit) console.log(`  committed ${r.commit}`);
      console.log(r.report);
      if (r.check.exitCode) process.exit(1);
      break;
    }
    case "next": {
      const root = rootFrom(positional);
      const { config } = loadConfig(root);
      console.log(formatNext(computeNext(extract(root, config))));
      break;
    }
    case "registry": {
      const root = rootFrom(positional);
      const { config } = loadConfig(root);
      const dir = outputDir(root, config);

      if (flags.check) {
        const r = checkDrift(root, { config });
        if (r.errors.length > 0) {
          console.error(`registry --check FAILED — the generator itself reports ${r.errors.length} error(s), so drift cannot even be checked:`);
          for (const e of r.errors) console.error(`  ✗ ${e}`);
          process.exit(1);
        }
        if (r.drifts.length === 0) {
          console.log(`registry --check OK · 5 generated file(s) match ${relative(root, dir) || "."}.`);
          break;
        }
        console.error(`registry --check FAILED — ${r.drifts.length} generated file(s) are stale (freshly regenerated copy kept at ${r.tmpDir} for inspection):`);
        for (const d of r.drifts) {
          if (d.reason === "missing") {
            console.error(`  ✗ ${d.file}: MISSING from ${relative(root, dir) || "."} — run \`factory-console registry\` and commit it.`);
          } else {
            console.error(
              `  ✗ ${d.file}: STALE — first differs at line ${d.firstDiffLine}\n` +
                `    committed: ${JSON.stringify(d.committed)}\n` +
                `    fresh:     ${JSON.stringify(d.fresh)}`,
            );
          }
        }
        process.exit(1);
      }

      const r = emitRegistry(root, { config });
      if (r.errors.length > 0) {
        console.error(`registry FAILED — ${r.errors.length} error(s):`);
        for (const e of r.errors) console.error(`  ✗ ${e}`);
        process.exit(1);
      }
      console.log(`registry OK · wrote ${r.wrote.length} file(s) to ${relative(root, r.outDir) || "."}`);
      if (r.warnings.length > 0) console.log(`  (${r.warnings.length} unresolved edge(s) — reported, not fatal; run --check for details)`);
      break;
    }
    case "pack": {
      const target = positional[0];
      if (!target) die("factory-console pack <WO-###> [project path]");
      const root = rootFrom(positional, 1);
      const { config } = loadConfig(root);
      const graph = extract(root, config);
      const pack = computePack(graph, config, root, target);
      if (!pack) die(`no work order ${target} in this corpus`);
      if (flags.json) { process.stdout.write(JSON.stringify(pack)); break; }
      console.log(formatPack(pack));
      break;
    }
    case "impact": {
      const target = positional[0];
      if (!target) die(`factory-console impact <WO-### | path> [project path]`);
      const root = rootFrom(positional, 1);
      const { config } = loadConfig(root);
      const graph = extract(root, config);

      const isWO = /^WO-\d{3}[a-z]?$/.test(target);
      if (isWO && !graph.nodes.some((n) => n.i === target)) {
        die(`no work order ${target} in this corpus`);
      }

      const result = computeImpact(graph, isWO ? { wo: target } : { paths: [target] });
      if (!result.present) {
        die("impact needs a connected repository (code layer absent — code: null, or not a git work tree)");
      }

      if (flags.json) {
        process.stdout.write(JSON.stringify(result));
        break;
      }

      const section = (label, items) => {
        console.log(`${label} (${items.length})`);
        console.log(items.length ? items.map((it) => `  ${it}`).join("\n") : "  (none)");
      };
      section("Files", result.files);
      section("Blueprints", result.blueprints.map((b) => `${b.id}  (${b.files.length} file${b.files.length === 1 ? "" : "s"})`));
      section("Importers", result.importers);
      section("Requirements", result.requirements);
      console.log(`\nimpact: ${result.files.length} files → ${result.blueprints.length} blueprints → ${result.importers.length} importers → ${result.requirements.length} requirements`);
      break;
    }
    default: {
      const root = rootFrom(positional);

      if (flags.json) {
        const { config } = loadConfig(root);
        const graph = extract(root, config);
        graph.check = check(graph, config, root);
        process.stdout.write(JSON.stringify(graph));
        break;
      }

      if (flags.check) {
        const roots = flags.all ? tabsFor(null).map((t) => t.root) : [root];
        let worst = 0;
        for (const r of roots) {
          const { config } = loadConfig(r);
          const graph = extract(r, config);
          const verdict = check(graph, config, r);
          console.log(formatReport(verdict, config, { root: r }));
          worst = Math.max(worst, verdict.exitCode);
        }
        process.exit(worst);
      }

      await serve(root, {
        port: flags.port ? Number(flags.port) : 4319,
        open: !flags.no_open,
        write: !!flags.write,
      });
    }
  }
} catch (e) {
  if (e instanceof ConfigError) die(`\n${e.message}\n`);
  if (e instanceof RootError) die(`\n${e.message}\n`);
  if (e instanceof PivotError) die(`\npivot refused — ${e.message}\n`);
  if (e instanceof VendorError) die(`\nvendor refused — ${e.message}\n`);
  die(`\n${e.message}\n`);
}
