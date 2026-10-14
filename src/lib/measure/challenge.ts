// SPEC §2 (issue 1379) — a bot-protection page is not the site.
//
// A site behind bot protection can answer a reader it does not trust with a
// page of the protection's own: a challenge ("Just a moment…"), a captcha,
// or a block ("Sorry, you have been blocked"). That page has a title, a few
// headings, a `noindex` and some text, and none of it is the site's. This
// module is the one place that tells such a page from the site's own, from
// the response alone: its status, the headers the protection sets, and what
// the body holds.
//
// **Two strengths of evidence.** A protection's script and cookies are also
// on the pages it lets through (`/cdn-cgi/challenge-platform/` is injected
// into ordinary Cloudflare pages, `_Incapsula_Resource` into ordinary
// Imperva ones), so a body marker counts only on a response with a
// refusing status. A header that states the mitigation, the challenge's own
// title, and the few captcha pages served with a 200 in place of the site
// count on any status.
//
// Under-report, never over-report: a real page read as a challenge would
// leave a customer's site unmeasured, so every rule needs the protection's
// own words or headers, and a status alone decides nothing.
import { visibleText } from "./parse";

/** The `because` of an on-page read that met a protection's page: the
 *  report reads it to say why the site's own pages are unmeasured. */
export const BOT_PROTECTION = "bot_protection";

export type ProtectionVendor =
  | "Cloudflare"
  | "Akamai"
  | "DataDome"
  | "PerimeterX"
  | "Imperva"
  | "Sucuri"
  | "AWS WAF"
  | "Vercel"
  | "F5";

/** The response headers the detector reads, lowercased. Kept with a stored
 *  document (`own-fetch.ts`) so a read served from the cache is judged on
 *  the same evidence as the read that made it. */
export const CHALLENGE_HEADERS = Object.freeze([
  "server",
  "cf-mitigated",
  "x-vercel-mitigated",
  "x-amzn-waf-action",
  "x-datadome",
  "x-sucuri-block",
  "x-iinfo",
  // Issue 1427: when a refusing server asks to be asked again.
  "retry-after",
] as const);

export interface ChallengeInput {
  status: number;
  html: string;
  /** Lowercased names. Absent on a document stored before issue 1379. */
  headers?: Readonly<Record<string, string>> | undefined;
}

/** A page of the protection's own carries little text. The sage.com block
 *  page of 2026-10-09 held 763 visible characters. */
const SPARSE_CHARS = 1200;

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;

/** A header that states the mitigation itself, on any status. */
function fromHeaders(headers: Readonly<Record<string, string>>): ProtectionVendor | null {
  if (/challenge/i.test(headers["cf-mitigated"] ?? "")) return "Cloudflare";
  if (/challenge/i.test(headers["x-vercel-mitigated"] ?? "")) return "Vercel";
  if (/challenge|captcha/i.test(headers["x-amzn-waf-action"] ?? "")) return "AWS WAF";
  if ((headers["x-sucuri-block"] ?? "") !== "") return "Sucuri";
  return null;
}

/** The title a protection gives its own page. No site titles its home page
 *  with one of these. */
const TITLES: readonly (readonly [RegExp, ProtectionVendor])[] = [
  [/^just a moment\b/i, "Cloudflare"],
  [/^attention required!?\s*\|\s*cloudflare$/i, "Cloudflare"],
  [/^access denied\s*\|\s*.*used cloudflare to restrict access$/i, "Cloudflare"],
  [/^sucuri website firewall\b/i, "Sucuri"],
  [/^access to this page has been denied\.?$/i, "PerimeterX"],
  [/^pardon our interruption\b/i, "Imperva"],
];

/** What a protection's own page holds, read on a refusing status only:
 *  the same scripts are on the pages a protection lets through. */
const REFUSED_BODIES: readonly (readonly [RegExp, ProtectionVendor])[] = [
  [/captcha-delivery\.com|datadome/i, "DataDome"],
  [/px-captcha|_pxAppId|captcha\.px-cdn\.net|perimeterx/i, "PerimeterX"],
  [/_Incapsula_Resource|incapsula incident id/i, "Imperva"],
  [/sucuri website firewall|cloudproxy@sucuri/i, "Sucuri"],
  [/errors\.edgesuite\.net/i, "Akamai"],
  [/awswaf/i, "AWS WAF"],
  [/the requested url was rejected\. please consult with your administrator/i, "F5"],
  // Last: Cloudflare's script is on the refusals of every site behind it.
  [/\/cdn-cgi\/challenge-platform\/|cf-error-details|cf_chl_opt|cf-browser-verification|checking your browser before accessing/i, "Cloudflare"],
];

/** The few a protection serves with a 200: a captcha or an incident page in
 *  place of the site. Read only where the page has almost no text. */
const SPARSE_BODIES: readonly (readonly [RegExp, ProtectionVendor])[] = [
  [/incapsula incident id/i, "Imperva"],
  [/captcha-delivery\.com/i, "DataDome"],
  [/px-captcha/i, "PerimeterX"],
  [/the requested url was rejected\. please consult with your administrator/i, "F5"],
];

/** A status a protection refuses with. 202 is AWS WAF's challenge. */
function refuses(status: number): boolean {
  return status === 202 || status >= 400;
}

/** No protection's page seen so far was a tenth of this: the largest
 *  fixture is under 6 kB. */
const CHALLENGE_MAX_BYTES = 100_000;

