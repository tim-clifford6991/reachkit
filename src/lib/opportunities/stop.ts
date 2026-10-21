// SPEC §8 — the Monday mail's stop link for a page the week planned but has
// not written yet. No draft exists to bind a veto token to, so the token is
// signed over (site, opportunity, day) and stores nothing. Stopping dismisses
// the page while it is still `open`, and that day then takes the week's next
// spare (`pageForDay`). No draft moves, so ADR-080 is not reached. Once the
// page is written, its own draft-bound link applies.
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";
import { dbAdmin } from "@/lib/db";
import { opportunityStore } from "./store";

const HKDF_INFO = "reachkit/planned-stop-token/v1";
const SEPARATOR = ".";

export interface PlannedPage {
  readonly query: string | null;
  readonly volume: number | null;
  readonly domain: string | null;
  /** The ISO date the page was planned for. */
  readonly day: string;
}

export type PlannedPreview =
  | { ok: true; planned: PlannedPage }
  | { ok: false; reason: "used"; domain: string | null }
  | { ok: false; reason: "written" | "expired" | "unknown" };

function macOf(payload: string): Buffer {
  const key = Buffer.from(hkdfSync("sha256", env.IP_HASH_SALT, "", HKDF_INFO, 32));
  return createHmac("sha256", key).update(payload).digest();
}

export function plannedStopToken(a: { siteId: string; opportunityId: string; day: string }): string {
  const payload = `${a.siteId}:${a.opportunityId}:${a.day}`;
  return `${Buffer.from(payload).toString("base64url")}${SEPARATOR}${macOf(payload).toString("base64url")}`;
}

/** A veto token is bare base64url, which never holds the separator. */
export function isPlannedStopToken(token: string): boolean {
  return token.includes(SEPARATOR);
}

function readToken(token: string): { siteId: string; opportunityId: string; day: string } | null {
  const [encoded, mac, ...rest] = token.split(SEPARATOR);
  if (encoded === undefined || mac === undefined || rest.length > 0) return null;
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const given = Buffer.from(mac, "base64url");
  const expected = macOf(payload);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const [siteId, opportunityId, day, ...more] = payload.split(":");
  if (!siteId || !opportunityId || !day || more.length > 0) return null;
  return { siteId, opportunityId, day };
}

export async function previewPlannedStop(token: string, at: Date = new Date()): Promise<PlannedPreview> {
  const read = readToken(token);
  if (read === null) return { ok: false, reason: "unknown" };
  const row = await opportunityStore().byId(read.opportunityId);
  if (row === null || row.site_id !== read.siteId) return { ok: false, reason: "unknown" };
  const domain = await domainOf(read.siteId);
  if (row.status === "dismissed") return { ok: false, reason: "used", domain };
  // The page goes live on its day, so after that day there is nothing to stop.
  if (read.day < at.toISOString().slice(0, 10)) return { ok: false, reason: "expired" };
  if (row.status !== "open") return { ok: false, reason: "written" };
  return { ok: true, planned: { query: row.target_query, volume: row.volume, domain, day: read.day } };
}

/** Stops the planned page where the preview would still offer it. */
export async function stopPlannedPage(token: string, at: Date = new Date()): Promise<PlannedPreview> {
  const preview = await previewPlannedStop(token, at);
  if (!preview.ok) return preview;
  // A draft saved since the read has taken the page out of `open`, so it is not stopped.
  if (await opportunityStore().dismissIfOpen(readToken(token)!.opportunityId)) return preview;
  return previewPlannedStop(token, at);
}

async function domainOf(siteId: string): Promise<string | null> {
  const { data } = await (dbAdmin() as unknown as {
    from(t: string): { select(c: string): { eq(c: string, v: string): PromiseLike<{ data: { domain: string | null }[] | null }> } };
  })
    .from("sites")
    .select("domain")
    .eq("id", siteId);
  return data?.[0]?.domain ?? null;
}
