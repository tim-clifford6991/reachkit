// BUILD §9 — the authenticated REST calls to a customer's own WordPress,
// and the one place the application password is in memory.
//
// Every byte leaving this module goes through `safeFetch` — SSRF-guarded,
// DNS-pinned, size-capped — and there is no other door: a `fetch(` here is
// a lint error and the assertion in `client.test.ts` reads this file's own
// source for one.
//
// **The application password exists for the duration of one call.** It
// arrives in the `WordPressConfig` the sealed-credential seam
// (`destinations/config`) hands the adapter, it is composed into one
// `Authorization` header, and nothing here logs it, returns it, throws with
// it or stores it. `safeFetch` logs five fields — host, reason, status,
// bytes, duration — and no header is among them, so §9's "never logged" is
// a property of the seam rather than care taken at each call site.
//
// **Robots checking is off, deliberately** (BP-048's stated rule 1.1
// choice). These are authenticated API calls to a site whose administrator
// gave us a credential for exactly this; `robots.txt` governs crawling, not
// an API the site's own owner authorised. Leaving it on would let a
// customer's own `Disallow: /` stop the publishing they are paying for.
//
// **This module classifies nothing.** Every call returns what the site did
// — an HTTP answer, or no answer at all — and `errors.ts` is the one place
// that turns either into a `FailureReason`. The vendor payload stops there.
//
// The archived plan is WO-236.
import { WORDPRESS } from "@/lib/config/constants";
import { safeFetch } from "@/lib/egress";

/** The shape `destinations.config` holds for a WordPress destination,
 *  sealed at rest and decrypted for the duration of one call. */
export interface WordPressConfig {
  /** The customer's site root. The REST root is derived, never stored twice. */
  baseUrl: string;
  username: string;
  /** Present only in memory, only inside one call. */
  applicationPassword: string;
}

/**
 * What one call to the customer's site did.
 *
 * `ok: true` means the site answered — with any status, including 401 and
 * 500. That is not a success and this module does not say it is: a status
 * is an answer, and telling an answer apart from a silence is the whole
 * distinction `already_gone` and `unreachable` rest on (ADR-082, carried
 * forward by ADR-084 Decision 4).
 *
 * `body` is the parsed JSON, or `null` where what came back was not JSON.
 * The raw text is not carried: it is the vendor payload, and it has no
 * route to a screen, a mail or an export.
 */
export type WordPressAnswer =
  | { ok: true; status: number; body: unknown }
  | { ok: false; transport: TransportFailure };

/** Why no answer came back. `safeFetch`'s own reasons, narrowed to the
 *  ones an authenticated API call can produce, plus `unreadable` for a
 *  200 whose body is not the JSON a REST API is defined to return. */
export type TransportFailure =
  | "dns"
  | "refused"
  | "timeout"
  | "too_large"
  | "blocked_by_policy";

/** The REST root for a site. Derived at every call from `baseUrl` and held
 *  nowhere: two copies of an address are two addresses that can disagree. */
