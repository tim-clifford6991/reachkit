// BUILD §9 — the authenticated REST calls to a customer's own WordPress, and the one place the application password is
// in memory. Every byte leaves through `safeFetch` (SSRF-guarded, DNS-pinned, size-capped); a `fetch(` here fails `client.test.ts`.
// The password lives for one call, composed into one `Authorization` header and never logged, returned, thrown or
// stored; `safeFetch` logs no header, so §9's "never logged" is the seam's property.
// Robots checking is off (BP-048 rule 1.1): `robots.txt` governs crawling, not an API the site's owner authorised.
// This module classifies nothing; `errors.ts` turns every answer into a `FailureReason`.
import { WORDPRESS } from "@/lib/config/constants";
import { safeFetch } from "@/lib/egress";

/** `destinations.config` for WordPress, sealed at rest and decrypted for one call. */
export interface WordPressConfig {
  /** The customer's site root. The REST root is derived, never stored twice. */
  baseUrl: string;
  username: string;
  /** Present only in memory, only inside one call. */
  applicationPassword: string;
}

/** What one call did. `ok: true` means the site answered, with any status, never a success: an answer against a silence
 *  is what `already_gone` and `unreachable` rest on (ADR-084 decision 4). `body` is parsed JSON or `null`; the raw text,
 *  the vendor payload, is not carried. */
export type WordPressAnswer =
  | { ok: true; status: number; body: unknown }
  | { ok: false; transport: TransportFailure };

/** Why no answer came back: `safeFetch`'s reasons an authenticated API call can produce. */
export type TransportFailure =
  | "dns"
  | "refused"
  | "timeout"
  | "too_large"
  | "blocked_by_policy";

/** The REST root, derived from `baseUrl` at every call and held nowhere. */
export function restRoot(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${WORDPRESS.restBase}`;
}

/** The only place the credential is a string; not exported, as a header a caller could build it could log. */
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
    // `robots.txt` does not govern an API its administrator authorised.
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
    // Robots is off, and a redirect chain that never settles is a refusal: both mean nothing came back.
    const transport: TransportFailure =
      outcome.reason === "robots_disallowed" || outcome.reason === "status"
        ? "refused"
        : outcome.reason;
    return { ok: false, transport };
  }

  return { ok: true, status: outcome.status, body: parseJson(outcome.html) };
}

/** The body as JSON, or `null`; a non-JSON answer is still an answer, for `errors.ts` to read. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ── The call shapes, and no others ──────────────────────────────────────
// No "publish this post" call: the create is the one call that publishes (ADR-084 decision 1). `setPostDraft` writes
// `draft` only and `updatePost` no status, by their literal types, so no create-then-publish can be composed here.

/** The REST index: is this WordPress REST, does the credential reach it, which SEO plugins (`seo.ts`). */
export function readRestIndex(cfg: WordPressConfig): Promise<WordPressAnswer> {
  return call(cfg, "/");
}

/** The credential's own account; `context=edit` is what returns the capability map. */
export function readSelf(cfg: WordPressConfig): Promise<WordPressAnswer> {
  return call(cfg, "/wp/v2/users/me?context=edit");
}

/** Candidates for a marker, bounded; `status=any` as a lost post may be in any state, `context=edit` for the raw content. */
export function searchPosts(cfg: WordPressConfig, marker: string): Promise<WordPressAnswer> {
  const query = new URLSearchParams({
    search: marker,
    status: "any",
    context: "edit",
    per_page: String(WORDPRESS.markerSearchLimit),
  });
  return call(cfg, `/wp/v2/posts?${query.toString()}`);
}

/** One page of the site's posts, newest first, for the known-content index: all posts, not only ours, drafts included,
 *  since "does the site cover this topic" is mostly the customer's. `content` is read for headings only; no body is stored. */
export function listPosts(
  cfg: WordPressConfig,
  a: { page: number; perPage: number }
): Promise<WordPressAnswer> {
  const query = new URLSearchParams({
    status: "any",
    context: "edit",
    orderby: "date",
    order: "desc",
    page: String(a.page),
    per_page: String(a.perPage),
    _fields: "id,link,slug,title,excerpt,content,date_gmt,status",
  });
  return call(cfg, `/wp/v2/posts?${query.toString()}`);
}

/** One post by id, as its author sees it. */
export function readPost(cfg: WordPressConfig, postId: string): Promise<WordPressAnswer> {
  return call(cfg, `/wp/v2/posts/${encodeURIComponent(postId)}?context=edit`);
}

/** Candidates at a known address: a customer's own page has no marker, so its slug is the only handle. */
export function findPostBySlug(cfg: WordPressConfig, slug: string): Promise<WordPressAnswer> {
  const query = new URLSearchParams({
    slug,
    status: "any",
    context: "edit",
    per_page: String(WORDPRESS.markerSearchLimit),
  });
  return call(cfg, `/wp/v2/posts?${query.toString()}`);
}

/** Rewrites an existing post (§7's third asset kind); it accepts no `status`, so it cannot raise or take down a page. */
export function updatePost(
  cfg: WordPressConfig,
  postId: string,
  fields: Readonly<{
    title?: string;
    content?: string;
    meta?: Readonly<Record<string, unknown>>;
  }>
): Promise<WordPressAnswer> {
  return call(cfg, `/wp/v2/posts/${encodeURIComponent(postId)}`, {
    method: "POST",
    json: fields,
  });
}

/** The one create call: status, SEO fields, stamp and marker in one request (ADR-084 decision 1); the adapter composes it. */
export function createPost(
  cfg: WordPressConfig,
  post: Readonly<Record<string, unknown>>
): Promise<WordPressAnswer> {
  return call(cfg, "/wp/v2/posts", { method: "POST", json: post });
}

/** Returns a post to draft, the one field `unpublish` writes into a post we made live (ADR-084 decision 4); it cannot publish. */
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

/** The stamp's term, created; a refusal is `stampApplied: false` on a delivered page (ADR-083 decision 4), never a failure. */
export function createTag(
  cfg: WordPressConfig,
  slug: string,
  name: string
): Promise<WordPressAnswer> {
  return call(cfg, "/wp/v2/tags", { method: "POST", json: { slug, name } });
}
