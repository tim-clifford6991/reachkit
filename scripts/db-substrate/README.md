# `db` project substrate

The `db` vitest project (`vitest.config.ts`'s `LIVE_SCHEMA_TESTS`) asserts the
schema against a **live, migrated PostgreSQL**, not against migration text.
This directory is what it talks to, reduced to the four parts those suites
actually use:

| part | where | why |
| --- | --- | --- |
| PostgreSQL 18 | `127.0.0.1:5432`, db `reachkit_scratch`, user `reachkit`/`reachkit` | the suites spawn `psql` and reset `public` between files |
| roles + `auth.uid()`/`auth.role()` | `shim.sql` | RLS policies call them; they live outside `supabase/migrations/` |
| PostgREST + a `/rest/v1` proxy | `:3002` behind `:3001` | `tests/db/rls.test.ts` drives RLS through `@supabase/supabase-js`, which builds its URLs as `<SUPABASE_URL>/rest/v1/…` |
| postgres-meta | `:8090` | `gen-types.sh` — the generator `supabase gen types` shells out to; `tests/db/clients.test.ts` diffs its output against the checked-in `src/lib/db/types.generated.ts` |

`SUPABASE_URL` is therefore `http://127.0.0.1:3001` and `DATABASE_URL` is
`postgresql://reachkit:reachkit@127.0.0.1:5432/reachkit_scratch` — the values
the suites hard-code.

## Running it

```bash
scripts/db-substrate/up.sh      # idempotent
npx vitest run --project db
```

`up.sh` assumes PostgreSQL is already listening (CI supplies it as a
`postgres:18` service container) and starts the rest with Docker, pinned to
`postgrest/postgrest:v16.2` and `supabase/postgres-meta:v0.99.0`. A service
whose port already answers is left alone, so on a host without Docker you can
start PostgREST and postgres-meta natively and `up.sh` will use those.

## Keys

`keys.mjs` mints the `anon` and `service_role` JWTs from
`SUBSTRATE_JWT_SECRET`. Nothing is checked in: the database exists only for
the length of a job and is never reachable from outside the runner. The
default secret is the same fixture literal `tests/db/rls.test.ts` carries in
its own source, so the tokens that file mints verify against this PostgREST.
