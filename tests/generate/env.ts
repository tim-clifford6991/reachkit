// tests/generate/env.ts — the bindings `src/lib/config/env.ts` parses at
// module load, applied as a side effect.
//
// Not a suite. `env` validates `process.env` once, at import time, and this
// engine's store reaches `@/lib/db`, which reaches `env`. Every file under
// `tests/generate/` imports this one **first**, so the bindings exist
// before any module under test is evaluated.
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();
