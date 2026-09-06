// BUILD §9 — "credentials encrypted at rest, never logged, revoked on
// disconnect". This file is the "encrypted at rest" half.
//
// Authenticated symmetric encryption, AES-256-GCM: the tag is what makes a
// tampered ciphertext an error rather than a plausible object, which
// matters because what comes back out of it is handed to a destination as
// a credential.
//
// **The key is derived, not stored a second time.** `IP_HASH_SALT` is the
// one long-lived server-only secret this deployment already holds, and
// `src/lib/mail/leads/optout.ts` and `src/lib/mail/notifications/
// unsubscribe.ts` already derive their own signing keys from it through
// HKDF with a purpose label. This file takes the same road with its own
// label, so no key derived here can verify or decrypt anything derived
// there. A dedicated binding of its own is the better long-term answer and
// is the owner's to add (see the PR's "Owner owes"): it would let the
// credential key rotate independently, which deriving from a shared secret
// does not.
//
// **Nothing here logs, throws with, or returns any part of a credential.**
// Every failure arm below carries a fixed sentence and no value: an error
// message is a string that ends up in a log, a stack, a serialised
// response — and §9's "never logged" is a promise about all of them, not
// about `console.log` alone.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env } from "@/lib/config/env";

/** The purpose label. Changing it makes every stored credential
 *  undecryptable, which is why it is a literal and never composed. */
const HKDF_INFO = "reachkit/publish/destination-config/v1";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** The one format this file writes and the only one it reads:
 *  `v1.{iv}.{tag}.{ciphertext}`, each part base64url. A version prefix
 *  because a key or cipher change has to be able to tell the two apart. */
const VERSION = "v1";

function configKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", env.IP_HASH_SALT, "", HKDF_INFO, KEY_BYTES));
}

/** A credential that could not be sealed or unsealed. Its message names
 *  the operation and nothing else — never the value, never a cipher
 *  detail, never a fragment of the input. */
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
    // The caught error may carry the plaintext (a circular structure
    // names its own path); it is dropped here rather than wrapped.
    throw new SealError("seal");
  }
}

/** The `config` column's value → plaintext config. Internal to this
 *  directory: `withConfig` is the only caller, so the plaintext exists
 *  only inside one call. */
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
