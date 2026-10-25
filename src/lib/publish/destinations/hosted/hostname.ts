// SPEC §5 — the customer's own subdomain, from a typed label to a served host: "on save the app adds the hostname to the
// project's domain list through the Vercel Domains API with our server-only token, the certificate is automatic once the
// CNAME resolves, and settings shows 'live' or 'waiting for DNS'." Stored, attached, and its word written back, in order.
// Idempotent by asking, not remembering: the vendor answers a held host the same way, so submit, health check and retry
// converge on one entry. Only when it was last asked is remembered, to bound the scheduled pass.
// Off the edge's path: only setup, the health check and "check connection" import it, so no middleware-reachable file
// reaches the vendor seam. No sentence and no vendor payload: a two-word state, and whether anything was asked.
import {
  DESTINATION_HOSTNAME_CHECK_FLOOR_S,
  DESTINATION_HOSTNAME_RECHECK_H,
} from "@/lib/config/constants";
import { publishDb } from "../../db";
import { addProjectDomain } from "@/lib/vendors/vercel/domains";

const HOUR_MS = 3_600_000;

/** The domain list's word for a host: SPEC §5's two, "waiting for DNS" then "live". */
export type HostnameState = "pending_dns" | "live";

/** The rows read here; one select list per question, none naming `config`. */
interface HostnameRow {
  id: string;
  site_id: string;
  hostname: string | null;
}

/** What the domain list last said, and when it was asked. */
interface HostnameCheckRow {
  id: string;
  hostname_state: HostnameState | null;
  hostname_checked_at: string | null;
}

/** Whether another site serves at this host: §5's "already-taken label", asked before the press;
 *  `destinations_one_live_hostname` is the guarantee. `exceptSiteId` keeps a founder's own host from reading as taken.
 *  While typing, a read that errors is "not taken", since the index decides; the submit asks `hostnameTakenStrict`. */
export async function hostnameTaken(a: {
  hostname: string;
  exceptSiteId?: string;
}): Promise<boolean> {
  try {
    return await hostnameTakenStrict(a);
  } catch {
    return false;
  }
}

/** `hostnameTaken` that throws on a read error, for the submit, so a collision is `label_taken` before any row is written. */
export async function hostnameTakenStrict(a: {
  hostname: string;
  exceptSiteId?: string;
}): Promise<boolean> {
  const host = a.hostname.trim().toLowerCase();
  if (host === "") return false;
  const { data, error } = await publishDb()
    .from<HostnameRow>("destinations")
    .select("id, site_id, hostname")
    .eq("hostname", host)
    .is("deleted_at", null)
    .limit(2);
  if (error !== null) throw new Error(`hostnameTaken: ${error.message}`);
  if (data === null) throw new Error("hostnameTaken: the read returned no rows array");
  return data.some((row) => row.site_id !== a.exceptSiteId);
}

/** Attaches the host and records the domain list's word, the vendor's answer alone: our resolver cannot see whether the
 *  record resolves at a project that holds the host, so only attached and verified is "live", else "waiting for DNS".
 *  A pass that could not ask leaves the word standing. At most one call per host per `DESTINATION_HOSTNAME_RECHECK_H`,
 *  gated on `hostname_checked_at`. No vendor message reaches a screen. */
export async function syncHostname(a: {
  destinationId: string;
  hostname: string;
  /** The clock, passed in so the throttle is decidable without waiting. */
  now?: Date;
}): Promise<HostnameState> {
  const now = a.now ?? new Date();
  const row = await readHostnameCheck(a.destinationId);
  const recorded: HostnameState = row?.hostname_state ?? "pending_dns";
  if (askedRecently(row?.hostname_checked_at ?? null, now)) return recorded;

  // A `/setup` press that verified this host is already the vendor's answer, kept rather than lost to a second ask.
  const answer = takeVerifiedAtSetup(a.hostname, now) ?? (await askVendor(a.hostname));
  await writeHostnameState({
    destinationId: a.destinationId,
    state: answer.asked ? answer.state : null,
    at: now,
  });
  return answer.asked ? answer.state : recorded;
}