/**
 * Whether a response could be a protection's page, from what a ledger read
 * can ask without the document's body (issue 1383): a refusing status, a
 * header that states the mitigation, or a small document. `challengeOf`
 * decides; this only spares the read of a large page the site served
 * itself.
 */
export function couldBeChallenge(a: { status: number; bytes: number; headers?: Readonly<Record<string, string>> }): boolean {
  return refuses(a.status) || fromHeaders(a.headers ?? {}) !== null || a.bytes <= CHALLENGE_MAX_BYTES;
}

/**
 * The protection whose page this response is, or `null` where it is the
 * site's own page (or an error page of the site's own, which the caller
 * reads as it always has).
 */
export function challengeOf(a: ChallengeInput): ProtectionVendor | null {
  const headers = a.headers ?? {};
  const stated = fromHeaders(headers);
  if (stated !== null) return stated;

  const title = (TITLE_RE.exec(a.html)?.[1] ?? "").replace(/&#0?39;|&apos;/gi, "'").replace(/\s+/g, " ").trim();
  for (const [re, vendor] of TITLES) if (re.test(title)) return vendor;

  if (refuses(a.status)) {
    for (const [re, vendor] of REFUSED_BODIES) if (re.test(a.html)) return vendor;
    // Akamai's refusal names itself only in the `server` header.
    if (/akamaighost/i.test(headers.server ?? "") && /^access denied$/i.test(title)) return "Akamai";
    return null;
  }
  if (visibleText(a.html).length >= SPARSE_CHARS) return null;
  for (const [re, vendor] of SPARSE_BODIES) if (re.test(a.html)) return vendor;
  return null;
}

/**
 * SPEC §2 (issue 1427) — what a read answered in place of the site's page.
 *
 * A protection's page (above) is one kind. The other is an answer that is
 * no document at all: an error status (a 429 rate limit, a 403 block, a
 * 404, a 503), or a 2xx whose body is empty, a bare string in place of a
 * page (`local_rate_limited`), or a rate-limit message. tattly.com's
 * profile was read off exactly that string on 2026-10-14 and named a
 * "residential proxy service" whose brand was `local_rate_limited`.
 *
 * The one detector for the score and the profile both: `challengeOf` is
 * asked first, so a protection's page keeps its vendor and its rendered
 * read.
 */
export type NotTheSite =
  | { kind: "protection"; vendor: ProtectionVendor }
  | {
      kind: "error";
      status: number;
      /** How long the server asked to be left, where it said (`Retry-After`). */
      retryAfterMs: number | null;
    };

const RATE_LIMIT_RE = /rate[\s_-]?limit|too many requests/i;
const MARKUP_RE = /<[a-z!]/i;

/** A body that is no page: nothing, a bare string, or a short page whose
 *  words are a rate limit's. A page of the site's own has markup, and one
 *  that mentions a rate limit in passing has more to say than that. A large
 *  page is never one: figma.com's, zendesk.com's and tally.so's own home
 *  pages carry "rate limit" in their scripts' strings. */
function noDocument(html: string): boolean {
  const body = html.trim();
  if (body === "") return true;
  if (!MARKUP_RE.test(body)) return body.length < SPARSE_CHARS;
  if (body.length > CHALLENGE_MAX_BYTES) return false;
  const text = visibleText(body);
  return text.length < SPARSE_CHARS && RATE_LIMIT_RE.test(text);
}

/** `Retry-After` as milliseconds: seconds, or an HTTP date. */
function retryAfterOf(headers: Readonly<Record<string, string>>, readAt: number): number | null {
  const value = (headers["retry-after"] ?? "").trim();
  if (value === "") return null;
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - readAt);
}

/** What this response is in place of the site's page, or `null` where it is
 *  the site's page. `readAt` dates a `Retry-After` given as a date. */
export function notTheSiteOf(a: ChallengeInput & { readAt?: string }): NotTheSite | null {
  const vendor = challengeOf(a);
  if (vendor !== null) return { kind: "protection", vendor };
  if (a.status < 400 && !noDocument(a.html)) return null;
  const readAt = a.readAt === undefined ? Number.NaN : new Date(a.readAt).getTime();
  return { kind: "error", status: a.status, retryAfterMs: retryAfterOf(a.headers ?? {}, Number.isNaN(readAt) ? Date.now() : readAt) };
}

/** What a challenge page's title leaves as a "site name" once the page half
 *  is dropped (`site-profile/site-name.ts`): the vendor, or the title whole. */
const NOT_A_COMPANY: ReadonlySet<string> = new Set([
  "cloudflare",
  "akamai",
  "datadome",
  "perimeterx",
  "imperva",
  "incapsula",
  "sucuri",
  "sucuri website firewall",
  "just a moment...",
  "just a moment…",
  "attention required!",
  "access denied",
  "pardon our interruption",
  "access to this page has been denied",
]);

/**
 * Whether a stored name is a protection's and not this site's: the name a
 * challenge page's title gave a site read before issue 1379. The vendor's
 * own site keeps its name.
 */
export function isProtectionName(name: string, domain: string): boolean {
  const key = name.replace(/\s+/g, " ").trim().toLowerCase();
  if (!NOT_A_COMPANY.has(key)) return false;
  const brand = (domain.replace(/^www\./, "").split(".")[0] ?? "").toLowerCase();
  return brand === "" || !key.replace(/\s/g, "").startsWith(brand);
}
