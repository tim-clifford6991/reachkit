// AES-256-GCM at rest, whose tag makes a tampered ciphertext an error rather than a plausible value.
// Each caller's key is `keyFor` its own label, so one purpose's key never opens another's.
// Nothing here logs, throws with or returns any part of the plaintext: every failure is the caller's fixed error.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { keyFor, keysFor } from "./keys";

const IV_BYTES = 12;
const TAG_BYTES = 16;

/** `v1.{iv}.{tag}.{ciphertext}`, base64url; versioned so a key or cipher change can tell the two apart. */
const VERSION = "v1";

export interface Sealer {
  seal(value: unknown): string;
  unseal(sealed: string): unknown;
  /** `resealed` is the value under the current root where it was sealed under the previous one, else `null`. */
  open(sealed: string): { value: unknown; resealed: string | null };
}

/** `label` is a literal, never composed: changing it makes every value sealed under it undecryptable. */
export function sealer(label: string, fail: (operation: "seal" | "unseal") => Error): Sealer {
  function seal(value: unknown): string {
    try {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", keyFor(label), iv);
      const body = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value), "utf8")), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [VERSION, iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(".");
    } catch {
      // Dropped, not wrapped: the caught error may carry the plaintext.
      throw fail("seal");
    }
  }
  function opened(sealed: string, key: Buffer): unknown {
    try {
      const [version, iv, tag, body] = sealed.split(".");
      if (version !== VERSION || iv === undefined || tag === undefined || body === undefined) return undefined;
      const tagBuf = Buffer.from(tag, "base64url");
      if (tagBuf.length !== TAG_BYTES) return undefined;
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
      decipher.setAuthTag(tagBuf);
      const plain = Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]);
      return JSON.parse(plain.toString("utf8"));
    } catch {
      return undefined;
    }
  }
  // `JSON.stringify` never yields the text `undefined`, so `undefined` here only ever means "this key did not open it".
  function open(sealed: string): { value: unknown; resealed: string | null } {
    for (const [index, key] of keysFor(label).entries()) {
      const value = opened(sealed, key);
      if (value !== undefined) return { value, resealed: index === 0 ? null : seal(value) };
    }
    throw fail("unseal");
  }
  return { seal, open, unseal: (sealed) => open(sealed).value };
}