/** "Nothing was asked" kept apart from "waiting for DNS": a scheduled pass folds it, a founder's press reports it. */
type VendorAnswer = { asked: true; state: HostnameState } | { asked: false };

/** Attaches the host (idempotent, per `addProjectDomain`) and judges the answer, in one place for every caller. */
async function askVendor(hostname: string): Promise<VendorAnswer> {
  const vendor = await addProjectDomain(hostname);
  // "Could not ask" is no answer; `elsewhere` is one: another project holds the host.
  if (!vendor.ok && vendor.because !== "elsewhere") return { asked: false };
  return { asked: true, state: vendor.ok && vendor.verified ? "live" : "pending_dns" };
}

/**
 * What a founder's own "check connection" press learned, three answers never folded into two:
 *
 *   * `asked` — the domain list answered, and `state` is its word.
 *   * `could_not_ask` — no token is bound, or the vendor did not answer.
 *     Nothing is known about the host, and nothing is claimed: this is not
 *     "waiting for DNS".
 *   * `too_soon` — this site's last press was inside
 *     `DESTINATION_HOSTNAME_CHECK_FLOOR_S`, so nothing was asked now. It
 *     carries when the founder may ask again and no state, so an old answer
 *     cannot be read as a new one.
 */
export type HostnameCheck =
  | { outcome: "asked"; state: HostnameState }
  | { outcome: "could_not_ask" }
  | { outcome: "too_soon"; askAgainAt: string; askAgainInS: number };

/** When each site's founder last pressed, per instance, keyed by site since cycling labels is one founder asking; the
 *  row's `hostname_checked_at` is read beside it. */
const lastPressed = new Map<string, number>();

/** Hosts a `/setup` press verified before any destination held them, per instance; read once by the submit's
 *  `syncHostname` and good for `DESTINATION_HOSTNAME_RECHECK_H`. Another instance just asks the vendor. */
const verifiedAtSetup = new Map<string, number>();

function takeVerifiedAtSetup(hostname: string, now: Date): VendorAnswer | null {
  const at = verifiedAtSetup.get(hostname);
  if (at === undefined) return null;
  verifiedAtSetup.delete(hostname);
  const age = now.getTime() - at;
  return age >= 0 && age < DESTINATION_HOSTNAME_RECHECK_H * HOUR_MS
    ? { asked: true, state: "live" }
    : null;
}

/** Asks the vendor now, on a founder's press at setup or in Settings, recording on a destination that holds the host.
 *  Keyed on the hostname, since at setup no destination exists; the caller derives it from the session's own site.
 *  It bypasses the hourly window with a floor of its own: a press inside the floor asks nothing and says so. */
export async function checkHostnameNow(a: {
  siteId: string;
  hostname: string;
  /** The destination holding this host, or `null` before setup creates one. */
  destinationId: string | null;
  now?: Date;
}): Promise<HostnameCheck> {
  const now = a.now ?? new Date();
  const row = a.destinationId === null ? null : await readHostnameCheck(a.destinationId);
  // An absent, unreadable or future stamp never refuses the founder, as in `askedRecently`.
  const stamps = [
    lastPressed.get(a.siteId) ?? Number.NaN,
    row?.hostname_checked_at == null ? Number.NaN : Date.parse(row.hostname_checked_at),
  ].filter((at) => !Number.isNaN(at) && at <= now.getTime());
  const floorMs = DESTINATION_HOSTNAME_CHECK_FLOOR_S * 1000;
  const last = stamps.length === 0 ? null : Math.max(...stamps);
  if (last !== null && now.getTime() - last < floorMs) {
    const at = last + floorMs;
    return {
      outcome: "too_soon",
      askAgainAt: new Date(at).toISOString(),
      askAgainInS: Math.ceil((at - now.getTime()) / 1000),
    };
  }

  lastPressed.set(a.siteId, now.getTime());
  const answer = await askVendor(a.hostname);
  if (a.destinationId !== null) {
    await writeHostnameState({
      destinationId: a.destinationId,
      state: answer.asked ? answer.state : null,
      at: now,
    });
  } else if (answer.asked && answer.state === "live") {
    verifiedAtSetup.set(a.hostname, now.getTime());
  }
  return answer.asked ? { outcome: "asked", state: answer.state } : { outcome: "could_not_ask" };
}

