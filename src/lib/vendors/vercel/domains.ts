// BUILD §5 — the Vercel Domains API, and the one place its token is read.
//
// §5's ruling of 2026-09-12: "on save the app adds the hostname to the
// project's domain list through the Vercel Domains API with our server-only
// token, the certificate is automatic once the CNAME resolves". A customer
// CNAME that arrives at a project which has never heard of the hostname is
// answered by Vercel's own 404 — so adding the hostname is not an
// optimisation, it is the difference between a pointed record serving their
// pages and serving nothing.
//
// **The token is read here and nowhere else.** It is composed into one
// `Authorization` header and is never logged, returned, thrown with or
// stored: `safeFetch` logs five fields — host, reason, status, bytes,
// duration — and no header is among them, so that is a property of the
// seam rather than care taken at this call site.
//
// **Every byte leaves through `safeFetch`.** SSRF-guarded, DNS-pinned,
// size-capped, and the same door every other outbound call in this product
// uses. `respectRobots: false` for the reason the WordPress client gives:
// `robots.txt` governs crawling, not an API we hold a credential for.
//
// **This module classifies nothing and speaks no sentence.** It answers
// what the vendor did — attached, already attached, or no answer — and the
// caller turns that into the destination's own health state. There is no
// member on the result a vendor message could travel in, which is what
// keeps §5's "a failure is the destination's own health state, never a
// vendor error" true by type rather than by review.
//
// **Absent bindings are an answer, not a throw.** A deployment with no
// token cannot attach a hostname; saying so lets the destination stay
// "waiting for DNS" — which is what it honestly is — instead of taking a
// founder's submit down over a binding they cannot see.
import { env } from "@/lib/config/env";
import { safeFetch } from "@/lib/egress";

/** The vendor's own API root. Declared here, beside the one module that
 *  calls it — the idiom `src/lib/vendors/dataforseo/transport.ts` sets for
 *  `DATAFORSEO_BASE_URL`, and the reason is the same: an address a vendor
 *  owns is not one of this product's pins. */
const VERCEL_API = "https://api.vercel.com";

/** Adding a domain to a project. v10 is the current revision of the add
 *  call and the one that answers with the domain's verification state. */
const ADD_PATH = (projectId: string): string => `/v10/projects/${projectId}/domains`;

/** Reading one of a project's domains back. v9 is the current revision of
 *  the single-domain read. */
const READ_PATH = (projectId: string, hostname: string): string =>
  `/v9/projects/${projectId}/domains/${hostname}`;

/** Vercel answers a domain another project holds with 409. Named because
 *  the arm matters: our own project holding it already is the idempotent
 *  case, and the read below is what tells the two apart. */
const CONFLICT = 409;

/**
 * What the project's domain list says about one hostname.
 *
 * `attached` is "this project serves this hostname"; `verified` is whether
 * Vercel has seen the customer's record resolve, which is also when the
 * certificate is issued — there is no manual step between the two.
 *
 * The `ok: false` arm carries a token and never a payload. `not_configured`
 * is a deployment with no token bound; `elsewhere` is a hostname another
 * project holds, which is the one refusal a customer could act on; and
 * `no_answer` covers every way the call did not complete.
 */
export type DomainState =
  | { ok: true; attached: true; verified: boolean }
  | { ok: false; because: "not_configured" | "elsewhere" | "no_answer" };

/** The two bindings, read once per call and never held. `null` where the
 *  deployment carries neither — see the header. */
function credentials(): { token: string; projectId: string } | null {
  const token = env.VERCEL_API_TOKEN;
  const projectId = env.VERCEL_PROJECT_ID;
  if (token === undefined || projectId === undefined) return null;
  return { token, projectId };
}

/** The one composition of the credential, and the only place it is a
 *  string. Not exported: a header a caller could build is a header a
 *  caller could log. */
function authorization(token: string): string {
  return `Bearer ${token}`;
}

/** `verified` as the vendor states it, read defensively: a body that does
 *  not carry the field is a domain we cannot say is verified, which is
 *  `false` — the state that holds the customer at "waiting for DNS" rather
 *  than telling them a page is live that is not. */
function verifiedIn(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  return (body as { verified?: unknown }).verified === true;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Adds the hostname to this project's domain list, idempotently.
 *
 * **Idempotent because the vendor is asked again rather than because a
 * caller remembers.** A second call for a hostname this project already
 * holds is Vercel's 409, and the read below turns it into the same
 * `attached` answer the first call gave — so the setup submit, a later
 * health check and a retry after a failure all converge on one domain
 * entry and never on two.
 *
 * The certificate needs no call of ours: Vercel issues it once the record
 * resolves, which is the same moment `verified` turns true.
 */
export async function addProjectDomain(hostname: string): Promise<DomainState> {
  const held = credentials();
  if (held === null) return { ok: false, because: "not_configured" };

  const outcome = await safeFetch(`${VERCEL_API}${ADD_PATH(held.projectId)}`, {
    method: "POST",
    respectRobots: false,
    headers: {
      Authorization: authorization(held.token),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: hostname }),
  });

  if (!outcome.ok) return { ok: false, because: "no_answer" };

  if (outcome.status >= 200 && outcome.status < 300) {
    return { ok: true, attached: true, verified: verifiedIn(parseJson(outcome.html)) };
  }

  // A conflict is either our own project holding it already — the
  // idempotent case — or somebody else's. Only the read can tell, and it is
  // the read that decides, never the status alone.
  if (outcome.status === CONFLICT) return projectDomainState(hostname);

  return { ok: false, because: "no_answer" };
}

/**
 * What this project's domain list already says about the hostname.
 *
 * The state the destination row records comes from here: it is the vendor's
 * own answer about its own list, never an inference from what we sent.
 */
export async function projectDomainState(hostname: string): Promise<DomainState> {
  const held = credentials();
  if (held === null) return { ok: false, because: "not_configured" };

  const outcome = await safeFetch(`${VERCEL_API}${READ_PATH(held.projectId, hostname)}`, {
    respectRobots: false,
    headers: { Authorization: authorization(held.token), Accept: "application/json" },
  });

  if (!outcome.ok) return { ok: false, because: "no_answer" };
  if (outcome.status >= 200 && outcome.status < 300) {
    return { ok: true, attached: true, verified: verifiedIn(parseJson(outcome.html)) };
  }
  // The project does not hold it. Where the add call has just been refused
  // with a conflict, that means another project does — the one refusal a
  // customer could act on, and the only place this module says so.
  return { ok: false, because: "elsewhere" };
}
