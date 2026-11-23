// Every server key comes from the one root secret here, each under its own HKDF label, so a rotation has one place to change.
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";

const KEY_BYTES = 32;

/** `label`'s key under each root, current first: the previous root only opens and verifies, it never signs or seals. */
export function keysFor(label: string): Buffer[] {
  const roots = env.IP_HASH_SALT_PREVIOUS === undefined ? [env.IP_HASH_SALT] : [env.IP_HASH_SALT, env.IP_HASH_SALT_PREVIOUS];
  return roots.map((root) => Buffer.from(hkdfSync("sha256", root, "", label, KEY_BYTES)));
}

/** `label` is a literal, never composed: changing it changes every value derived under it. */
export function keyFor(label: string): Buffer {
  return keysFor(label)[0]!;
}

/** HMAC-SHA256 of `data` under `label`'s key. */
export function macFor(label: string, data: string): Buffer {
  return createHmac("sha256", keyFor(label)).update(data).digest();
}

/** Whether `given` is `data`'s MAC under `label` and either root, so a link mailed before a rotation still works. */
export function macMatches(label: string, data: string, given: Buffer): boolean {
  return keysFor(label).some((key) => {
    const expected = createHmac("sha256", key).update(data).digest();
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Keyed by the root itself, not a label: stored `scans.network_hash` rows were written that way and must keep matching. */
export function rootMac(data: string): Buffer {
  return createHmac("sha256", env.IP_HASH_SALT).update(data).digest();
}
