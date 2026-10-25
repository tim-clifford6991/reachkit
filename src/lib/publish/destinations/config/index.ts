// BUILD §9 — the sealed credential: plaintext for one call and nothing that outlives it. This directory is the only place
// a credential is plaintext, and `withConfig` the only door: it returns the callback's value, never the config, and `R`
// is unrelated to `T` so returning the config is a type error. No surface's select list names `config` (`store.ts`).
import { publishDb } from "../../db";
import { seal, SealError, unseal } from "./seal";

export { seal, SealError } from "./seal";

interface ConfigRow {
  config: string | null;
}

/** No credential to hand over (never connected, or disconnected); unlike a seal failure, nothing is wrong. */
export class NoConfigError extends Error {
  constructor() {
    super("src/lib/publish/destinations/config: the destination holds no credential.");
    this.name = "NoConfigError";
  }
}

/** Runs `fn` with the decrypted config and returns what it returned; no cache, no log line, nothing derived. */
export async function withConfig<T, R>(
  destinationId: string,
  fn: (cfg: T) => Promise<R>
): Promise<R> {
  const { data, error } = await publishDb()
    .from<ConfigRow>("destinations")
    .select("config")
    .eq("id", destinationId)
    .limit(1);
  if (error !== null || data === null) throw new NoConfigError();
  const row = data[0];
  if (row === undefined || row.config === null) throw new NoConfigError();
  return fn(unseal(row.config) as T);
}

/** Destroys the credential and takes the destination out of the live set in one statement, since either write alone is
 *  a state never held: a disconnected destination with a password, or a live one with nothing to publish through.
 *  The row survives, and so does every publication pointing at it (ADR-080). */
export async function destroyConfig(destinationId: string, at: Date): Promise<void> {
  const { error } = await publishDb()
    .from<never>("destinations")
    .update({ config: null, deleted_at: at.toISOString() })
    .eq("id", destinationId);
  if (error !== null) {
    throw new Error(
      "src/lib/publish/destinations/config: could not destroy the destination credential."
    );
  }
}

/** Writes a credential, sealed; the plaintext is not returned, logged or read back. */
export async function storeConfig(destinationId: string, config: unknown): Promise<void> {
  const { error } = await publishDb()
    .from<never>("destinations")
    .update({ config: seal(config) })
    .eq("id", destinationId);
  if (error !== null) {
    throw new SealError("seal");
  }
}
