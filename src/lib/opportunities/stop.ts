// SPEC §8 — the Monday mail's stop link for a page planned but not written: signed over (site, opportunity, day), storing
// nothing. Stopping dismisses the open row, so no draft moves and ADR-080 is not reached; a written page has its own link.
import { timingSafeEqual } from "node:crypto";
import { macFor } from "@/lib/crypto/keys";
import { dbAdmin } from "@/lib/db";
import { weekStartFor } from "@/lib/scan/weekly/week";
import { opportunityStore } from "./store";
import type { PlanReason } from "./types";

const HKDF_INFO = "reachkit/planned-stop-token/v1";
const SEPARATOR = ".";

export interface PlannedPage {
  readonly query: string | null;
  readonly volume: number | null;
  readonly domain: string | null;
  /** The ISO date the page is planned for now; `null` where a hot page moved it out of the week until `waitsFor`. */
  readonly day: string | null;
  readonly waitsFor: string | null;
  /** The first day it was planned for, where a hot page moved it. */
  readonly movedFrom: string | null;
  /** Why the week chose it; `null` where the commit kept no reason. */
  readonly reason: PlanReason | null;
}

export type PlannedPreview =
  | { ok: true; planned: PlannedPage }
  | { ok: false; reason: "used"; domain: string | null }
  | { ok: false; reason: "written" | "expired" | "unknown" };

function macOf(payload: string): Buffer {
  return macFor(HKDF_INFO, payload);
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
  // The token's day only names the link: a page still in the week is read at its current day, which it goes live on.
  const today = at.toISOString().slice(0, 10), day = row.plan_place == null ? read.day : (row.planned_for ?? null);
  if (day !== null && day < today) return { ok: false, reason: "expired" };
  if (row.status !== "open") return { ok: false, reason: "written" };
  const waitsFor = day === null ? new Date(Date.parse(`${weekStartFor({ at, zone: "UTC" })}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10) : null;
  return { ok: true, planned: { query: row.target_query, volume: row.volume, domain, day, waitsFor, movedFrom: row.plan_reason?.moved?.from ?? null, reason: row.plan_reason ?? null } };
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
  return (await dbAdmin().from("sites").select("domain").eq("id", siteId)).data?.[0]?.domain ?? null;
}
