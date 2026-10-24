// BUILD §5 — the Vercel Domains API, and the one place its token is read.
// A CNAME to a project that does not list the hostname gets Vercel's 404, so adding it on save is what makes the record serve.
// The token goes into one `Authorization` header and is never logged, returned, thrown or stored; `safeFetch` logs no header.
// `respectRobots: false`: `robots.txt` governs crawling, not an API we hold a credential for.
// The result has no member a vendor message could travel in, so a failure stays the destination's own health state (§5).
// Absent bindings are an answer, not a throw: the destination stays "waiting for DNS" instead of failing the submit.
import { env } from "@/lib/config/env";
import { safeFetch } from "@/lib/egress";

/** Declared beside its one caller: an address a vendor owns is not one of this product's pins. */
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

/** Read per call and never held. The team is optional: a personal account's project needs none. */
function credentials(): { token: string; projectId: string; teamId: string | null } | null {
  const token = env.VERCEL_API_TOKEN;
  const projectId = env.VERCEL_PROJECT_ID;
  if (token === undefined || projectId === undefined) return null;
  return { token, projectId, teamId: env.VERCEL_TEAM_ID ?? null };
}

/** A team-owned project answers 403 to a call that does not name its team, so `?teamId=` rides on every call. */
function urlFor(path: string, teamId: string | null): string {
  const url = new URL(path, VERCEL_API);
  if (teamId !== null) url.searchParams.set("teamId", teamId);
  return url.toString();
}

/** Yes or no, never the values: a deployment that cannot verify any host says so instead of reading as a vendor that did not answer. */
export function domainsConfigured(): boolean {
  return credentials() !== null;
}

/** Not exported: a header a caller could build is a header a caller could log. */
function authorization(token: string): string {
  return `Bearer ${token}`;
}

/** A body without the field is `false`, which holds the customer at "waiting for DNS" rather than claiming a live page. */
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
 * Adds the hostname to this project's domain list, idempotently: a repeat is Vercel's 409, which the read turns into the
 * same `attached` answer. Vercel issues the certificate itself when `verified` turns true.
 */
export async function addProjectDomain(hostname: string): Promise<DomainState> {
  const held = credentials();
  if (held === null) return { ok: false, because: "not_configured" };

  const outcome = await safeFetch(urlFor(ADD_PATH(held.projectId), held.teamId), {
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

  // A conflict is our own project or another one; only the read can tell.
  if (outcome.status === CONFLICT) return projectDomainState(hostname);

  return { ok: false, because: "no_answer" };
}

/** The vendor's own answer about its list, never an inference from what we sent. */
export async function projectDomainState(hostname: string): Promise<DomainState> {
  const held = credentials();
  if (held === null) return { ok: false, because: "not_configured" };

  const outcome = await safeFetch(urlFor(READ_PATH(held.projectId, hostname), held.teamId), {
    respectRobots: false,
    headers: { Authorization: authorization(held.token), Accept: "application/json" },
  });

  if (!outcome.ok) return { ok: false, because: "no_answer" };
  if (outcome.status >= 200 && outcome.status < 300) {
    return { ok: true, attached: true, verified: verifiedIn(parseJson(outcome.html)) };
  }
  // Not ours. After a conflict that means another project holds it, the one refusal a customer can act on.
  return { ok: false, because: "elsewhere" };
}
