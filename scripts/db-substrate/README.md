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
```

`--run` names the run after the current directory — on this layout, the
worktree — so each implementer gets **one** database and reuses it rather
than accumulating one per invocation. `--run <id>` names it explicitly.
The database is `reachkit_scratch_<id>` and the three service ports are
derived from the same id, so two worktrees never share a port or a row.
**No lock is needed**, and the interim `flock /tmp/layout.lock` rule this
replaced is no longer necessary.

`up.sh` prints every binding as an `export` line on stdout — the database
name, the proxy URL, the postgres-meta port and the two keys — which is
what `eval` above consumes; progress goes to stderr. The suites read those
bindings and fall back to the shared substrate's values when there are
none, so a run with no `--run` behaves exactly as it did before.

Without `--run` it uses the shared `reachkit_scratch` on `:3001`/`:3002`/
`:8090`. **That is what CI does** — one job, one runner, one database — and
CI passes no flag.

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

A service whose port already answers is left alone, so re-running `up.sh`
for the same id finds its own services and returns their bindings.

## Keys

`keys.mjs` mints the `anon` and `service_role` JWTs from
`SUBSTRATE_JWT_SECRET`. Nothing is checked in: the database exists only for
the length of a job and is never reachable from outside the runner. The
default secret is the same fixture literal `tests/db/rls.test.ts` carries in
its own source, so the tokens that file mints verify against this PostgREST.