/** The site's live hosted destination and its host, or `null` (WordPress, or setup not submitted). */
export async function hostedDestinationOf(
  siteId: string
): Promise<{ id: string; hostname: string } | null> {
  const { data, error } = await publishDb()
    .from<HostnameRow & { kind: string }>("destinations")
    .select("id, site_id, hostname, kind")
    .eq("site_id", siteId)
    .eq("kind", "hosted")
    .is("deleted_at", null)
    .limit(1);
  if (error !== null || data === null) return null;
  const row = data[0];
  return row === undefined || row.hostname === null ? null : { id: row.id, hostname: row.hostname };
}

/** The hosted host and the domain list's last word, in one select with no vendor call, for screens that only draw "which
 *  host, and is it live yet". `null` with no hosted host; never checked reads `pending_dns`. */
export async function hostedHostFor(
  siteId: string
): Promise<{ hostname: string; state: HostnameState; checkedAt: Date | null; since: Date | null } | null> {
  const { data, error } = await publishDb()
    .from<
      HostnameRow & {
        kind: string;
        hostname_state: HostnameState | null;
        hostname_checked_at: string | null;
        created_at: string | null;
      }
    >("destinations")
    .select("id, site_id, hostname, kind, hostname_state, hostname_checked_at, created_at")
    .eq("site_id", siteId)
    .eq("kind", "hosted")
    .is("deleted_at", null)
    .limit(1);
  if (error !== null || data === null) return null;
  const row = data[0];
  if (row === undefined || row.hostname === null) return null;
  return {
    hostname: row.hostname,
    state: row.hostname_state ?? "pending_dns",
    checkedAt: dateOrNull(row.hostname_checked_at),
    since: dateOrNull(row.created_at),
  };
}

/** A stored stamp, or `null` where it is absent or unreadable. */
function dateOrNull(at: string | null | undefined): Date | null {
  const ms = at == null ? Number.NaN : Date.parse(at);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** What the domain list last said about this destination's host, and when. */
async function readHostnameCheck(destinationId: string): Promise<HostnameCheckRow | null> {
  const { data, error } = await publishDb()
    .from<HostnameCheckRow>("destinations")
    .select("id, hostname_state, hostname_checked_at")
    .eq("id", destinationId)
    .limit(1);
  if (error !== null || data === null) return null;
  return data[0] ?? null;
}

/** Asked inside the window? Never asked, or an unreadable stamp, is asked, so the throttle never blocks attaching a host. */
function askedRecently(at: string | null, now: Date): boolean {
  if (at === null) return false;
  const last = Date.parse(at);
  if (Number.isNaN(last)) return false;
  return now.getTime() - last < DESTINATION_HOSTNAME_RECHECK_H * HOUR_MS;
}

/** Records the domain list's word and when; `state: null` stamps the date only, keeping the throttle and the word.
 *  `live` is also health `ok` in the same write, so `destination_working` stops reading an old `expired`, with
 *  `writeHealth`'s rules. An unverified host leaves health to `health/check.ts`. */
export async function writeHostnameState(a: {
  destinationId: string;
  state: HostnameState | null;
  at: Date;
}): Promise<void> {
  const at = a.at.toISOString();
  const checkedAt = { hostname_checked_at: at };
  let values: Record<string, unknown> =
    a.state === null ? checkedAt : { hostname_state: a.state, ...checkedAt };
  if (a.state === "live") {
    const health = await readHealth(a.destinationId);
    values = {
      ...values,
      health: "ok",
      health_reason: null,
      last_checked_at: at,
      broken_mail_sent_at: null,
      ...(health === "ok" ? {} : { health_changed_at: at }),
    };
  }
  await publishDb().from<never>("destinations").update(values).eq("id", a.destinationId);
}

/** The recorded health, for changed-or-not; a failed read counts as changed, which no customer sees. */
async function readHealth(destinationId: string): Promise<string | null> {
  const { data, error } = await publishDb()
    .from<{ health: string }>("destinations")
    .select("health")
    .eq("id", destinationId)
    .limit(1);
  if (error !== null || data === null) return null;
  return data[0]?.health ?? null;
}
