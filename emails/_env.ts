// emails/_env.ts — the bindings the mail seam parses at module load.
//
// A **side-effect import**, and it has to be: `src/lib/config/env.ts`
// validates `process.env` once, when it is first imported, and throws on a
// missing binding. A module that called an `applyEnvFixture()` of its own
// would have done so after its static imports had already evaluated, which
// is too late. `_preview.ts` imports this first, and the seam second.
//
// The values are `tests/mail/env-fixture.ts`'s — the same ones CI composes
// these mails under, stated in one place. Nothing here reaches a vendor:
// the preview composes fixtures, and `composeMail()` is pure.
import { ENV_FIXTURE } from "../tests/mail/env-fixture";

for (const [name, value] of Object.entries(ENV_FIXTURE)) process.env[name] = value;