export function restRoot(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${WORDPRESS.restBase}`;
}

/** The one composition of the credential, and the only place it is a
 *  string. Not exported: nothing outside this file needs it, and a header
 *  a caller could build is a header a caller could log. */
function authorization(cfg: WordPressConfig): string {
  const pair = `${cfg.username}:${cfg.applicationPassword}`;
  return `Basic ${Buffer.from(pair, "utf8").toString("base64")}`;
}

async function call(
  cfg: WordPressConfig,
  path: string,
  init?: { method: "POST"; json: unknown }
): Promise<WordPressAnswer> {
  const outcome = await safeFetch(`${restRoot(cfg.baseUrl)}${path}`, {
    // The site's own `robots.txt` does not govern an API its administrator
    // authorised us against — see the module header.
    respectRobots: false,
    headers:
      init === undefined
        ? { Authorization: authorization(cfg), Accept: "application/json" }
        : {
            Authorization: authorization(cfg),
            Accept: "application/json",
            "Content-Type": "application/json",
          },
    ...(init === undefined ? {} : { method: init.method, body: JSON.stringify(init.json) }),
  });

  if (!outcome.ok) {
    // `robots_disallowed` and `status` cannot arise here — robots checking
    // is off, and a redirect chain that never settles is the site refusing
    // to answer. Both fold into the reasons that mean the same thing to a
    // caller: nothing came back.
    const transport: TransportFailure =
      outcome.reason === "robots_disallowed" || outcome.reason === "status"
        ? "refused"
        : outcome.reason;
    return { ok: false, transport };
  }

  return { ok: true, status: outcome.status, body: parseJson(outcome.html) };
}

/** The body as JSON, or `null`. A parse failure is not an error arm: a
 *  site that answered with something other than JSON answered, and what
 *  that means is `errors.ts`'s to say. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ── The five call shapes, and no sixth ──────────────────────────────────
//
// There is deliberately no "publish this post" call. ADR-084 Decision 1
// makes the create the one call that publishes, and a status-write that
// could raise a draft to `publish` is exactly the second half of the
// two-step that ruling forbids. `setPostStatus` below writes `draft` and
// nothing else — its type says so — so no create-then-publish sequence can
// be composed out of this file.

/** The REST index. One read, and the answer to three questions: is this a
 *  WordPress REST endpoint at all, does the credential reach it, and which
 *  SEO plugins are installed (`seo.ts` reads the namespaces). */
export function readRestIndex(cfg: WordPressConfig): Promise<WordPressAnswer> {
  return call(cfg, "/");
}

/** The credential's own account, with its capabilities. `context=edit` is
 *  what makes WordPress return the capability map at all — without it the
 *  answer is the public profile and carries nothing to read. */
export function readSelf(cfg: WordPressConfig): Promise<WordPressAnswer> {
  return call(cfg, "/wp/v2/users/me?context=edit");
}

/** Candidates for a marker. Bounded, `status=any` because a post we lost
 *  the answer to may be in any state, `context=edit` because the raw
 *  content is where the marker lives and the rendered content is not. */
export function searchPosts(cfg: WordPressConfig, marker: string): Promise<WordPressAnswer> {
  const query = new URLSearchParams({
    search: marker,
    status: "any",
    context: "edit",
    per_page: String(WORDPRESS.markerSearchLimit),
  });
  return call(cfg, `/wp/v2/posts?${query.toString()}`);
}

/** One post by id, as its author sees it. */
export function readPost(cfg: WordPressConfig, postId: string): Promise<WordPressAnswer> {
  return call(cfg, `/wp/v2/posts/${encodeURIComponent(postId)}?context=edit`);
}

/** **The one create call**, carrying the status, the SEO fields, the stamp
 *  and the marker in the same request (ADR-084 Decision 1). Its body is
 *  composed by the adapter; this file makes the request and nothing else. */
export function createPost(
  cfg: WordPressConfig,
  post: Readonly<Record<string, unknown>>
): Promise<WordPressAnswer> {
  return call(cfg, "/wp/v2/posts", { method: "POST", json: post });
}

/** Returns a post to draft — the one field `unpublish` writes into a post
 *  ReachKit itself made live (REQ-060's non-goals; ADR-081/082's ruling as
 *  ADR-084 Decision 4 carries it). The literal type is the guard: this
 *  function cannot be asked to publish anything. */
export function setPostDraft(cfg: WordPressConfig, postId: string): Promise<WordPressAnswer> {
  return call(cfg, `/wp/v2/posts/${encodeURIComponent(postId)}`, {
    method: "POST",
    json: { status: "draft" },
  });
}

/** The stamp's term, looked up by its slug. */
export function findTag(cfg: WordPressConfig, slug: string): Promise<WordPressAnswer> {
  const query = new URLSearchParams({ slug, per_page: "1" });
  return call(cfg, `/wp/v2/tags?${query.toString()}`);
}

/** The stamp's term, created. A credential that may not create a term
 *  answers with a status, and `stampApplied: false` is the delivered
 *  page's honest record of it (ADR-083 Decision 4) — never a failed
 *  delivery. */
export function createTag(
  cfg: WordPressConfig,
  slug: string,
  name: string
): Promise<WordPressAnswer> {
  return call(cfg, "/wp/v2/tags", { method: "POST", json: { slug, name } });
}
