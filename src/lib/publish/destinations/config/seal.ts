// BUILD §9 — "credentials encrypted at rest, never logged, revoked on disconnect": the at-rest half, AES-256-GCM, whose
// tag makes a tampered ciphertext an error rather than a plausible credential.
// The key is HKDF-derived from `IP_HASH_SALT` under its own label, so nothing derived for the mail links can decrypt it;
// a dedicated binding would let it rotate alone.
// Nothing here logs, throws with or returns any part of a credential: every failure carries a fixed sentence, because
// §9's "never logged" covers logs, stacks and responses alike.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env } from "@/lib/config/env";

/** A literal, never composed: changing it makes every stored credential undecryptable. */
const HKDF_INFO = "reachkit/publish/destination-config/v1";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** `v1.{iv}.{tag}.{ciphertext}`, base64url; versioned so a key or cipher change can tell the two apart. */
const VERSION = "v1";

function configKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", env.IP_HASH_SALT, "", HKDF_INFO, KEY_BYTES));
}

/** Its message names the operation only, never the value, a cipher detail or a fragment of the input. */
export class SealError extends Error {
  constructor(operation: "seal" | "unseal") {
    super(`src/lib/publish/destinations/config: could not ${operation} a destination credential.`);
    this.name = "SealError";
  }
}

/** Plaintext config → the string the `config` column holds. */
export function seal(config: unknown): string {
  try {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", configKey(), iv);
    const body = Buffer.concat([
      cipher.update(Buffer.from(JSON.stringify(config), "utf8")),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(".");
  } catch {
    // Dropped, not wrapped: the caught error may carry the plaintext.
    throw new SealError("seal");
  }
}

/** The `config` column's value → plaintext; `withConfig` is the only caller, so it exists inside one call. */
export function unseal(sealed: string): unknown {
  try {
    const [version, iv, tag, body] = sealed.split(".");
    if (version !== VERSION || iv === undefined || tag === undefined || body === undefined) {
      throw new SealError("unseal");
    }
    const tagBuf = Buffer.from(tag, "base64url");
    if (tagBuf.length !== TAG_BYTES) throw new SealError("unseal");
    const decipher = createDecipheriv("aes-256-gcm", configKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(tagBuf);
    const plain = Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]);
    return JSON.parse(plain.toString("utf8"));
  } catch {
    throw new SealError("unseal");
  }
}
