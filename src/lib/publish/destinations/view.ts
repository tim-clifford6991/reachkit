// BUILD §9 — the read model, derived. The whole of what a surface may see
// about a destination, and the mapping that decides it.
//
// Pure: facts in, view out. No database, no clock, no network — which is
// what lets Settings, Overview and the calendar all render a destination
// through the same mapping instead of each writing its own, and what lets
// every row of that mapping be decided by a test with no fixture database
// at all.
//
// **The state selects the band; the reason selects the line and the
// action** (ADR-086). `health` is §10's three members and the customer
// reads exactly three words. Everything a particular breakage needs to say
// hangs off `reason`, which is why a fourth occasion has never cost a
// fourth state.
import type { CopyKey } from "@/lib/presentation/copy";
import type {
  DestinationAction,
  DestinationHealth,
  DestinationKind,
  DestinationView,
  HealthReason,
} from "../types";

/** The word the customer reads for each state.
 *
 *  These three keys are already the registry's — Settings has rendered
 *  them since #107 — and are read here rather than re-minted under a
 *  `publish.*` name. Two keys holding the same sentence is how a product
 *  ends up calling one state two things. */
/** SPEC §5's two ruled words, one key each. The state is the row's, so a
 *  surface cannot decide that a record has resolved: it renders the word
 *  the check recorded. */
const HOSTNAME_KEY: Record<"pending_dns" | "live", CopyKey> = {
  pending_dns: "settings.destination.hostname.waiting",
  live: "settings.destination.hostname.live",
};

const STATE_KEY: Record<DestinationHealth, CopyKey> = {
  ok: "settings.destination.health.ok",
  expired: "settings.destination.health.expired",
  error: "settings.destination.health.error",
};

/** One written line per reason. Eight keys, total over the union, so a
 *  ninth reason cannot be added without a line to go with it.
 *
 *  `cannot_publish` has a line of its own and it is **not** REQ-074's
 *  "pages are being held and nothing has been lost" (ADR-086): that
 *  sentence is false there twice over — the credential is valid, and the
 *  page has already failed rather than been held. */
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

/**
 * The one action offered against a broken destination.
 *
 * `cannot_publish` takes `reconnect_other_account` and never `reconnect`:
 * the stored credential is valid and re-entering it is the one action
 * guaranteed to change nothing, so the remedy is an account with the
 * capability (ADR-086 Decision 2). A destination waiting on DNS takes
 * `set_dns` — there is no credential to re-enter and offering one would
 * point the customer at the wrong screen.
 */
function actionFor(kind: DestinationKind, reason: HealthReason | null): DestinationAction {
  if (reason === null) return "none";
  switch (reason) {
    case "dns_unset":
    case "dns_elsewhere":
      return "set_dns";
    case "never_connected":
      // What is missing depends on what the kind needs: the hosted blog
      // needs a record pointed at us, WordPress needs a credential — and
      // its *first* one, which is `connect` and not `reconnect` (#240).
      return kind === "hosted" ? "set_dns" : "connect";
    case "cannot_publish":
      return "reconnect_other_account";
    default:
      return "reconnect";
  }
}

/** What the view is built from. Every member is a stored or derived fact;
 *  there is no message, status or payload among them, because there is
 *  nowhere on `DestinationView` for one to go. */
export interface DestinationFacts {
  id: string;
  kind: DestinationKind;
  health: DestinationHealth;
  reason: HealthReason | null;
  lastCheckedAt: Date;
  heldPages: number;
  /** The host the customer's pages are served at, where this destination
   *  has one of its own (SPEC §5, 2026-09-12). */
  hostname?: string | null;
  /** What the project's domain list says about it. */
  hostnameState?: "pending_dns" | "live" | null;
}

/**
 * The destination as a surface sees it.
 *
 * A working destination carries no line: it says its state and stops.
 * Every other state carries exactly one, chosen by the reason — and a
 * state that is not `ok` with no reason recorded is still rendered, with
 * its band and no line, rather than being hidden or guessed at.
 */
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
    // A host with no state recorded is one nobody has pointed yet, which
    // is what "waiting for DNS" says — never a blank beside an address the
    // customer is being asked to point.
    hostnameState,
    copy: {
      state: STATE_KEY[facts.health],
      line: facts.health === "ok" || facts.reason === null ? null : LINE_KEY[facts.reason],
      hostname: hostnameState === null ? null : HOSTNAME_KEY[hostnameState],
    },
  };
}
