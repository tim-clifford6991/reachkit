// BUILD §9 — "credentials encrypted at rest, never logged, revoked on disconnect": the at-rest half, under publish's
// own HKDF label so nothing derived for the mail links or the sign-in links can decrypt it.
import { sealer } from "@/lib/crypto/seal";

/** Its message names the operation only, never the value, a cipher detail or a fragment of the input. */
export class SealError extends Error {
  constructor(operation: "seal" | "unseal") {
    super(`src/lib/publish/destinations/config: could not ${operation} a destination credential.`);
    this.name = "SealError";
  }
}

/** A literal, never composed: changing it makes every stored credential undecryptable. */
const DESTINATION_CONFIG_LABEL = "reachkit/publish/destination-config/v1";

const destinationConfig = sealer(DESTINATION_CONFIG_LABEL, (operation) => new SealError(operation));

/** Plaintext config → the string the `config` column holds. */
export const seal = (config: unknown): string => destinationConfig.seal(config);

/** The `config` column's value → plaintext; `withConfig` is the only caller, so it exists inside one call. */
export const unseal = (sealed: string): unknown => destinationConfig.unseal(sealed);
