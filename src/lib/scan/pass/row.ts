// src/lib/scan/pass/row.ts — the scans row a pass writes to: adopted, claimed or closed at 0¢.
import { dbAdmin } from "@/lib/db";
import { parseDomain, type CanonicalDomain } from "../domain";
import type { Tier } from "../report";
import { untyped } from "./sections";

interface RunningScanRow {
  id: string;
  /** Read under an alias, so the column name appears in this file only
   *  inside the select string. `admission.ts` is the one place the column
   *  is ever *written*, and its own suite asserts that by pattern over
   *  `src/`; a read shape that spelled the column as a property would read
   *  to that check as a second writer. */
  fromIncompleteRescan: boolean;
  /** What the row already carries — setup's rival suggestion, on the
   *  onboarding row (issue 798). Counted into the pass's own context. */
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

/**
 * Inserts the `running` row a paid pass writes to, before any spend.
 *
 * `fetches.scan_id` and `opportunities.scan_id` both reference `scans
 * (id)`, so a pass whose row does not exist yet can neither ledger a
 * vendor call nor persist an opportunity against it. The free path adopts
 * the row admission already claimed, the deep pass adopts the one
 * `claimOnboardingPass` claimed, and the weekly pass claims its own (that
 * claim is also the once-a-week guarantee and carries `week_start`, which
 * is why it stays `runWeekly`'s); every other pass claims here, and
 * `store_current_report` then updates this row rather than inserting one.
 *
 * No `week_start`, no `is_current`, no cost: this is the row, not the
 * report. Nothing about the pass is decided by it.
 */
export async function claimPassRow(a: {
  scanId: string;
  domain: CanonicalDomain;
  tier: Tier;
  siteId?: string;
}): Promise<{ claimed: boolean }> {
  const { error } = await untyped(dbAdmin())
    .from<{ id: string }>("scans")
    .insert({
      id: a.scanId,
      domain: a.domain,
      tier: a.tier,
      status: "running",
      ...(a.siteId === undefined ? {} : { site_id: a.siteId }),
    });
  // The row already exists: a claim made earlier under the same id.
  if (error?.code === UNIQUE_VIOLATION) return { claimed: false };
  if (error) throw new Error(`runScan: could not claim the scan row: ${error.message}`);
  return { claimed: true };
}

const UNIQUE_VIOLATION = "23505";

/**
 * Claims the onboarding pass's row for one site, before anything is spent
 * against it, and answers its id (owner ruling, 2026-09-16).
 *
 * Setup calls this when it accepts the founder's address, so the rival
 * suggestion a stated market needs — `competitors_domain`, a vendor call —
 * is ledgered against a row that exists (`fetches.scan_id` is `not null`).
 * The deep pass calls it again as it starts, then adopts the row
 * (`adoptsClaim`), so a founder whose address was never sought through
 * setup still gets exactly one.
 *
 * **One row per site, held by the primary key.** The id is derived from
 * the site id, so a second claim — the same founder's next address, a
 * request racing another, the pass itself — conflicts on insert rather
 * than adding a row, and only moves the address the row is for, while it
 * is still running. Setup completes once, so a site has one onboarding
 * pass, and a pass that has already ended is not re-opened: the pass
 * started for it adopts nothing and stops.
 *
 * **A founder who abandons setup leaves the row `running`**, with no
 * report, no `is_current`, no network hash and no cost beyond the ledgered
 * suggestion. No guard is held by it: admission's in-flight bound and the
 * stuck-row sweep are both the free tier's, the account's own screens open
 * only once setup is complete, and account deletion takes it with the site.
 */
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
