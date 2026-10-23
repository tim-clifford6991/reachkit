// BUILD §9 — "Pause all pages" from the Monday mail: a signed link that switches publishing off.
//
// Signed over the site alone, under its own HKDF label, so it can do this one
// thing and nothing else: it is never a sign-in, an unsubscribe or a stop of one
// page. It moves no page and takes no transition; it records the switch through
// `setPublishing`, as Settings does. Applying it twice writes once.
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";
import { publishDb } from "../db";
import { setPublishing } from "./index";

const HKDF_INFO = "reachkit/pause-link/v1";
const SEPARATOR = ".";

function macOf(siteId: string): Buffer {
  const key = Buffer.from(hkdfSync("sha256", env.IP_HASH_SALT, "", HKDF_INFO, 32));
  return createHmac("sha256", key).update(`pause:${siteId}`).digest();
}

export function pauseTokenFor(siteId: string): string {
  return `${Buffer.from(siteId).toString("base64url")}${SEPARATOR}${macOf(siteId).toString("base64url")}`;
}

/** Pure: the site a token was signed for, or `null` where it was not signed by us. */
export function readPauseToken(token: string): string | null {
  const [site, mac, ...rest] = token.split(SEPARATOR);
  if (site === undefined || mac === undefined || rest.length > 0) return null;
  const siteId = Buffer.from(site, "base64url").toString("utf8");
  const given = Buffer.from(mac, "base64url");
  const expected = macOf(siteId);
  if (siteId === "" || given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return siteId;
}

/** Switches publishing off for the token's site, once; a site already paused is left as it is. */
export async function applyPauseToken(token: string): Promise<{ paused: true } | { error: "invalid" | "unavailable" }> {
  const siteId = readPauseToken(token);
  if (siteId === null) return { error: "invalid" };
  try {
    const { data, error } = await publishDb()
      .from<{ user_id: string; publishing_enabled: boolean | null }>("sites")
      .select("user_id, publishing_enabled")
      .eq("id", siteId)
      .single();
    if (error !== null || data === null) return { error: "unavailable" };
    if (data.publishing_enabled === true) await setPublishing(siteId, false, { kind: "customer", userId: data.user_id });
    return { paused: true };
  } catch {
    return { error: "unavailable" };
  }
}
