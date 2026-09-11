---
description: System · Scaffold the SDLC Factory into this project, or upgrade an existing one
---

Install the factory into the current project. Work from the repository root.
`$ARGUMENTS` may name a project title; if empty, infer one from the
directory name and confirm it with me.

`$CLAUDE_PROJECT_DIR/.claude/factory/plugins/sdlc-factory` is this plugin's directory — read every template
from there, never from another project.

## Step 1 — decide install or upgrade

Check whether `sdlc-factory/` exists in the project root.

**It does not exist → install.** Continue at step 2.

**It exists → upgrade.** Do not touch `sdlc-factory/docs/` under any
circumstances; that is the project's corpus and this command is not allowed
to rewrite it. Only offer to refresh `sdlc-factory/CLAUDE.md` from
`$CLAUDE_PROJECT_DIR/.claude/factory/plugins/sdlc-factory/templates/constitution.md`. Show me the diff first
and ask before writing. If the corpus itself needs migrating for a newer
doctrine version, that is `factory-console upgrade`, not this command — it
migrates the corpus and, on a vendored project (step 4a), re-vendors
`.claude/factory` in the same commit; say so and stop. Then skip to step 5.

## Step 2 — scaffold

Copy from `$CLAUDE_PROJECT_DIR/.claude/factory/plugins/sdlc-factory/templates/`:

- `constitution.md` → `sdlc-factory/CLAUDE.md`
- `docs-skeleton/` → `sdlc-factory/docs/`

The skeleton carries the six artifact templates and empty registries.
Never overwrite a file that already exists — report it and move on.

Then stamp the corpus with the doctrine version it was created against:
write the `version` from `$CLAUDE_PROJECT_DIR/.claude/factory/plugins/sdlc-factory/.claude-plugin/plugin.json`
into `sdlc-factory/.doctrine-version`. `factory upgrade` reads that stamp to
decide which corpus migrations still have to run; an unstamped corpus is
treated as predating versioning, so every migration applies to it.

Then make the project a git repository if it is not one — `git init`, and
commit the scaffold as the seed commit. The factory's acceptance model is
commit-based: expand and workorder passes land uncommitted and the owner
accepts by committing, `/implement` refuses a work order absent from HEAD,
and `factory upgrade` refuses a corpus it cannot revert. A factory outside
git is a factory whose history does not exist — the first live project ran
66 requirements deep before anyone noticed the rework was invisible.

## Step 3 — write `factory.config.json`

Write **only this project's deviations** from the shipped grammar, at the
project root. The defaults live with the plugin and stay owned by the
doctrine; copying them here would freeze this project's grammar at today's
version, which is the drift the whole marketplace exists to prevent.

Detect the schema source and write that, and nothing else:

| Found | Write |
|---|---|
| `supabase/migrations/` | `{ "schema": { "kind": "supabase", "path": "supabase/migrations" } }` |
| `prisma/schema.prisma` | `{ "schema": { "kind": "prisma", "path": "prisma/schema.prisma" } }` |
| `drizzle/` or `drizzle.config.*` | `{ "schema": { "kind": "drizzle", "path": "<the migrations dir>" } }` |
| none of these | `{ "schema": null }` |

`"schema": null` is a normal, complete answer — the project loses the
data-model view and nothing else. If the file already exists, leave it
alone and tell me what it says.

## Step 4 — wire the constitution into the project's `CLAUDE.md`

Append the line `@sdlc-factory/CLAUDE.md` to the project's root
`CLAUDE.md`, creating the file if it does not exist. If the line is already
present, do nothing.

**This step is the reason this is a command and not something the plugin
does on install.** A plugin cannot write a project's `CLAUDE.md`; without
this line the constitution is on disk but not in context, and every agent
below it behaves like an ordinary assistant.

## Step 4a — vendor the doctrine, so the project is self-contained

Run, from the marketplace clone's console (binary resolution per
`commands/console.md`):

```bash
factory-console vendor .
```

It copies this plugin and the console into `.claude/factory/`, links
`.claude/{agents,commands,skills}` into the copy, wires both hooks into
`.claude/settings.json`, disables the marketplace plugin for this project,
and writes `.claude/factory/VENDORED.md` — the banner naming the doctrine
version and source commit. From then on the project carries its own
doctrine and console: it runs on any host with Node and no marketplace,
and `factory-console upgrade` re-vendors the copy when it migrates the
corpus. Never edit under `.claude/factory/` — a fix belongs in the central
repository, then re-vendor (the banner says so). Commit `.claude/` with the
scaffold; a vendored copy is part of the project, not a build product.

If `factory-console` cannot be found on this host, say so and stop here:
the project still works through the marketplace plugin until it can be
vendored from a clone.

## Step 5 — charter and report

On a fresh install, `sdlc-factory/docs/00-project.md` does not exist yet.
Offer to draft it — that is `/codebase-scan` phase 1 for an existing codebase,
or a short interview for a new one. Do not write it silently.

Report, briefly:

- installed or upgraded, and what changed on disk
- what `factory.config.json` says about the schema
- whether `@sdlc-factory/CLAUDE.md` was already wired or was just added
- whether the doctrine was vendored (the banner's version and commit), or
  why not
- the next command, in the form that resolves (constitution §4, "Typing a
  verb"): `/sdlc-factory:codebase-scan` for an existing codebase,
  `/sdlc-factory:require` for a new one, `/sdlc-factory:factory` to let the
  loop drive either, `/sdlc-factory:console` to look.
