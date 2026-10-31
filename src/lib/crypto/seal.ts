// AES-256-GCM at rest, whose tag makes a tampered ciphertext an error rather than a plausible value.
// Each caller derives its key from `IP_HASH_SALT` under its own HKDF label, so one purpose's key never opens another's.
// Nothing here logs, throws with or returns any part of the plaintext: every failure is the caller's fixed error.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env } from "@/lib/config/env";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** `v1.{iv}.{tag}.{ciphertext}`, base64url; versioned so a key or cipher change can tell the two apart. */
const VERSION = "v1";

export interface Sealer {
  seal(value: unknown): string;
  unseal(sealed: string): unknown;
}

/** `label` is a literal, never composed: changing it makes every value sealed under it undecryptable. */
export function sealer(label: string, fail: (operation: "seal" | "unseal") => Error): Sealer {
  const key = (): Buffer => Buffer.from(hkdfSync("sha256", env.IP_HASH_SALT, "", label, KEY_BYTES));
  return {
    seal(value) {
      try {
        const iv = randomBytes(IV_BYTES);
        const cipher = createCipheriv("aes-256-gcm", key(), iv);
        const body = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value), "utf8")), cipher.final()]);
        const tag = cipher.getAuthTag();
        return [VERSION, iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(".");
      } catch {
        // Dropped, not wrapped: the caught error may carry the plaintext.
        throw fail("seal");
      }
    },
    unseal(sealed) {
      try {
        const [version, iv, tag, body] = sealed.split(".");
        if (version !== VERSION || iv === undefined || tag === undefined || body === undefined) {
          throw fail("unseal");
        }
        const tagBuf = Buffer.from(tag, "base64url");
        if (tagBuf.length !== TAG_BYTES) throw fail("unseal");
        const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
        decipher.setAuthTag(tagBuf);
        const plain = Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]);
        return JSON.parse(plain.toString("utf8"));
      } catch {
        throw fail("unseal");
      }
    },
  };
}
