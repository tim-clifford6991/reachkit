#!/usr/bin/env bash
# scripts/db-substrate/gen-types.sh
#
# Emits the TypeScript `Database` type for the live scratch schema — the same
# bytes `supabase gen types typescript --local` emits, because it asks the
# same generator: postgres-meta, which the Supabase CLI shells out to.
#
# `tests/db/clients.test.ts`'s staleness check runs this and diffs the result
# against the checked-in `src/lib/db/types.generated.ts`.
#
# Usage: gen-types.sh > src/lib/db/types.generated.ts
set -euo pipefail
PGMETA_PORT="${PGMETA_PORT:-8090}"
curl -sf "http://127.0.0.1:${PGMETA_PORT}/generators/typescript?included_schemas=public&detect_one_to_one_relationships=true"
