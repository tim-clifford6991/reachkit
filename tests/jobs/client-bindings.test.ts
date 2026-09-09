// tests/jobs/client-bindings.test.ts — issue #315
//
// The two jobs bindings are declared in one place and read in another. The
// env schema (`src/lib/config/env.ts`) declares `INNGEST_SIGNING_KEY` and
// `INNGEST_EVENT_KEY`, validates them, and refuses the boot of a real
// deployment that carries neither; the platform SDK reads them for itself,
// out of `process.env`, by those same names. Nothing passes one to the
// other — `src/jobs/client.ts` says why: both are server-only, and that
// module is loaded from a rendered screen through the setup store, so a
// read at its module load would throw in a browser-like environment.
//
// That leaves one seam worth a test: the two names must be the same names.
// A rename on either side would otherwise be silent — the schema would
// validate a binding nothing reads, and the client would fall back to no
// key at all, which shows up as jobs that never run.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubEnv } from "./env-fixture";

beforeEach(() => stubEnv(false));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the client resolves exactly the bindings the schema declares", () => {
  it("takes its event key from INNGEST_EVENT_KEY", async () => {
    const { client } = await import("@/jobs/client");
    expect(client.eventKey).toBe("event-key-fixture");
  });

  it("takes its signing key from INNGEST_SIGNING_KEY", async () => {
    const { client } = await import("@/jobs/client");
    expect(client.signingKey).toBe("signkey-fixture");
  });

  it("both are members of the env schema under the same names", async () => {
    const { env } = await import("@/lib/config/env");
    expect(env.INNGEST_EVENT_KEY).toBe("event-key-fixture");
    expect(env.INNGEST_SIGNING_KEY).toBe("signkey-fixture");
  });

  it("a client built with neither binding set resolves no key, rather than inventing one", async () => {
    vi.stubEnv("INNGEST_EVENT_KEY", undefined);
    vi.stubEnv("INNGEST_SIGNING_KEY", undefined);
    vi.resetModules();
    const { client } = await import("@/jobs/client");
    expect(client.eventKey).toBeUndefined();
    expect(client.signingKey).toBeUndefined();
  });
});
