# The substrate the live suites talk to

Two vitest projects reach a **live, migrated PostgreSQL** rather than
migration text: `db` (`vitest.config.ts`'s `LIVE_SCHEMA_TESTS`) and `layout`
(the browser sweep signs in as a seeded account, #193/#206). This directory
is what both talk to, reduced to the four parts they actually use:

| part | why |
| --- | --- |
| PostgreSQL 18, user `reachkit`/`reachkit` | the suites spawn `psql` and reset `public` between files |
| roles + `auth.uid()`/`auth.role()` (`shim.sql`) | RLS policies call them; they live outside `supabase/migrations/` |
| PostgREST + a `/rest/v1` proxy | `tests/db/rls.test.ts` and the layout sweep drive `@supabase/supabase-js`, which builds its URLs as `<SUPABASE_URL>/rest/v1/…` |
| postgres-meta | `gen-types.sh` — the generator `supabase gen types` shells out to; `tests/db/clients.test.ts` diffs its output against the checked-in `src/lib/db/types.generated.ts` |

## Running it locally

Every suite that reaches the substrate begins by dropping and rebuilding
`public`, so **two runs sharing a database delete each other's rows
mid-flight** — the layout sweep's seeded account vanishes and every `/app`
address redirects to `/signin`, which reads exactly like a broken screen
(#219 lost two runs to it). `--run` is the answer: one run, one database.

```bash
eval "$(scripts/db-substrate/up.sh --run)"     # idempotent; see below
npx vitest run --project db --maxWorkers=1
npx vitest run --project layout --maxWorkers=1
scripts/db-substrate/down.sh                  # stop the stack when you are done
```

## The lifecycle: up → test → down

**A stack costs 150–190 MB and nothing used to stop it.** `up.sh --run`
leaves its database behind on purpose — that is what makes the next run on
the same worktree cheap — but until issue #273 it also left the three
*server processes* running for ever, and removing the worktree did not stop
them. Measured on the shared box on 2026-09-07: **59 substrate processes
holding 2.4 GB of 7.7 GB, 41 of them (1.66 GB) belonging to worktrees that
no longer existed**, across twelve removed worktrees — one of which had
three separate stacks. With swap already full, that is what the kernel was
killing `npm ci` and `next build` to make room for. Roughly every sixth
orphan costs the box a build.

So a run has an end as well as a beginning:

```bash
scripts/db-substrate/down.sh                 # this worktree's run
scripts/db-substrate/down.sh --run <id>      # a named run
scripts/db-substrate/down.sh --drop          # …and drop its database too
scripts/db-substrate/reap.sh                 # every stack whose worktree is gone
```

`--drop` is deliberately not the default: the database is what makes the
next `up.sh` cheap, and dropping it turns every one into a full migration
replay. Stopping the processes is what recovers the memory; the database
costs disk, which this box has.

**Before removing a worktree, stop its stack** — `down.sh --run <id>`, or
`reap.sh` afterwards, which finds any stack whose working directory has been
deleted (including stacks started before #273, which have no state file).

### One run, one stack — never two

`up.sh --run` records what it started in `/tmp/reachkit-substrate/<id>.state`
— the ports, the database and the **pids**. On a second call it reuses that
stack and starts nothing; if the same worktree asks under a *different* id it
is refused, naming the id already running, because two ids for one directory
is how issue-247 came to have three stacks.

The pids are the point. Until #273 this script asked `curl` whether
*something* answered a derived port and, if so, left it alone — so a
**foreign** server on that port was silently adopted as this run's PostgREST,
and the suite then failed with "PostgREST never picked up the migrated
schema", which reads like a rejected JWT and is not. A port says something is
listening; only a recorded pid says it is ours. `down.sh` holds the same
discipline in reverse: it signals only pids `up.sh` recorded, checked against
`/proc/<pid>/cmdline` first, and reports rather than kills anything it cannot
prove is this run's.

`--run` names the run after the current directory — on this layout, the
worktree — so each implementer gets **one** database and reuses it rather
than accumulating one per invocation. `--run <id>` names it explicitly.
The database is `reachkit_scratch_<id>` and the run's **four** service ports
are derived from the same id, so two worktrees never share a port or a row.

Four, not three (issue #296): the stack binds one port for PostgREST, one for
the proxy and **two** for postgres-meta — its server on `PG_META_PORT` and an
admin app on `PG_META_PORT + 1`, which the package hard-codes and no setting
can move. Reserving three put that fourth port on the *next* offset's
PostgREST, so every pair of adjacent offsets collided by construction: run
`issue-291` bound 3554 and run `issue-244` reserved it. A run's block is now
`3200 + offset × 4` through `+ 3`, offsets 0-199, so the whole scheme lives in
3200-3999.
**No lock is needed for the database.** The interim `flock /tmp/layout.lock`
rule this replaced is no longer necessary *for isolation* — though on a box
running several implementers it is still worth holding for **memory**, since
`next build` and Chromium together are the largest thing either suite does.

`up.sh` prints every binding as an `export` line on stdout — the database
name, the proxy URL, the postgres-meta port and the two keys — which is
what `eval` above consumes; progress goes to stderr. The suites read those
bindings and fall back to the shared substrate's values when there are
none, so a run with no `--run` behaves exactly as it did before.

Without `--run` it uses the shared `reachkit_scratch` on `:3001`/`:3002`/
`:8090` (postgres-meta's admin app takes `:8091` with it). **That is what CI
does** — one job, one runner, one database — and CI passes no flag.

### What `up.sh` starts

PostgreSQL must already be listening (CI supplies it as a `postgres:18`
service container). PostgREST comes from Docker, pinned to
`postgrest/postgrest:v16.2`, **or** from a native binary where there is no
Docker: `POSTGREST_BIN`, else one on `PATH`. The native path is what makes
`--run` work on a machine with no Docker at all — without it, per-run
isolation would work in CI and nowhere else, which is the opposite of the
point.

postgres-meta comes from npm, pinned to `@supabase/postgres-meta@0.99.0`
and installed outside the tree. The generator has to be that exact build:
the `supabase/postgres-meta:v0.99.0` image, same version number, emits
`Json` where the package emits `NonNullable<Json>` for a not-null `jsonb`
column, and the staleness check diffs those bytes.

### Reuse is by recorded pid, never by liveness

Re-running `up.sh` for the same run finds its own services through the state
file — a pid it recorded, checked against `/proc/<pid>/cmdline` — and returns
their bindings. A port answered by anything **else** stops the script, naming
the port, the pid holding it and the run whose state file claims it. It never
adopts: "something answers :3002, so it must be mine" is what pointed one
run's reads at another run's database, and #296 removed the last three places
this file still asked that question. The shared stack (no `--run`) is recorded
and reused the same way, and `down.sh --run shared` stops it.

A start that fails part-way stops what it had already started, so a partial
stack is never left for `reap.sh` to find later.

## Keys

`keys.mjs` mints the `anon` and `service_role` JWTs from
`SUBSTRATE_JWT_SECRET`. Nothing is checked in: the database exists only for
the length of a job and is never reachable from outside the runner. The
default secret is the same fixture literal `tests/db/rls.test.ts` carries in
its own source, so the tokens that file mints verify against this PostgREST.
