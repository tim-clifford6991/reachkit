// BUILD §9 — the freshness promise, kept on the read path.
//
// The date the customer reads about a destination is never more than
// `DESTINATION_HEALTH_MAX_AGE_H` old, **whether or not a publish was
// attempted in between**. That promise is about the moment they read it,
// so it is kept where they read it: `listDestinations` calls this, and a
// stale row is re-checked in line before the list is returned.
//
// Refreshing only on publish would fail it exactly where it matters most —
// a destination breaks, publishing stops, so nothing attempts a publish,
// so nothing refreshes, and the customer reads a date from before the
// breakage. And a job would fail it in a second way: §11's kill
// switch stops `publish/execute` and `draft/generate`, and a stop must not
// take the truth of a date on a screen with it.
//
// The cost is that a read path can make a network call, which is why it is
// debounced and why at most one live destination per site exists to check.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-01: A credential that cannot publish is its own occasion (a
//   `HealthReason`, not a fourth health state) with a distinct line and an action leading to a
//   different account. — ADR-086
//
// DECISIONS 2026-09-07: canStamp is a read beside canPublish sharing no implementation
//   (manage_categories on /users/me?context=edit); destinations.stamp_capable is nullable with
//   no default (null = hosted, never probed, or unreadable), written by its own writer;
//   checkHealth records it and it never changes health; the adapter looks the term up first
//   and treats an unreadable probe as no permission to write a term, the page still publishing
//   with stampApplied false; the lifecycle wire is registered from the publishing side at boot
//   (ADR-050 shape). — #208

import { DESTINATION_HEALTH_DEBOUNCE_S, DESTINATION_HEALTH_MAX_AGE_H } from "@/lib/config/constants";
import type { DestinationView } from "../../types";
import { heldPages } from "../../switch";
import { destinationView } from "../view";
import { readDestination, type DestinationRecord } from "../store";
import { checkHealth } from "./check";

export { checkHealth } from "./check";
export type { HealthCheck } from "./check";
export { breakageMailDue, sendBreakageMail } from "./breakage-mail";
export type { BreakageMail } from "./breakage-mail";

const HOUR_MS = 3_600_000;
const SECOND_MS = 1_000;

/** When each destination was last checked *by this process*. The debounce
 *  is a burst collapser, not a correctness mechanism: the stored
 *  `last_checked_at` is what the freshness promise is made against, and a
 *  process that has never seen a destination simply checks it. */
const lastCheckedHere = new Map<string, number>();

/** Vitest keeps one module instance per file; a debounce that outlived a
 *  test would make the next one's first read a no-op. */
export function __resetHealthDebounceForTesting(): void {
  lastCheckedHere.clear();
}

/**
 * What the capability probe last found for this destination, as recorded
 * on its row.
 *
 * Three values and not two: `true` and `false` are answers, and `null` is
 * "not asked" — a hosted destination, which has no such distinction to
 * draw, or a WordPress destination no check has reached yet. A caller that
 * read `null` as `false` would tell a customer their account cannot publish
 * before anything had asked it (ADR-086 Decision 1).
 */
export async function publishCapability(destinationId: string): Promise<boolean | null> {
  const row = await readDestination(destinationId);
  return row?.publish_capable ?? null;
}

function isStale(row: DestinationRecord, now: Date): boolean {
  const checkedAt = Date.parse(row.last_checked_at);
  if (Number.isNaN(checkedAt)) return true;
  return now.getTime() - checkedAt >= DESTINATION_HEALTH_MAX_AGE_H * HOUR_MS;
}

function debounced(destinationId: string, now: Date): boolean {
  const last = lastCheckedHere.get(destinationId);
  return last !== undefined && now.getTime() - last < DESTINATION_HEALTH_DEBOUNCE_S * SECOND_MS;
}

/**
 * The destination as a surface sees it, with its state no older than the
 * freshness window.
 *
 * Returns `null` for a destination that is not there — a row that never
 * existed, or one whose id no longer resolves. A caller renders nothing
 * rather than a blank destination.
 */
export async function ensureFreshHealth(destinationId: string): Promise<DestinationView | null> {
  const now = new Date();
  let row = await readDestination(destinationId);
  if (row === null) return null;

  if (isStale(row, now) && !debounced(destinationId, now)) {
    lastCheckedHere.set(destinationId, now.getTime());
    await checkHealth(destinationId);
    row = (await readDestination(destinationId)) ?? row;
  }

  const held = await heldPages(row.site_id);
  return destinationView({
    id: row.id,
    kind: row.kind,
    health: row.health,
    reason: row.health_reason,
    lastCheckedAt: new Date(row.last_checked_at),
    heldPages: held.count,
  });
}
