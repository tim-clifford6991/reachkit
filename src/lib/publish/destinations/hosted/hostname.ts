// SPEC §5 — the customer's own subdomain, from a typed label to a served
// host.
//
// §5's ruling of 2026-09-12: "on save the app adds the hostname to the
// project's domain list through the Vercel Domains API with our server-only
// token, the certificate is automatic once the CNAME resolves, and settings
// shows 'live' or 'waiting for DNS'." Three things have to happen in one
// order for that sentence to be true, and this module is where they are
// kept together: the host is stored on the destination row (by the one
// transaction that creates it), it is attached to the project, and the
// word the customer reads is written back.
//
// **Idempotent by asking, not by remembering.** Every entry point here can
// be called again for a host already attached: the vendor's own answer for
// a hostname this project holds is the same answer the first call got, so
// the setup submit, a later health check and a retry after a failure
// converge on one domain entry and never on two. The one thing remembered
// is *when the vendor was last asked*, which bounds the calls the scheduled
// health pass makes and decides nothing about the host.
//
// **It is not on the edge's path.** `store.ts` holds the Host lookup the
// hosted edge makes, and this module is imported only by the setup store
// and the health check — so nothing a middleware-reachable file imports
// reaches the vendor seam.
//
// **No sentence, and no vendor payload.** What a caller learns is a state
// with two members, which is what the customer reads two words for.
import { DESTINATION_HOSTNAME_RECHECK_H } from "@/lib/config/constants";
import { publishDb } from "../../db";
import { addProjectDomain } from "@/lib/vendors/vercel/domains";

const HOUR_MS = 3_600_000;

/** What the project's domain list says about a host, as the row holds it.
 *  Two members, because SPEC §5 rules the customer reads two words —
 *  "waiting for DNS" until the record resolves, "live" after. */
export type HostnameState = "pending_dns" | "live";

/** The destination rows this module reads. `config` is not named here,
 *  for the reason `store.ts` gives: there is one select list per question
 *  and none of them has the column. */
interface HostnameRow {
  id: string;
  site_id: string;
  hostname: string | null;
}

/** The row the attachment pass reads: what the domain list last said, and
 *  when it was asked. */
interface HostnameCheckRow {
  id: string;
  hostname_state: HostnameState | null;
  hostname_checked_at: string | null;
}

/**
 * Whether another site already serves at this host.
 *
 * §5: an "already-taken label" is refused in one written line. The
 * database refuses it too (`destinations_one_live_hostname`), and that is
 * the guarantee; this is the readable form of the same refusal, asked
 * before a founder presses the one control rather than after.
 *
 * `exceptSiteId` is the site doing the asking: a founder re-reading their
 * own setup screen must not be told their own host is taken.
 *
 * **Fails closed towards refusal is wrong here, and so is fails open.** A
 * read that errors answers `false` — not taken — because the unique index
 * is what actually decides, and a founder blocked by a database blip from
 * a name nobody holds has been refused something true.
 *
 * That is the answer a founder *typing* is given. The submit asks
 * `hostnameTakenStrict` instead (issue 608): there, a read that could not
 * answer is not a free name, because the next thing that happens is a
 * write.
 */
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

/** `hostnameTaken`, with a read that errors thrown rather than read as
 *  "not taken". The setup submit asks this before it writes any row, so a
 *  collision is refused as `label_taken` and never reaches the unique
 *  index after the founder's answers are already on disk. */
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

/**
 * Adds the host to the project's domain list, and records what the list
 * then said about it.
 *
 * **The word is the vendor's own answer and nothing else.** Our resolver
 * can see that a record resolves; it cannot see whether it resolves at a
 * project that has been told about this host, and a host Vercel does not
 * hold is answered by Vercel's own 404. So only `attached` *and*
 * `verified` is "live" — which is also the moment the certificate exists —
 * and every answer short of that is "waiting for DNS".
 *
 * **A pass that could not ask leaves the recorded word standing.** A
 * deployment with no token and a vendor that did not answer carry no fact
 * about the host: neither raises one to "live", and neither tells a
 * customer whose pages are being served that they are waiting.
 *
 * **At most one vendor call per host per `DESTINATION_HOSTNAME_RECHECK_H`.**
 * The scheduled health pass reaches this for every hosted destination, so
 * the call is gated on `hostname_checked_at` — read here, written below.
 *
 * **A failure is never louder than a wait.** No vendor message reaches a
 * screen: the destination states its own health, as §5 requires.
 */
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

  const vendor = await addProjectDomain(a.hostname);
  // "We could not ask" is not an answer about the host. `elsewhere` is one
  // — another project holds it, so this one does not serve it.
  const answered = vendor.ok || vendor.because === "elsewhere";
  const state: HostnameState = vendor.ok && vendor.verified ? "live" : "pending_dns";
  await writeHostnameState({
    destinationId: a.destinationId,
    state: answered ? state : null,
    at: now,
  });
  return answered ? state : recorded;
}

/** What the project's domain list last said about this destination's host,
 *  and when it was asked. Its own select list, for the reason the module
 *  header gives: one question, one list. */
async function readHostnameCheck(destinationId: string): Promise<HostnameCheckRow | null> {
  const { data, error } = await publishDb()
    .from<HostnameCheckRow>("destinations")
    .select("id, hostname_state, hostname_checked_at")
    .eq("id", destinationId)
    .limit(1);
  if (error !== null || data === null) return null;
  return data[0] ?? null;
}

/** Whether the vendor has already been asked about this host inside the
 *  window. A row that was never asked, or carries an unreadable date, is
 *  asked — a throttle that cannot read its own stamp must not become a
 *  reason never to attach a host. */
function askedRecently(at: string | null, now: Date): boolean {
  if (at === null) return false;
  const last = Date.parse(at);
  if (Number.isNaN(last)) return false;
  return now.getTime() - last < DESTINATION_HOSTNAME_RECHECK_H * HOUR_MS;
}

/** Records what the project's domain list said, and when it was asked.
 *  `state: null` is a pass that asked and got no answer: the date is
 *  stamped — so the next pass is still throttled — and the word the
 *  customer reads is left as it was. */
export async function writeHostnameState(a: {
  destinationId: string;
  state: HostnameState | null;
  at: Date;
}): Promise<void> {
  const checkedAt = { hostname_checked_at: a.at.toISOString() };
  await publishDb()
    .from<never>("destinations")
    .update(a.state === null ? checkedAt : { hostname_state: a.state, ...checkedAt })
    .eq("id", a.destinationId);
}
