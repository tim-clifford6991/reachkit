// tests/opportunities/env.ts — the bindings `src/lib/config/env.ts` parses
// at module load, applied as a side effect.
//
// Not a suite. `env` validates `process.env` once, at import time, and the
// engine's store reaches `@/lib/db`, which reaches `env`. Every file in
// this directory imports this one **first**, so the bindings exist before
// any module under test is evaluated.
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();
