// BUILD §9 — the read model: all a surface may see about a destination. Pure, so Settings, Overview and the calendar
// share one mapping. The state selects the band; the reason selects the line and the action (ADR-086): `health` stays
// §10's three words, and a new breakage is a new reason, never a fourth state.
import type { CopyKey } from "@/lib/presentation/copy";
import type {
  DestinationAction,
  DestinationHealth,
  DestinationKind,
  DestinationView,
  HealthReason,
} from "../types";

/** SPEC §5's two words, one key each. The state is the row's, so a surface renders what the check recorded. */
const HOSTNAME_KEY: Record<"pending_dns" | "live", CopyKey> = {
  pending_dns: "settings.destination.hostname.waiting",
  live: "settings.destination.hostname.live",
};

/** Settings' own keys, never re-minted under `publish.*`, so one state has one name. */
const STATE_KEY: Record<DestinationHealth, CopyKey> = {
  ok: "settings.destination.health.ok",
  expired: "settings.destination.health.expired",
  error: "settings.destination.health.error",
};

/** One line per reason, total over the union. `cannot_publish` is never REQ-074's "pages are being held and nothing has
 *  been lost" (ADR-086): its credential is valid and its page already failed. */
const LINE_KEY: Record<HealthReason, CopyKey> = {
  never_connected: "publish.destination.line.never-connected",
  dns_unset: "publish.destination.line.dns-unset",
  dns_elsewhere: "publish.destination.line.dns-elsewhere",
  credentials_expired: "publish.destination.line.credentials-expired",
  credentials_invalid: "publish.destination.line.credentials-invalid",
  unreachable: "publish.destination.line.unreachable",
  destination_rejected: "publish.destination.line.destination-rejected",
  cannot_publish: "publish.destination.line.cannot-publish",
};

/** The one action offered. `cannot_publish` takes `reconnect_other_account`, never `reconnect`, which would change
 *  nothing (ADR-086 decision 2); waiting on DNS takes `set_dns`, as there is no credential to re-enter. */
function actionFor(kind: DestinationKind, reason: HealthReason | null): DestinationAction {
  if (reason === null) return "none";
  switch (reason) {
    case "dns_unset":
    case "dns_elsewhere":
      return "set_dns";
    case "never_connected":
      // Hosted needs a record; WordPress needs its first credential, so `connect`, not `reconnect`.
      return kind === "hosted" ? "set_dns" : "connect";
    case "cannot_publish":
      return "reconnect_other_account";
    default:
      return "reconnect";
  }
}

/** Stored or derived facts only; no message, status or payload, as `DestinationView` has nowhere for one. */
export interface DestinationFacts {
  id: string;
  kind: DestinationKind;
  health: DestinationHealth;
  reason: HealthReason | null;
  lastCheckedAt: Date;
  heldPages: number;
  /** The host the pages are served at, where the destination has its own (SPEC §5). */
  hostname?: string | null;
  /** What the project's domain list says about it. */
  hostnameState?: "pending_dns" | "live" | null;
}

/** A working destination carries no line; every other state one, by reason. Not `ok` with no reason still renders its
 *  band with no line, never hidden or guessed. */
export function destinationView(facts: DestinationFacts): DestinationView {
  const hostname = facts.hostname ?? null;
  const hostnameState = hostname === null ? null : (facts.hostnameState ?? "pending_dns");
  return {
    id: facts.id,
    kind: facts.kind,
    health: facts.health,
    reason: facts.reason,
    lastCheckedAt: facts.lastCheckedAt,
    heldPages: facts.heldPages,
    action: facts.health === "ok" ? "none" : actionFor(facts.kind, facts.reason),
    hostname,
    // No state recorded means nobody has pointed it yet: "waiting for DNS", never a blank.
    hostnameState,
    copy: {
      state: STATE_KEY[facts.health],
      line: facts.health === "ok" || facts.reason === null ? null : LINE_KEY[facts.reason],
      hostname: hostnameState === null ? null : HOSTNAME_KEY[hostnameState],
    },
  };
}
