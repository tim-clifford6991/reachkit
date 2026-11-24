// src/lib/scan/pass/row.ts — the scans row a pass writes to: adopted, claimed or closed at 0¢.
import { dbAdmin } from "@/lib/db";
import { parseDomain, type CanonicalDomain } from "../domain";
import type { Tier } from "../report";
import { untyped } from "./sections";

interface RunningScanRow {
  id: string;
  /** Read under an alias, so the column name appears only inside the select string: `admission.ts` is its one writer, and its suite asserts that by pattern over `src/`. */
  fromIncompleteRescan: boolean;
  /** What the row already carries (setup's rival suggestion, on the onboarding row), counted into the pass's own context. */
  costCents?: number | string | null;
}

/** The running row already claimed for this pass, or `null`: for a free
 *  scan the one admission inserted for the domain, and for a pass that
 *  belongs to a site the one setup claimed for that site. */
export async function adoptClaimedRow(a: {
  domain: CanonicalDomain;
  tier: Tier;
  siteId?: string;
}): Promise<RunningScanRow | null> {
  const running = untyped(dbAdmin())
    .from<RunningScanRow>("scans")
    .select("id, fromIncompleteRescan:from_incomplete_rescan, costCents:cost_cents")
    .eq("tier", a.tier)
    .eq("status", "running");
  const { data, error } = await (a.siteId === undefined
    ? running.eq("domain", a.domain)
    : running.eq("site_id", a.siteId)
  )
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`runScan: could not read the claimed scan row: ${error.message}`);
  return data?.[0] ?? null;
}

/** Closes a row out without spending anything — the seven-day window's
 *  arm, where the stored report is served and no pass runs. */
export async function closeWithoutSpending(scanId: string): Promise<void> {
  const { error } = await untyped(dbAdmin())
    .from<{ id: string }>("scans")
    .update({
      status: "done",
      cost_cents: 0,
      stopped_reason: "complete",
      finished_at: new Date().toISOString(),
    })
    .eq("id", scanId);
  if (error) throw new Error(`runScan: could not close the adopted row: ${error.message}`);
}

/** Inserts the `running` row a paid pass writes to, before any spend: `fetches.scan_id` and `opportunities.scan_id` reference it.
 *  The free path, deep pass and weekly pass adopt or claim their own rows; every other pass claims here, and `store_current_report` updates it.
 *  No `week_start`, `is_current` or cost: this is the row, not the report. */
export async function claimPassRow(a: {
  scanId: string;
  domain: CanonicalDomain;
  tier: Tier;
  siteId?: string;
  /** The visitor's network, so the row counts against their free bounds. */
  network?: string;
}): Promise<{ claimed: boolean }> {
  const { error } = await untyped(dbAdmin())
    .from<{ id: string }>("scans")
    .insert({
      id: a.scanId,
      domain: a.domain,
      tier: a.tier,
      status: "running",
      ...(a.siteId === undefined ? {} : { site_id: a.siteId }),
      ...(a.network === undefined ? {} : { network_hash: a.network }),
    });
  // The row already exists: a claim made earlier under the same id.
  if (error?.code === UNIQUE_VIOLATION) return { claimed: false };
  if (error) throw new Error(`runScan: could not claim the scan row: ${error.message}`);
  return { claimed: true };
}

const UNIQUE_VIOLATION = "23505";

/** Claims one site's onboarding row before anything is spent and answers its id: setup calls it on accepting the address, so its rival suggestion
 *  ledgers against a row that exists, and the deep pass calls it again and adopts it. The id derives from the site id, so a second claim conflicts
 *  and only moves the address while still running; an ended pass is not re-opened. A row abandoned in setup stays `running` and guards nothing. */
export async function claimOnboardingPass(a: { siteId: string; domain: string }): Promise<string> {
  const parsed = parseDomain(a.domain);
  if (!parsed.ok) throw new Error(`claimOnboardingPass: ${parsed.problem}`);
  const scanId = await onboardingPassId(a.siteId);
  const { claimed } = await claimPassRow({
    scanId,
    domain: parsed.domain,
    tier: "deep",
    siteId: a.siteId,
  });
  if (!claimed) {
    const { error } = await untyped(dbAdmin())
      .from<{ id: string }>("scans")
      .update({ domain: parsed.domain, created_at: new Date().toISOString() })
      .eq("id", scanId)
      .eq("status", "running");
    if (error) throw new Error(`claimOnboardingPass: could not re-claim ${scanId}: ${error.message}`);
  }
  return scanId;
}

/** Whether this one row is still `running`. */
export async function passRunning(scanId: string): Promise<boolean> {
  const { data, error } = await untyped(dbAdmin()).from<{ id: string }>("scans").select("id").eq("id", scanId).eq("status", "running").limit(1);
  if (error) throw new Error(`passRunning: could not read ${scanId}: ${error.message}`);
  return (data ?? []).length > 0;
}

/** A UUID named by the site (the version-5 layout over SHA-1): the same
 *  site always names the same row, and no two sites name one. */
async function onboardingPassId(siteId: string): Promise<string> {
  const name = new TextEncoder().encode(`reachkit/onboarding-pass/${siteId}`);
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-1", name)).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
