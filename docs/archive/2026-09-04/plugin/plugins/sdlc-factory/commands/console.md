---
description: System · Open the read-only knowledge-graph console for this project
---

Run the factory console against the current project root.

```bash
node "$CLAUDE_PROJECT_DIR/.claude/factory/console/bin/factory-console.mjs" $ARGUMENTS
```

Check that path exists before running it. On a vendored project the
plugin root IS `.claude/factory/plugins/sdlc-factory` and the path above
already points at the copy beside it (`factory-console vendor` patches
this line — `.claude/factory/VENDORED.md` is the banner). Otherwise the
console lives beside the plugin inside the marketplace repository, which
is where it is when the plugin source is a relative path — but an
installed plugin can end up outside that checkout. If the file is not
there, in order:

1. try `factory-console $ARGUMENTS` on the PATH;
2. otherwise tell me to run `npm link` once inside the marketplace's
   `console/` directory, and stop. Do not go looking for a copy of the
   console elsewhere on disk — the wrong version parsing a corpus is the
   exact failure mode shipping doctrine and console as one unit exists to
   prevent.

Modes, all one parser so the viewer and the checker can never disagree
about what the corpus says:

| Invocation | Does |
|---|---|
| `/sdlc-factory:console` (typed; `/console` below is the name) | serves the viewer, prints the URL |
| `/console --check` | conformance run; exits 1 on an `error`-severity finding |
| `/console --json` | writes the graph to stdout for other tools |
| `/console impact <WO-### \| path>` | blast radius: files → blueprints → importers → requirements |
| `/console registry` | projects `registry/generated/` (the librarian's generator) |
| `/console registry --check` | drift check on the generated files; exits 1 on drift |
| `/console register` / `unregister` / `projects` | the `~/.factory` fleet registry |
| `/console upgrade [--all]` | migrate this corpus (or every registered one) to the shipped doctrine; on a vendored project, re-vendor `.claude/factory` first |
| `/console vendor` | copy this doctrine + console into `.claude/factory` so the project is self-contained on any host |
| `/console pivot --decision ADR-###` | archive derived artifacts, keep durable ones, relink (rule 7.5) |

The console **never writes an artifact's content.** Agents remain the only
writers of what a corpus says; the binary's write paths are `registry`
(the derived projection), `upgrade` (a migration forward), `pivot` (rule
7.5's archive and relink) and `vendor` (`.claude/factory`, outside the
corpus) — ADR-004 in the marketplace repository's `docs/decisions/`.
If it reports something wrong, fix it through the pipeline — `/sync`,
`/require`, the owning agent — not by editing around the finding.

After a `--check` run, summarise the findings by rule, say which are at
`error` and which at `warn`, and name the single most valuable one to fix
first. Do not fix them as part of this command.
