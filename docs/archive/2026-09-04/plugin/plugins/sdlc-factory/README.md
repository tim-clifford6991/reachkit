# SDLC Factory

An AI-native software factory for Claude Code: requirements flow through a
documented pipeline with gates, traceability, and a living knowledge base
under `sdlc-factory/docs/`. The owner speaks in five verbs; the system
derives, drafts, and verifies everything else.

## Install

**Natively, per project (0.12.0):** from a clone of this repository,

```
factory-console vendor <project>      # or /sdlc-factory:factory-init, which runs it as step 4a
```

copies the doctrine and the console into `<project>/.claude/factory/`,
links `.claude/{agents,commands,skills}` into the copy, wires the hooks
into `.claude/settings.json`, and writes `VENDORED.md`. The project is then
self-contained on any host with Node — no marketplace, no plugin install —
and `factory-console upgrade <project>` re-vendors the copy when it
migrates the corpus. The copy is generated: never edit it; fix here and
re-vendor.

**Through the marketplace**, for a host that keeps the plugin globally —
there is no in-session `/plugin` command; installation and upgrades go
through the `claude plugin` CLI, outside any session:

```
claude plugin marketplace add <path>
claude plugin install sdlc-factory@timclifford
claude plugin update sdlc-factory@timclifford
```

`update` pulls the latest doctrine, but a session that already loaded the
plugin keeps running the version it started with — restart the session (or
the console, if it's running) to pick up the change. A vendored project
disables the marketplace plugin for itself, so the two never load twice.

## Owner verbs

**You need one:** `/sdlc-factory:factory` — say what you want (or nothing), and the
orchestrator classifies, consults the corpus state, drives every subagent
chain end to end, and stops only at one batched checkpoint where your
word is required — clarifying questions, approvals, rulings, sign-offs,
each one line. The five decision verbs below are where your rulings land,
not what you must remember to type.

- `/sdlc-factory:require` — turn raw input into a structured requirement.
- `/sdlc-factory:requirement-cleanup` — bring a requirement that has outgrown
  one page back to one page.
- `/sdlc-factory:decide` — state a ruling and have it recorded as a decision.
- `/sdlc-factory:feedback` — triage raw feedback into the pipeline.
- `/sdlc-factory:wave` — propose, show, or close the current wave.

Type them namespaced: the bare form (`/wave`) is the verb's name in the
doctrine and resolves only when nothing else on the machine claims it
(constitution §4, "Typing a verb").

Everything else is internal — invoked by `/factory` or by one of the five,
never something to remember. Constitution §4's routing map (in
`templates/constitution.md`, and in every project's `sdlc-factory/CLAUDE.md`)
is the only place routing is stated: one row per verb — stage, caller,
agent, the skill it loads, the model tier it runs on. The router hook
renders that map's owner rows every turn. `/factory-init` is the one
verb that runs before a corpus exists.
