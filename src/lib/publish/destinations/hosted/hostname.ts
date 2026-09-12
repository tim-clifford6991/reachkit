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
// **Idempotent, and by asking rather than by remembering.** Every entry
// point here can be called again for a host already attached: the vendor's
// own answer for a hostname this project holds is the same answer the first
// call got, so the setup submit, a later health check and a retry after a
// failure converge on one domain entry. Nothing here keys off "have we done
// this before".
//
// **It is not on the edge's path.** `store.ts` holds the Host lookup the
// hosted edge makes, and this module is imported only by the setup store
// and the health check — so nothing a middleware-reachable file imports
// reaches the vendor seam.
//
// **No sentence, and no vendor payload.** What a caller learns is a state
// with two members, which is what the customer reads two words for.
import { publishDb } from "../../db";
import { addProjectDomain } from "@/lib/vendors/vercel/domains";

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
 */
export async function hostnameTaken(a: {
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
  if (error !== null || data === null) return false;
  return data.some((row) => row.site_id !== a.exceptSiteId);
}

/**
 * Adds the host to the project's domain list, and records the word the
 * customer reads.
 *
 * **Two acts, and only one of them decides the word.** The attachment is
 * what makes a pointed record answer with the customer's pages instead of
 * the platform's own 404, and it is made every time — idempotently, by
 * asking the vendor again rather than by remembering. The word is §5's
 * own rule and nothing else: "settings shows 'waiting for DNS' until the
 * record resolves and 'live' after". So `resolves` is what selects it, and
 * a vendor that did not answer cannot turn a customer's live pages into a
 * screen that says they are waiting.
 *
 * **A failure is never louder than a wait.** A deployment with no token, a
 * vendor that did not answer, a host another project holds: each leaves
 * the attachment for the next check to make, and none of them produces a
 * vendor message on a screen — the destination states its own health, as
 * §5 requires.
 */
export async function syncHostname(a: {
  destinationId: string;
  hostname: string;
  /** Whether the customer's record resolves — §6.4's `resolvesInDns`,
   *  passed in rather than read here so this module stays decidable
   *  without a resolver. */
  resolves: boolean;
}): Promise<HostnameState> {
  // The answer is not read: what it decides is whether the hostname is on
  // the project, which is the vendor's own record and not a fact about
  // this customer's DNS. Awaited, so a check that returns has made the
  // attempt rather than left it in flight.
  await addProjectDomain(a.hostname);
  const state: HostnameState = a.resolves ? "live" : "pending_dns";
  await writeHostnameState({ destinationId: a.destinationId, state, at: new Date() });
  return state;
}

/** Records what the project's domain list last said, and when it was
 *  asked. The date is not read by any surface: it is what keeps a re-check
 *  from being made on every render. */
export async function writeHostnameState(a: {
  destinationId: string;
  state: HostnameState;
  at: Date;
}): Promise<void> {
  await publishDb()
    .from<never>("destinations")
    .update({ hostname_state: a.state, hostname_checked_at: a.at.toISOString() })
    .eq("id", a.destinationId);
}
