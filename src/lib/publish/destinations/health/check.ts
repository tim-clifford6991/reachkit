// BUILD §9 — "expired credential is a state (reconnect prompt, queue holds), not an error loop": this check finds that
// state, in one conclusion and one write.
// It never writes to the customer's site: every arm is a read, so it cannot interfere with a delivery, and a credential
// is never proved by creating something. `health_changed_at` moves only on a change (`breakage-mail.ts` counts from it).
import { resolvesInDns } from "@/lib/egress";
import { hostFor } from "../hosted/label";
import { syncHostname } from "../hosted/hostname";
import { publishDb } from "../../db";
import type { DestinationHealth, HealthReason } from "../../types";
import { NoConfigError, withConfig } from "../config";
import { adapterFor } from "../registry";
import {
  readDestination,
  writeHealth,
  writePublishCapable,
  writeStampCapable,
  type DestinationRecord,
} from "../store";

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

/** The hosted destination's state. A name that does not resolve is a record never set, so nothing is delivered there.
 *  The name is the customer's chosen host off the row, else the default label, never an empty first label.
 *  The host is attached to the project again here, throttled by `syncHostname`, so a save made while the vendor was down
 *  is repaired; the customer's word is the domain list's answer, never the resolution's.
 *  A name that resolves is the adapter's to judge. No domain yet is `never_connected`, nobody's DNS failure. */
async function hostedHealth(row: DestinationRecord): Promise<{ health: DestinationHealth; reason: HealthReason | null }> {
  const domain = await siteDomain(row.site_id);
  if (domain === null || domain.trim() === "") {
    return { health: "expired", reason: "never_connected" };
  }
  const host = row.hostname ?? hostFor({ label: null, domain });
  // Whether or not it resolves, as a certificate needs the host on the project first; throttled inside `syncHostname`.
  const state = await syncHostname({ destinationId: row.id, hostname: host });
  // A host the domain list verified is `ok` whatever this resolver sees: the record points here and the certificate exists.
  if (state === "live") return { health: "ok", reason: null };
  const resolves = await resolvesInDns(host);
  if (!resolves) {
    return { health: "expired", reason: "dns_unset" };
  }
  const adapter = adapterFor("hosted");
  if (adapter === null) return { health: "error", reason: "destination_rejected" };
  return adapter.health({});
}

/** A credential-bearing destination's state. No credential is `never_connected`, `expired` not `error`, since the
 *  customer's next move is to connect it and the waiting pages go out. */
async function credentialHealth(row: DestinationRecord): Promise<{ health: DestinationHealth; reason: HealthReason | null }> {
  const adapter = adapterFor(row.kind);
  if (adapter === null) {
    // No adapter for the kind: not a destination this build can serve.
    return { health: "error", reason: "destination_rejected" };
  }
  try {
    return await withConfig(row.id, (cfg) => adapter.health(cfg as Record<string, unknown>));
  } catch (cause) {
    if (cause instanceof NoConfigError) return { health: "expired", reason: "never_connected" };
    // The destination failed to answer; the cause is not carried, since a vendor payload never reaches a person (§9).
    return { health: "error", reason: "unreachable" };
  }
}

/** What the credential may do; `null` where no probe exists or it could not be asked, and neither writes, so the last
 *  answer stands. Asked beside `health`, never inside it (ADR-086), or re-entering the credential would clear it. */
async function publishCapable(row: DestinationRecord): Promise<boolean | null> {
  const adapter = adapterFor(row.kind);
  if (adapter?.canPublish === undefined) return null;
  const probe = adapter.canPublish.bind(adapter);
  try {
    return await withConfig(row.id, (cfg) => probe(cfg as Record<string, unknown>));
  } catch {
    // "We could not ask" is not "no"; the cause is not carried.
    return null;
  }
}

/** Whether the site will carry the findability stamp (ADR-083 decision 4): a separate call, as a site can publish and
 *  refuse the term or the reverse. `null` is not asked or could not be, and neither writes. */
async function stampCapable(row: DestinationRecord): Promise<boolean | null> {
  const adapter = adapterFor(row.kind);
  if (adapter?.canStamp === undefined) return null;
  const probe = adapter.canStamp.bind(adapter);
  try {
    return await withConfig(row.id, (cfg) => probe(cfg as Record<string, unknown>));
  } catch {
    // "We could not ask" is not "no"; the cause is not carried.
    return null;
  }
}

/** Checks one destination and records it. `publish_capable === false` outranks every answer (ADR-086), with its own
 *  line and an action to another account; read here, so reconnecting the same credential cannot clear it. */
export async function checkHealth(destinationId: string): Promise<HealthCheck> {
  const checkedAt = new Date();
  const row = await readDestination(destinationId);
  if (row === null) {
    return { health: "error", reason: "destination_rejected", checkedAt };
  }

  const answered = row.kind === "hosted" ? await hostedHealth(row) : await credentialHealth(row);

  // The fresh answer decides; unasked, the last stands, so only a probe that finds otherwise clears `cannot_publish`.
  const capable = await publishCapable(row);
  if (capable !== null) await writePublishCapable(destinationId, capable);
  const stands = capable ?? row.publish_capable;

  // The stamp probe is recorded and read by nothing below (ADR-083 decision 4): refusing a `post_tag` term is not a
  // breakage, so `stands` never sees it.
  const stampable = await stampCapable(row);
  if (stampable !== null) await writeStampCapable(destinationId, stampable);

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
