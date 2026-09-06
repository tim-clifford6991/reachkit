// BUILD §9 — health is a state, and this is what decides it.
//
// §9: "expired credential is a **state** (reconnect prompt, queue holds),
// not an error loop." A state has to be *found* by something, and this is
// that something: one check, one conclusion, one write.
//
// **It makes no write to the customer's site.** Every arm below is a read
// — a DNS resolution, or the adapter's own read of its end — so a health
// check running while a delivery is in flight cannot interfere with it,
// and a credential is never proved by creating something with it.
//
// **It writes `health_changed_at` only when the state actually changed.**
// That column is when the destination broke, not when it was last looked
// at, and one breakage mail is counted from it (`breakage-mail.ts`).
import { HOSTED_SUBDOMAIN_LABEL } from "@/lib/config/constants";
import { resolvesInDns } from "@/lib/egress";
import { publishDb } from "../../db";
import type { DestinationHealth, HealthReason } from "../../types";
import { NoConfigError, withConfig } from "../config";
import { adapterFor } from "../registry";
import { readDestination, writeHealth, writePublishCapable, type DestinationRecord } from "../store";

export interface HealthCheck {
  health: DestinationHealth;
  reason: HealthReason | null;
  checkedAt: Date;
}

async function siteDomain(siteId: string): Promise<string | null> {
  const { data, error } = await publishDb()
    .from<{ domain: string | null }>("sites")
    .select("domain")
    .eq("id", siteId)
    .single();
  if (error !== null || data === null) return null;
  return data.domain;
}

/**
 * What the hosted destination's state is.
 *
 * The record the customer has to point is the first question, and DNS
 * resolution answers it on its own: a name that does not resolve is a
 * record that was never set, and until it is, no page is delivered there
 * and none is recorded as live at that address.
 *
 * A name that *does* resolve raises the one question resolution cannot
 * answer — whether it points at our edge or at somebody else's server —
 * and the adapter is asked, because the adapter is the end that would
 * know. Today it answers `error`/`unreachable`, which is true: the edge
 * route is #49's and nothing serves there yet.
 *
 * A site with no domain yet has nothing to point: that is `never_connected`
 * and not a failure of anybody's DNS.
 */
async function hostedHealth(row: DestinationRecord): Promise<{ health: DestinationHealth; reason: HealthReason | null }> {
  const domain = await siteDomain(row.site_id);
  if (domain === null || domain.trim() === "") {
    return { health: "expired", reason: "never_connected" };
  }
  if (!(await resolvesInDns(`${HOSTED_SUBDOMAIN_LABEL}.${domain}`))) {
    return { health: "expired", reason: "dns_unset" };
  }
  const adapter = adapterFor("hosted");
  if (adapter === null) return { health: "error", reason: "destination_rejected" };
  return adapter.health({});
}

/**
 * What a credential-bearing destination's state is.
 *
 * No credential is `never_connected` — the deferred connection §9's setup
 * makes, and the same state a disconnect leaves behind. It is `expired`
 * rather than `error` because the customer's next move is the same one:
 * connect it, and the pages that were waiting go out.
 */
async function credentialHealth(row: DestinationRecord): Promise<{ health: DestinationHealth; reason: HealthReason | null }> {
  const adapter = adapterFor(row.kind);
  if (adapter === null) {
    // No adapter for the kind: nothing can be published through it and
    // no probe can be run against it. `destination_rejected` is the true
    // reading — the destination is not one this build can serve.
    return { health: "error", reason: "destination_rejected" };
  }
  try {
    return await withConfig(row.id, (cfg) => adapter.health(cfg as Record<string, unknown>));
  } catch (cause) {
    if (cause instanceof NoConfigError) return { health: "expired", reason: "never_connected" };
    // Anything else is the destination's end failing to answer. The cause
    // is not carried: a vendor payload has no route to a screen, a mail or
    // an export (§9 — credentials and their errors are never shown).
    return { health: "error", reason: "unreachable" };
  }
}

/**
 * What the credential may do, asked of the destination's own end.
 *
 * Returns `null` where the question does not arise (an adapter that
 * declares no probe — a destination ReachKit runs has no account whose
 * permission to publish could differ from its permission to create) **and
 * where it could not be put**. Those two are one return value here and two
 * different things on the row: neither writes, so the last real answer
 * stands, and nothing is recorded on the strength of a network blip.
 *
 * **It is asked beside `health` and never inside it** (ADR-086): a site can
 * answer its REST index perfectly and refuse to publish, and folding the
 * two would make one answer stand for both — after which re-entering the
 * same, valid credential would appear to clear a state the probe decided.
 */
async function publishCapable(row: DestinationRecord): Promise<boolean | null> {
  const adapter = adapterFor(row.kind);
  if (adapter?.canPublish === undefined) return null;
  const probe = adapter.canPublish.bind(adapter);
  try {
    return await withConfig(row.id, (cfg) => probe(cfg as Record<string, unknown>));
  } catch {
    // "We could not ask" is not "the answer is no". The cause is not
    // carried: a vendor payload has no route to a screen, a mail or an
    // export.
    return null;
  }
}

/**
 * Checks one destination and records what it found.
 *
 * `publish_capable === false` outranks every other answer (ADR-086): a
 * credential that can create a post and cannot publish it is `failing`,
 * with a line of its own and an action that leads to a different account.
 * It is the one probe result on the row that is a health input, and it is
 * read here rather than folded into the adapter's answer so that
 * re-entering the same credential cannot clear it — the state is decided
 * by what the probe found, never by the act of reconnecting.
 */
export async function checkHealth(destinationId: string): Promise<HealthCheck> {
  const checkedAt = new Date();
  const row = await readDestination(destinationId);
  if (row === null) {
    return { health: "error", reason: "destination_rejected", checkedAt };
  }

  const answered = row.kind === "hosted" ? await hostedHealth(row) : await credentialHealth(row);

  // The capability probe, run beside the state read and recorded where it
  // answered. The fresh answer is what the state is decided from; where the
  // probe was not asked or could not be, the last recorded answer stands —
  // which is what keeps `cannot_publish` from being cleared by anything but
  // a probe that found otherwise.
  const capable = await publishCapable(row);
  if (capable !== null) await writePublishCapable(destinationId, capable);
  const stands = capable ?? row.publish_capable;

  const found =
    stands === false
      ? { health: "error" as const, reason: "cannot_publish" as const }
      : answered;

  const changed = found.health !== row.health;
  await writeHealth({
    destinationId,
    health: found.health,
    reason: found.reason,
    checkedAt,
    changed,
  });
  return { health: found.health, reason: found.reason, checkedAt };
}
