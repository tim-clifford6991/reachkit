// Every server key comes from the one root secret here, each under its own HKDF label, so a rotation has one place to change.
import { createHmac, hkdfSync } from "node:crypto";
import { env } from "@/lib/config/env";

const KEY_BYTES = 32;

/** `label` is a literal, never composed: changing it changes every value derived under it. */
export function keyFor(label: string): Buffer {
  return Buffer.from(hkdfSync("sha256", env.IP_HASH_SALT, "", label, KEY_BYTES));
}

/** HMAC-SHA256 of `data` under `label`'s key. */
export function macFor(label: string, data: string): Buffer {
  return createHmac("sha256", keyFor(label)).update(data).digest();
}

/** Keyed by the root itself, not a label: stored `scans.network_hash` rows were written that way and must keep matching. */
export function rootMac(data: string): Buffer {
  return createHmac("sha256", env.IP_HASH_SALT).update(data).digest();
}
