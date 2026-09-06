// BUILD §9 — the sealed credential: plaintext for the duration of one
// call, and nothing that outlives it.
//
// This directory is the **only** place a destination credential is ever in
// plaintext, and `withConfig` is the only door. It reads the ciphertext,
// decrypts it, invokes the callback with it, and returns **the callback's
// value** — never the config. That is a property of the signature and not
// of the discipline of the caller: `R` is unrelated to `T`, so a callback
// written to return the config is a type error at the call site rather
// than a credential on a screen.
//
// No read path any surface uses selects `config` at all (`store.ts` holds
// the one select list, and it does not name the column), so the ciphertext
// never leaves the database except into this callback.
import { publishDb } from "../../db";
import { seal, SealError, unseal } from "./seal";

export { seal, SealError } from "./seal";

interface ConfigRow {
  config: string | null;
}

/** A destination with no credential to hand over — never connected, or
 *  disconnected since. Distinct from a seal failure: nothing is wrong, and
 *  nothing is there. */
export class NoConfigError extends Error {
  constructor() {
    super("src/lib/publish/destinations/config: the destination holds no credential.");
    this.name = "NoConfigError";
  }
}

/**
 * Runs `fn` with the destination's decrypted config and returns what `fn`
 * returned.
 *
 * The plaintext exists for the duration of the call and is referenced
 * nowhere after it: this function keeps no cache, writes no log line and
 * returns nothing derived from it.
 */
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

/**
 * Destroys the stored credential and takes the destination out of the live
 * set, in one statement.
 *
 * One statement on purpose: a `deleted_at` written without the null, or a
 * null written without the `deleted_at`, are both states this product must
 * never hold — the first is a disconnected destination that still carries
 * the customer's password, the second is a live destination with nothing
 * to publish through. The row itself survives, and so does every
 * publication pointing at it (ADR-080).
 */
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

/** Writes a credential, sealed. The plaintext is not returned, not logged
 *  and not read back. */
export async function storeConfig(destinationId: string, config: unknown): Promise<void> {
  const { error } = await publishDb()
    .from<never>("destinations")
    .update({ config: seal(config) })
    .eq("id", destinationId);
  if (error !== null) {
    throw new SealError("seal");
  }
}
